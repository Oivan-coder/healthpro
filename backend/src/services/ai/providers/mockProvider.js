const patientService = require("../../patientService");
const labService = require("../../labService");
const appointmentService = require("../../appointmentService");
const reportService = require("../../reportService");

function normalize(text) {
  return String(text || "").trim().toLowerCase();
}

function labValueText(context) {
  if (!context?.test_name) return "";
  return `${context.test_name} ${context.value ?? ""} ${context.unit || ""}`.replace(/\s+/g, " ").trim();
}

function flagText(flag) {
  if (flag === "high") return "выше обычного диапазона";
  if (flag === "low") return "ниже обычного диапазона";
  if (flag === "normal") return "в обычном диапазоне";
  return "требует интерпретации";
}

function humanChain(chain) {
  const names = {
    patient_summary: "Демо-сводка пациента",
    result_explanation: "Демо-разбор результата",
    doctor_questions: "Подготовка вопросов врачу",
    appointment_route: "Маршрут записи к врачу",
    out_of_scope: "Вопрос вне подключенной базы знаний",
    empty_question: "Ожидание вопроса"
  };
  return names[chain] || "Демо-сценарий Атласа здоровья";
}

function buildBasis(chain, context, extra = {}) {
  return {
    chain,
    chainLabel: humanChain(chain),
    indicator: context?.test_name || extra.indicator || null,
    patientData: context?.test_name ? {
      test_code: context.test_code || null,
      test_name: context.test_name,
      value: context.value ?? null,
      unit: context.unit || null,
      flag: context.flag || null,
      report_date: context.report_date || context.date || null
    } : extra.patientData || null,
    source: "atlas_demo_knowledge_base",
    sourceLabel: "Демо-база знаний Атласа здоровья",
    validationStatus: "Демо-логика, требует врачебной валидации"
  };
}

function responseEnvelope(response, mode) {
  return {
    mode,
    ...response,
    safety: [
      "Это не диагноз.",
      "Не заменяет консультацию врача.",
      "Не содержит назначений лечения."
    ]
  };
}

function resultAnswer(context) {
  const valueText = labValueText(context);
  const status = flagText(context?.flag);
  if (!valueText) {
    return outOfScopeAnswer(context);
  }
  return {
    answer: [
      `${valueText}: этот результат ${status}.`,
      "Это не диагноз и не заменяет консультацию врача.",
      "Стоит обсудить результат с врачом, особенно если есть жалобы, лекарства, подготовка к анализу или повторные отклонения.",
      "Можно подготовить вопросы врачу: что могло повлиять на показатель, нужен ли повторный контроль и какие данные взять на прием."
    ].join(" "),
    basis: buildBasis("result_explanation", context)
  };
}

function appointmentAnswer(context) {
  const valueText = labValueText(context);
  const resultPart = valueText ? ` по результату ${valueText}` : "";
  return {
    answer: [
      `Маршрут простой: откройте запись к врачу${resultPart}, выберите специальность, врача и удобное время.`,
      "Цель записи — спокойно обсудить результат с врачом.",
      "Это не диагноз, не назначение лечения и не замена консультации врача."
    ].join(" "),
    actions: [
      { label: "Записаться к врачу", route: "appointments" },
      { label: "Открыть лабораторию", route: "labs", labMode: "abnormal" }
    ],
    basis: buildBasis("appointment_route", context)
  };
}

function outOfScopeAnswer(context) {
  return {
    answer: "Сейчас я могу отвечать только по результатам, подключенным в Атласе здоровья, и согласованным медицинским сценариям.",
    basis: buildBasis("out_of_scope", context)
  };
}

