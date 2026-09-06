const crypto = require("crypto");
const https = require("https");
const mockProvider = require("./mockProvider");
const clinicalKnowledge = require("../clinicalKnowledge");

let tokenCache = {
  accessToken: "",
  expiresAt: 0
};

const SYSTEM_PROMPT = [
  "Ты ассистент пациентского кабинета «Атлас здоровья».",
  "Отвечай на русском языке, спокойно, понятно и по делу.",
  "Ты видишь персональный контекст пациента: имя, возраст, пол, лабораторные данные и, когда доступно, подключенную доказательную базу.",
  "Обращайся к пациенту по имени естественно, обычно не чаще одного раза за ответ.",
  "Учитывай возраст и пол только когда это действительно важно для интерпретации; не повторяй их механически в каждом ответе.",
  "Сначала отвечай на конкретный вопрос пользователя, затем при необходимости добавляй 1–3 полезных пояснения.",
  "Предпочитай короткие ответы: обычно 3–7 небольших абзацев или пунктов, без длинной формальной сводки.",
  "Не ставь диагнозы и не формулируй состояние пациента как установленное заболевание.",
  "Не назначай лечение и не рекомендуй начать, отменить или изменить лекарства, дозировки, добавки или диету.",
  "Не назначай обследования от своего имени. Если подключенная документация связывает показатель с другими исследованиями, формулируй это как: «в рекомендациях для оценки также используют ...; в ваших данных ...; это можно обсудить с врачом».",
  "Медицинские объяснения причин, связей и дополнительных показателей допускаются только если они прямо присутствуют в переданной доказательной базе.",
  "Если доказательной базы для тезиса нет, прямо скажи, что подтвержденного основания в подключенной базе недостаточно, и не додумывай.",
  "Не делай вывод только по одному отклонению: учитывай динамику, связанные показатели, референс, возраст и пол, если они переданы.",
  "Различай факт и справочную информацию: «у вас показатель ниже референса» — факт; «в рекомендациях этот показатель рассматривают вместе с ...» — справочная информация.",
  "Если пользователь просит возможные причины, перечисляй их только когда они есть в подключенном источнике и обязательно указывай, что это не означает наличие конкретной причины у пациента.",
  "При острых опасных симптомах рекомендуй очную медицинскую оценку или неотложную помощь.",
  "Не выдумывай анализы, значения, диагнозы, документы, ссылки или назначения."
].join("\n");

const UNSAFE_ANSWER_PATTERNS = [
  /у\s+вас\s+(?:точно\s+)?(?:диагноз|заболевание|анемия|диабет|гипотиреоз|инфекция)/i,
  /вам\s+(?:нужно|необходимо|следует)\s+(?:сдать|пройти|принимать|начать|отменить|увеличить|уменьшить)/i,
  /(?:начните|начать)\s+(?:принимать|лечение)/i,
  /(?:отмените|прекратите)\s+(?:принимать|препарат|лекарств)/i,
  /(?:увеличьте|уменьшите|измените)\s+(?:доз|дозиров)/i,
  /я\s+(?:ставлю|подтверждаю)\s+диагноз/i,
  /это\s+(?:точно|однозначно)\s+(?:означает|указывает|свидетельствует)/i
];

function clampText(value, maxChars) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 1)}…`;
}

function flagText(flag) {
  if (flag === "high") return "выше референсного диапазона";
  if (flag === "low") return "ниже референсного диапазона";
  if (flag === "normal") return "в референсном диапазоне";
  return "требует интерпретации";
}

function safeError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function parseJsonBody(body) {
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch (error) {
    return {};
  }
}

async function fetchJson(url, options, config) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const body = options.body ? String(options.body) : "";
    const request = https.request({
      method: options.method || "GET",
      hostname: target.hostname,
      port: target.port || 443,
      path: `${target.pathname}${target.search}`,
      headers: {
        ...(options.headers || {}),
        ...(body ? { "Content-Length": Buffer.byteLength(body) } : {})
      },
      timeout: config.timeoutMs,
      agent: new https.Agent({
        rejectUnauthorized: config.rejectUnauthorized !== false,
        ca: config.caCert
      })
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(safeError(`gigachat_http_${response.statusCode}`, response.statusCode));
          return;
        }
        resolve(parseJsonBody(text));
      });
    });

    request.on("timeout", () => {
      request.destroy(safeError("gigachat_timeout", 504));
    });
    request.on("error", reject);
    if (body) request.write(body);
    request.end();
  });
}

function shouldRefreshToken() {
  return !tokenCache.accessToken || !tokenCache.expiresAt || Date.now() > tokenCache.expiresAt - 60 * 1000;
}

async function getAccessToken(config) {
  if (!config.authKey) throw safeError("gigachat_auth_key_missing", 401);
  if (!shouldRefreshToken()) return tokenCache.accessToken;

  const body = new URLSearchParams({ scope: config.scope });
  const json = await fetchJson(config.authUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${config.authKey}`,
      RqUID: crypto.randomUUID(),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json"
    },
    body
  }, config);

  if (!json.access_token) throw safeError("gigachat_token_missing", 502);
  tokenCache = {
    accessToken: json.access_token,
    expiresAt: Number(json.expires_at || 0) || Date.now() + 25 * 60 * 1000
  };
  return tokenCache.accessToken;
}

