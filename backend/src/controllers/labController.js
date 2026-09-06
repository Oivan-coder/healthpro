const labService = require("../services/labService");
const labReferenceService = require("../services/labReferenceService");
const auditService = require("../services/auditService");
const demoPatients = require("../data/demoPatients");
const { getDemoPatientId, storagePatientId } = require("../utils/demoPatientContext");
const fs = require("fs");
const path = require("path");

function shouldEnrichDictionaryReferences(patientContextId) {
  return !demoPatients.isSyntheticPatient(patientContextId);
}

async function getLabs(req, res, next) {
  try {
    const patientContextId = getDemoPatientId(req);
    const data = await labService.getLabs(patientContextId);
    if (!shouldEnrichDictionaryReferences(patientContextId)) return res.json(data);
    res.json(await labReferenceService.enrichLabs(data, storagePatientId(patientContextId)));
  } catch (error) { next(error); }
}

async function getCatalog(req, res, next) {
  try { res.json(await labService.getCatalog()); } catch (error) { next(error); }
}

async function getHistory(req, res, next) {
  try {
    const patientContextId = getDemoPatientId(req);
    const history = await labService.getHistory(patientContextId);
    if (!shouldEnrichDictionaryReferences(patientContextId)) return res.json(history);
    res.json(await labReferenceService.enrichHistory(history, storagePatientId(patientContextId)));
  } catch (error) { next(error); }
}

async function importLabs(req, res, next) {
  try { res.status(201).json(await labService.importObservations(req.body)); } catch (error) { next(error); }
}

async function validateLabs(req, res, next) {
  try {
    const result = await labService.validateImportItems(req.body);
    res.json({
      validCount: result.valid.length,
      errorCount: result.errors.length,
      errors: result.errors,
      valid: result.valid
    });
  } catch (error) { next(error); }
}

async function getLabReports(req, res, next) {
  try {
    const patientContextId = getDemoPatientId(req);
    const reports = await labService.getLabReports(patientContextId);
    if (!shouldEnrichDictionaryReferences(patientContextId)) return res.json(reports);
    const storageId = storagePatientId(patientContextId);
    const enriched = await labReferenceService.enrichReportSummaries(
      reports,
      storageId,
      (id) => labService.getLabReportById(id, patientContextId)
    );
    res.json(enriched);
  } catch (error) { next(error); }
}

async function getLabReportById(req, res, next) {
  try {
    const patientContextId = getDemoPatientId(req);
    const report = await labService.getLabReportById(req.params.id, patientContextId);
    if (!report) return res.status(404).json({ error: "lab_report_not_found" });
    if (!shouldEnrichDictionaryReferences(patientContextId)) return res.json(report);
    res.json(await labReferenceService.enrichReport(report, storagePatientId(patientContextId)));
  } catch (error) { next(error); }
}

async function downloadLabReportPdf(req, res, next) {
  try {
    const demoPatientId = getDemoPatientId(req);
    const patientId = storagePatientId(demoPatientId);
    const result = await labService.getLabReportPdfDocument(req.params.id, demoPatientId);
    if (result.status === "report_not_found") {
      await auditService.createAuditEventFromRequest(req, {
        eventType: "lab_report_pdf_download",
        patientId,
        actorType: "demo_patient",
        actorId: demoPatientId,
        resourceType: "lab_report",
        resourceId: req.params.id,
        status: "denied_not_found",
        details: { reason: "lab_report_not_found" }
      });
      return res.status(404).json({ error: "lab_report_not_found" });
    }
    if (result.status === "pdf_not_connected") {
      await auditService.createAuditEventFromRequest(req, {
        eventType: "lab_report_pdf_download",
        patientId,
        actorType: "demo_patient",
        actorId: demoPatientId,
        resourceType: "lab_report",
        resourceId: req.params.id,
        status: "not_connected",
        details: { reason: "lab_report_pdf_not_connected" }
      });
      return res.status(404).json({
        error: "lab_report_pdf_not_connected",
        message: "PDF-бланк лабораторного исследования пока не подключен."
      });
    }

    const storageRoot = path.resolve(__dirname, "../../storage/lab-report-pdfs");
    const filePath = path.resolve(storageRoot, result.document.storageKey || "");
    const insideStorage = filePath !== storageRoot && filePath.startsWith(`${storageRoot}${path.sep}`);
    if (!insideStorage || !fs.existsSync(filePath)) {
      await auditService.createAuditEventFromRequest(req, {
        eventType: "lab_report_pdf_download",
        patientId,
        actorType: "demo_patient",
        actorId: demoPatientId,
        resourceType: "lab_report",
        resourceId: req.params.id,
        status: "not_connected",
        details: { reason: "lab_report_pdf_file_missing" }
      });
      return res.status(404).json({
        error: "lab_report_pdf_not_connected",
        message: "PDF-бланк лабораторного исследования пока не подключен."
      });
    }

    const sourceFilename = result.document.sourceFilename || `${result.report.id}.pdf`;
    const filename = sourceFilename.replace(/[^\p{L}\p{N}_.-]+/gu, "_") || `${result.report.id}.pdf`;
    await auditService.createAuditEventFromRequest(req, {
      eventType: "lab_report_pdf_download",
      patientId,
      actorType: "demo_patient",
      actorId: demoPatientId,
      resourceType: "lab_report",
      resourceId: result.report.id,
      status: "success",
      details: {
        documentId: result.document.id,
        signatureStatus: result.document.signatureStatus,
        sourceFilename: result.document.sourceFilename
      }
    });
    res.setHeader("Content-Type", result.document.contentType || "application/pdf");
    res.download(filePath, filename);
  } catch (error) { next(error); }
}

async function getTestHistory(req, res, next) {
  try {
    const patientContextId = getDemoPatientId(req);
    const history = await labService.getTestHistory(req.params.testCode, patientContextId);
    if (!history) return res.status(404).json({ error: "lab_test_history_not_found" });
    if (!shouldEnrichDictionaryReferences(patientContextId)) return res.json(history);
    res.json(await labReferenceService.enrichTestHistory(history, storagePatientId(patientContextId)));
  } catch (error) { next(error); }
}

async function importLabReport(req, res, next) {
  try {
    const report = await labService.importLabReport(req.body || {});
    await auditService.createAuditEventFromRequest(req, {
      eventType: "lab_report_import",
      patientId: report?.patientId || null,
      actorType: "demo_integration",
      actorId: "local_demo",
      resourceType: "lab_report",
      resourceId: report?.id || req.body?.id || null,
      status: "success",
      details: {
        sourceServiceCode: report?.sourceServiceCode || req.body?.source_service_code || req.body?.sourceServiceCode,
        testCount: report?.testCount || 0
      }
    });
    res.status(201).json(report);
  } catch (error) { next(error); }
}

async function getUnmapped(req, res, next) {
  try { res.json(await labService.getUnmapped()); } catch (error) { next(error); }
}

module.exports = {
  getLabs,
  getCatalog,
  getHistory,
  importLabs,
  validateLabs,
  getLabReports,
  getLabReportById,
  downloadLabReportPdf,
  getTestHistory,
  importLabReport,
  getUnmapped
};
