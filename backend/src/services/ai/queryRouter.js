// Limited offline/outage fallback. The enabled LLM does not pass through these rules.
const mock = require("./providers/mockProvider");
function profileField(message) {
  const text=message.toLowerCase().replace(/ё/g,"е");
  if(/сколько.*лет|скока.*лет|возраст/.test(text)) return "age";
  if(/как.*(?:меня|мое).*зовут|мое имя/.test(text)) return "name";
  if(/мой пол|какой.*пол|пол.*у меня/.test(text)) return "sex";
  if(/когда.*родил|дата.*рожд|день.*рожд/.test(text)) return "birthDate";
  return null;
}
function route(payload,data) {
  const field=profileField(payload.message);
  if(field) return {intent:"profile",profileField:field};
  const selected=(data.labs||[]).find(lab=>lab.code===payload.context?.test_code);
  const context=mock.contextFromLab(selected);
  const detected=mock.detectIntent(payload.message,"assistant_chat",context,data);
  if(detected.kind==="result") {
    const lab=(data.labs||[]).find(item=>item.code===detected.context?.test_code);
    return lab?{intent:"lab_result",targetCode:lab.code,targetLab:lab}:{intent:"clarify"};
  }
  if(detected.kind==="study") return {
    intent:"lab_group",entityLabel:detected.topic,
    groupLabs:(data.labs||[]).filter(lab=>mock.humanGroup(lab)===detected.topic)
  };
  const intent=({casual:"casual",summary:"summary",attention:"attention",missing:"missing_context",doctor_questions:"doctor_questions"})[detected.kind]||"clarify";
  return {intent,targetLab:["doctor_questions","missing_context"].includes(intent)?selected:null};
}
module.exports={route};