function firstName(patient = {}) {
  const raw = String(patient.name || patient.fullName || "").trim();
  return raw ? raw.split(/\s+/)[0] : "";
}

function patientLine(patient = {}) {
  const parts = [];
  const name = firstName(patient);
  if (name) parts.push(`имя: ${name}`);
  if (patient.age !== undefined && patient.age !== null && patient.age !== "") parts.push(`возраст: ${patient.age}`);
  if (patient.sex) parts.push(`пол: ${patient.sex}`);
  return parts.length ? `Пациент: ${parts.join("; ")}.` : "";
}

function referenceFromContext(context = {}) {
  return clinicalKnowledge.referenceText(context) || "";
}

function contextLine(context) {
  if (!context?.test_name) return "";
  const parts = [
    `показатель: ${context.test_name}`,
    context.value !== undefined ? `значение: ${context.value}` : "",
    context.unit ? `единицы: ${context.unit}` : "",
    context.flag ? `статус: ${flagText(context.flag)}` : "",
    referenceFromContext(context) ? `референс: ${referenceFromContext(context)}` : "",
    context.report_date || context.date ? `дата: ${context.report_date || context.date}` : ""
  ].filter(Boolean);
  return parts.join("; ");
}

function historyLine(context = {}) {
  if (!Array.isArray(context.history) || !context.history.length) return "";
  const rows = context.history.slice(-8).map(row => {
    const value = `${row.value ?? ""}${context.unit ? ` ${context.unit}` : ""}`.trim();
    return `${row.date || "без даты"}: ${value}${row.flag ? ` (${flagText(row.flag)})` : ""}`;
  });
  return rows.length ? `Динамика выбранного показателя: ${rows.join("; ")}.` : "";
}

function evidenceLines(context = {}, patientLabs = []) {
  const knowledge = clinicalKnowledge.knowledgeFor(context);
  if (!knowledge) return [];
  const lines = [
    `Подключенная доказательная база для показателя: ${knowledge.groupTitle}.`,
    `Проверенный справочный тезис: ${knowledge.interpretation}`
  ];
  if (knowledge.related?.length) {
    lines.push(`Связанные показатели по сценарию: ${knowledge.related.join(", ")}.`);
    const missing = clinicalKnowledge.missingRelated(knowledge, patientLabs);
    if (missing.length) lines.push(`Из связанных показателей в текущих данных не найдено: ${missing.join(", ")}.`);
  }
  if (knowledge.documents?.length) {
    lines.push(`Подключенные документы: ${knowledge.documents.map(doc => `${doc.title}${doc.year ? ` (${doc.year})` : ""}`).join("; ")}.`);
  }
  if (knowledge.sources?.length) {
    lines.push(`Разрешенные источники: ${knowledge.sources.map(source => `${source.label} — ${source.url}`).join("; ")}.`);
  }
  lines.push("Используй медицинские причинно-следственные пояснения только в пределах этих тезисов и источников.");
  return lines;
}

async function buildMinimalPatientContext(payload, patientId, maxPromptChars) {
  const mode = payload.mode || "patient_summary";
  const lines = [
    `Режим ассистента: ${mode}.`,
    "Ответ должен быть персональным, но не диагностическим."
  ];

  let data = null;
  if (patientId) {
    try {
      data = await mockProvider.buildPatientSummaryContext(patientId);
    } catch (error) {
      data = null;
    }
  }

  if (data?.patient) {
    const patient = patientLine(data.patient);
    if (patient) lines.push(patient);
  }

  const selectedResult = contextLine(payload.context || {});
  if (selectedResult) lines.push(`Выбранный результат: ${selectedResult}.`);
  const selectedHistory = historyLine(payload.context || {});
  if (selectedHistory) lines.push(selectedHistory);

  const patientLabs = data?.labs || [];
  lines.push(...evidenceLines(payload.context || {}, patientLabs));

  if (data) {
    const abnormal = (data.abnormal || []).slice(0, 8).map((lab) => (
      `${lab.name}: ${lab.latestValue ?? ""} ${lab.unit || ""} (${flagText(lab.flag)})`
    ).replace(/\s+/g, " ").trim());
    const reports = (data.labReports || []).slice(0, 3).map((report) => `${report.name} от ${report.date}`);
    lines.push(`В кабинете лабораторных показателей: ${(data.labs || []).length}; показателей вне референса: ${(data.abnormal || []).length}.`);
    if (abnormal.length) lines.push(`Текущие показатели внимания: ${abnormal.join("; ")}.`);
    if (reports.length) lines.push(`Последние исследования: ${reports.join("; ")}.`);
  }

  return clampText(lines.join("\n"), maxPromptChars);
}