function categoryForLab(lab) {
  const key = `${lab.code || ""} ${lab.name || ""} ${lab.group || ""}`.toLowerCase();
  if (/(glu|hba1c|insulin|c-peptide|c peptide|глюкоз|инсулин)/i.test(key)) return "углеводный обмен";
  if (/(ldl|hdl|chol|triglycerides|tg|лпнп|лпвп|холестерин|триглицерид|липид)/i.test(key)) return "липидный профиль";
  if (/(crp|соэ|soe|wbc|срб|лейкоцит|воспал)/i.test(key)) return "воспаление";
  if (/(alt|ast|bilirubin|ggt|алт|аст|билирубин|ггт|печен)/i.test(key)) return "печеночные ферменты";
  if (/(ferr|iron|hb|hgb|ферритин|желез|гемоглобин|анеми)/i.test(key)) return "железо/анемия";
  if (/(tsh|t3|t4|тиреотроп|щитовид)/i.test(key)) return "щитовидная железа";
  return lab.group || "другие показатели";
}

function formatLab(lab) {
  return `${lab.name}: ${lab.latestValue} ${lab.unit || ""} (${flagText(lab.flag)})`.replace(/\s+/g, " ").trim();
}

function groupAttentionLabs(abnormalLabs) {
  const grouped = {};
  abnormalLabs.forEach((lab) => {
    const category = categoryForLab(lab);
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(formatLab(lab));
  });
  return grouped;
}

function dynamicLabs(labs) {
  return labs
    .filter((lab) => Array.isArray(lab.history) && lab.history.length > 1)
    .slice(0, 6)
    .map((lab) => lab.name);
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
    patient: summary.patient,
    labs: summary.labs || [],
    abnormal: summary.abnormal || [],
    labReports: labReports || [],
    visits: visits || [],
    reports: reports || [],
    documents: documents || []
  };
}

async function patientSummaryAnswer(patientId) {
  const data = await buildPatientSummaryContext(patientId);
  const patient = data.patient || {};
  const attentionGroups = groupAttentionLabs(data.abnormal);
  const groupNames = Object.keys(attentionGroups);
  const trends = dynamicLabs(data.labs);
  const latestReports = data.labReports.slice(0, 3).map((report) => `${report.name} от ${report.date}`);
  const nextVisit = data.visits.find((visit) => visit.status === "Запланировано") || data.visits[0];

  const brief = [
    `${patient.name || "Пациент"}${patient.age ? `, ${patient.age} лет` : ""}${patient.sex ? `, ${patient.sex.toLowerCase()}` : ""}: в Атласе доступны лабораторные отчеты, динамика показателей, записи и документы.`,
    data.abnormal.length
      ? `Сейчас внимания требуют ${data.abnormal.length} показателей: ${groupNames.join(", ")}.`
      : "По последним подключенным лабораторным данным показателей для внимания не видно.",
    trends.length ? `В динамике есть данные по показателям: ${trends.join(", ")}.` : "Для оценки динамики пока не хватает повторных значений.",
    "Это не диагноз: для интерпретации важны анамнез, жалобы, лекарства и подготовка к анализу."
  ];

  const missing = [
    "жалобы и цель обращения",
    "лекарства и добавки",
    "подготовка к анализам",
    "анамнез и сопутствующие состояния",
    "заключение врача по текущему эпизоду",
    "план повторного контроля, если врач сочтет его нужным"
  ];

  const questions = [
    "Какие из отклонений стоит обсудить в первую очередь?",
    "Могли ли подготовка к анализу, питание или лекарства повлиять на результат?",
    "Нужен ли повторный контроль и в какие сроки его корректно планировать?",
    "Какие жалобы или данные анамнеза важны для интерпретации?",
    "Какие документы и предыдущие результаты лучше взять на прием?"
  ];

  return {
    answer: [
      "A. Краткая сводка",
      ...brief.map((item) => `- ${item}`),
      "",
      "B. Что требует внимания",
      groupNames.length
        ? groupNames.map((group) => `- ${group}: ${attentionGroups[group].join("; ")}`).join("\n")
        : "- По последним подключенным данным нет показателей вне обычного диапазона.",
      "",
      "C. Чего не хватает",
      ...missing.map((item) => `- ${item}`),
      "",
      "D. Вопросы врачу",
      ...questions.map((item) => `- ${item}`),
      "",
      "E. Следующие действия",
      "- Открыть лабораторию.",
      "- Записаться к врачу.",
      "- Открыть документы.",
      "",
      "F. На чем основана сводка",
      `- Лабораторные результаты пациента: ${data.labs.length} показателей, ${data.labReports.length} отчетов.`,
      `- Последние исследования: ${latestReports.length ? latestReports.join("; ") : "нет данных"}.`,
      `- Записи/приемы: ${nextVisit ? `${nextVisit.specialty || ""} ${nextVisit.date || ""} ${nextVisit.time || ""}`.trim() : "нет данных"}.`,
      `- Документы/заключения: ${data.documents.length + data.reports.length}.`,
      "- Демо-правила Атласа здоровья.",
      "- Статус: демо-логика, требует врачебной валидации."
    ].join("\n"),
    actions: [
      { label: "Открыть лабораторию", route: "labs", labMode: "abnormal" },
      { label: "Записаться к врачу", route: "appointments" },
      { label: "Открыть документы", route: "reports" }
    ],
    basis: buildBasis("patient_summary", null, {
      patientData: {
        patient: patient.name || null,
        labReports: data.labReports.length,
        abnormal: data.abnormal.length,
        visits: data.visits.length,
        documents: data.documents.length + data.reports.length
      }
    })
  };
}

