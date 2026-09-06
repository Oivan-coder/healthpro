const legacyProvider = require("./mockProvider");
const clinicalKnowledge = require("../clinicalKnowledge");
const clinicalSources = require("../clinical-sources.json");

const SAFETY = [
  "Это не диагноз.",
  "Не заменяет консультацию врача.",
  "Не содержит назначений лечения."
];

function normalize(text) {
  return String(text || "").trim().toLowerCase();
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
  } else if (minzdrav) {
    lines.push(`- ${minzdrav.label}: ${minzdrav.url}`);
  }

  if (helix) lines.push(`- ${helix.label}: ${helix.url}`);

  if (loinc) {
    const loincUrl = isLoincCode(context.test_code)
      ? `https://loinc.org/${String(context.test_code).trim()}/`
      : loinc.url;
    lines.push(`- ${loinc.label}: ${loincUrl}`);
  }

  return lines;
}

async function evidenceAnswer(context = {}, patientId) {
  if (!context.test_name) return null;
  const knowledge = clinicalKnowledge.knowledgeFor(context);
  if (!knowledge) {
    return {
      mode: "result_explanation",
      answer: [
        `${context.test_name}: ${valueText(context) || "значение не передано"}; результат ${flagText(context.flag)}.`,
        "Для этого показателя в подключенной доказательной базе пока нет отдельного сценария, поэтому Атлас не будет додумывать клиническую интерпретацию.",
        "Можно обсудить результат с врачом с учетом жалоб, лекарств, подготовки к исследованию и динамики."
      ].join("\n"),
      basis: {
        chain: "evidence_result_explanation",
        chainLabel: "Разбор только по подключенной доказательной базе",
        indicator: context.test_name,
        patientData: {
          test_code: context.test_code || null,
          test_name: context.test_name,
          value: context.value ?? null,
          unit: context.unit || null,
          flag: context.flag || null,
          report_date: context.report_date || context.date || null
        },
        source: "atlas_evidence_layer",
        sourceLabel: "Подключенная доказательная база Атласа",
        validationStatus: "Для показателя нет валидированного отдельного сценария — клинические выводы не сформированы"
      },
      safety: SAFETY
    };
  }

  let patientLabs = [];
  if (patientId) {
    try {
      const summary = await legacyProvider.buildPatientSummaryContext(patientId);
      patientLabs = summary.labs || [];
    } catch (error) {
      patientLabs = [];
    }
  }

  const reference = knowledge.reference ? ` Референс: ${knowledge.reference}.` : "";
  const missing = patientLabs.length ? clinicalKnowledge.missingRelated(knowledge, patientLabs) : [];
  const missingLine = missing.length
    ? `В подключенных данных сейчас не найдено: ${missing.join(", ")}. Это не назначение анализов — этот список можно использовать как вопрос врачу.`
    : "";
  const related = knowledge.related?.length
    ? `В документации этот блок обычно оценивают вместе с: ${knowledge.related.join(", ")}.`
    : "";

  return {
    mode: "result_explanation",
    answer: [
      `${context.test_name}: ${valueText(context) || "значение не передано"} — ${flagText(context.flag)}.${reference}`,
      knowledge.interpretation,
      related,
      missingLine,
      "Это справочное пояснение по документам, а не диагноз и не назначение обследования или лечения.",
      "Источники:",
      ...sourceLines(knowledge, context)
    ].filter(Boolean).join("\n"),
    basis: {
      chain: "evidence_result_explanation",
      chainLabel: "Разбор результата по подключенной доказательной базе",
      indicator: context.test_name,
      patientData: {
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
        : "Клинические рекомендации Минздрава РФ + Helixbook + LOINC",
      validationStatus: "Справочная интерпретация по подключенным источникам; не является диагнозом или назначением",
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
  const asksAboutResult = /(показател|анализ|результат|референс|норм|выше|ниже|что значит|объясни)/i.test(message);

  if (mode === "result_explanation" || (payload.context?.test_name && asksAboutResult)) {
    return (await evidenceAnswer(payload.context || {}, patientId)) || legacyProvider.chat(payload, patientId);
  }

  return legacyProvider.chat(payload, patientId);
}

module.exports = {
  chat,
  evidenceAnswer,
  buildPatientSummaryContext: legacyProvider.buildPatientSummaryContext
};
