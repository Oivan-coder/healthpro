const repository = require("../repositories/manualLabRepository");
const { resolveReference, referenceLabel } = require("./manualLabService");

function statusForReference(value, reference) {
  const numeric = Number(value);
  if (!reference || !Number.isFinite(numeric)) return "info";
  const low = reference.low;
  const high = reference.high;
  if (Number.isFinite(high) && numeric > high) return "high";
  if (Number.isFinite(low) && numeric < low) return "low";
  if (Number.isFinite(low) || Number.isFinite(high)) return "normal";
  return "info";
}

function interpretationFor(item) {
  if (item.referenceStatus === "ambiguous") {
    return `${item.name}: для показателя есть несколько референсных интервалов. Для интерпретации нужен дополнительный клинический контекст.`;
  }
  if (item.flag === "normal") {
    return `${item.name}: значение находится в пределах выбранного референсного интервала. Оцените динамику и сопоставьте результат с клиническим контекстом.`;
  }
  if (item.flag === "high") {
    return `${item.name}: значение выше выбранного референсного интервала. Это не диагноз; результат требует врачебной интерпретации.`;
  }
  if (item.flag === "low") {
    return `${item.name}: значение ниже выбранного референсного интервала. Это не диагноз; результат требует врачебной интерпретации.`;
  }
  return item.interpretation;
}

async function referenceMapForCodes(codes, patient, selectionsByTestId = {}) {
  const tests = await repository.getReferenceDataByCodes(codes);
  const entries = tests
    .filter((test) => Array.isArray(test.references) && test.references.length > 0)
    .map((test) => {
      const resolved = resolveReference(test.references, patient, selectionsByTestId[test.id]);
      return [test.code, { test, resolved }];
    });
  return new Map(entries);
}

function applyReference(item, entry) {
  if (!entry) return item;
  const { test, resolved } = entry;
  const reference = resolved.reference;
  const rawValue = item.latestValue ?? item.value;
  const flag = statusForReference(rawValue, reference);
  const enriched = {
    ...item,
    unit: item.unit || test.unit || reference?.unit || "",
    low: Number.isFinite(reference?.low) ? reference.low : null,
    high: Number.isFinite(reference?.high) ? reference.high : null,
    referenceGroup: reference?.group || "",
    referenceLabel: referenceLabel(reference, item.unit || test.unit),
    referenceStatus: resolved.status,
    flag
  };
  if (Object.prototype.hasOwnProperty.call(item, "interpretation")) {
    enriched.interpretation = interpretationFor(enriched);
  }
  return enriched;
}

async function enrichLabs(payload, patientId) {
  if (!payload?.labs?.length || !patientId) return payload;
  const patient = await repository.getPatient(patientId);
  if (!patient) return payload;
  const map = await referenceMapForCodes(payload.labs.map((item) => item.code), patient);
  return {
    ...payload,
    catalog: (payload.catalog || []).map((item) => applyReference(item, map.get(item.code))),
    labs: payload.labs.map((lab) => {
      const entry = map.get(lab.code);
      const enriched = applyReference(lab, entry);
      return {
        ...enriched,
        history: (lab.history || []).map((point) => applyReference(point, entry))
      };
    })
  };
}

async function enrichHistory(items, patientId) {
  if (!Array.isArray(items) || !items.length || !patientId) return items;
  const patient = await repository.getPatient(patientId);
  if (!patient) return items;
  const map = await referenceMapForCodes(items.map((item) => item.code), patient);
  return items.map((item) => applyReference(item, map.get(item.code)));
}

async function enrichTestHistory(history, patientId) {
  if (!history?.code || !patientId) return history;
  const patient = await repository.getPatient(patientId);
  if (!patient) return history;
  const map = await referenceMapForCodes([history.code], patient);
  const entry = map.get(history.code);
  if (!entry) return history;
  const enriched = applyReference(history, entry);
  return {
    ...enriched,
    history: (history.history || []).map((point) => applyReference(point, entry))
  };
}

async function enrichReport(report, patientId) {
  if (!report?.observations?.length || !patientId) return report;
  const patient = await repository.getPatient(patientId);
  if (!patient) return report;
  const selections = await repository.getReportReferenceSelections(report.id);
  const map = await referenceMapForCodes(report.observations.map((item) => item.code), patient, selections);
  const observations = report.observations.map((item) => applyReference(item, map.get(item.code)));
  return {
    ...report,
    observations,
    abnormalCount: observations.filter((item) => item.flag === "high" || item.flag === "low").length
  };
}

async function enrichReportSummaries(reports, patientId, reportLoader) {
  if (!Array.isArray(reports) || !reports.length || !patientId || typeof reportLoader !== "function") return reports;
  const result = [];
  for (const report of reports) {
    const details = await reportLoader(report.id);
    const enriched = await enrichReport(details, patientId);
    result.push({ ...report, abnormalCount: enriched?.abnormalCount ?? report.abnormalCount });
  }
  return result;
}

module.exports = {
  enrichLabs,
  enrichHistory,
  enrichTestHistory,
  enrichReport,
  enrichReportSummaries
};
