const assistantService = require("../services/assistantService");
const patientHistoryService = require("../services/patientHistoryService");
const auditService = require("../services/auditService");
const { getDemoPatientId } = require("../utils/demoPatientContext");

const pendingHistorySuggestions = new Map();

function normalize(text) {
  return String(text || "").trim().toLowerCase().replace(/ё/g, "е");
}

function isYes(text) {
  return /^(да|ага|угу|ок|окей|добавь|добавить|запиши|записать|сохрани|сохранить|давай)$/i.test(normalize(text));
}

function isNo(text) {
  return /^(нет|не надо|не добавляй|не сохраняй|отмена|отмени)$/i.test(normalize(text));
}

async function chat(req, res, next) {
  try {
    const patientId = getDemoPatientId(req);
    const message = req.body?.message || "";
    const stored = pendingHistorySuggestions.get(patientId);
    const lastTurn = Array.isArray(req.body?.history) ? req.body.history.at(-1) : null;
    const matchesConversation = !Array.isArray(req.body?.history) ||
      (lastTurn?.role === "assistant" && typeof lastTurn.content === "string" &&
        lastTurn.content.includes(`Добавить в анамнез: «${stored?.suggestion.title}»?`));
    const pending = stored && stored.expiresAt > Date.now() && matchesConversation ? stored.suggestion : null;
    // A confirmation is valid only for the immediately preceding suggestion.
    // A new topic, a refusal, or expiry cancels it; consume before an async write.
    pendingHistorySuggestions.delete(patientId);

    if (pending && isYes(message)) {
      const saved = await patientHistoryService.create(patientId, pending);
      pendingHistorySuggestions.delete(patientId);
      await auditService.createAuditEventFromRequest(req, {
        eventType: "patient_history_confirmed_from_chat",
        patientId,
        actorType: "demo_patient",
        actorId: patientId,
        resourceType: "patient_history_event",
        resourceId: String(saved.id),
        status: "success",
        details: { event_type: saved.event_type, title: saved.title }
      });
      res.json({
        mode: "assistant_chat",
        provider: "local",
        providerStatus: "success",
        answer: `Добавил в анамнез: ${saved.title}. Я буду учитывать это в следующих ответах, когда это действительно важно.`,
        actions: [],
        basis: {
          chain: "patient_history_confirmed",
          chainLabel: "Подтверждённая запись анамнеза",
          indicator: null,
          patientData: { historyEvent: saved.title },
          source: "patient_confirmed_history",
          sourceLabel: "Анамнез, подтверждённый пациентом",
          validationStatus: "Запись сохранена только после подтверждения пациента"
        }
      });
      return;
    }

    if (pending && isNo(message)) {
      pendingHistorySuggestions.delete(patientId);
      res.json({
        mode: "assistant_chat",
        provider: "local",
        providerStatus: "success",
        answer: "Хорошо, не сохраняю это в анамнез.",
        actions: []
      });
      return;
    }

    const result = await assistantService.chat(req.body || {}, patientId);
    const historySuggestion = Object.hasOwn(result, "historySuggestion")
      ? result.historySuggestion : patientHistoryService.suggestFromMessage(message);
    if (historySuggestion) pendingHistorySuggestions.set(patientId, {suggestion:historySuggestion,expiresAt:Date.now()+5*60*1000});

    const answer = historySuggestion
      ? `${result.answer}\n\nЯ заметил информацию, которая может быть полезна для дальнейшей интерпретации. Добавить в анамнез: «${historySuggestion.title}»? Напишите «да» или «нет».`
      : result.answer;

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
        fallbackReason: result.fallbackReason || null,
        historySuggestion: Boolean(historySuggestion)
      }
    });
    res.json({ ...result, answer, historySuggestion });
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
