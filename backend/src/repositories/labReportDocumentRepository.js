const { readJson } = require("../db/jsonStore");
const { withMysql } = require("./repositoryMode");

function mapDocument(row) {
  if (!row) return null;
  return {
    id: row.id,
    labReportId: row.lab_report_id || row.labReportId,
    patientId: row.patient_id || row.patientId,
    storageKey: row.storage_key || row.storageKey,
    sourceFilename: row.source_filename || row.sourceFilename,
    contentType: row.content_type || row.contentType || "application/pdf",
    fileSize: Number(row.file_size || row.fileSize || 0),
    checksumSha256: row.checksum_sha256 || row.checksumSha256 || null,
    signatureStatus: row.signature_status || row.signatureStatus || "unknown",
    createdAt: row.created_at || row.createdAt || null
  };
}

async function getLabReportDocument(labReportId, patientId) {
  return withMysql(async (pool) => {
    const [rows] = await pool.query(
      `SELECT id, lab_report_id, patient_id, storage_key, source_filename, content_type, file_size,
              checksum_sha256, signature_status, created_at
       FROM lab_report_documents
       WHERE lab_report_id = ? AND patient_id = ?
       LIMIT 1`,
      [labReportId, patientId]
    );
    return mapDocument(rows[0]);
  }, () => {
    const rows = readJson("labReportDocuments");
    return mapDocument(rows.find((row) => row.labReportId === labReportId && row.patientId === patientId));
  });
}

module.exports = { getLabReportDocument };
