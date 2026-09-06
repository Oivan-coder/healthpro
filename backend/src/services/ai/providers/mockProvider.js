const patientService = require("../../patientService");
const labService = require("../../labService");
const appointmentService = require("../../appointmentService");
const reportService = require("../../reportService");
const patientHistoryService = require("../../patientHistoryService");

const SAFETY = [
  "Это не диагноз.",
  "Не заменяет консультацию врача.",
  "Не содержит назначений лечения."
];

function normalize(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[–—]/g, "-")
    .replace(/[^a-zа-я0-9%+./ -]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
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
  if (/(d[- ]?димер|ддимер|d[- ]?dimer|мно|inr|ачтв|aptt|фибриноген|коагул)/i.test(key)) return "свёртываемость крови";
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

function contextFromLab(lab) {
  if (!lab) return null;
  return {
    test_code: lab.code || null,
    test_name: lab.name,
    value: lab.latestValue,
    unit: lab.unit || null,
    flag: lab.flag || null,
    report_date: lab.latestDate || null,
    history: Array.isArray(lab.history)
      ? lab.history.map(row => ({ date: row.date, value: row.value, flag: row.flag }))
      : []
  };
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
  const [summary, labReports, visits, reports, documents, historyEvents] = await Promise.all([
    patientService.getSummary(patientId),
    labService.getLabReports(patientId),
    appointmentService.getVisits(patientId),
    reportService.getReports(patientId),
    reportService.getDocuments(patientId),
    patientHistoryService.list(patientId, 20).catch(() => [])
  ]);
  return {
    patient: summary.patient || {},
    labs: summary.labs || [],
    abnormal: summary.abnormal || [],
    labReports: labReports || [],
    visits: visits || [],
    reports: reports || [],
    documents: documents || [],
    historyEvents: historyEvents || []
  };
}

function recentHistoryEvents(data, limit = 4) {
  return (data.historyEvents || []).slice(0, limit);
}

function historyDateText(event = {}) {
  const raw = event.started_at || event.created_at;
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ru-RU");
}

function recentHistoryLine(data, limit = 4) {
  const events = recentHistoryEvents(data, limit);
  if (!events.length) return "";
  const items = events.map(event => {
    const date = historyDateText(event);
    return `${event.title}${date ? ` (${date})` : ""}`;
  });
  return `Из подтверждённого анамнеза я также вижу: ${items.join("; ")}.`;
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
    documents: data.documents.length + data.reports.length,
    anamnesisEvents: (data.historyEvents || []).length
  };
}

function shortSummaryAnswer(data) {
  const patient = data.patient || {};
  const name = firstName(patient);
  const intro = [name ? `${name},` : "", patientDescriptor(patient)].filter(Boolean).join(" ");
  const abnormal = data.abnormal.slice(0, 5);
  const dynCount = dynamicsCount(data.labs);
  const date = latestDate(data.labs);
  const anamnesis = recentHistoryLine(data, 3);
  const lines = [];
  if (intro) lines.push(`${intro}${intro.endsWith(",") ? "" : "."}`);
  lines.push(data.abnormal.length
    ? `В последних анализах ${data.abnormal.length} ${data.abnormal.length === 1 ? "показатель выходит" : "показателей выходят"} за референсный диапазон.`
    : "По последним подключённым анализам отклонений от референсных диапазонов не видно.");
  if (abnormal.length) lines.push(`Сейчас в зоне внимания: ${abnormal.map(lab => lab.name).join(", ")}.`);
  if (anamnesis) lines.push(anamnesis);
  if (dynCount) lines.push(`Повторные значения есть по ${dynCount} показателям — их уже можно смотреть в динамике.`);
  else lines.push("По текущим отклонениям повторных значений пока недостаточно для оценки динамики.");
  if (date) lines.push(`Последние результаты: ${date}.`);
  lines.push("Это справочная сводка, а не диагноз; анамнез помогает учитывать контекст, но сам по себе не доказывает причину отклонений.");
  return {
    answer: lines.join("\n"), actions: [],
    basis: buildBasis("patient_summary", null, { patientData: compactPatientData(data), chainLabel: "Короткая сводка пациента" })
  };
}

