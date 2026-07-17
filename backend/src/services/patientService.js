const labService = require("./labService");
const patientRepository = require("../repositories/patientRepository");
const integrationRepository = require("../repositories/integrationRepository");
const visitRepository = require("../repositories/visitRepository");
const reportRepository = require("../repositories/reportRepository");
const demoPatients = require("../data/demoPatients");
const { storagePatientId } = require("../utils/demoPatientContext");

async function getPatient(patientId) {
  if (demoPatients.isSyntheticPatient(patientId)) return demoPatients.getPatient(patientId);
  return patientRepository.getPatient(storagePatientId(patientId));
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

module.exports = { getPatient, getSummary };
