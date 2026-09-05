const repository = require("../repositories/manualLabRepository");

function httpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalize(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[–—−]/g, "-")
    .replace(/ё/g, "е");
}

function patientSex(value) {
  const text = normalize(value);
  if (/жен|female|девоч/.test(text)) return "female";
  if (/муж|male|мальчик/.test(text)) return "male";
  return "";
}

function groupSex(value) {
  const text = normalize(value);
  if (/жен|female|девоч/.test(text)) return "female";
  if (/муж|male|мальчик/.test(text)) return "male";
  return "";
}

function patientAgeMetrics(patient) {
  const now = new Date();
  const birth = patient?.birthDate ? new Date(patient.birthDate) : null;
  if (birth && !Number.isNaN(birth.getTime())) {
    const days = Math.max(0, (now.getTime() - birth.getTime()) / 86400000);
    return { days, months: days / 30.4375, years: days / 365.25 };
  }
  const years = Number(patient?.age);
  if (Number.isFinite(years)) return { days: years * 365.25, months: years * 12, years };
  return { days: null, months: null, years: null };
}

function ageUnit(text) {
  if (/сут|дн(?:ей|я|ь)?\b/.test(text)) return "days";
  if (/мес/.test(text)) return "months";
  if (/лет|год|года/.test(text)) return "years";
  return "";
}

function parseAgeConstraint(group) {
  const text = normalize(group);
  const unit = ageUnit(text);
  if (!unit) return null;

  let match = text.match(/(?:старше|>|более)\s*(\d+(?:[.,]\d+)?)/);
  if (match) return { unit, min: Number(match[1].replace(",", ".")), minExclusive: true, max: null };

  match = text.match(/(?:до|<)\s*(\d+(?:[.,]\d+)?)/);
  if (match) return { unit, min: null, max: Number(match[1].replace(",", ".")), maxExclusive: false };

  match = text.match(/(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)/);
  if (match) {
    return {
      unit,
      min: Number(match[1].replace(",", ".")),
      minExclusive: false,
      max: Number(match[2].replace(",", ".")),
      maxExclusive: false
    };
  }

  return null;
}

function ageMatches(constraint, patient) {
  if (!constraint) return null;
  const metrics = patientAgeMetrics(patient);
  const value = metrics[constraint.unit];
  if (!Number.isFinite(value)) return null;
  if (constraint.min !== null && constraint.min !== undefined) {
    if (constraint.minExclusive ? value <= constraint.min : value < constraint.min) return false;
  }
  if (constraint.max !== null && constraint.max !== undefined) {
    if (constraint.maxExclusive ? value >= constraint.max : value > constraint.max) return false;
  }
  return true;
}

function isContextualGroup(group) {
  return /фаза|триместр|беремен|менопауз|пременопауз|постменопауз|овуля|цикл|лактац|вскарм|недонош|донош/.test(normalize(group));
}

function referenceSignature(reference) {
  return [reference.lowRaw, reference.highRaw, reference.unit].map(normalize).join("|");
}

function resolveReference(references, patient, preferredReferenceId = null) {
  const refs = Array.isArray(references) ? references.filter(Boolean) : [];
  if (!refs.length) return { status: "none", reference: null, options: [] };

  if (preferredReferenceId) {
    const preferred = refs.find((ref) => Number(ref.id) === Number(preferredReferenceId));
    if (preferred) return { status: "selected", reference: preferred, options: refs };
  }

  const signatures = new Set(refs.map(referenceSignature));
  if (signatures.size === 1) return { status: "matched", reference: refs[0], options: refs };
  if (refs.length === 1) return { status: "matched", reference: refs[0], options: refs };

  const sex = patientSex(patient?.sex);
  const scored = refs.map((reference) => {
    const referenceSex = groupSex(reference.group);
    const ageConstraint = parseAgeConstraint(reference.group);
    const ageResult = ageMatches(ageConstraint, patient);
    let score = 0;
    let rejected = false;

    if (referenceSex && sex) {
      if (referenceSex !== sex) rejected = true;
      else score += 5;
    }
    if (ageResult === false) rejected = true;
    else if (ageResult === true) score += 5;
    if (!clean(reference.group)) score += 1;
    if (isContextualGroup(reference.group)) score -= 1;

    return { reference, score, rejected, contextual: isContextualGroup(reference.group) };
  }).filter((item) => !item.rejected);

  if (!scored.length) return { status: "ambiguous", reference: null, options: refs };
  scored.sort((a, b) => b.score - a.score);
  const topScore = scored[0].score;
  const top = scored.filter((item) => item.score === topScore);
  if (top.length === 1 && !top[0].contextual) {
    return { status: "matched", reference: top[0].reference, options: refs };
  }

  const topSignatures = new Set(top.map((item) => referenceSignature(item.reference)));
  if (topSignatures.size === 1) {
    return { status: "matched", reference: top[0].reference, options: refs };
  }
  return { status: "ambiguous", reference: null, options: refs };
}

function referenceLabel(reference, fallbackUnit = "") {
  if (!reference) return "Референс не задан";
  const unit = reference.unit || fallbackUnit || "";
  const low = clean(reference.lowRaw);
  const high = clean(reference.highRaw);
  let interval = "";
  if (low && high) interval = `${low}–${high}`;
  else interval = low || high || "Референс указан текстом";
  const group = clean(reference.group);
  return [interval, unit, group ? `(${group})` : ""].filter(Boolean).join(" ");
}

function statusForReference(value, reference) {
  if (!reference || !Number.isFinite(value)) return "info";
  const low = reference.low;
  const high = reference.high;
  if (Number.isFinite(high) && value > high) return "high";
  if (Number.isFinite(low) && value < low) return "low";
  if (Number.isFinite(low) || Number.isFinite(high)) return "normal";
  return "info";
}