function attentionAnswer(data) {
  const name = firstName(data.patient || {});
  const abnormal = data.abnormal.slice(0, 6);
  if (!abnormal.length) {
    return { answer: `${name ? `${name}, ` : ""}по последним подключённым данным показателей вне референсного диапазона не видно.`, actions: [], basis: buildBasis("attention", null, { patientData: compactPatientData(data), chainLabel: "Что требует внимания" }) };
  }
  const grouped = new Map();
  abnormal.forEach(lab => {
    const group = humanGroup(lab);
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group).push(formatLab(lab));
  });
  const anamnesis = recentHistoryLine(data, 3);
  return {
    answer: [
      `${name ? `${name}, ` : ""}сейчас вне референсного диапазона ${data.abnormal.length} показателей.`,
      ...Array.from(grouped.entries()).map(([group, labs]) => `- ${group}: ${labs.join("; ")}`),
      anamnesis,
      anamnesis
        ? "Этот анамнез может быть важен как контекст для врача, но по нему нельзя автоматически объяснять лабораторные отклонения."
        : "Если скажете, зачем сдавали анализы и есть ли жалобы, я помогу сузить, что обсудить с врачом в первую очередь."
    ].filter(Boolean).join("\n"),
    actions: [], basis: buildBasis("attention", null, { patientData: compactPatientData(data), chainLabel: "Что требует внимания" })
  };
}

function doctorQuestionsAnswer(data, context) {
  const name = firstName(data.patient || {});
  const selected = context?.test_name ? ` по показателю «${context.test_name}»` : "";
  const anamnesis = recentHistoryLine(data, 3);
  return {
    answer: [
      `${name ? `${name}, ` : ""}для разговора с врачом${selected} я бы подготовил 4 вопроса:`,
      anamnesis ? `- насколько важен для интерпретации недавний анамнез: ${recentHistoryEvents(data, 3).map(item => item.title).join(", ")};` : null,
      "- какие из отклонений действительно значимы именно с учётом ваших жалоб и причины обследования;",
      "- могли ли лекарства, питание, физическая нагрузка или условия сдачи повлиять на результат;",
      "- какие показатели стоит оценивать вместе, а не по одному;",
      "- нужна ли врачу динамика или повторное исследование и при каких условиях."
    ].filter(Boolean).join("\n"), actions: [],
    basis: buildBasis("doctor_questions", context, { patientData: compactPatientData(data), chainLabel: "Подготовка вопросов врачу" })
  };
}

function missingDataAnswer(data) {
  const name = firstName(data.patient || {});
  const hasHistory = recentHistoryEvents(data, 1).length > 0;
  return {
    answer: [
      `${name ? `${name}, ` : ""}для более полезного разбора мне сейчас больше всего не хватает контекста:`,
      hasHistory ? null : "- текущие или недавние жалобы и симптомы;",
      "- зачем сдавали анализы;",
      "- лекарства и добавки;",
      "- условия сдачи анализа;",
      "- важные диагнозы или состояния, если они уже установлены врачом.",
      hasHistory ? "Подтверждённые симптомы из анамнеза я уже учитываю." : "Сами результаты и ваш пол/возраст я уже вижу в Атласе."
    ].filter(Boolean).join("\n"), actions: [],
    basis: buildBasis("missing_context", null, { patientData: compactPatientData(data), chainLabel: "Недостающий контекст" })
  };
}

function casualAnswer(data, message) {
  const name = firstName(data.patient || {});
  const hi = /(привет|здравств|добрый|доброе)/i.test(message);
  const how = /(как дела|как ты|че как|что нового)/i.test(message);
  const otherTopic = /(поговорим|поговорить|о чем[- ]?то другом|не про анализ|другая тема|сменим тему)/i.test(message);
  const openEnded = /(что расскажешь|расскажи что-нибудь|что можешь рассказать|что скажешь)/i.test(message);
  let answer;
  if (otherTopic) answer = "Конечно. Можем немного отвлечься от анализов — о чём хотите поговорить?";
  else if (how) answer = `${name ? `${name}, ` : ""}всё в порядке 🙂 Я на связи.`;
  else if (openEnded) answer = `${name ? `${name}, ` : ""}могу рассказать о том, что вижу в ваших анализах, учесть сохранённый анамнез, разобрать отдельный показатель или просто поговорить на другую тему. Что интереснее?`;
  else if (hi) answer = `${name ? `${name}, ` : ""}здравствуйте.`;
  else answer = "Я на связи.";
  return { answer, actions: [], basis: buildBasis("casual", null, { patientData: compactPatientData(data), chainLabel: "Обычный диалог" }) };
}