function basisForResponse(payload) {
  const context = payload.context || {};
  const hasIndicator = Boolean(context.test_name);
  const knowledge = hasIndicator ? clinicalKnowledge.knowledgeFor(context) : null;
  return {
    chain: payload.mode || "gigachat_safe_answer",
    chainLabel: knowledge ? "AI-ответ с доказательным контекстом" : "AI-safe режим Атласа здоровья",
    indicator: context.test_name || null,
    patientData: hasIndicator ? {
      test_code: context.test_code || null,
      test_name: context.test_name,
      value: context.value ?? null,
      unit: context.unit || null,
      flag: context.flag || null,
      report_date: context.report_date || context.date || null,
      reference: referenceFromContext(context) || null
    } : null,
    source: knowledge ? "atlas_evidence_layer" : "atlas_patient_context",
    sourceLabel: knowledge?.documents?.length
      ? `Подключенная доказательная база · ${knowledge.documents[0].title}`
      : "Данные пациента Атласа здоровья",
    validationStatus: knowledge
      ? "Справочная интерпретация ограничена подключенными источниками; не является диагнозом или назначением"
      : "Ответ ограничен данными пациента; медицинские выводы без источника не формируются"
  };
}

function normalizeQuestion(payload) {
  return String(payload.message || "").trim().toLowerCase();
}

function labSummaryLine(lab) {
  return `${lab.name}: ${lab.latestValue ?? ""} ${lab.unit || ""} (${flagText(lab.flag)})`.replace(/\s+/g, " ").trim();
}

function summaryBasis(payload, data) {
  const basis = basisForResponse(payload);
  basis.patientData = {
    patient: firstName(data.patient || {}) || null,
    age: data.patient?.age ?? null,
    sex: data.patient?.sex || null,
    labReports: (data.labReports || []).length,
    abnormal: (data.abnormal || []).length,
    visits: (data.visits || []).length,
    documents: (data.documents || []).length + (data.reports || []).length
  };
  return basis;
}

function greetingPrefix(data) {
  const name = firstName(data?.patient || {});
  return name ? `${name}, ` : "";
}

function safeResultAnswer(context, data) {
  const value = [context.value !== undefined ? context.value : "", context.unit || ""].filter(Boolean).join(" ");
  const resultText = value ? ` — ${value}` : "";
  const reference = referenceFromContext(context);
  const knowledge = clinicalKnowledge.knowledgeFor(context);
  const name = firstName(data?.patient || {});
  const lines = [
    `${name ? `${name}, ` : ""}${context.test_name}${resultText}: показатель ${flagText(context.flag)}${reference ? ` (референс ${reference})` : ""}.`
  ];
  if (knowledge) {
    lines.push(knowledge.interpretation);
    if (knowledge.related?.length) lines.push(`В подключенной документации этот блок рассматривают вместе с: ${knowledge.related.join(", ")}.`);
  } else {
    lines.push("Для этого показателя в подключенной базе пока нет отдельного подтвержденного сценария, поэтому я не буду додумывать клиническую интерпретацию.");
  }
  lines.push("Это справочное пояснение, а не диагноз и не назначение лечения или обследования.");
  return lines.join("\n");
}

function attentionAnswer(data) {
  const items = (data.abnormal || []).slice(0, 6).map(labSummaryLine);
  return [
    `${greetingPrefix(data)}${items.length ? `сейчас вне референсных диапазонов: ${items.join("; ")}.` : "по последним подключенным данным показателей вне референса нет."}`,
    "Я могу разобрать любой из этих показателей отдельно и показать, на какой подключенной документации основано пояснение.",
    "Это не диагноз: значение имеет сочетание показателей, динамика и клинический контекст."
  ].join("\n");
}

function relatedAnswer(data) {
  const groups = {};
  (data.abnormal || []).forEach((lab) => {
    const group = lab.group || "Другие показатели";
    if (!groups[group]) groups[group] = [];
    groups[group].push(labSummaryLine(lab));
  });
  const lines = Object.entries(groups).slice(0, 5).map(([group, labs]) => `- ${group}: ${labs.join("; ")}`);
  return [
    `${greetingPrefix(data)}удобнее смотреть отклонения не по одному, а связанными блоками:`,
    lines.length ? lines.join("\n") : "- сейчас нет показателей вне референсных диапазонов.",
    "Для конкретного показателя я могу отдельно показать связанные исследования из подключенной доказательной базы."
  ].join("\n");
}

