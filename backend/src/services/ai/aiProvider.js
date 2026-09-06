const {getAiConfig} = require("../../config/ai");
const mock = require("./providers/mockProvider");
const evidence = require("./providers/evidenceProvider");
const gigachat = require("./providers/gigachatProvider");
const router = require("./llmIntentRouter");
const fallbackRouter = require("./queryRouter");
const context = require("./assistantContext");

function modeFor(intent) {
  if(["summary","attention"].includes(intent)) return "patient_summary";
  if(["lab_result","lab_group"].includes(intent)) return "result_explanation";
  if(["doctor_questions","missing_context"].includes(intent)) return "doctor_questions";
  return "assistant_chat";
}
function logAiFailure(stage,error) {
  console.warn("Assistant GigaChat failure", {
    stage,
    message:error?.message || "unknown_error",
    statusCode:error?.statusCode || null,
    code:error?.code || null
  });
}
async function chat(input={},patientId) {
  if(!patientId) throw Object.assign(new Error("patient_context_required"),{statusCode:403});
  const payload=context.sanitizePayload(input);
  if(!payload.message) throw Object.assign(new Error("message_required"),{statusCode:400});
  const config=getAiConfig();
  const data=await mock.buildPatientSummaryContext(patientId);
  let route,routerFallbackReason,fallbackReason,reply;
  const enabled=config.enabled && config.provider==="gigachat";

  if(enabled) {
    try {route=await router.classify(payload,data,config.gigachat);}
    catch(error) {
      routerFallbackReason="intent_router_unavailable";
      logAiFailure("intent_router",error);
    }
  }

  // If semantic routing is temporarily unavailable, use the narrow deterministic
  // router only to build safe context. Still give GigaChat a chance to answer:
  // a transient router failure should not turn the whole conversation into mock mode.
  if(!route) route=fallbackRouter.route(payload,data);
  let grounding=context.buildGrounding(route,data,config.gigachat?.maxPromptChars);

  if(enabled) {
    try {reply=await gigachat.chat(payload,route,grounding,config.gigachat);}
    catch(error) {
      fallbackReason="answer_validation_or_provider_failed";
      logAiFailure("answer_or_review",error);
      if(error.message==="answer_off_topic") {
        route={intent:"clarify"};
        grounding=context.buildGrounding(route,data,config.gigachat?.maxPromptChars);
      }
    }
  }

  if(!reply) reply={answer:evidence.answer(route,data),safetyGuardApplied:Boolean(fallbackReason||routerFallbackReason)};
  const basis=context.basisFor(route,grounding);
  if(reply.evidenceIds) {
    const used=grounding.evidence.filter(item=>reply.evidenceIds.includes(item.id));
    basis.sources=used.flatMap(item=>item.sources);
    basis.documents=used.flatMap(item=>item.documents);
    basis.evidenceIds=reply.evidenceIds;
  }

  const aiSucceeded=enabled && Boolean(reply?.evidenceIds || (!fallbackReason && reply?.answer)) && !fallbackReason;
  return {
    ...reply,actions:[],basis,...context.responseContext(route),
    ...(enabled && !routerFallbackReason?{historySuggestion:route.historySuggestion||null}:{}),
    provider:aiSucceeded?"gigachat":"mock",requestedProvider:config.provider,
    aiEnabled:config.enabled,
    providerStatus:fallbackReason?"fallback":routerFallbackReason&&aiSucceeded?"degraded":"success",
    fallbackReason,
    routerFallbackReason,
    mode:modeFor(route.intent),
    router:{intent:route.intent,entityLabel:route.entityLabel||null,confidence:route.confidence??null},
    safety:["Это не диагноз.","Не заменяет консультацию врача.","Не содержит назначений лечения."]
  };
}
module.exports={chat};