function resultAnswer(context, data) {
  if (!context?.test_name) return { answer: "Назовите показатель в вопросе — я попробую найти его среди ваших результатов и разобрать именно его.", actions: [], basis: buildBasis("result_explanation", context) };
  const name = firstName(data.patient || {});
  const historyCount = Array.isArray(context.history) ? context.history.length : 0;
  const anamnesis = recentHistoryLine(data, 4);
  return {
    answer: [
      `${name ? `${name}, ` : ""}${context.test_name}: ${context.value ?? ""} ${context.unit || ""} — ${flagText(context.flag)}.`,
      historyCount > 1 ? `По этому показателю у вас есть ${historyCount} значения в динамике.` : "Повторных значений по этому показателю пока недостаточно для оценки динамики.",
      anamnesis,
      anamnesis ? "Я буду учитывать этот анамнез как персональный контекст, но не стану автоматически считать его причиной изменения показателя без подтверждённого источника." : null,
      "Для медицинской трактовки я использую только подключённые доказательные сценарии и не буду придумывать диагноз."
    ].filter(Boolean).join("\n"), actions: [],
    basis: buildBasis("result_explanation", context, { patientData: compactPatientData(data), chainLabel: "Разбор результата" })
  };
}

function compactKey(value) {
  return normalize(value).replace(/[^a-zа-я0-9]+/gi, "");
}

const LAB_ALIASES = [
  { re: /(ддимер|д[- ]?димер|d[- ]?dimer)/i, terms: ["димер", "d-dimer", "d dimer"] },
  { re: /(гемоглобин|гемоглоб|\bhb\b|\bhgb\b)/i, terms: ["гемоглоб", "hgb"] },
  { re: /(лейкоцит|\bwbc\b)/i, terms: ["лейкоцит", "wbc"] },
  { re: /(эритроцит|\brbc\b)/i, terms: ["эритроцит", "rbc"] },
  { re: /(17[- ]?он[- ]?прогестерон|17он|17[- ]?oh)/i, terms: ["17-он", "17 он", "17-oh"] }
];