function decorateTest(test, patient, preferredReferenceId = null) {
  const resolved = resolveReference(test.references, patient, preferredReferenceId);
  return {
    ...test,
    recommendedReferenceId: resolved.reference?.id || null,
    referenceStatus: resolved.status,
    referenceLabel: referenceLabel(resolved.reference, test.unit),
    reference: resolved.reference,
    references: resolved.options.map((reference) => ({
      ...reference,
      label: referenceLabel(reference, test.unit)
    }))
  };
}

async function listServices() {
  return { services: await repository.listServices() };
}

async function listServiceTests(adminUser, serviceId, patientId) {
  if (!patientId) throw httpError("patient_id_required");
  const available = await repository.isPatientAccessible(adminUser.organizationId, patientId);
  if (!available) throw httpError("patient_not_available", 404);
  const patient = await repository.getPatient(patientId);
  const tests = await repository.listServiceTests(serviceId);
  if (!tests.length) throw httpError("lab_service_not_found", 404);
  return {
    patient,
    serviceId,
    tests: tests.map((test) => decorateTest(test, patient))
  };
}

function normalizeManualValue(rawValue) {
  const valueRaw = clean(rawValue);
  if (!valueRaw) throw httpError("result_value_required");
  const normalized = valueRaw.replace(",", ".");
  if (/^-?\d+(?:\.\d+)?$/.test(normalized)) {
    const valueNum = Number(normalized);
    if (!Number.isFinite(valueNum)) throw httpError("invalid_result_value");
    return { valueRaw, valueNum, valueText: null };
  }
  return { valueRaw, valueNum: null, valueText: valueRaw };
}

function normalizeDate(value) {
  const text = clean(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw httpError("invalid_report_date");
  const date = new Date(`${text}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) throw httpError("invalid_report_date");
  return text;
}

async function createManualReport(adminUser, payload = {}) {
  const patientId = clean(payload.patientId);
  const serviceId = clean(payload.serviceId);
  const reportDate = normalizeDate(payload.reportDate);
  if (!patientId) throw httpError("patient_id_required");
  if (!serviceId) throw httpError("service_id_required");
  if (!Array.isArray(payload.observations) || !payload.observations.length) {
    throw httpError("observations_required");
  }
  if (payload.observations.length > 100) throw httpError("too_many_observations");

  const available = await repository.isPatientAccessible(adminUser.organizationId, patientId);
  if (!available) throw httpError("patient_not_available", 404);
  const patient = await repository.getPatient(patientId);
  const tests = await repository.listServiceTests(serviceId);
  if (!tests.length) throw httpError("lab_service_not_found", 404);
  const testsById = new Map(tests.map((test) => [test.id, test]));
  const seen = new Set();

  const observations = payload.observations.map((item) => {
    const testId = clean(item?.testId);
    const test = testsById.get(testId);
    if (!test) throw httpError("test_not_in_service");
    if (seen.has(testId)) throw httpError("duplicate_test_in_report");
    seen.add(testId);

    const value = normalizeManualValue(item?.value);
    const requestedReferenceId = item?.referenceId ? Number(item.referenceId) : null;
    if (requestedReferenceId && !test.references.some((ref) => Number(ref.id) === requestedReferenceId)) {
      throw httpError("reference_not_available");
    }
    const resolved = resolveReference(test.references, patient, requestedReferenceId);
    return {
      testId,
      referenceId: resolved.reference?.id || requestedReferenceId || null,
      ...value
    };
  });

  return repository.createManualReport({
    organizationId: adminUser.organizationId,
    actorUserId: adminUser.id,
    patientId,
    serviceId,
    reportDate,
    observations
  });
}

async function referenceMapForCodes(codes, patient, selectionsByTestId = {}) {
  const tests = await repository.getReferenceDataByCodes(codes);
  return new Map(tests.map((test) => {
    const resolved = resolveReference(test.references, patient, selectionsByTestId[test.id]);
    return [test.code, { test, resolved }];
  }));
}

function applyReference(item, entry) {
  if (!entry) return item;
  const { test, resolved } = entry;
  const reference = resolved.reference;
  const value = Number(item.latestValue ?? item.value);
  const numeric = Number.isFinite(value);
  return {
    ...item,
    unit: item.unit || test.unit || reference?.unit || "",
    low: Number.isFinite(reference?.low) ? reference.low : null,
    high: Number.isFinite(reference?.high) ? reference.high : null,
    referenceGroup: reference?.group || "",
    referenceLabel: referenceLabel(reference, item.unit || test.unit),
    referenceStatus: resolved.status,
    flag: numeric ? statusForReference(value, reference) : "info"
  };
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
        history: (lab.history || []).map((point) => applyReference(point, entry)),
        interpretation: enriched.referenceStatus === "ambiguous"
          ? `${lab.name}: для этого показателя есть несколько референсных интервалов. Для интерпретации нужен дополнительный клинический контекст.`
          : lab.interpretation
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
  const enriched = applyReference(history, entry);
  return {
    ...enriched,
    history: (history.history || []).map((point) => applyReference(point, entry)),
    interpretation: enriched.referenceStatus === "ambiguous"
      ? `${history.name}: референс зависит от дополнительного клинического контекста.`
      : history.interpretation
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
  listServices,
  listServiceTests,
  createManualReport,
  enrichLabs,
  enrichHistory,
  enrichTestHistory,
  enrichReport,
  enrichReportSummaries,
  resolveReference,
  referenceLabel
};
