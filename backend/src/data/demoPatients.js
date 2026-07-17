const baseCatalog = require("./labCatalog.json");

const extraTests = [
  { code: "MCV", name: "MCV", group: "ОАК", unit: "фл", low: 80, high: 96, loinc: "", graphable: true },
  { code: "MCH", name: "MCH", group: "ОАК", unit: "пг", low: 27, high: 33, loinc: "", graphable: true },
  { code: "FERR", name: "Ферритин", group: "Железо", unit: "нг/мл", low: 30, high: 300, loinc: "", graphable: true },
  { code: "IRON", name: "Железо", group: "Железо", unit: "мкмоль/л", low: 9, high: 30, loinc: "", graphable: true },
  { code: "TIBC", name: "ОЖСС", group: "Железо", unit: "мкмоль/л", low: 45, high: 72, loinc: "", graphable: true },
  { code: "B12", name: "B12", group: "Витамины", unit: "пг/мл", low: 200, high: 900, loinc: "", graphable: true },
  { code: "GGT", name: "ГГТ", group: "Биохимия", unit: "Ед/л", low: 0, high: 60, loinc: "", graphable: true },
  { code: "BIL", name: "Билирубин общий", group: "Биохимия", unit: "мкмоль/л", low: 3, high: 21, loinc: "", graphable: true },
  { code: "ALP", name: "ЩФ", group: "Биохимия", unit: "Ед/л", low: 40, high: 130, loinc: "", graphable: true },
  { code: "ALB", name: "Альбумин", group: "Биохимия", unit: "г/л", low: 35, high: 52, loinc: "", graphable: true }
];

const catalog = [...baseCatalog, ...extraTests];
const byCode = Object.fromEntries(catalog.map((item) => [item.code, item]));
const createdVisits = {};

const profiles = {
  alexey: {
    id: "alexey",
    name: "Алексей Петров",
    initials: "АП",
    profile: "метаболический риск",
    misCard: "MIS-248019",
    routes: ["эндокринолог", "кардиолог", "терапевт"],
    directions: ["глюкоза", "HbA1c", "липидный профиль"]
  },
  anna: {
    id: "anna",
    name: "Анна Смирнова",
    initials: "АС",
    profile: "анемия / железодефицит",
    misPatientId: "mis_391204",
    misCard: "MIS-391204",
    phone: "+7 900 391-20-04",
    birthDate: "03.03.1991",
    age: 35,
    sex: "Женский",
    policy: "ОМС •••• 1204",
    clinic: "Частная клиника «Пилот»",
    region: "Московская область",
    routes: ["терапевт", "гематолог"],
    directions: ["ОАК", "ферритин", "железо"]
  },
  dmitry: {
    id: "dmitry",
    name: "Дмитрий Орлов",
    initials: "ДО",
    profile: "печеночные ферменты",
    misPatientId: "mis_582771",
    misCard: "MIS-582771",
    phone: "+7 900 582-77-10",
    birthDate: "21.11.1978",
    age: 47,
    sex: "Мужской",
    policy: "ОМС •••• 2771",
    clinic: "Частная клиника «Пилот»",
    region: "Московская область",
    routes: ["терапевт", "гастроэнтеролог"],
    directions: ["АЛТ", "АСТ", "ГГТ"]
  }
};

const observations = {
  anna: [
    ["HGB", 109, "02.04.2026"], ["HGB", 104, "18.04.2026"], ["HGB", 106, "26.04.2026"],
    ["MCV", 78, "18.04.2026"], ["MCH", 25, "18.04.2026"],
    ["WBC", 5.9, "18.04.2026"], ["PLT", 318, "18.04.2026"],
    ["FERR", 14, "02.04.2026"], ["FERR", 11, "26.04.2026"],
    ["IRON", 7.2, "26.04.2026"], ["TIBC", 76, "26.04.2026"], ["B12", 245, "26.04.2026"]
  ],
  dmitry: [
    ["ALT", 68, "01.04.2026"], ["ALT", 82, "20.04.2026"], ["ALT", 76, "27.04.2026"],
    ["AST", 47, "20.04.2026"], ["AST", 54, "27.04.2026"],
    ["GGT", 118, "20.04.2026"], ["GGT", 126, "27.04.2026"],
    ["BIL", 26, "27.04.2026"], ["ALP", 122, "27.04.2026"], ["ALB", 42, "27.04.2026"],
    ["CRP", 3.2, "27.04.2026"]
  ]
};