function findLabFromMessage(message, labs = []) {
  const text = normalize(message);
  for (const alias of LAB_ALIASES) {
    if (!alias.re.test(text)) continue;
    const found = labs.find(lab => {
      const hay = normalize(`${lab.name || ""} ${lab.code || ""}`);
      const compactHay = compactKey(hay);
      return alias.terms.some(term => hay.includes(normalize(term)) || compactHay.includes(compactKey(term)));
    });
    if (found) return found;
  }
  const candidates = labs
    .map(lab => {
      const name = normalize(lab.name);
      const code = normalize(lab.code);
      const nameWords = name.split(/\s+/).filter(word => word.length >= 4);
      let score = 0;
      if (code && text.includes(code)) score += 5;
      if (name && text.includes(name)) score += 6;
      nameWords.forEach(word => { if (text.includes(word)) score += 2; });
      return { lab, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);
  return candidates[0]?.score >= 2 ? candidates[0].lab : null;
}

function detectStudyTopic(message) {
  const text = normalize(message);
  if (/\bоак\b|общ(ий|его).*анализ.*кров|клиническ.*анализ.*кров/i.test(text)) return "общий анализ крови";
  if (/(что|че).*мо(й|и|им).*\bок\b/i.test(text)) return "общий анализ крови";
  if (/коагулограмм|гемостаз|свертываемост.*кров/i.test(text)) return "свёртываемость крови";
  if (/печеночн.*проб|печеночн.*показ/i.test(text)) return "печёночные показатели";
  if (/липидограмм|липидн.*профил/i.test(text)) return "липидный профиль";
  if (/щитовид|тиреоидн.*профил/i.test(text)) return "щитовидная железа";
  return null;
}

function studyAnswer(topic, data) {
  const name = firstName(data.patient || {});
  const labs = data.labs.filter(lab => humanGroup(lab) === topic);
  if (!labs.length) {
    return {
      answer: `${name ? `${name}, ` : ""}в подключённых результатах я не нашёл показателей блока «${topic}».`,
      actions: [], basis: buildBasis("study_group", null, { patientData: compactPatientData(data), chainLabel: "Разбор группы исследований" })
    };
  }
  const abnormal = labs.filter(lab => lab.flag && lab.flag !== "normal");
  const anamnesis = recentHistoryLine(data, 3);
  const lines = [
    `${name ? `${name}, ` : ""}по блоку «${topic}» у вас сейчас ${labs.length} показателей${abnormal.length ? `, из них ${abnormal.length} вне референсного диапазона` : ", отклонений по подключённым референсам не видно"}.`,
    ...labs.slice(0, 8).map(lab => `- ${formatLab(lab)}`),
    anamnesis
  ].filter(Boolean);
  if (abnormal.length) lines.push("Я могу разобрать любой из отклонённых показателей отдельно и учесть сохранённый анамнез как дополнительный контекст.");
  return {
    answer: lines.join("\n"), actions: [],
    basis: buildBasis("study_group", null, { patientData: compactPatientData(data), chainLabel: `Разбор: ${topic}` })
  };
}

function detectIntent(message, requestedMode, context, data) {
  const text = normalize(message);
  if (!text) return { kind: "empty" };
  if (/^(привет|здравствуй|здравствуйте|добрый день|доброе утро|добрый вечер|как дела|как ты|че как|что нового)$/i.test(text)) return { kind: "casual" };
  if (/(поговорим|поговорить|о чем[- ]?то другом|не про анализ|другая тема|сменим тему|что расскажешь|расскажи что-нибудь|что можешь рассказать|что скажешь)/i.test(text)) return { kind: "casual" };

  const topic = detectStudyTopic(text);
  if (topic) return { kind: "study", topic };

  const mentionedLab = findLabFromMessage(text, data.labs);
  if (mentionedLab) return { kind: "result", context: contextFromLab(mentionedLab) };

  if (/(коротк.*свод|кратк.*свод|собери.*свод|сводк.*для врача|общая картина|что у меня по анализам)/i.test(text)) return { kind: "summary" };
  if (/(что.*требует внимания|что.*важн|на что.*обратить|что.*не так|отклонен|вне.*диапаз|выше|ниже)/i.test(text) && !context?.test_name) return { kind: "attention" };
  if (/(чего не хватает|каких данных|недостаточно данных|что уточнить)/i.test(text)) return { kind: "missing" };
  if (/(вопрос.*врач|что обсудить.*врач|подготов.*врач|на прием)/i.test(text)) return { kind: "doctor_questions" };
  if (context?.test_name && /(почему|что значит|объясни|влияет|связан|динамик|референс|показател|результат|анализ|он|его|этот)/i.test(text)) return { kind: "result", context };
  if (requestedMode === "result_explanation" && context?.test_name) return { kind: "result", context };
  if (requestedMode === "doctor_questions" && /(врач|прием|вопрос|обсуд)/i.test(text)) return { kind: "doctor_questions" };
  return { kind: "unknown" };
}

async function chat(payload = {}, patientId) {
  const message = String(payload.message || "").trim();
  const context = payload.context || {};
  const requestedMode = payload.mode || "";
  const data = await buildPatientSummaryContext(patientId);
  const intent = detectIntent(message, requestedMode, context, data);

  if (intent.kind === "casual") return responseEnvelope(casualAnswer(data, message), "assistant_chat");
  if (intent.kind === "study") return responseEnvelope(studyAnswer(intent.topic, data), "result_explanation");
  if (intent.kind === "summary") return responseEnvelope(shortSummaryAnswer(data), "patient_summary");
  if (intent.kind === "attention") return responseEnvelope(attentionAnswer(data), "patient_summary");
  if (intent.kind === "missing") return responseEnvelope(missingDataAnswer(data), "doctor_questions");
  if (intent.kind === "doctor_questions") return responseEnvelope(doctorQuestionsAnswer(data, context), "doctor_questions");
  if (intent.kind === "result") {
    const response = resultAnswer(intent.context, data);
    response.resolvedContext = intent.context;
    return responseEnvelope(response, "result_explanation");
  }
  if (intent.kind === "empty") {
    return responseEnvelope({
      answer: "Напишите вопрос своими словами. Можно спросить, например, «что с моим ОАК?» или «что значит D-димер?». Сам показатель выбирать вручную не обязательно.",
      actions: [], basis: buildBasis("empty_question", context)
    }, "assistant_chat");
  }

  return responseEnvelope({
    answer: "Не до конца понял формулировку. Если речь об анализах, можете написать даже коротко — например «ОАК», «D-димер», «что с лейкоцитами». Я попробую сам найти нужные результаты.",
    actions: [], basis: buildBasis("clarification", context, { patientData: compactPatientData(data), chainLabel: "Уточнение запроса" })
  }, "assistant_chat");
}

module.exports = { chat, buildPatientSummaryContext, firstName, sexText, contextFromLab, findLabFromMessage };
