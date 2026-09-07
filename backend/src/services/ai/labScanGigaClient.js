const crypto = require("crypto");
const https = require("https");

let cached = { key: "", token: "", expiresAt: 0, pending: null };
const apiError = (message, statusCode = 502) => Object.assign(new Error(message), { statusCode });

function request(url, options, config) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    if (target.protocol !== "https:") return reject(apiError("gigachat_https_required"));
    const body = Buffer.isBuffer(options.body) ? options.body : Buffer.from(String(options.body || ""));
    const req = https.request(target, {
      method: options.method || "POST",
      headers: { ...options.headers, "Content-Length": body.length },
      timeout: Math.max(1000, Math.min(Number(config.timeoutMs) || 12000, 45000)),
      agent: new https.Agent({ rejectUnauthorized: config.rejectUnauthorized !== false, ca: config.caCert })
    }, (response) => {
      const chunks = [];
      let size = 0;
      response.on("data", (chunk) => {
        size += chunk.length;
        if (size > 2 * 1024 * 1024) return req.destroy(apiError("gigachat_response_too_large"));
        chunks.push(chunk);
      });
      response.on("error", () => reject(apiError("gigachat_network_error")));
      response.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        let json = null;
        try { json = raw ? JSON.parse(raw) : {}; } catch (error) {}
        if (response.statusCode < 200 || response.statusCode >= 300) {
          return reject(apiError(`gigachat_http_${response.statusCode}`, response.statusCode));
        }
        if (!json) return reject(apiError("gigachat_invalid_json"));
        resolve(json);
      });
    });
    req.on("timeout", () => req.destroy(apiError("gigachat_timeout", 504)));
    req.on("error", (error) => reject(error.message?.startsWith("gigachat_") ? error : apiError("gigachat_network_error")));
    req.end(body);
  });
}

async function accessToken(config) {
  if (!config.authKey) throw apiError("gigachat_auth_key_missing", 401);
  const key = crypto.createHash("sha256").update([config.authUrl, config.scope, config.authKey].join("|")).digest("hex");
  if (cached.key !== key) cached = { key, token: "", expiresAt: 0, pending: null };
  if (cached.token && Date.now() < cached.expiresAt - 60000) return cached.token;
  if (!cached.pending) {
    cached.pending = request(config.authUrl, {
      headers: {
        Authorization: `Basic ${config.authKey}`,
        RqUID: crypto.randomUUID(),
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json"
      },
      body: new URLSearchParams({ scope: config.scope }).toString()
    }, config).then((json) => {
      if (!json.access_token) throw apiError("gigachat_token_missing");
      cached.token = json.access_token;
      cached.expiresAt = Number(json.expires_at) || Date.now() + 25 * 60000;
      return cached.token;
    }).finally(() => { cached.pending = null; });
  }
  return cached.pending;
}

function safeFilename(value) {
  const name = String(value || "analysis").replace(/[\r\n"\\/]/g, "_").slice(0, 120);
  return name || "analysis";
}

async function uploadFile(buffer, fileName, mimeType, config) {
  const token = await accessToken(config);
  const boundary = `----atlas-${crypto.randomBytes(12).toString("hex")}`;
  const prefix = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="purpose"\r\n\r\ngeneral\r\n` +
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${safeFilename(fileName)}"\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n`
  );
  const suffix = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([prefix, buffer, suffix]);
  const json = await request(`${config.apiUrl.replace(/\/$/, "")}/files`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      Accept: "application/json"
    },
    body
  }, config);
  const id = json.id || json.file_id;
  if (!id) throw apiError("gigachat_file_id_missing");
  return id;
}

function parseObject(text) {
  const raw = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const parse = (value) => {
    try {
      let result = JSON.parse(value);
      if (typeof result === "string") result = JSON.parse(result);
      return result && typeof result === "object" && !Array.isArray(result) ? result : null;
    } catch (error) { return null; }
  };
  const direct = parse(raw);
  if (direct) return direct;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  return start >= 0 && end > start ? parse(raw.slice(start, end + 1)) : null;
}

const SCAN_SCHEMA = {
  type: "json_schema",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      report_date: { type: "string" },
      laboratory: { type: "string" },
      report_name: { type: "string" },
      tests: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            code: { type: "string" },
            value: { type: "string" },
            unit: { type: "string" },
            reference: { type: "string" }
          },
          required: ["name", "code", "value", "unit", "reference"]
        }
      }
    },
    required: ["report_date", "laboratory", "report_name", "tests"]
  }
};

async function chatCompletion(payload, config, allowFormatFallback = true) {
  const token = await accessToken(config);
  try {
    const json = await request(`${config.apiUrl.replace(/\/$/, "")}/chat/completions`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload)
    }, config);
    const content = json.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) throw apiError("gigachat_answer_missing");
    return content.trim();
  } catch (error) {
    if (allowFormatFallback && payload.response_format && [400, 404, 415, 422].includes(error.statusCode)) {
      const fallback = { ...payload };
      delete fallback.response_format;
      return chatCompletion(fallback, config, false);
    }
    throw error;
  }
}

async function extractLabReport(fileId, config) {
  const system = [
    "Ты извлекаешь данные из лабораторного бланка пациента.",
    "Ничего не интерпретируй, не ставь диагноз и не исправляй значения.",
    "Верни только то, что явно видно в приложенном документе.",
    "Для каждого показателя сохрани исходное название, код/аббревиатуру если видна, значение, единицу и напечатанный референс.",
    "Если поле отсутствует, верни пустую строку. Дата — YYYY-MM-DD, если её можно однозначно прочитать, иначе пустая строка.",
    "Не включай строки без результата. Не объединяй разные показатели. Максимум 100 строк.",
    'Ответ — JSON вида {"report_date":"","laboratory":"","report_name":"","tests":[{"name":"","code":"","value":"","unit":"","reference":""}]}.'
  ].join("\n");
  const payload = {
    model: config.model,
    stream: false,
    temperature: 0,
    max_tokens: 2600,
    response_format: SCAN_SCHEMA,
    messages: [
      { role: "system", content: system },
      { role: "user", content: "Распознай приложенный лабораторный бланк и извлеки результаты.", attachments: [fileId] }
    ]
  };
  let content = await chatCompletion(payload, config, true);
  let parsed = parseObject(content);
  if (parsed && Array.isArray(parsed.tests)) return parsed;

  content = await chatCompletion({
    model: config.model,
    stream: false,
    temperature: 0,
    max_tokens: 2600,
    messages: [
      { role: "system", content: system },
      { role: "user", content: "Верни строго один валидный JSON-объект без markdown.", attachments: [fileId] }
    ]
  }, config, false);
  parsed = parseObject(content);
  if (!parsed || !Array.isArray(parsed.tests)) throw apiError("scan_invalid_response");
  return parsed;
}

module.exports = { uploadFile, extractLabReport, parseObject };