const reportTemplates = {
  anna: [
    { id: "anna_cbc_1804", date: "18.04.2026", name: "ОАК", serviceCode: "CBC", codes: ["HGB", "MCV", "MCH", "WBC", "PLT"] },
    { id: "anna_iron_2604", date: "26.04.2026", name: "Железо и ферритин", serviceCode: "IRON", codes: ["HGB", "FERR", "IRON", "TIBC", "B12"] }
  ],
  dmitry: [
    { id: "dmitry_liver_2004", date: "20.04.2026", name: "Печеночные ферменты", serviceCode: "LIVER", codes: ["ALT", "AST", "GGT"] },
    { id: "dmitry_biochem_2704", date: "27.04.2026", name: "Биохимия печени", serviceCode: "BIOCHEM", codes: ["ALT", "AST", "GGT", "BIL", "ALP", "ALB", "CRP"] }
  ]
};

const reports = {
  anna: [
    { id: "anna_r_1", date: "26.04.2026", title: "Заключение терапевта", doctor: "Иванова М.С.", status: "Новое", text: "Рекомендовано обсудить показатели ОАК и обмена железа. Диагноз по одному набору анализов не устанавливается." },
    { id: "anna_r_2", date: "18.04.2026", title: "Комментарий лаборатории", doctor: "Лаборатория", status: "Подписано", text: "Показатели крови требуют сопоставления с жалобами, анамнезом и подготовкой к исследованию." }
  ],
  dmitry: [
    { id: "dmitry_r_1", date: "27.04.2026", title: "Заключение терапевта", doctor: "Павлов Н.А.", status: "Новое", text: "Рекомендовано обсудить печеночные ферменты и биохимические показатели с врачом." },
    { id: "dmitry_r_2", date: "20.04.2026", title: "Заключение гастроэнтеролога", doctor: "Морозова Е.К.", status: "Подписано", text: "Для интерпретации важны лекарства, питание, алкоголь, УЗИ и предыдущие результаты." }
  ]
};

const documents = {
  anna: [
    { id: "anna_d_1", title: "ОАК", date: "18.04.2026", type: "PDF", size: "92 КБ", icon: "◌" },
    { id: "anna_d_2", title: "Железо и ферритин", date: "26.04.2026", type: "PDF", size: "104 КБ", icon: "□" }
  ],
  dmitry: [
    { id: "dmitry_d_1", title: "Биохимия печени", date: "27.04.2026", type: "PDF", size: "108 КБ", icon: "◌" },
    { id: "dmitry_d_2", title: "Заключение гастроэнтеролога", date: "20.04.2026", type: "PDF", size: "118 КБ", icon: "□" }
  ]
};

const visits = {
  anna: [
    { id: "anna_v_1", date: "29.04.2026", time: "10:00", specialty: "Терапевт", doctor: "Иванова М.С.", room: "204", status: "Запланировано", note: "Обсудить ОАК и обмен железа." },
    { id: "anna_v_2", date: "18.04.2026", time: "16:30", specialty: "Терапевт", doctor: "Иванова М.С.", room: "204", status: "Завершено", note: "Назначена лабораторная проверка." }
  ],
  dmitry: [
    { id: "dmitry_v_1", date: "30.04.2026", time: "12:30", specialty: "Гастроэнтеролог", doctor: "Морозова Е.К.", room: "308", status: "Запланировано", note: "Обсудить печеночные ферменты." },
    { id: "dmitry_v_2", date: "20.04.2026", time: "09:30", specialty: "Терапевт", doctor: "Павлов Н.А.", room: "205", status: "Завершено", note: "Рекомендована биохимия." }
  ]
};

