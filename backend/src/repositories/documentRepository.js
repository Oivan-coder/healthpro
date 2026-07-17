const { readJson } = require("../db/jsonStore");
const { withMysql } = require("./repositoryMode");
const { toRuDate } = require("./formatters");

async function getDocuments(patientId) {
  return withMysql(async (pool) => {
    const [rows] = await pool.query("SELECT id, title, document_date AS date, type, size, icon FROM documents ORDER BY document_date DESC");
    return rows.map(formatDocument);
  }, () => readJson("documents"));
}

async function getDocumentById(id, patientId) {
  const documents = await getDocuments(patientId);
  return documents.find((document) => document.id === id) || null;
}

function formatDocument(row) {
  return {
    ...row,
    date: row.date instanceof Date ? toRuDate(row.date) : row.date,
    storageKey: row.storageKey || row.storage_key || `documents/${row.id}.pdf`,
    fileUrl: row.fileUrl || row.file_url || null
  };
}

module.exports = { getDocuments, getDocumentById };
