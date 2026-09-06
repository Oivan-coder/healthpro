const patientService = require("../../patientService");
const labService = require("../../labService");
const appointmentService = require("../../appointmentService");
const reportService = require("../../reportService");

const SAFETY = [
  "Это не диагноз.",
  "Не заменяет консультацию врача.",
  "Не содержит назначений лечения."
];

function normalize(text) {
  return String(text || "").trim().toLowerCase().replace(/ё/g, "е");
}

function firstName(patient = {}) {
  const raw = String(patient.name || patient.fullName || "").trim();
  if (!raw) return "";
  const parts = raw.split(/\s+/).filter(Boolean);
  return parts[1] || parts[0] || "";
}

function sexText(value) {
  const sex = normalize(value);
  if (["male", "m", "м", "муж", "мужской"].includes(sex)) return "мужской";
  if (["female", "f", "ж", "жен", "женский"].includes(sex)) return "женский";
  return value ? String(value) : "не указан";
}

function flagText(flag) {
  if (flag === "high") return "выше референсного диапазона";
  if (flag === "low") return "ниже референсного диапазона";
  if (flag === "normal") return "в референсном диапазоне";
  return "требует интерпретации";
}

function valueText(lab = {}) {
  return `${lab.latestValue ?? lab.value ?? ""} ${lab.unit || ""}`.replace(/\s+/g, " ").trim();
}

function patientDescriptor(patient = {}) {
  const parts = [];
  if (patient.age) parts.push(`${patient.age} лет`);
  if (patient.sex) parts.push(`пол — ${sexText(patient.sex)}`);
  return parts.join(", ");
}

function humanGroup(lab = {}) {
  const key = normalize(`${lab.code || ""} ${lab.name || ""} ${lab.group || ""}`);
  if (/(d[- ]?димер|d[- ]?dimer|мно|inr|ачтв|aptt|фибриноген|коагул)/i.test(key)) return "свёртываемость крови";
  if (/(гемоглоб|hgb|\bhb\b|эритроцит|rbc|гематокрит|hct|mcv|mch|mchc|rdw)/i.test(key)) return "общий анализ крови";
  if (/(лейкоцит|wbc|нейтрофил|лимфоцит|моноцит|эозинофил|базофил)/i.test(key)) return "общий анализ крови";
  if (/(17[- ]?он|прогестер|тестостер|эстрадиол|пролактин|фсг|лг|horm)/i.test(key)) return "гормональные показатели";
  if (/(алт|ast|alt|аст|ггт|ggt|билирубин|альбумин|печен)/i.test(key)) return "печёночные показатели";
  if (/(креатинин|egfr|скф|мочевин|цистатин)/i.test(key)) return "функция почек";
  if (/(глюкоз|hba1c|инсулин)/i.test(key)) return "углеводный обмен";
  if (/(холестерин|ldl|hdl|лпнп|лпвп|триглицер)/i.test(key)) return "липидный профиль";
  if (/(ттг|tsh|т4|ft4|т3|ft3|щитовид)/i.test(key)) return "щитовидная железа";
  if (/(crp|срб|соэ|прокальцитонин)/i.test(key)) return "маркеры воспаления";
  return lab.group || "другие показатели";
}

function formatLab(lab) {
  return `${lab.name}: ${valueText(lab)} — ${flagText(lab.flag)}`;
}

function buildBasis(chain, context, extra = {}) {
  return {
    chain,
    chainLabel: extra.chainLabel || "Справочный сценарий Атласа здоровья",
    indicator: context?.test_name || extra.indicator || null,
    patientData: context?.test_name ? {
      test_code: context.test_code || null,
      test_name: context.test_name,
      value: context.value ?? null,
      unit: context.unit || null,
      flag: context.flag || null,
      report_date: context.report_date || context.date || null
    } : extra.patientData || null,
    source: "atlas_patient_context",
    sourceLabel: extra.sourceLabel || "Данные пациента в Атласе здоровья",
    validationStatus: extra.validationStatus || "Справочный ответ; диагноз и назначения не формируются"
  };
}

function responseEnvelope(response, mode) {
  return { mode, ...response, safety: response.safety || SAFETY };
}

async function buildPatientSummaryContext(patientId) {
  const [summary, labReports, visits, reports, documents] = await Promise.all([
    patientService.getSummary(patientId),
    labService.getLabReports(patientId),
    appointmentService.getVisits(patientId),
    reportService.getReports(patientId),
    reportService.getDocuments(patientId)
  ]);
  return {
    patient: summary.patient || {},
    labs: summary.labs || [],
    abnormal: summary.abnormal || [],
    labReports: labReports || [],
    visits: visits || [],
    reports: reports || [],
    documents: documents || []
  };
}

function dynamicsCount(labs = []) {
  return labs.filter(lab => Array.isArray(lab.history) && lab.history.length > 1).length;
}

