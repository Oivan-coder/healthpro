const crypto = require("crypto");
const https = require("https");
const mockProvider = require("./mockProvider");

let tokenCache = {
  accessToken: "",
  expiresAt: 0
};

const SYSTEM_PROMPT = [
  "Ты ассистент пациентского кабинета «Атлас здоровья».",
  "Отвечай на русском языке, спокойно и понятно.",
  "Помогай пациенту понять структуру данных в кабинете и простыми словами объяснять, что показатель выше или ниже референса.",
  "Не ставь диагнозы.",
  "Не назначай лечение.",
  "Не рекомендуй начать, отменить или изменить лекарства.",
  "Не предлагай диету, добавки, обследования, препараты или лечение как рекомендацию.",
  "Не используй вероятностные медицинские выводы вроде «это может говорить о», «указывает на», «повышает риск», если это не указано явно в переданных данных.",
  "Если показатель вне референса, говори нейтрально: «показатель выше/ниже обычного диапазона» и «это стоит обсудить с врачом».",
  "Вопросы к врачу формулируй как подготовку к приему: «что могло повлиять на результат», «нужна ли перепроверка», «какие дальнейшие шаги уместны».",
  "Не заменяй врача.",
  "Всегда предлагай обсудить отклонения с врачом.",
  "Если вопрос тревожный, острый или связан с лечением, рекомендуй обратиться к врачу или в неотложную помощь.",
  "Опирайся только на данные, переданные из Атласа здоровья.",
  "Если данных недостаточно, честно скажи, чего не хватает.",
  "Не выдумывай анализы, диагнозы, документы или назначения."
].join("\n");

const UNSAFE_ANSWER_PATTERNS = [
  /преддиаб/i,
  /диабет/i,
  /аутоиммун/i,
  /инфекц/i,
  /сердечно-сосуд/i,
  /риск/i,
  /лечени[еяюем]/i,
  /препарат/i,
  /лекарств/i,
  /добавк/i,
  /обследован/i,
  /коррекц/i,
  /нормализ/i,
  /может\s+(говорить|свидетельствовать|указывать|быть признаком)/i,
  /могут?\s+(говорить|свидетельствовать|указывать|быть признаком)/i,
  /указывает\s+на/i,
  /свидетельствует\s+о/i,
  /проблем[а-я\s]+со здоровьем/i,
  /нарушени[ея]/i
];

