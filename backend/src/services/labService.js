const { parseRuDate } = require("../utils/date");
const labRepository = require("../repositories/labRepository");
const labReportDocumentRepository = require("../repositories/labReportDocumentRepository");
const integrationRepository = require("../repositories/integrationRepository");
const demoPatients = require("../data/demoPatients");
const { storagePatientId } = require("../utils/demoPatientContext");

async function catalogByCode() {
  return Object.fromEntries((await labRepository.getCatalog()).map((item) => [item.code, item]));
}

async function getCatalog() {
  return labRepository.getTests();
}

function statusFor(meta, value) {
  if (value > meta.high) return "high";
  if (value < meta.low) return "low";
  return "normal";
}

function buildInterpretation(meta, value, flag) {
  if (flag === "normal") {
    return `${meta.name}: значение находится в пределах референсного интервала. Оцените динамику и сопоставьте результат с клиническим контекстом.`;
  }
  if (flag === "high") {
    return `${meta.name}: значение выше референсного интервала. Это не диагноз; результат требует врачебной интерпретации с учетом подготовки, лекарств и сопутствующих факторов.`;
  }
  return `${meta.name}: значение ниже референсного интервала. Рекомендуется обсудить результат с врачом и при необходимости повторить исследование.`;
}

async function getLabs(patientId) {
  if (demoPatients.isSyntheticPatient(patientId)) {
    const labs = demoPatients.getLabs(patientId);
    return {
      groups: ["Все", ...Array.from(new Set(labs.map((item) => item.group)))],
      catalog: labs.map(({ history, interpretation, interpretationRequirements, latestValue, latestDate, flag, ...item }) => item),
      labs
    };
  }
  const catalog = await getCatalog();
  const byCode = Object.fromEntries(catalog.map((item) => [item.code, item]));
  const grouped = {};

  const observations = await labRepository.getObservations(storagePatientId(patientId));
  observations.forEach((obs) => {
    if (!grouped[obs.code]) grouped[obs.code] = [];
    grouped[obs.code].push(obs);
  });

  const labs = Object.entries(grouped)
    .filter(([code]) => byCode[code])
    .map(([code, history]) => {
      const meta = byCode[code];
      const sorted = history
        .map((item) => ({ ...item, value: Number(item.value) }))
        .sort((a, b) => parseRuDate(a.date) - parseRuDate(b.date));
      const latest = sorted[sorted.length - 1];
      const flag = statusFor(meta, latest.value);
      return {
        ...meta,
        latestValue: latest.value,
        latestDate: latest.date,
        flag,
        history: sorted.map((item) => ({
          date: item.date,
          value: item.value,
          flag: statusFor(meta, item.value)
        })),
        interpretation: buildInterpretation(meta, latest.value, flag),
        interpretationRequirements: [
          "натощак или не натощак",
          "возраст и пол пациента",
          "метод и анализатор лаборатории",
          "лекарственная терапия и сопутствующие состояния"
        ]
      };
    })
    .sort((a, b) => a.group.localeCompare(b.group, "ru") || a.name.localeCompare(b.name, "ru"));

  return {
    groups: ["Все", ...Array.from(new Set(labs.map((item) => item.group)))],
    catalog: labs.map(({ history, interpretation, interpretationRequirements, latestValue, latestDate, flag, ...item }) => item),
    labs
  };
}

async function getHistory(patientId) {
  if (demoPatients.isSyntheticPatient(patientId)) {
    return demoPatients.getLabs(patientId)
      .flatMap((lab) => lab.history.map((row) => ({ ...lab, ...row })))
      .sort((a, b) => parseRuDate(b.date) - parseRuDate(a.date));
  }
  const byCode = await catalogByCode();
  const observations = await labRepository.getObservations(storagePatientId(patientId));
  return observations
    .filter((obs) => byCode[obs.code])
    .map((obs) => {
      const meta = byCode[obs.code];
      const value = Number(obs.value);
      return { ...obs, ...meta, value, flag: statusFor(meta, value) };
    })
    .sort((a, b) => parseRuDate(b.date) - parseRuDate(a.date));
}