function latestDate(labs = []) {
  return labs.map(lab => lab.latestDate).filter(Boolean)[0] || "";
}

function compactPatientData(data) {
  return {
    patient: data.patient?.name || null,
    age: data.patient?.age || null,
    sex: sexText(data.patient?.sex),
    labReports: data.labReports.length,
    abnormal: data.abnormal.length,
    visits: data.visits.length,
    documents: data.documents.length + data.reports.length
  };
}

function shortSummaryAnswer(data) {
  const patient = data.patient || {};
  const name = firstName(patient);
  const intro = [name ? `${name},` : "", patientDescriptor(patient)].filter(Boolean).join(" ");
  const abnormal = data.abnormal.slice(0, 5);
  const dynCount = dynamicsCount(data.labs);
  const date = latestDate(data.labs);

  const lines = [];
  if (intro) lines.push(`${intro}${intro.endsWith(",") ? "" : "."}`);
  lines.push(data.abnormal.length
    ? `В последних анализах ${data.abnormal.length} ${data.abnormal.length === 1 ? "показатель выходит" : "показателей выходят"} за референсный диапазон.`
    : "По последним подключённым анализам отклонений от референсных диапазонов не видно.");
  if (abnormal.length) lines.push(`Сейчас в зоне внимания: ${abnormal.map(lab => lab.name).join(", ")}.`);
  if (dynCount) lines.push(`Повторные значения есть по ${dynCount} показателям — их уже можно смотреть в динамике.`);
  else lines.push("По текущим отклонениям повторных значений пока недостаточно для оценки динамики.");
  if (date) lines.push(`Последние результаты: ${date}.`);
  lines.push("Это справочная сводка, а не диагноз; приоритет зависит от жалоб, причины обследования, лекарств и условий сдачи анализов.");

  return {
    answer: lines.join("\n"),
    actions: [],
    basis: buildBasis("patient_summary", null, { patientData: compactPatientData(data), chainLabel: "Короткая сводка пациента" })
  };
}

function attentionAnswer(data) {
  const patient = data.patient || {};
  const name = firstName(patient);
  const abnormal = data.abnormal.slice(0, 6);
  if (!abnormal.length) {
    return {
      answer: `${name ? `${name}, ` : ""}по последним подключённым данным показателей вне референсного диапазона не видно.`,
      actions: [],
      basis: buildBasis("attention", null, { patientData: compactPatientData(data), chainLabel: "Что требует внимания" })
    };
  }

  const grouped = new Map();
  abnormal.forEach(lab => {
    const group = humanGroup(lab);
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group).push(formatLab(lab));
  });

  const lines = [
    `${name ? `${name}, ` : ""}сейчас вне референсного диапазона ${data.abnormal.length} показателей.`,
    ...Array.from(grouped.entries()).map(([group, labs]) => `- ${group}: ${labs.join("; ")}`),
    "По одним лабораторным значениям корректно ранжировать причины нельзя. Если скажете, зачем сдавали анализы и есть ли жалобы, я помогу сузить, что обсудить с врачом в первую очередь."
  ];
  return {
    answer: lines.join("\n"),
    actions: [],
    basis: buildBasis("attention", null, { patientData: compactPatientData(data), chainLabel: "Что требует внимания" })
  };
}

function doctorQuestionsAnswer(data, context) {
  const name = firstName(data.patient || {});
  const selected = context?.test_name ? ` по показателю «${context.test_name}»` : "";
  return {
    answer: [
      `${name ? `${name}, ` : ""}для разговора с врачом${selected} я бы подготовил 4 вопроса:`,
      "- какие из отклонений действительно значимы именно с учётом ваших жалоб и причины обследования;",
      "- могли ли лекарства, питание, физическая нагрузка или условия сдачи повлиять на результат;",
      "- какие показатели стоит оценивать вместе, а не по одному;",
      "- нужна ли врачу динамика или повторное исследование и при каких условиях.",
      "Я не назначаю обследования и лечение — это список вопросов для консультации."
    ].join("\n"),
    actions: [],
    basis: buildBasis("doctor_questions", context, { patientData: compactPatientData(data), chainLabel: "Подготовка вопросов врачу" })
  };
}

function missingDataAnswer(data) {
  const name = firstName(data.patient || {});
  return {
    answer: [
      `${name ? `${name}, ` : ""}для более полезного разбора мне сейчас больше всего не хватает контекста:`,
      "- зачем сдавали анализы и какие есть жалобы;",
      "- лекарства и добавки;",
      "- условия сдачи анализа;",
      "- важные диагнозы или состояния, если они уже установлены врачом.",
      "Сами результаты и ваш пол/возраст я уже вижу в Атласе."
    ].join("\n"),
    actions: [],
    basis: buildBasis("missing_context", null, { patientData: compactPatientData(data), chainLabel: "Недостающий контекст" })
  };
}