function clampText(value, maxChars) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 1)}…`;
}

function flagText(flag) {
  if (flag === "high") return "выше обычного диапазона";
  if (flag === "low") return "ниже обычного диапазона";
  if (flag === "normal") return "в обычном диапазоне";
  return "требует внимания";
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

function contextLine(context) {
  if (!context?.test_name) return "";
  const parts = [
    `показатель: ${context.test_name}`,
    context.value !== undefined ? `значение: ${context.value}` : "",
    context.unit ? `единицы: ${context.unit}` : "",
    context.flag ? `статус: ${flagText(context.flag)}` : "",
    context.report_date || context.date ? `дата: ${context.report_date || context.date}` : ""
  ].filter(Boolean);
  return parts.join("; ");
}

async function buildMinimalPatientContext(payload, patientId, maxPromptChars) {
  const mode = payload.mode || "patient_summary";
  const lines = [
    `Режим ассистента: ${mode}`,
    "Передавай ответ как пациентское пояснение, без диагнозов и назначений."
  ];

  const selectedResult = contextLine(payload.context || {});
  if (selectedResult) lines.push(`Выбранный результат: ${selectedResult}`);

  if (mode === "patient_summary" && patientId) {
    const data = await mockProvider.buildPatientSummaryContext(patientId);
    const abnormal = (data.abnormal || []).slice(0, 8).map((lab) => (
      `${lab.name}: ${lab.latestValue ?? ""} ${lab.unit || ""} (${flagText(lab.flag)})`
    ).replace(/\s+/g, " ").trim());
    const reports = (data.labReports || []).slice(0, 3).map((report) => `${report.name} от ${report.date}`);
    lines.push(`Лабораторных показателей: ${(data.labs || []).length}.`);
    lines.push(`Показателей внимания: ${(data.abnormal || []).length}.`);
    if (abnormal.length) lines.push(`Показатели внимания: ${abnormal.join("; ")}.`);
    if (reports.length) lines.push(`Последние исследования: ${reports.join("; ")}.`);
    lines.push(`Записей/приемов в кабинете: ${(data.visits || []).length}.`);
    lines.push(`Документов в кабинете: ${(data.reports || []).length + (data.documents || []).length}.`);
  }

  return clampText(lines.join("\n"), maxPromptChars);
}

function basisForResponse(payload) {
  const context = payload.context || {};
  const hasIndicator = Boolean(context.test_name);
  return {
    chain: payload.mode || "gigachat_safe_answer",
    chainLabel: "AI-safe режим Атласа здоровья",
    indicator: context.test_name || null,
    patientData: hasIndicator ? {
      test_code: context.test_code || null,
      test_name: context.test_name,
      value: context.value ?? null,
      unit: context.unit || null,
      flag: context.flag || null,
      report_date: context.report_date || context.date || null
    } : null,
    source: "atlas_minimal_context",
    sourceLabel: "Минимальный контекст Атласа здоровья",
    validationStatus: "AI-интеграция, требует врачебной валидации"
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
    labReports: (data.labReports || []).length,
    abnormal: (data.abnormal || []).length,
    visits: (data.visits || []).length,
    documents: (data.documents || []).length + (data.reports || []).length
  };
  basis.validationStatus = "AI-интеграция, ответ ограничен safety guard и требует врачебной валидации";
  return basis;
}

function safeResultAnswer(context) {
  const value = [
    context.value !== undefined ? context.value : "",
    context.unit || ""
  ].filter(Boolean).join(" ");
  const resultText = value ? ` со значением ${value}` : "";
  const dateText = context.report_date || context.date ? ` от ${context.report_date || context.date}` : "";
  return [
    `${context.test_name}${dateText}${resultText}: показатель ${flagText(context.flag)}.`,
    "Это не диагноз и не назначение лечения.",
    "Для приема можно подготовить вопросы врачу:",
    "- что могло повлиять на результат;",
    "- нужна ли перепроверка и когда;",
    "- какие данные или документы взять на прием;",
    "- какие дальнейшие шаги врач считает уместными."
  ].join("\n");
}

function attentionAnswer(data) {
  const items = (data.abnormal || []).slice(0, 6).map(labSummaryLine);
  return [
    items.length
      ? `В текущих данных за пределами обычного диапазона: ${items.join("; ")}.`
      : "По последним подключенным данным нет показателей вне обычного диапазона.",
    "Это не диагноз и не назначение лечения.",
    "На приеме лучше уточнить, какие из этих результатов врач считает приоритетными, что могло повлиять на значения и нужна ли перепроверка."
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
    "Для обсуждения с врачом удобно смотреть показатели не по одному, а блоками:",
    lines.length ? lines.join("\n") : "- сейчас нет показателей вне обычного диапазона.",
    "Связь между показателями должен оценивать врач с учетом жалоб, подготовки к анализу, лекарств и анамнеза."
  ].join("\n");
}

function missingDataAnswer() {
  return [
    "Для полноценной врачебной интерпретации обычно не хватает контекста, которого нет в одном лабораторном значении:",
    "- жалобы и цель обращения;",
    "- подготовка к анализу: натощак или нет, время сдачи;",
    "- список лекарств и добавок;",
    "- анамнез и сопутствующие состояния;",
    "- предыдущие результаты и PDF-бланки лаборатории;",
    "- план наблюдения от врача, если он уже есть."
  ].join("\n");
}

function visitPrepAnswer(data) {
  const reports = (data.labReports || []).slice(0, 3).map((report) => `${report.name} от ${report.date}`);
  return [
    "К приему стоит подготовить короткую папку по текущему эпизоду:",
    `- результаты, которые требуют внимания: ${(data.abnormal || []).length};`,
    `- последние исследования: ${reports.length ? reports.join("; ") : "нет данных"};`,
    "- PDF-бланки лаборатории, если врач попросит оригинал;",
    "- список вопросов: что могло повлиять на результат, нужна ли перепроверка, какие следующие шаги врач считает уместными;",
    "- жалобы, лекарства, подготовку к анализу и важные события перед сдачей."
  ].join("\n");
}

function overviewAnswer(data) {
  const items = (data.abnormal || []).slice(0, 4).map(labSummaryLine);
  return [
    `В кабинете подключено ${(data.labs || []).length} лабораторных показателей и ${(data.labReports || []).length} исследований.`,
    items.length
      ? `Для спокойного обсуждения с врачом можно вынести в начало: ${items.join("; ")}.`
      : "По последним данным нет показателей вне обычного диапазона.",
    "Ассистент не делает медицинских выводов. Его задача сейчас — собрать удобную сводку и вопросы к врачу."
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

  if (payload.context?.test_name) {
    basis.validationStatus = "AI-интеграция, ответ ограничен safety guard и требует врачебной валидации";
    return {
      answer: safeResultAnswer(payload.context),
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
  const question = clampText(payload.message || "", 1200);
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
      max_tokens: 700,
      temperature: 0.2
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
