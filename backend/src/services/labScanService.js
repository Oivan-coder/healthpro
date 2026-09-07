const { getAiConfig } = require("../config/ai");
const giga = require("./ai/labScanGigaClient");
const repository = require("../repositories/labScanRepository");

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const scanWindows = new Map();

function httpError(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalize(value) {
  return clean(value)
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[×х]/g, "x")
    .replace(/[–—−]/g, "-")
    .replace(/[^a-zа-я0-9%+.-]+/gi, " ")
    .trim();
}

function unitNorm(value) {
  return normalize(value).replace(/\s+/g, "").replace(/10\^/g, "10");
}

function tokens(value) {
  return new Set(normalize(value).split(/\s+/).filter((token) => token.length > 1));
}

function dice(a, b) {
  const left = tokens(a);
  const right = tokens(b);
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  left.forEach((token) => { if (right.has(token)) intersection += 1; });
  return (2 * intersection) / (left.size + right.size);
}

function scoreExtracted(extracted, candidate) {
  const name = normalize(extracted.name);
  const code = normalize(extracted.code);
  const names = [candidate.name, candidate.rawName].map(normalize).filter(Boolean);
  const codes = [candidate.code, candidate.sourceTestCode].map(normalize).filter(Boolean);
  let score = 0;
  if (code && codes.includes(code)) score = Math.max(score, 125);
  if (name && names.includes(name)) score = Math.max(score, 110);
  if (name && codes.includes(name)) score = Math.max(score, 115);
  names.forEach((candidateName) => {
    if (name && (candidateName.includes(name) || name.includes(candidateName))) score = Math.max(score, 82);
    score = Math.max(score, Math.round(dice(name, candidateName) * 78));
  });
  if (code) codes.forEach((candidateCode) => {
    if (candidateCode && (candidateCode.includes(code) || code.includes(candidateCode))) score = Math.max(score, 90);
  });
  const sourceUnit = unitNorm(extracted.unit);
  const targetUnit = unitNorm(candidate.unit);
  if (sourceUnit && targetUnit) {
    if (sourceUnit === targetUnit) score += 12;
    else if (sourceUnit.includes(targetUnit) || targetUnit.includes(sourceUnit)) score += 6;
  }
  return Math.min(score, 140);
}

function collapseDictionary(rows) {
  const tests = new Map();
  rows.forEach((row) => {
    let item = tests.get(row.testId);
    if (!item) {
      item = { ...row, services: [] };
      delete item.serviceId;
      delete item.serviceCode;
      delete item.serviceName;
      delete item.sortOrder;
      tests.set(row.testId, item);
    }
    if (!item.services.some((service) => service.id === row.serviceId)) {
      item.services.push({ id: row.serviceId, code: row.serviceCode, name: row.serviceName, sortOrder: row.sortOrder });
    }
  });
  return [...tests.values()];
}

function serviceSupport(mapped) {
  const support = new Map();
  mapped.forEach((item) => {
    const candidate = item.rank[0]?.candidate;
    if (!candidate) return;
    candidate.services.forEach((service) => support.set(service.id, (support.get(service.id) || 0) + 1));
  });
  return support;
}

