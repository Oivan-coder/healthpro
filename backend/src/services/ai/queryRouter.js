const patientService = require("../patientService");

function normalize(text) {
  return String(text || "").trim().toLowerCase().replace(/ё/g, "е");
}

function classify(message) {
  const text = normalize(message);
  if (!text) return "none";

  // Profile questions must always outrank any selected laboratory context.
  if (
    /(сколько\s+(?:мне|у меня)\s+(?:сейчас\s+)?лет)/i.test(text) ||
    /(?:а\s+)?лет\s+мне\s+сколько/i.test(text) ||
    /мне\s+сколько\s+лет/i.test(text) ||
    /(?:какой|сколько).*возраст|возраст.*(?:какой|сколько)|мой\s+возраст/i.test(text)
  ) return "profile_age";

  if (
    /какой\s+у\s+меня\s+пол|мой\s+пол|пол\s+у\s+меня|я\s+мужчина\s+или\s+женщина/i.test(text)
  ) return "profile_sex";

  if (
    /как\s+меня\s+зовут|мое\s+имя|моё\s+имя|как\s+зовут\s+меня/i.test(text)
  ) return "profile_name";

  // Keep short conversational phrases conversational, including common typos.
  if (
    /^(привет|здравствуй|здравствуйте|добрый день|доброе утро|добрый вечер|как дела|как ты|че как|чё как|че ка|чё ка|что нового)[?!.\s]*$/i.test(text)
  ) return "casual";

  if (/(поговорим|поговорить|о чем[- ]?то другом|другая тема|сменим тему|что расскажешь)/i.test(text)) return "casual";
  if (/\bоак\b|общ(ий|его).*анализ.*кров|клиническ.*анализ.*кров|коагулограмм|гемостаз|липидограмм|щитовид/i.test(text)) return "study";
  return "none";
}

async function directResponse(kind, patientId) {
  if (!kind.startsWith("profile_")) return null;
  const summary = await patientService.getSummary(patientId);
  const patient = summary.patient || {};
  let answer = "";
  let label = "Данные профиля";
  if (kind === "profile_age") answer = patient.age !== undefined && patient.age !== null ? `В профиле указан возраст: ${patient.age} лет.` : "Возраст в профиле не указан.";
  if (kind === "profile_sex") {
    const raw = String(patient.sex || "").toLowerCase();
    const sex = ["female", "f", "ж", "женский"].includes(raw) ? "женский" : ["male", "m", "м", "мужской"].includes(raw) ? "мужской" : patient.sex || "не указан";
    answer = `В профиле указан пол: ${sex}.`;
  }
  if (kind === "profile_name") answer = patient.name ? `В профиле указано имя: ${patient.name}.` : "Имя в профиле не указано.";
  return {
    mode: "assistant_chat",
    answer,
    actions: [],
    basis: {
      chain: kind,
      chainLabel: label,
      indicator: null,
      patientData: { patient: patient.name || null, age: patient.age ?? null, sex: patient.sex || null },
      source: "atlas_patient_profile",
      sourceLabel: "Профиль пациента",
      validationStatus: "Ответ по данным профиля пациента"
    }
  };
}

async function route(payload = {}, patientId) {
  const kind = classify(payload.message);
  const direct = await directResponse(kind, patientId);
  if (direct) return { direct, payload };
  if (["casual", "study"].includes(kind)) {
    return {
      direct: null,
      payload: { ...payload, context: null, mode: "assistant_chat" }
    };
  }
  return { direct: null, payload };
}

module.exports = { route, classify };
