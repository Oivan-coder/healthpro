require("../db/env");
const fs = require("fs");

function bool(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value).toLowerCase() === "true";
}

function firstEnv(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

function gigachatAuthKey() {
  const direct = firstEnv(
    "GIGACHAT_AUTH_KEY",
    "GIGACHAT_AUTH_DATA",
    "GIGACHAT_AUTHORIZATION_KEY",
    "GIGACHAT_API_KEY"
  );
  if (direct) return direct.replace(/^Basic\s+/i, "");

  const clientId = firstEnv("GIGACHAT_CLIENT_ID");
  const clientSecret = firstEnv("GIGACHAT_CLIENT_SECRET", "GIGACHAT_SECRET");
  if (clientId && clientSecret) {
    return Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  }

  return "";
}

function gigachatCaCert() {
  const caCertPath = firstEnv("GIGACHAT_CA_CERT_PATH");
  if (!caCertPath) return undefined;

  try {
    return fs.readFileSync(caCertPath, "utf8");
  } catch (error) {
    return undefined;
  }
}

function getAiConfig() {
  return {
    enabled: bool(process.env.AI_ENABLED, false),
    provider: String(process.env.AI_PROVIDER || "mock").toLowerCase(),
    gigachat: {
      authKey: gigachatAuthKey(),
      authUrl: process.env.GIGACHAT_AUTH_URL || "https://ngw.devices.sberbank.ru:9443/api/v2/oauth",
      apiUrl: process.env.GIGACHAT_API_URL || "https://api.giga.chat/v1",
      scope: process.env.GIGACHAT_SCOPE || "GIGACHAT_API_PERS",
      model: process.env.GIGACHAT_MODEL || "GigaChat-2",
      timeoutMs: Number(process.env.GIGACHAT_TIMEOUT_MS || 12000),
      maxPromptChars: Number(process.env.GIGACHAT_MAX_PROMPT_CHARS || 6000),
      rejectUnauthorized: bool(process.env.GIGACHAT_REJECT_UNAUTHORIZED, true),
      caCert: gigachatCaCert()
    }
  };
}

module.exports = { getAiConfig };