function missingDataAnswer(data) {
  return [
    `${greetingPrefix(data)}для более точного справочного объяснения могут быть важны данные, которых обычно нет в одном лабораторном значении:`,
    "- жалобы и цель обращения;",
    "- условия подготовки и время исследования;",
    "- лекарства и добавки;",
    "- предыдущие результаты и динамика;",
    "- связанные показатели, предусмотренные подключенным сценарием.",
    "Если этих данных нет, я обозначу неопределенность, а не буду достраивать диагноз."
  ].join("\n");
}

function visitPrepAnswer(data) {
  const reports = (data.labReports || []).slice(0, 3).map((report) => `${report.name} от ${report.date}`);
  return [
    `${greetingPrefix(data)}к приему можно собрать короткий контекст:`,
    `- показатели вне референса: ${(data.abnormal || []).length};`,
    `- последние исследования: ${reports.length ? reports.join("; ") : "нет данных"};`,
    "- жалобы, лекарства и условия подготовки к анализам;",
    "- вопросы по тем показателям, которые хотите обсудить в первую очередь."
  ].join("\n");
}

function overviewAnswer(data) {
  const items = (data.abnormal || []).slice(0, 4).map(labSummaryLine);
  return [
    `${greetingPrefix(data)}в кабинете сейчас ${(data.labs || []).length} лабораторных показателей и ${(data.labReports || []).length} исследований.`,
    items.length ? `В первую очередь внимание привлекают: ${items.join("; ")}.` : "По последним данным показателей вне референса нет.",
    "Можете выбрать конкретный показатель — я сверю его с вашей динамикой, возрастом/полом и подключенной доказательной базой."
  ].join("\n");
}

function hasUnsafeMedicalAdvice(answer) {
  return UNSAFE_ANSWER_PATTERNS.some((pattern) => pattern.test(String(answer || "")));
}

async function guardAnswer(answer, payload, patientId) {
  const basis = basisForResponse(payload);
  if (!hasUnsafeMedicalAdvice(answer)) {
    return { answer, basis, safetyGuardApplied: false };
  }

  let data = null;
  try {
    data = patientId ? await mockProvider.buildPatientSummaryContext(patientId) : null;
  } catch (error) {
    data = null;
  }

  if (payload.context?.test_name) {
    basis.validationStatus = "Ответ модели был ограничен safety guard; возвращено справочное пояснение по подключенным данным";
    return {
      answer: safeResultAnswer(payload.context, data),
      basis,
      safetyGuardApplied: true
    };
  }

  return { ...(await safeSummaryAnswer(payload, patientId)), safetyGuardApplied: true };
}

async function safeSummaryAnswer(payload, patientId) {
  const data = await mockProvider.buildPatientSummaryContext(patientId);
  const question = normalizeQuestion(payload);

  if (/не хватает|недостаточно|каких данных/.test(question)) {
    return { answer: missingDataAnswer(data), basis: summaryBasis(payload, data) };
  }
  if (/связан|вместе|блок/.test(question)) {
    return { answer: relatedAnswer(data), basis: summaryBasis(payload, data) };
  }
  if (/вниман|отклон|выше|ниже/.test(question)) {
    return { answer: attentionAnswer(data), basis: summaryBasis(payload, data) };
  }
  if (/подготов|при[её]м|врач/.test(question)) {
    return { answer: visitPrepAnswer(data), basis: summaryBasis(payload, data) };
  }

  return { answer: overviewAnswer(data), basis: summaryBasis(payload, data) };
}

async function chat(payload = {}, patientId, config) {
  const question = clampText(payload.message || "", 1600);
  const minimalContext = await buildMinimalPatientContext(payload, patientId, config.maxPromptChars);
  const token = await getAccessToken(config);
  const json = await fetchJson(`${config.apiUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: ["Контекст Атласа здоровья:", minimalContext, "", "Вопрос пациента:", question].join("\n") }
      ],
      stream: false,
      max_tokens: 650,
      temperature: 0.25
    })
  }, config);

  const answer = json.choices?.[0]?.message?.content;
  if (!answer) throw safeError("gigachat_answer_missing", 502);
  const guarded = await guardAnswer(String(answer).trim(), payload, patientId);

  return {
    answer: guarded.answer,
    actions: [],
    basis: guarded.basis,
    safetyGuardApplied: guarded.safetyGuardApplied,
    mode: payload.mode || "assistant_chat"
  };
}

module.exports = { chat };
