const patientService = require("../services/patientService");
const { getDemoPatientId } = require("../utils/demoPatientContext");

async function getPatient(req, res, next) {
  try { res.json(await patientService.getPatient(getDemoPatientId(req))); } catch (error) { next(error); }
}

async function updatePatient(req, res, next) {
  try { res.json(await patientService.updatePatient(getDemoPatientId(req), req.body || {})); } catch (error) { next(error); }
}

async function getSummary(req, res, next) {
  try { res.json(await patientService.getSummary(getDemoPatientId(req))); } catch (error) { next(error); }
}

module.exports = { getPatient, updatePatient, getSummary };
