const { getAiConfig } = require("../../config/ai");
const mockProvider = require("./providers/mockProvider");
const gigachatProvider = require("./providers/gigachatProvider");

const SAFETY = [
  "Это не диагноз.",
  "Не заменяет консультацию врача.",
  "Не содержит назначений лечения."
];

function envelope(response, meta) {
  return {
    provider: meta.provider,
    requestedProvider: meta.requestedProvider || meta.provider,
    aiEnabled: meta.aiEnabled,
    providerStatus: meta.providerStatus || "success",
    fallbackReason: meta.fallbackReason || undefined,
    mode: response.mode || meta.mode || "assistant_chat",
    ...response,
    safety: response.safety || SAFETY
  };
}

async function fallbackToMock(payload, patientId, config, fallbackReason) {
  console.warn("Assistant provider fallback", {
    requestedProvider: config.provider,
    fallbackProvider: "mock",
    reason: fallbackReason
  });
  const response = await mockProvider.chat(payload, patientId);
  return envelope(response, {
    provider: "mock",
    requestedProvider: config.provider,
    aiEnabled: config.enabled,
    providerStatus: "fallback",
    fallbackReason
  });
}

async function chat(payload = {}, patientId) {
  const config = getAiConfig();
  if (!config.enabled || config.provider === "mock") {
    const response = await mockProvider.chat(payload, patientId);
    return envelope(response, {
      provider: "mock",
      aiEnabled: config.enabled,
      providerStatus: "success"
    });
  }

  if (config.provider === "gigachat") {
    try {
      const response = await gigachatProvider.chat(payload, patientId, config.gigachat);
      return envelope(response, {
        provider: "gigachat",
        aiEnabled: config.enabled,
        providerStatus: "success"
      });
    } catch (error) {
      return fallbackToMock(payload, patientId, config, error.message || "gigachat_unavailable");
    }
  }

  return fallbackToMock(payload, patientId, config, "unsupported_provider");
}

module.exports = { chat };
