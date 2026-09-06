const patientHistoryService = require('../services/patientHistoryService');
const auditService = require('../services/auditService');
const { getDemoPatientId } = require('../utils/demoPatientContext');

async function list(req, res, next) {
  try {
    const patientId = getDemoPatientId(req);
    const items = await patientHistoryService.list(patientId, req.query.limit);
    res.json({ items });
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const patientId = getDemoPatientId(req);
    const item = await patientHistoryService.create(patientId, req.body || {});
    await auditService.createAuditEventFromRequest(req, {
      eventType: 'patient_history_created',
      patientId,
      actorType: 'demo_patient',
      actorId: patientId,
      resourceType: 'patient_history_event',
      resourceId: String(item.id),
      status: 'success',
      details: { event_type: item.event_type, source: item.source }
    });
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
}

module.exports = { list, create };
