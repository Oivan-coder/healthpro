const mock = require("./mockProvider");
const clinicalKnowledge = require("../clinicalKnowledge");

function line(lab) {
  const context=mock.contextFromLab(lab);
  const flag=({high:"выше диапазона",low:"ниже диапазона",normal:"в диапазоне"})[lab.flag]||"нет оценки";
  const value=context.value==null?"нет значения":context.value;
  const reference=clinicalKnowledge.referenceText(context);
  return `${lab.name}: ${value} ${lab.unit||""} — ${flag}${reference?` (реф.: ${reference})`:""}`.trim();
}
function answer(route,data) {
  const lab=route.targetLab;
  if(route.intent==="profile") {
    const patient=data.patient||{},field=route.profileField;
    const value=({age:patient.age,name:patient.name,sex:mock.sexText(patient.sex),birthDate:patient.birthDate})[field];
    return value!=null && value!=="" ? ({
      age:`По дате рождения в профиле вам ${value} ${Number(value)%10===1&&Number(value)%100!==11?"год":Number(value)%10>=2&&Number(value)%10<=4&&(Number(value)%100<12||Number(value)%100>14)?"года":"лет"}.`,
      name:`В профиле указано: ${value}.`,sex:`В профиле указан пол: ${value}.`,birthDate:`Дата рождения в профиле: ${value}.`
    })[field]||"Какое поле профиля вас интересует?" : "Эти данные в профиле не указаны.";
  }
  if(route.intent==="casual") return "Нормально 🙂 Я на связи. Можем обсудить анализы, здоровье или вообще что-нибудь другое.";
  if(lab && route.intent==="lab_result") {
    const knowledge=clinicalKnowledge.knowledgeFor(mock.contextFromLab(lab));
    return [
      line(lab),
      (lab.history||[]).length>1?`В динамике: ${lab.history.slice(-6).map(row=>`${row.date}: ${row.value??"—"} ${row.unit||lab.unit||""}`).join("; ")}.`:"",
      knowledge?.interpretation||"В подключённой базе недостаточно оснований, чтобы объяснить причину этого результата.",
      knowledge?.related?.length?`Для оценки этого блока также смотрят: ${knowledge.related.join(", ")}. Это не означает, что вам обязательно нужны все эти исследования.`:"",
      "По одному этому результату диагноз не определяется."
    ].filter(Boolean).join("\n");
  }
  if(route.intent==="lab_group") {
    const labs=route.groupLabs||[],abnormal=labs.filter(item=>["high","low"].includes(item.flag)).length;
    return labs.length?[`В этой группе ${labs.length} показателей; вне референсов — ${abnormal}.`,...labs.slice(0,20).map(item=>"- "+line(item))].join("\n")
      :"В подключённых результатах эта группа не найдена.";
  }
  if(["summary","attention"].includes(route.intent)) {
    const labs=route.intent==="attention"?(data.labs||[]).filter(item=>["high","low"].includes(item.flag)):data.labs||[];
    const abnormal=(data.labs||[]).filter(item=>["high","low"].includes(item.flag));
    if(!labs.length) return "По подключённым данным заметных лабораторных отклонений сейчас не вижу.";
    if(route.intent==="summary") {
      return [
        abnormal.length
          ? `Если коротко: в последних анализах есть ${abnormal.length} ${abnormal.length===1?"показатель вне референса":"показателей вне референса"}.`
          : "Если коротко: по последним анализам отклонений от подключённых референсов не видно.",
        abnormal.length?abnormal.slice(0,5).map(item=>"- "+line(item)).join("\n"):"",
        (data.historyEvents||[]).length?`Из сохранённого анамнеза также учитываю: ${(data.historyEvents||[]).slice(0,3).map(item=>item.title).join("; ")}.`:"",
        "Это общая картина по данным кабинета, а не диагноз."
      ].filter(Boolean).join("\n");
    }
    return labs.slice(0,8).map(item=>"- "+line(item)).join("\n");
  }
  if(route.intent==="history") return (data.historyEvents||[]).length
    ?"В подтверждённом анамнезе:\n"+data.historyEvents.slice(0,6).map(item=>"- "+item.title).join("\n")
    :"Подтверждённый анамнез пока не подключён.";
  if(route.intent==="documents") {
    const docs=[...(data.documents||[]),...(data.reports||[])];
    return docs.length?"Подключены документы:\n"+docs.slice(0,6).map(item=>"- "+item.title+(item.date?" · "+item.date:"")).join("\n")
      :"Личные документы пока не подключены. Общий демо-каталог не является вашими документами.";
  }
  if(route.intent==="doctor_questions") return "Можно обсудить с врачом:\n- Как оценить эти результаты вместе с моими жалобами и анамнезом?\n- Что показывает сравнение с предыдущими значениями?\n- Какие выводы позволяют сделать имеющиеся данные?";
  if(route.intent==="missing_context") return "Что именно вы хотите уточнить по результату? Можно описать жалобы и цель исследования. Я отделю ваши слова от подтверждённых данных кабинета.";
  return "Я не уверен, что правильно понял вопрос. Скажите чуть иначе — можно совсем простыми словами.";
}
async function evidenceAnswer(context,patientId,data) {
  data=data||await mock.buildPatientSummaryContext(patientId);
  const lab=(data.labs||[]).find(item=>item.code===context?.test_code);
  return lab?{mode:"result_explanation",answer:answer({intent:"lab_result",targetLab:lab},data),actions:[]}:null;
}
module.exports={answer,evidenceAnswer,buildPatientSummaryContext:mock.buildPatientSummaryContext,labToContext:mock.contextFromLab};
