const legacyProvider = require("./mockProvider");
const clinicalKnowledge = require("../clinicalKnowledge");
const clinicalSources = require("../clinical-sources.json");

const SAFETY = [
  "Это не диагноз.",
  "Не заменяет консультацию врача.",
  "Не содержит назначений лечения."
];

function normalize(text) {
  return String(text || "").trim().toLowerCase().replace(/ё/g, "е");
}

function compact(text) {
  return normalize(text)
    .replace(/d/g, "д")
    .replace(/[^a-zа-я0-9]+/gi, "");
}

function flagText(flag) {
  if (flag === "high") return "выше референсного диапазона";
  if (flag === "low") return "ниже референсного диапазона";
  if (flag === "normal") return "в референсном диапазоне";
  return "требует интерпретации";
}

function valueText(context = {}) {
  const value = context.value ?? "";
  const unit = context.unit || "";
  return `${value} ${unit}`.replace(/\s+/g, " ").trim();
}

function sourceByKey(key) {
  return clinicalSources.sources?.[key] || null;
}

function registryDocument(document = {}) {
  const title = normalize(document.title);
  return Object.values(clinicalSources.documents || {}).find(item => normalize(item.title) === title) || null;
}

function isLoincCode(value) {
  return /^\d{1,5}-\d$/.test(String(value || "").trim());
}

function sourceLines(knowledge, context = {}) {
  const lines = [];
  const minzdrav = sourceByKey("minzdrav");
  const helix = sourceByKey("helix");
  const loinc = sourceByKey("loinc");

  if (knowledge.documents?.length) {
    knowledge.documents.forEach(document => {
      const registry = registryDocument(document);
      const details = [document.year || registry?.year, document.id ? `ID ${document.id}` : registry?.catalog_id ? `ID ${registry.catalog_id}` : ""]
        .filter(Boolean)
        .join(", ");
      const url = registry?.url || minzdrav?.url || "https://cr.minzdrav.gov.ru/";
      lines.push(`- ${minzdrav?.label || "Клинические рекомендации Минздрава России"} «${document.title}»${details ? ` (${details})` : ""}: ${url}`);
    });
  }

  if (helix) lines.push(`- ${helix.label}: ${helix.url}`);
  if (loinc) {
    const loincUrl = isLoincCode(context.test_code) ? `https://loinc.org/${String(context.test_code).trim()}/` : loinc.url;
    lines.push(`- ${loinc.label}: ${loincUrl}`);
  }
  return lines;
}

function patientIntro(data = {}) {
  const patient = data.patient || {};
  const name = legacyProvider.firstName(patient);
  const details = [];
  if (patient.age) details.push(`${patient.age} лет`);
  if (patient.sex) details.push(`пол — ${legacyProvider.sexText(patient.sex)}`);
  return { name, details: details.join(", ") };
}

function labToContext(lab = {}) {
  return {
    test_code: lab.code || null,
    test_name: lab.name || null,
    value: lab.latestValue ?? lab.value ?? null,
    unit: lab.unit || null,
    flag: lab.flag || null,
    report_date: lab.latestDate || lab.date || null,
    reference_low: lab.reference_low ?? lab.referenceLow ?? lab.ref_low ?? null,
    reference_high: lab.reference_high ?? lab.referenceHigh ?? lab.ref_high ?? null,
    reference: lab.reference || lab.referenceText || lab.reference_text || null,
    history: Array.isArray(lab.history)
      ? lab.history.map(row => ({ date: row.date, value: row.value, flag: row.flag }))
      : []
  };
}

function scoreLabMention(message, lab = {}) {
  const text = normalize(message);
  const compactText = compact(message);
  const candidates = [lab.name, lab.code]
    .filter(Boolean)
    .flatMap(value => {
      const normalized = normalize(value);
      const baseName = normalized.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
      return [normalized, baseName, compact(normalized), compact(baseName)].filter(Boolean);
    });

  let score = 0;
  candidates.forEach(candidate => {
    const c = normalize(candidate);
    const cc = compact(candidate);
    if (c.length >= 3 && text.includes(c)) score = Math.max(score, 100 + c.length);
    if (cc.length >= 3 && compactText.includes(cc)) score = Math.max(score, 90 + cc.length);
  });

  const name = normalize(lab.name);
  if (/d[- ]?димер|d[- ]?dimer/i.test(name) && /(д\s*[-]?\s*димер|ддимер|d\s*[-]?\s*dimer)/i.test(text)) score = Math.max(score, 160);
  return score;
}

