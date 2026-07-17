const appointmentService = require("../services/appointmentService");
const auditService = require("../services/auditService");
const { getDemoPatientId, storagePatientId } = require("../utils/demoPatientContext");

async function getVisits(req, res, next) {
  try { res.json(await appointmentService.getVisits(getDemoPatientId(req))); } catch (error) { next(error); }
}

async function getBookingDictionary(req, res, next) {
  try { res.json(await appointmentService.getBookingDictionary()); } catch (error) { next(error); }
}

async function bookAppointment(req, res, next) {
  try {
    const demoPatientId = getDemoPatientId(req);
    const visit = await appointmentService.bookAppointment(req.body || {}, demoPatientId);
    await auditService.createAuditEventFromRequest(req, {
      eventType: "appointment_book",
      patientId: storagePatientId(demoPatientId),
      actorType: "demo_patient",
      actorId: demoPatientId,
      resourceType: "appointment",
      resourceId: visit.id,
      status: "success",
      details: {
        doctor: visit.doctor,
        specialty: visit.specialty,
        date: visit.date,
        time: visit.time
      }
    });
    res.status(201).json(visit);
  } catch (error) { next(error); }
}

module.exports = { getVisits, getBookingDictionary, bookAppointment };
