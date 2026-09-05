const labService = require("./labService");
const patientRepository = require("../repositories/patientRepository");
const integrationRepository = require("../repositories/integrationRepository");
const visitRepository = require("../repositories/visitRepository");
const reportRepository = require("../repositories/reportRepository");
const demoPatients = require("../data/demoPatients");
const { storagePatientId } = require("../utils/demoPatientContext");

function httpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function cleanNullable(value, maxLength) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (text.length > maxLength) throw httpError("profile_field_too_long");
  return text;
}

function calculateAge(birthDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(birthDate || ""));
  if (!match) throw httpError("invalid_birth_date");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw httpError("invalid_birth_date");
  }
  const today = new Date();
  let age = today.getUTCFullYear() - year;
  const beforeBirthday = today.getUTCMonth() + 1 < month || (today.getUTCMonth() + 1 === month && today.getUTCDate() < day);
  if (beforeBirthday) age -= 1;
  if (age < 0 || age > 120) throw httpError("invalid_birth_date");
  return age;
}

function initialsFromName(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

async function getPatient(patientId) {
  if (demoPatients.isSyntheticPatient(patientId)) return demoPatients.getPatient(patientId);
  return patientRepository.getPatient(storagePatientId(patientId));
}

async function updatePatient(patientId, payload = {}) {
  if (demoPatients.isSyntheticPatient(patientId)) throw httpError("profile_edit_not_available", 403);

  const name = String(payload.name || "").trim();
  if (name.length < 2 || name.length > 160) throw httpError("invalid_profile_name");
  const birthDate = String(payload.birthDate || "").trim();
  const age = calculateAge(birthDate);
  const sex = String(payload.sex || "").trim().toLowerCase();
  if (!["male", "female"].includes(sex)) throw httpError("invalid_profile_sex");

  const updated = await patientRepository.updatePatient(storagePatientId(patientId), {
    name,
    initials: initialsFromName(name),
    birthDate,
    age,
    sex,
    phone: cleanNullable(payload.phone, 64),
    policy: cleanNullable(payload.policy, 128),
    clinic: cleanNullable(payload.clinic, 255),
    region: cleanNullable(payload.region, 255)
  });
  if (!updated) throw httpError("patient_not_found", 404);
  return updated;
}

async function getSummary(patientId) {
  const labs = (await labService.getLabs(patientId)).labs;
  const abnormal = labs.filter((item) => item.flag !== "normal");
  const normal = labs.filter((item) => item.flag === "normal");
  const visits = demoPatients.isSyntheticPatient(patientId)
    ? demoPatients.getVisits(patientId)
    : await visitRepository.getVisits(storagePatientId(patientId));

  return {
    patient: await getPatient(patientId),
    meta: await patientRepository.getMeta(),
    events: demoPatients.isSyntheticPatient(patientId) ? [] : await integrationRepository.getEvents(),
    latestLabs: labs.slice(0, 8),
    labs,
    abnormal,
    normalCount: normal.length,
    abnormalCount: abnormal.length,
    nextVisit: visits.find((visit) => visit.status === "Запланировано") || visits[0],
    visits,
    reports: demoPatients.isSyntheticPatient(patientId) ? demoPatients.getReports(patientId) : await reportRepository.getReports(storagePatientId(patientId))
  };
}

module.exports = { getPatient, updatePatient, getSummary };
