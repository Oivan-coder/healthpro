const { readJson } = require("../db/jsonStore");
const { withMysql } = require("./repositoryMode");
const { toRuDate } = require("./formatters");

async function getReports(patientId) {
  return withMysql(async (pool) => {
    const [rows] = await pool.query("SELECT id, report_date AS date, title, doctor, status, text FROM medical_reports ORDER BY report_date DESC");
    return rows.map((row) => ({ ...row, date: toRuDate(row.date) }));
  }, () => readJson("reports"));
}

module.exports = { getReports };