function casualAnswer(data, message) {
  const name = firstName(data.patient || {});
  const hi = /(привет|здравств|добрый|доброе)/i.test(message);
  const how = /(как дела|как ты|че как|что нового)/i.test(message);
  const otherTopic = /(поговорим|поговорить|о чем[- ]?то другом|не про анализ|другая тема|сменим тему)/i.test(message);

  let answer;
  if (otherTopic) {
    answer = "Конечно. Можем немного отвлечься от анализов — о чём хотите поговорить?";
  } else if (how) {
    answer = `${name ? `${name}, ` : ""}всё в порядке 🙂 Я на связи.`;
  } else if (hi) {
    answer = `${name ? `${name}, ` : ""}здравствуйте.`;
  } else {
    answer = "Я на связи.";
  }

  return {
    answer,
    actions: [],
    basis: buildBasis("casual", null, { patientData: compactPatientData(data), chainLabel: "Обычный диалог" })
  };
}

function resultAnswer(context, data) {
  if (!context?.test_name) {
    return {
      answer: "Назовите показатель в вопросе — я попробую найти его среди ваших результатов и разобрать именно его.",
      actions: [],
      basis: buildBasis("result_explanation", context)
    };
  }
  const name = firstName(data.patient || {});
  const historyCount = Array.isArray(context.history) ? context.history.length : 0;
  return {
    answer: [
      `${name ? `${name}, ` : ""}${context.test_name}: ${context.value ?? ""} ${context.unit || ""} — ${flagText(context.flag)}.`,
      historyCount > 1 ? `По этому показателю у вас есть ${historyCount} значения в динамике.` : "Повторных значений по этому показателю пока недостаточно для оценки динамики.",
      "Без подтверждённого сценария из подключённой базы я не буду придумывать причину отклонения."
    ].join("\n"),
    actions: [],
    basis: buildBasis("result_explanation", context, { patientData: compactPatientData(data), chainLabel: "Разбор результата" })
  };
}

function detectIntent(message, requestedMode, context) {
  const text = normalize(message);
  if (!text) return "empty";
  if (/^(привет|здравствуй|здравствуйте|добрый день|доброе утро|добрый вечер|как дела\??|как ты\??|че как\??|что нового\??)$/i.test(text)) return "casual";
  if (/(поговорим|поговорить|о чем[- ]?то другом|не про анализ|другая тема|сменим тему)/i.test(text)) return "casual";
  if (/(коротк.*свод|кратк.*свод|собери.*свод|сводк.*для врача|общая картина|что у меня по анализам)/i.test(text)) return "summary";
  if (/(что.*требует внимания|что.*важн|на что.*обратить|что.*не так|отклонен|вне.*диапаз|выше|ниже)/i.test(text) && !context?.test_name) return "attention";
  if (/(чего не хватает|каких данных|недостаточно данных|что уточнить)/i.test(text)) return "missing";
  if (/(вопрос.*врач|что обсудить.*врач|подготов.*врач|на прием)/i.test(text)) return "doctor_questions";
  if (context?.test_name && /(почему|что значит|объясни|влияет|связан|динамик|референс|показател|результат|анализ)/i.test(text)) return "result";
  if (requestedMode === "result_explanation" && context?.test_name) return "result";
  if (requestedMode === "doctor_questions" && /(врач|прием|вопрос|обсуд)/i.test(text)) return "doctor_questions";
  return "unknown";
}

async function chat(payload = {}, patientId) {
  const message = String(payload.message || "").trim();
  const context = payload.context || {};
  const requestedMode = payload.mode || "";
  const data = await buildPatientSummaryContext(patientId);
  const intent = detectIntent(message, requestedMode, context);

  if (intent === "casual") return responseEnvelope(casualAnswer(data, message), "assistant_chat");
  if (intent === "summary") return responseEnvelope(shortSummaryAnswer(data), "patient_summary");
  if (intent === "attention") return responseEnvelope(attentionAnswer(data), "patient_summary");
  if (intent === "missing") return responseEnvelope(missingDataAnswer(data), "doctor_questions");
  if (intent === "doctor_questions") return responseEnvelope(doctorQuestionsAnswer(data, context), "doctor_questions");
  if (intent === "result") return responseEnvelope(resultAnswer(context, data), "result_explanation");
  if (intent === "empty") {
    return responseEnvelope({
      answer: "Напишите вопрос своими словами. Я могу разобрать конкретный показатель, коротко свести анализы или просто поддержать короткий разговор.",
      actions: [],
      basis: buildBasis("empty_question", context)
    }, "assistant_chat");
  }

  return responseEnvelope({
    answer: "Я понял вопрос не до конца. Можно переформулировать его одной фразой — если речь о показателе из ваших анализов, просто назовите его.",
    actions: [],
    basis: buildBasis("clarification", context, { patientData: compactPatientData(data), chainLabel: "Уточнение запроса" })
  }, "assistant_chat");
}

module.exports = { chat, buildPatientSummaryContext, firstName, sexText };