function serviceChoices(candidate, support) {
  return candidate.services
    .slice()
    .sort((a, b) => (support.get(b.id) || 0) - (support.get(a.id) || 0) || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ru"));
}

function mapRows(extractedTests, dictionaryRows) {
  const dictionary = collapseDictionary(dictionaryRows);
  const ranked = extractedTests.map((extracted) => {
    const rank = dictionary
      .map((candidate) => ({ candidate, score: scoreExtracted(extracted, candidate) }))
      .filter((item) => item.score >= 28)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    return { extracted, rank };
  });
  const support = serviceSupport(ranked);

  return ranked.map(({ extracted, rank }, index) => {
    const top = rank[0];
    const second = rank[1];
    const confident = Boolean(top && top.score >= 68 && (!second || top.score - second.score >= 8));
    const choices = [];
    rank.slice(0, 4).forEach(({ candidate, score }) => {
      serviceChoices(candidate, support).slice(0, 3).forEach((service) => {
        choices.push({
          testId: candidate.testId,
          serviceId: service.id,
          code: candidate.code,
          name: candidate.name,
          unit: candidate.unit,
          serviceName: service.name,
          score
        });
      });
    });
    const selectedService = top ? serviceChoices(top.candidate, support)[0] : null;
    return {
      id: `row_${index + 1}`,
      extractedName: clean(extracted.name || extracted.code),
      extractedCode: clean(extracted.code),
      value: clean(extracted.value),
      extractedUnit: clean(extracted.unit),
      extractedReference: clean(extracted.reference),
      confidence: top ? top.score : 0,
      status: confident ? "matched" : (choices.length ? "review" : "unmatched"),
      selected: confident && selectedService ? {
        testId: top.candidate.testId,
        serviceId: selectedService.id,
        code: top.candidate.code,
        name: top.candidate.name,
        unit: top.candidate.unit,
        serviceName: selectedService.name
      } : null,
      choices
    };
  }).filter((row) => row.extractedName && row.value);
}

function normalizeDate(value) {
  const text = clean(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const date = new Date(`${text}T12:00:00Z`);
    if (!Number.isNaN(date.getTime())) return text;
  }
  return new Date().toISOString().slice(0, 10);
}

function enforceRateLimit(userId) {
  const now = Date.now();
  const current = scanWindows.get(userId) || [];
  const recent = current.filter((stamp) => now - stamp < 60 * 60 * 1000);
  if (recent.length >= 12) throw httpError("scan_rate_limit", 429);
  recent.push(now);
  scanWindows.set(userId, recent);
}

async function analyze(user, file = {}) {
  if (!user?.patientId || !["user", "tester"].includes(user.role)) throw httpError("patient_context_required", 403);
  enforceRateLimit(user.id);
  const mimeType = clean(file.mimeType).toLowerCase();
  if (!MIME_TYPES.has(mimeType)) throw httpError("unsupported_scan_file", 415);
  if (!Buffer.isBuffer(file.buffer) || !file.buffer.length) throw httpError("scan_file_required");
  if (file.buffer.length > MAX_FILE_BYTES) throw httpError("scan_file_too_large", 413);

  const config = getAiConfig();
  if (!config.enabled || config.provider !== "gigachat" || !config.gigachat?.authKey) throw httpError("scan_ai_unavailable", 503);
  const patient = await repository.getPatient(user.patientId);
  if (!patient) throw httpError("patient_not_available", 404);

  const fileId = await giga.uploadFile(file.buffer, file.fileName, mimeType, config.gigachat);
  let extracted;
  try {
    extracted = await giga.extractLabReport(fileId, config.gigachat);
  } finally {
    giga.deleteFile(fileId, config.gigachat).catch((error) => {
      console.warn("GigaChat scan file cleanup failed", { message: error?.message || "unknown_error" });
    });
  }
  const tests = Array.isArray(extracted.tests) ? extracted.tests.slice(0, 100) : [];
  if (!tests.length) throw httpError("scan_no_results", 422);
  const dictionaryRows = await repository.listDictionaryRows();
  const rows = mapRows(tests, dictionaryRows);
  if (!rows.length) throw httpError("scan_no_results", 422);

  return {
    reportDate: normalizeDate(extracted.report_date),
    laboratory: clean(extracted.laboratory),
    reportName: clean(extracted.report_name),
    fileName: clean(file.fileName),
    mimeType,
    patient: { id: patient.id, name: patient.name },
    rows,
    summary: {
      total: rows.length,
      matched: rows.filter((row) => row.status === "matched").length,
      review: rows.filter((row) => row.status !== "matched").length
    }
  };
}

async function confirm(user, payload = {}) {
  if (!user?.patientId || !["user", "tester"].includes(user.role)) throw httpError("patient_context_required", 403);
  const reportDate = normalizeDate(payload.reportDate);
  if (!Array.isArray(payload.rows) || !payload.rows.length) throw httpError("observations_required");
  if (payload.rows.length > 100) throw httpError("too_many_observations");
  const rows = payload.rows.map((row) => ({
    testId: clean(row.testId),
    serviceId: clean(row.serviceId),
    value: clean(row.value),
    extractedName: clean(row.extractedName),
    extractedUnit: clean(row.extractedUnit),
    extractedReference: clean(row.extractedReference)
  }));
  rows.forEach((row) => {
    if (!row.testId || !row.serviceId || !row.value) throw httpError("scan_row_incomplete");
  });
  return repository.saveConfirmed(user, reportDate, rows, {
    fileName: clean(payload.fileName),
    mimeType: clean(payload.mimeType),
    laboratory: clean(payload.laboratory),
    reportName: clean(payload.reportName)
  });
}

module.exports = { analyze, confirm, mapRows, scoreExtracted, MAX_FILE_BYTES };
