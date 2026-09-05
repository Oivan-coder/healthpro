const { runtimeConfig } = require("../config/runtime");

const DEMO_PATIENT_IDS = new Set(["alexey", "anna", "dmitry"]);
const STORAGE_PATIENT_IDS = {
  alexey: "p_001"
};

function contextError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getDemoPatientId(req) {
  const authenticatedPatientId = String(req.auth?.user?.patientId || "").trim();
  if (authenticatedPatientId) return authenticatedPatientId;

  if (runtimeConfig().isProduction) {
    throw contextError("patient_access_not_configured", 403);
  }

  const patientId = String(req.headers["x-demo-patient-id"] || req.query.demoPatientId || "").trim();
  if (!patientId) throw contextError("demo_context_required");
  if (!DEMO_PATIENT_IDS.has(patientId)) throw contextError("invalid_demo_patient");
  return patientId;
}

function storagePatientId(patientId) {
  return STORAGE_PATIENT_IDS[patientId] || patientId;
}

module.exports = { getDemoPatientId, storagePatientId, DEMO_PATIENT_IDS };