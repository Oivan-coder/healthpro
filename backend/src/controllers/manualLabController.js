const manualLabService = require("../services/manualLabService");
const auditService = require("../services/auditService");

async function listServices(req, res, next) {
  try {
    res.json(await manualLabService.listServices());
  } catch (error) {
    next(error);
  }
}

async function listServiceTests(req, res, next) {
  try {
    res.json(await manualLabService.listServiceTests(
      req.auth.user,
      req.params.serviceId,
      req.query.patientId
    ));
  } catch (error) {
    next(error);
  }
}

async function createReport(req, res, next) {
  try {
    const report = await manualLabService.createManualReport(req.auth.user, req.body || {});
    await auditService.createAuditEventFromRequest(req, {
      eventType: "manual_lab_report_created",
      patientId: report.patientId,
      actorType: "admin_user",
      actorId: req.auth.user.id,
      resourceType: "lab_report",
      resourceId: report.id,
      status: "success",
      details: {
        serviceId: report.serviceId,
        serviceCode: report.serviceCode,
        testCount: report.testCount,
        reportDate: report.date
      }
    });
    res.status(201).json({ report });
  } catch (error) {
    next(error);
  }
}

module.exports = { listServices, listServiceTests, createReport };
