const reportService = require("../services/reportService");
const auditService = require("../services/auditService");
const { getDemoPatientId, storagePatientId } = require("../utils/demoPatientContext");
const fs = require("fs");
const path = require("path");

async function getReports(req, res, next) {
  try { res.json(await reportService.getReports(getDemoPatientId(req))); } catch (error) { next(error); }
}

async function getDocuments(req, res, next) {
  try { res.json(await reportService.getDocuments(getDemoPatientId(req))); } catch (error) { next(error); }
}

async function downloadDocument(req, res, next) {
  try {
    const demoPatientId = getDemoPatientId(req);
    const patientId = storagePatientId(demoPatientId);
    const document = await reportService.getDocumentById(req.params.id, demoPatientId);
    if (!document) {
      await auditService.createAuditEventFromRequest(req, {
        eventType: "document_download",
        patientId,
        actorType: "demo_patient",
        actorId: demoPatientId,
        resourceType: "document",
        resourceId: req.params.id,
        status: "denied_not_found",
        details: { reason: "document_not_found" }
      });
      return res.status(404).json({ error: "document_not_found" });
    }

    const storageKey = document.storageKey || `documents/${document.id}.pdf`;
    const storageRoot = path.resolve(__dirname, "../../storage/documents");
    const documentPath = storageKey.startsWith("documents/") ? storageKey.slice("documents/".length) : storageKey;
    const filePath = path.resolve(storageRoot, documentPath);
    const insideStorage = filePath !== storageRoot && filePath.startsWith(`${storageRoot}${path.sep}`);
    if (!insideStorage || !fs.existsSync(filePath)) {
      await auditService.createAuditEventFromRequest(req, {
        eventType: "document_download",
        patientId,
        actorType: "demo_patient",
        actorId: demoPatientId,
        resourceType: "document",
        resourceId: document.id,
        status: "not_connected",
        details: { reason: "document_file_not_connected" }
      });
      return res.status(404).json({ error: "document_file_not_connected" });
    }

    const filename = `${document.title.replace(/[^\p{L}\p{N}_-]+/gu, "_") || document.id}.pdf`;
    await auditService.createAuditEventFromRequest(req, {
      eventType: "document_download",
      patientId,
      actorType: "demo_patient",
      actorId: demoPatientId,
      resourceType: "document",
      resourceId: document.id,
      status: "success",
      details: { title: document.title, type: document.type }
    });
    res.download(filePath, filename);
  } catch (error) {
    next(error);
  }
}

module.exports = { getReports, getDocuments, downloadDocument };