function doctorQuestionsAnswer(context) {
  const valueText = labValueText(context);
  const resultLine = valueText ? ` по результату ${valueText}` : "";
  return {
    answer: [
      `Можно подготовить вопросы врачу${resultLine}:`,
      "- Какие показатели стоит обсудить в первую очередь?",
      "- Может быть важно уточнить подготовку к анализу, лекарства и жалобы?",
      "- Нужен ли повторный контроль и какие условия сдачи важны?",
      "- Какие предыдущие результаты или документы взять на прием?",
      "- Есть ли связанные показатели, которые стоит смотреть вместе?",
      "Это не диагноз и не назначение лечения."
    ].join("\n"),
    actions: [
      { label: "Записаться к врачу", route: "appointments" },
      { label: "Открыть документы", route: "reports" }
    ],
    basis: buildBasis("doctor_questions", context)
  };
}

async function chat(payload = {}, patientId) {
  const message = normalize(payload.message);
  const context = payload.context || {};
  const requestedMode = payload.mode || "";

  if (!message && requestedMode !== "patient_summary") {
    return responseEnvelope({
      answer: "Выберите режим или задайте вопрос по подключенным данным.",
      basis: buildBasis("empty_question", context)
    }, "out_of_scope");
  }

  if (requestedMode === "patient_summary") {
    return responseEnvelope(await patientSummaryAnswer(patientId), "patient_summary");
  }
  if (requestedMode === "result_explanation") {
    return responseEnvelope(resultAnswer(context), "result_explanation");
  }
  if (requestedMode === "doctor_questions") {
    return responseEnvelope(doctorQuestionsAnswer(context), "doctor_questions");
  }
  if (requestedMode === "out_of_scope") {
    return responseEnvelope(outOfScopeAnswer(context), "out_of_scope");
  }

  const isAppointment = /(запис|врач|при[её]м|специалист|консультац)/i.test(message);
  const isResult = /(показател|анализ|результат|норм|выше|ниже|референс|динамик|что значит|объясни)/i.test(message);
  const isSummary = /(сводк|пациент|вниман|связан|не хватает|подготов)/i.test(message);

  if (isSummary) return responseEnvelope(await patientSummaryAnswer(patientId), "patient_summary");
  if (isAppointment) return responseEnvelope(appointmentAnswer(context), "doctor_questions");
  if (isResult) return responseEnvelope(resultAnswer(context), "result_explanation");
  return responseEnvelope(outOfScopeAnswer(context), "out_of_scope");
}

module.exports = { chat, buildPatientSummaryContext };
