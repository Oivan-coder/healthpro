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
async function chat(input={},patientId) {
  if(!patientId) throw Object.assign(new Error("patient_context_required"),{statusCode:403});
  const payload=context.sanitizePayload(input);
  if(!payload.message) throw Object.assign(new Error("message_required"),{statusCode:400});
  const config=getAiConfig();
  // One authoritative patient snapshot per request. No client-provided values or patient IDs.
  const data=await mock.buildPatientSummaryContext(patientId);
  let route,fallbackReason,reply;
  const enabled=config.enabled && config.provider==="gigachat";
  if(enabled) {
    try {route=await router.classify(payload,data,config.gigachat);}
    catch {fallbackReason="intent_router_unavailable";}
  }
  if(!route) route=fallbackRouter.route(payload,data);
  let grounding=context.buildGrounding(route,data,config.gigachat?.maxPromptChars);
  if(enabled && !fallbackReason) {
    try {reply=await gigachat.chat(payload,route,grounding,config.gigachat);}
    catch(error) {
      fallbackReason="answer_validation_or_provider_failed";
      if(error.message==="answer_off_topic") {
        route={intent:"clarify"};
        grounding=context.buildGrounding(route,data,config.gigachat?.maxPromptChars);
      }
    }
  }
  if(!reply) reply={answer:evidence.answer(route,data),safetyGuardApplied:Boolean(fallbackReason)};
  const basis=context.basisFor(route,grounding);
  if(reply.evidenceIds) {
    const used=grounding.evidence.filter(item=>reply.evidenceIds.includes(item.id));
    basis.sources=used.flatMap(item=>item.sources);
    basis.documents=used.flatMap(item=>item.documents);
    basis.evidenceIds=reply.evidenceIds;
  }
  return {
    ...reply,actions:[],basis,...context.responseContext(route),
    // Only an unavailable router uses the legacy symptom fallback. A model's null
    // explicitly means "do not propose a history record", including negations.
    ...(enabled && fallbackReason!=="intent_router_unavailable"?{historySuggestion:route.historySuggestion||null}:{}),
    provider:enabled&&!fallbackReason?"gigachat":"mock",requestedProvider:config.provider,
    aiEnabled:config.enabled,providerStatus:fallbackReason?"fallback":"success",fallbackReason,
    mode:modeFor(route.intent),
    router:{intent:route.intent,entityLabel:route.entityLabel||null,confidence:route.confidence??null},
    safety:["Это не диагноз.","Не заменяет консультацию врача.","Не содержит назначений лечения."]
  };
}
module.exports={chat};
