const {contextFromLab,firstName,sexText} = require("./providers/mockProvider");
const clinicalKnowledge = require("./clinicalKnowledge");

function text(value,limit=1600) {return typeof value==="string"?value.trim().slice(0,limit):"";}
function sanitizePayload(payload={}) {
  const rows=Array.isArray(payload.history)?payload.history:[];
  // Never accept a client-supplied system message, medical fact, or patient ID.
  let remaining=6000;
  const history=[];
  for(const row of rows.slice(-12).reverse()) {
    if(!row || !["user","assistant"].includes(row.role)) continue;
    const content=text(row.content??row.text,Math.min(1200,remaining));
    if(!content) continue;
    history.unshift({role:row.role,content});remaining-=content.length;
    if(remaining<=0) break;
  }
  return {
    message:text(payload.message,2000),history,
    context:typeof payload.context?.test_code==="string"?{test_code:text(payload.context.test_code,120)}:null,
    mode:["assistant_chat","result_explanation","patient_summary","doctor_questions"].includes(payload.mode)?payload.mode:"assistant_chat"
  };
}
function labFact(lab) {
  const context=contextFromLab(lab);
  return {...context,history:context.history.slice(-8)};
}
function buildGrounding(route,data,maxChars=6000) {
  const profile=data.patient||{};
  const personal={name:profile.name||null,firstName:firstName(profile)||null,age:profile.age??null,sex:sexText(profile.sex),birthDate:profile.birthDate||null};
  const medical=!["casual","profile","clarify","general"].includes(route.intent);
  let labs=route.targetLab?[route.targetLab]:route.intent==="lab_group"?route.groupLabs:
    ["summary","attention","doctor_questions","missing_context"].includes(route.intent)?data.labs||[]:[];
  if(route.intent==="attention") labs=labs.filter(lab=>["high","low"].includes(lab.flag));
  const grounding={
    intent:route.intent,entity:route.entityLabel,profileField:route.profileField,
    patient:route.intent==="casual"?{firstName:personal.firstName}:personal,
    labs:[],historyEvents:[],documents:[],evidence:[],unavailable:[],
    counts:medical?{labs:(data.labs||[]).length,attention:(data.labs||[]).filter(lab=>["high","low"].includes(lab.flag)).length}:undefined,
    truncated:false
  };
  const limit=Math.max(3000,Math.min(Number(maxChars)||6000,20000));
  const append=(key,item)=>{
    grounding[key].push(item);
    if(JSON.stringify(grounding).length>limit){grounding[key].pop();grounding.truncated=true;return false;}
    return true;
  };
  // Relevant results and evidence precede optional background; never slice JSON mid-fact.
  for(const lab of labs.slice(0,60)) {
    const knowledge=clinicalKnowledge.knowledgeFor(contextFromLab(lab));
    const fact=labFact(lab);
    const entry=knowledge?{
      id:knowledge.groupId+":"+lab.code+":"+lab.flag,
      testCode:lab.code,title:knowledge.groupTitle,
      statement:knowledge.interpretation||null,related:knowledge.related,
      documents:knowledge.documents,sources:knowledge.sources,
      provenance:"local_curated_scenario",registryVersion:knowledge.registryVersion
    }:null;
    const previous=JSON.stringify(grounding).length;
    const bundleSize=JSON.stringify(fact).length+(entry?JSON.stringify(entry).length:0);
    if(previous+bundleSize>limit){grounding.truncated=true;break;}
    append("labs",fact);
    if(entry) append("evidence",entry);
  }
  if(medical) {
    for(const event of (data.historyEvents||[]).slice(0,8)) append("historyEvents",{
      title:text(event.title,255),details:text(event.details,700),date:event.started_at||event.created_at||null,
      source:"patient_confirmed",note:"Сообщено пациентом; не установленная помощником причина отклонения"
    });
    for(const item of [...(data.documents||[]),...(data.reports||[])].slice(0,6)) append("documents",{
      title:text(item.title,255),date:item.date||null,type:item.type||null,
      text:text(item.text,1000)||null,contentAvailable:Boolean(item.text)
    });
    if(!grounding.documents.length) grounding.unavailable.push("Личные документы не подключены. Общий демо-каталог не является документами пациента.");
    if(!grounding.historyEvents.length) grounding.unavailable.push("Подтверждённый анамнез не получен.");
    if(!grounding.evidence.length) grounding.unavailable.push("Для текущей темы нет тезисов evidence: разрешено описать данные, но нельзя выдумывать медицинские причины или связи.");
  }
  return grounding;
}
function basisFor(route,grounding) {
  return {
    chain:"dialogue_"+route.intent,chainLabel:"Ответ по вопросу и контексту диалога",
    indicator:route.targetLab?.name||null,
    patientData:{patient:grounding.patient.name||null,age:grounding.patient.age??null,
      test_name:route.targetLab?.name||null,value:route.targetLab?.latestValue??null,
      unit:route.targetLab?.unit||null,reference:route.targetLab?clinicalKnowledge.referenceText(contextFromLab(route.targetLab)):null},
    source:grounding.evidence.length?"atlas_evidence_layer":"atlas_patient_context",
    sourceLabel:grounding.evidence.length?"Локальные справочные тезисы Атласа":"Подключённые данные пациента",
    validationStatus:grounding.evidence.length
      ?"Ответ ограничен локальными тезисами; ссылки реестра не означают загрузку полных документов"
      :"Ответ по доступным данным; без медицинских причин и назначений",
    sources:grounding.evidence.flatMap(entry=>entry.sources),
    documents:grounding.evidence.flatMap(entry=>entry.documents)
  };
}
function responseContext(route) {
  return route.targetLab?{resolvedContext:contextFromLab(route.targetLab)}:{contextAction:"clear"};
}
module.exports={sanitizePayload,buildGrounding,basisFor,responseContext};
