const crypto = require("crypto");
const https = require("https");
const mockProvider = require("./providers/mockProvider");

let tokenCache = { accessToken: "", expiresAt: 0 };

const ROUTER_PROMPT = [
  "Ты маршрутизатор запросов пациентского ассистента «Атлас здоровья».",
  "Твоя задача — понять смысл фразы пользователя, даже если она написана разговорно, с опечатками, сокращениями или сленгом.",
  "Не отвечай на медицинский вопрос. Верни только JSON.",
  "Допустимые intent: casual, lab_result, lab_group, summary, attention, doctor_questions, missing_context, general.",
  "Если пользователь явно называет новый анализ или показатель, он ВСЕГДА важнее ранее выбранного показателя интерфейса.",
  "Ранее выбранный показатель можно использовать только для явного продолжения вроде «а почему он высокий?», «а что с ним связано?», когда новый объект не назван.",
  "Для lab_result выбери target_code ТОЛЬКО из переданного каталога.",
  "Для lab_group выбери group_codes ТОЛЬКО из переданного каталога. Сам реши, какие показатели относятся к названной пользователем группе: ОАК, ОАМ, биохимия, гемостаз, липидограмма, щитовидная железа и т.п.",
  "Не требуй от пользователя точных медицинских терминов. «че там с оак», «моча как», «биохимия норм?», «ддимер че значит» должны быть поняты по смыслу.",
  "Если это обычный разговор не про медданные — intent casual.",
  "Формат строго: {\"intent\":\"...\",\"target_code\":null,\"group_codes\":[],\"entity_label\":null,\"use_selected\":false,\"confidence\":0.0}",
  "Никакого markdown и текста вне JSON."
].join("\n");

function safeError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function parseJsonBody(body) {
  if (!body) return {};
  try { return JSON.parse(body); } catch (error) { return {}; }
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
      response.on("data", chunk => chunks.push(chunk));
      response.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(safeError(`gigachat_router_http_${response.statusCode}`, response.statusCode));
          return;
        }
        resolve(parseJsonBody(text));
      });
    });
    request.on("timeout", () => request.destroy(safeError("gigachat_router_timeout", 504)));
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
  if (!json.access_token) throw safeError("gigachat_router_token_missing", 502);
  tokenCache = {
    accessToken: json.access_token,
    expiresAt: Number(json.expires_at || 0) || Date.now() + 25 * 60 * 1000
  };
  return tokenCache.accessToken;
}

function extractJson(text) {
  const raw = String(text || "").trim();
  try { return JSON.parse(raw); } catch (error) {}
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch (error) { return null; }
}

function normalizeRoute(raw, data, payload) {
  if (!raw || typeof raw !== "object") return null;
  const intents = new Set(["casual", "lab_result", "lab_group", "summary", "attention", "doctor_questions", "missing_context", "general"]);
  const intent = intents.has(raw.intent) ? raw.intent : "general";
  const labs = data.labs || [];
  const byCode = new Map(labs.map(lab => [String(lab.code || ""), lab]));
  const selectedCode = String(payload.context?.test_code || "");

  let targetCode = raw.target_code ? String(raw.target_code) : null;
  if (targetCode && !byCode.has(targetCode)) targetCode = null;
  if (!targetCode && raw.use_selected && selectedCode && byCode.has(selectedCode)) targetCode = selectedCode;

  const groupCodes = Array.isArray(raw.group_codes)
    ? [...new Set(raw.group_codes.map(String).filter(code => byCode.has(code)))].slice(0, 20)
    : [];

  return {
    intent,
    targetCode,
    targetLab: targetCode ? byCode.get(targetCode) : null,
    groupCodes,
    groupLabs: groupCodes.map(code => byCode.get(code)).filter(Boolean),
    entityLabel: raw.entity_label ? String(raw.entity_label).slice(0, 120) : null,
    useSelected: Boolean(raw.use_selected),
    confidence: Math.max(0, Math.min(1, Number(raw.confidence) || 0)),
    data
  };
}

async function classify(payload = {}, patientId, config) {
  const message = String(payload.message || "").trim();
  if (!message || !patientId) return null;

  const data = await mockProvider.buildPatientSummaryContext(patientId);
  const labs = (data.labs || []).slice(0, 120);
  const catalog = labs.map(lab => `${lab.code} | ${lab.name} | ${lab.group || "без группы"}`).join("\n");
  const selected = payload.context?.test_name
    ? `${payload.context.test_code || "без кода"} | ${payload.context.test_name}`
    : "не выбран";

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
        { role: "system", content: ROUTER_PROMPT },
        {
          role: "user",
          content: [
            `Фраза пользователя: ${message}`,
            `Ранее выбранный показатель: ${selected}`,
            "Каталог доступных лабораторных показателей:",
            catalog || "нет лабораторных данных"
          ].join("\n")
        }
      ],
      stream: false,
      max_tokens: 220,
      temperature: 0
    })
  }, config);

  const content = json.choices?.[0]?.message?.content;
  if (!content) throw safeError("gigachat_router_answer_missing", 502);
  return normalizeRoute(extractJson(content), data, payload);
}

function contextFromLab(lab) {
  if (!lab) return null;
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

function flagText(flag) {
  if (flag === "high") return "выше референсного диапазона";
  if (flag === "low") return "ниже референсного диапазона";
  if (flag === "normal") return "в референсном диапазоне";
  return "без однозначного статуса";
}

function groupResponse(route) {
  const labs = route.groupLabs || [];
  if (!labs.length) return null;
  const name = mockProvider.firstName(route.data?.patient || {});
  const abnormal = labs.filter(lab => lab.flag && lab.flag !== "normal");
  const label = route.entityLabel || "этот блок анализов";
  const lines = [
    `${name ? `${name}, ` : ""}по запросу «${label}» я нашёл ${labs.length} показателей${abnormal.length ? `; ${abnormal.length} из них вне референсного диапазона` : "; по подключённым референсам отклонений не видно"}.`,
    ...labs.slice(0, 12).map(lab => `- ${lab.name}: ${lab.latestValue ?? ""} ${lab.unit || ""} — ${flagText(lab.flag)}`)
  ];
  if ((route.data?.historyEvents || []).length) {
    lines.push(`Из подтверждённого анамнеза также учитываю: ${(route.data.historyEvents || []).slice(0, 3).map(event => event.title).join("; ")}.`);
  }
  lines.push("Если хотите, можно разобрать любой из этих показателей отдельно по подключённой доказательной базе.");
  return {
    mode: "result_explanation",
    answer: lines.join("\n"),
    actions: [],
    contextAction: "clear",
    basis: {
      chain: "llm_routed_lab_group",
      chainLabel: "AI распознал группу анализов",
      indicator: null,
      patientData: {
        patient: route.data?.patient?.name || null,
        group: label,
        tests: labs.map(lab => lab.name),
        abnormal: abnormal.length
      },
      source: "atlas_patient_context",
      sourceLabel: "Данные пациента в Атласе здоровья",
      validationStatus: "Группа определена AI; значения взяты только из данных пациента; диагноз не формируется"
    }
  };
}

module.exports = { classify, contextFromLab, groupResponse };