async function validateImportItems(items) {
  const byCode = await catalogByCode();
  const observations = await labRepository.getObservations();
  const existing = new Set(observations.map((item) => `${item.code}|${item.date}|${Number(item.value)}`));
  const errors = [];
  const valid = [];

  if (!Array.isArray(items)) {
    return {
      valid,
      errors: [{ index: 0, code: "invalid_payload", message: "Ожидается массив наблюдений." }]
    };
  }

  items.forEach((item, index) => {
    const rowErrors = [];
    if (!item || !byCode[item.code]) rowErrors.push("unknown_code");
    if (item && (item.value === "" || Number.isNaN(Number(item.value)))) rowErrors.push("invalid_value");
    if (!item || !item.date) rowErrors.push("missing_date");

    const duplicateKey = item ? `${item.code}|${item.date}|${Number(item.value)}` : "";
    if (item && item.code && item.date && !Number.isNaN(Number(item.value)) && existing.has(duplicateKey)) {
      rowErrors.push("duplicate_observation");
    }

    if (rowErrors.length) {
      rowErrors.forEach((errorCode) => errors.push({ index, code: errorCode, item }));
      return;
    }

    valid.push({
      code: item.code,
      value: Number(item.value),
      date: item.date
    });
  });

  return { valid, errors };
}

async function importObservations(items) {
  const validation = await validateImportItems(items);
  if (validation.valid.length) {
    await labRepository.addObservations(validation.valid);
    await integrationRepository.addEvent({
      icon: "⇣",
      kind: "sync",
      level: "purple",
      title: "Импортированы лабораторные данные",
      text: `Добавлено ${validation.valid.length} наблюдений из JSON/API.`,
      date: "Только что"
    });
    await integrationRepository.touchSync("lab_import", validation.valid.length, validation.errors.length);
  }

  return {
    imported: validation.valid.length,
    validCount: validation.valid.length,
    errorCount: validation.errors.length,
    errors: validation.errors,
    valid: validation.valid,
    labs: await getLabs(),
    history: await getHistory()
  };
}

async function getLabReports(patientId) {
  if (demoPatients.isSyntheticPatient(patientId)) return demoPatients.getLabReports(patientId);
  return labRepository.getLabReports(storagePatientId(patientId));
}

async function getLabReportById(id, patientId) {
  if (demoPatients.isSyntheticPatient(patientId)) return demoPatients.getLabReportById(patientId, id);
  return labRepository.getLabReportById(id, storagePatientId(patientId));
}

async function getLabReportPdfDocument(id, patientId) {
  const report = await getLabReportById(id, patientId);
  if (!report) return { status: "report_not_found", document: null };

  const document = await labReportDocumentRepository.getLabReportDocument(id, storagePatientId(patientId));
  if (!document) return { status: "pdf_not_connected", document: null, report };

  return { status: "ok", document, report };
}

async function getTestHistory(testCode, patientId) {
  if (demoPatients.isSyntheticPatient(patientId)) return demoPatients.getTestHistory(patientId, testCode);
  const history = await labRepository.getTestHistory(testCode, storagePatientId(patientId));
  if (!history.length) return null;
  const meta = history[history.length - 1];
  const enriched = history.map((item) => ({
    date: item.date,
    value: Number(item.value),
    flag: statusFor(item, Number(item.value))
  }));
  const latest = enriched[enriched.length - 1];
  return {
    code: meta.code,
    name: meta.name,
    group: meta.group,
    unit: meta.unit,
    low: meta.low,
    high: meta.high,
    loinc: meta.loinc,
    latestValue: latest.value,
    latestDate: latest.date,
    flag: latest.flag,
    history: enriched,
    interpretation: buildInterpretation(meta, latest.value, latest.flag),
    interpretationRequirements: [
      "натощак или не натощак",
      "возраст и пол пациента",
      "метод и анализатор лаборатории",
      "лекарственная терапия и сопутствующие состояния"
    ]
  };
}

async function importLabReport(payload) {
  const report = await labRepository.importLabReport(payload);
  await integrationRepository.addEvent({
    icon: "⇣",
    kind: "sync",
    level: "purple",
    title: "Импортирован лабораторный отчет",
    text: `${report?.name || report?.sourceServiceCode || "Исследование"}: ${report?.testCount || 0} показателей.`,
    date: "Только что"
  });
  await integrationRepository.touchSync("lab_report_import", report?.testCount || 0, 0);
  return report;
}

async function getUnmapped() {
  return labRepository.getUnmapped();
}

module.exports = {
  getCatalog,
  getLabs,
  getHistory,
  validateImportItems,
  importObservations,
  getLabReports,
  getLabReportById,
  getLabReportPdfDocument,
  getTestHistory,
  importLabReport,
  getUnmapped
};
