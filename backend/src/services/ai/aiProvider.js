const { getAiConfig } = require("../../config/ai");
const mockProvider = require("./providers/evidenceProvider");
const gigachatProvider = require("./providers/gigachatProvider");
const llmIntentRouter = require("./llmIntentRouter");

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

function routedMode(intent, currentMode) {
  if (intent === "summary" || intent === "attention") return "patient_summary";
  if (intent === "doctor_questions" || intent === "missing_context") return "doctor_questions";
  if (intent === "lab_result" || intent === "lab_group") return "result_explanation";
  if (intent === "casual" || intent === "general") return "assistant_chat";
  return currentMode || "assistant_chat";
}

async function chatWithGigachatRouter(payload, patientId, config) {
  const route = await llmIntentRouter.classify(payload, patientId, config.gigachat);
  if (!route) return gigachatProvider.chat(payload, patientId, config.gigachat);

  if (route.intent === "lab_result" && route.targetLab) {
    const resolvedContext = llmIntentRouter.contextFromLab(route.targetLab);
    const response = await mockProvider.evidenceAnswer(resolvedContext, patientId);
    if (response) {
      response.resolvedContext = resolvedContext;
      response.router = {
        intent: route.intent,
        entityLabel: route.entityLabel,
        confidence: route.confidence
      };
      return response;
    }
  }

  if (route.intent === "lab_group" && route.groupLabs.length) {
    const response = llmIntentRouter.groupResponse(route);
    if (response) {
      response.router = {
        intent: route.intent,
        entityLabel: route.entityLabel,
        confidence: route.confidence
      };
      return response;
    }
  }

  const routedPayload = {
    ...payload,
    mode: routedMode(route.intent, payload.mode),
    context: route.useSelected ? payload.context : null,
    router: {
      intent: route.intent,
      entityLabel: route.entityLabel,
      confidence: route.confidence
    }
  };

  const response = await gigachatProvider.chat(routedPayload, patientId, config.gigachat);
  response.router = routedPayload.router;
  if (!route.useSelected && payload.context?.test_name) response.contextAction = "clear";
  return response;
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
      const response = await chatWithGigachatRouter(payload, patientId, config);
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
