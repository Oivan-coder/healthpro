const reportRepository = require("../repositories/reportRepository");
const documentRepository = require("../repositories/documentRepository");
const demoPatients = require("../data/demoPatients");
const { storagePatientId } = require("../utils/demoPatientContext");

async function getReports(patientId) {
  if (demoPatients.isSyntheticPatient(patientId)) return demoPatients.getReports(patientId);
  return reportRepository.getReports(storagePatientId(patientId));
}

async function getDocuments(patientId) {
  if (demoPatients.isSyntheticPatient(patientId)) return demoPatients.getDocuments(patientId);
  return documentRepository.getDocuments(storagePatientId(patientId));
}

async function getDocumentById(id, patientId) {
  if (demoPatients.isSyntheticPatient(patientId)) {
    return demoPatients.getDocuments(patientId).find((document) => document.id === id) || null;
  }
  return documentRepository.getDocumentById(id, storagePatientId(patientId));
}

module.exports = { getReports, getDocuments, getDocumentById };