async function resolveMentionedLab(message, patientId) {
  if (!patientId || !String(message || "").trim()) return null;
  let data;
  try {
    data = await legacyProvider.buildPatientSummaryContext(patientId);
  } catch (error) {
    return null;
  }
  const ranked = (data.labs || [])
    .map(lab => ({ lab, score: scoreLabMention(message, lab) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.lab || null;
}

async function evidenceAnswer(context = {}, patientId) {
  if (!context.test_name) return null;
  const knowledge = clinicalKnowledge.knowledgeFor(context);

  let data = { patient: {}, labs: [] };
  if (patientId) {
    try {
      data = await legacyProvider.buildPatientSummaryContext(patientId);
    } catch (error) {
      data = { patient: {}, labs: [] };
    }
  }
  const patient = patientIntro(data);
  const prefix = patient.name ? `${patient.name}, ` : "";

  if (!knowledge) {
    return {
      mode: "result_explanation",
      answer: [
        `${prefix}${context.test_name}: ${valueText(context) || "значение не передано"} — ${flagText(context.flag)}.`,
        patient.details ? `При разборе я учитываю данные профиля: ${patient.details}.` : "",
        "Для этого показателя в подключённой доказательной базе пока нет отдельного сценария, поэтому я не буду придумывать причины отклонения.",
        "Если расскажете, зачем сдавали анализ и есть ли жалобы, я помогу сформулировать полезные вопросы врачу."
      ].filter(Boolean).join("\n"),
      actions: [],
      basis: {
        chain: "evidence_result_explanation",
        chainLabel: "Разбор только по подключённой доказательной базе",
        indicator: context.test_name,
        patientData: {
          patient: data.patient?.name || null,
          age: data.patient?.age || null,
          sex: legacyProvider.sexText(data.patient?.sex),
          test_code: context.test_code || null,
          test_name: context.test_name,
          value: context.value ?? null,
          unit: context.unit || null,
          flag: context.flag || null,
          report_date: context.report_date || context.date || null
        },
        source: "atlas_evidence_layer",
        sourceLabel: "Подключённая доказательная база Атласа",
        validationStatus: "Для показателя нет отдельного подтверждённого сценария — клинические выводы не сформированы"
      },
      safety: SAFETY
    };
  }

  const reference = knowledge.reference ? ` Референс: ${knowledge.reference}.` : "";
  const missing = data.labs?.length ? clinicalKnowledge.missingRelated(knowledge, data.labs) : [];
  const related = knowledge.related?.length
    ? `В подключённой документации этот блок рассматривают вместе с: ${knowledge.related.join(", ")}.`
    : "";
  const missingLine = missing.length
    ? `В ваших подключённых данных сейчас не найдено: ${missing.join(", ")}. Это не назначение анализов — этот список можно использовать как вопрос врачу.`
    : "";
  const historyCount = Array.isArray(context.history) ? context.history.length : 0;

  return {
    mode: "result_explanation",
    answer: [
      `${prefix}${context.test_name}: ${valueText(context) || "значение не передано"} — ${flagText(context.flag)}.${reference}`,
      historyCount > 1 ? `По этому показателю у вас есть ${historyCount} значения в динамике.` : "",
      knowledge.interpretation,
      related,
      missingLine,
      "Это справочное пояснение по подключённым документам, а не диагноз и не назначение лечения или обследования.",
      "Источники:",
      ...sourceLines(knowledge, context)
    ].filter(Boolean).join("\n"),
    actions: [],
    basis: {
      chain: "evidence_result_explanation",
      chainLabel: "Разбор результата по подключённой доказательной базе",
      indicator: context.test_name,
      patientData: {
        patient: data.patient?.name || null,
        age: data.patient?.age || null,
        sex: legacyProvider.sexText(data.patient?.sex),
        test_code: context.test_code || null,
        test_name: context.test_name,
        value: context.value ?? null,
        unit: context.unit || null,
        flag: context.flag || null,
        report_date: context.report_date || context.date || null,
        reference: knowledge.reference || null,
        missingRelated: missing
      },
      source: "atlas_evidence_layer",
      sourceLabel: knowledge.documents?.length
        ? `Клинические рекомендации Минздрава РФ · ${knowledge.documents[0].title}`
        : "Helixbook + LOINC",
      validationStatus: "Справочная интерпретация по подключённым источникам; не является диагнозом или назначением",
      sources: knowledge.sources,
      documents: knowledge.documents,
      group: knowledge.groupTitle,
      sourceRegistryVersion: clinicalSources.version
    },
    safety: SAFETY
  };
}

async function chat(payload = {}, patientId) {
  const mode = payload.mode || "";
  const message = normalize(payload.message);
  const asksAboutResult = /(показател|анализ|результат|референс|норм|выше|ниже|что значит|объясни|почему|влияет|связан|динамик|про|мой|моя|хочу узнать)/i.test(message);

  if (payload.context?.test_name && (asksAboutResult || mode === "result_explanation")) {
    return (await evidenceAnswer(payload.context || {}, patientId)) || legacyProvider.chat(payload, patientId);
  }

  const mentionedLab = await resolveMentionedLab(message, patientId);
  if (mentionedLab && asksAboutResult) {
    return (await evidenceAnswer(labToContext(mentionedLab), patientId)) || legacyProvider.chat(payload, patientId);
  }

  return legacyProvider.chat(payload, patientId);
}

module.exports = {
  chat,
  evidenceAnswer,
  resolveMentionedLab,
  buildPatientSummaryContext: legacyProvider.buildPatientSummaryContext
};
