const assistantService = require("../services/assistantService");
const auditService = require("../services/auditService");
const { getDemoPatientId } = require("../utils/demoPatientContext");

async function chat(req, res, next) {
  try {
    const patientId = getDemoPatientId(req);
    const result = await assistantService.chat(req.body || {}, patientId);
    await auditService.createAuditEventFromRequest(req, {
      eventType: "assistant_chat",
      patientId,
      actorType: "demo_patient",
      actorId: patientId,
      resourceType: "assistant",
      resourceId: result.mode || "assistant_chat",
      status: result.providerStatus === "fallback" ? "fallback" : "success",
      details: {
        provider: result.provider,
        requestedProvider: result.requestedProvider,
        mode: result.mode,
        aiEnabled: result.aiEnabled,
        fallbackReason: result.fallbackReason || null
      }
    });
    res.json(result);
  } catch (error) {
    auditService.createAuditEventFromRequest(req, {
      eventType: "assistant_chat",
      patientId: getDemoPatientId(req),
      actorType: "demo_patient",
      actorId: getDemoPatientId(req),
      resourceType: "assistant",
      resourceId: req.body?.mode || "assistant_chat",
      status: "error",
      details: { provider: "unknown", mode: req.body?.mode || null }
    });
    next(error);
  }
}

module.exports = { chat };
