const service = require("../services/labScanService");
const auditService = require("../services/auditService");

async function analyze(req, res, next) {
  try {
    const result = await service.analyze(req.auth.user, {
      buffer: req.body,
      fileName: decodeURIComponent(String(req.headers["x-file-name"] || "analysis")),
      mimeType: String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase()
    });
    await auditService.createAuditEventFromRequest(req, {
      eventType: "patient_lab_scan_analyzed",
      patientId: req.auth.user.patientId,
      actorType: req.auth.user.role === "tester" ? "tester_user" : "patient_user",
      actorId: req.auth.user.id,
      resourceType: "lab_scan",
      resourceId: null,
      status: "success",
      details: { rowCount: result.summary.total, matched: result.summary.matched, mimeType: result.mimeType }
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function search(req, res, next) {
  try {
    res.json(await service.searchDictionary(req.auth.user, req.query.q));
  } catch (error) {
    next(error);
  }
}

async function confirm(req, res, next) {
  try {
    const reports = await service.confirm(req.auth.user, req.body || {});
    for (const report of reports) {
      await auditService.createAuditEventFromRequest(req, {
        eventType: "patient_lab_scan_imported",
        patientId: report.patientId,
        actorType: req.auth.user.role === "tester" ? "tester_user" : "patient_user",
        actorId: req.auth.user.id,
        resourceType: "lab_report",
        resourceId: report.id,
        status: "success",
        details: { serviceId: report.serviceId, serviceCode: report.serviceCode, testCount: report.testCount, reportDate: report.date }
      });
    }
    res.status(201).json({ reports });
  } catch (error) {
    next(error);
  }
}

module.exports = { analyze, search, confirm };