function isSyntheticPatient(id) {
  return id === "anna" || id === "dmitry";
}

function getPatient(id) {
  return profiles[id] || profiles.alexey;
}

function getObservations(id) {
  return (observations[id] || []).map(([code, value, date]) => ({ code, value, date }));
}

function flagFor(meta, value) {
  if (value > meta.high) return "high";
  if (value < meta.low) return "low";
  return "normal";
}

function getLabs(id) {
  const grouped = {};
  getObservations(id).forEach((obs) => {
    if (!byCode[obs.code]) return;
    if (!grouped[obs.code]) grouped[obs.code] = [];
    grouped[obs.code].push(obs);
  });
  return Object.entries(grouped).map(([code, history]) => {
    const meta = byCode[code];
    const sorted = history.slice().sort((a, b) => a.date.localeCompare(b.date));
    const latest = sorted[sorted.length - 1];
    const flag = flagFor(meta, Number(latest.value));
    return {
      ...meta,
      latestValue: Number(latest.value),
      latestDate: latest.date,
      flag,
      history: sorted.map((item) => ({ date: item.date, value: Number(item.value), flag: flagFor(meta, Number(item.value)) })),
      interpretation: `${meta.name}: результат ${flag === "normal" ? "в обычном диапазоне" : "стоит обсудить с врачом"}. Это не диагноз.`,
      interpretationRequirements: ["жалобы", "лекарства", "подготовка к анализу", "анамнез"]
    };
  }).sort((a, b) => a.group.localeCompare(b.group, "ru") || a.name.localeCompare(b.name, "ru"));
}

function getLabReports(id) {
  const labs = getLabs(id);
  const byLabCode = Object.fromEntries(labs.map((lab) => [lab.code, lab]));
  return (reportTemplates[id] || []).map((report) => {
    const reportLabs = report.codes.map((code) => byLabCode[code]).filter(Boolean);
    return {
      ...report,
      status: "final",
      sourceServiceCode: report.serviceCode,
      testCount: reportLabs.length,
      abnormalCount: reportLabs.filter((lab) => lab.flag !== "normal").length
    };
  }).sort((a, b) => b.date.localeCompare(a.date));
}

function getLabReportById(id, reportId) {
  const report = getLabReports(id).find((item) => item.id === reportId);
  if (!report) return null;
  const labs = Object.fromEntries(getLabs(id).map((lab) => [lab.code, lab]));
  const observations = report.codes.map((code) => labs[code]).filter(Boolean).map((lab) => ({
    code: lab.code,
    sourceTestCode: lab.code,
    name: lab.name,
    group: lab.group,
    value: lab.latestValue,
    unit: lab.unit,
    low: lab.low,
    high: lab.high,
    loinc: lab.loinc,
    flag: lab.flag,
    mappingStatus: "mapped"
  }));
  return { ...report, observations };
}

function getTestHistory(id, testCode) {
  return getLabs(id).find((lab) => lab.code === testCode) || null;
}

function getReports(id) {
  return reports[id] || [];
}

function getDocuments(id) {
  return documents[id] || [];
}

function getVisits(id) {
  return [...(createdVisits[id] || []), ...(visits[id] || [])];
}

function addVisit(id, visit) {
  if (!createdVisits[id]) createdVisits[id] = [];
  createdVisits[id].unshift(visit);
  return visit;
}

module.exports = {
  catalog,
  profiles,
  isSyntheticPatient,
  getPatient,
  getLabs,
  getObservations,
  getLabReports,
  getLabReportById,
  getTestHistory,
  getReports,
  getDocuments,
  getVisits,
  addVisit
};
