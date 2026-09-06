const { readJson } = require("../db/jsonStore");
const { withMysql } = require("./repositoryMode");
const { toRuDate } = require("./formatters");

function mapPatient(row) {
  return {
    id: row.id,
    misPatientId: row.mis_patient_id,
    misCard: row.mis_card,
    name: row.name,
    initials: row.initials,
    phone: row.phone,
    birthDate: toRuDate(row.birth_date),
    age: row.age,
    sex: row.sex,
    policy: row.policy,
    clinic: row.clinic,
    region: row.region
  };
}

async function getPatient(patientId) {
  return withMysql(async (pool) => {
    const [rows] = await pool.query("SELECT * FROM patients WHERE id = ? LIMIT 1", [patientId]);
    return rows[0] ? mapPatient(rows[0]) : readJson("patient");
  }, () => readJson("patient"));
}

async function updatePatient(patientId, values) {
  return withMysql(async (pool) => {
    const [result] = await pool.query(`
      UPDATE patients
      SET name = ?, initials = ?, birth_date = ?, age = ?, sex = ?, phone = ?, policy = ?, clinic = ?, region = ?
      WHERE id = ?
    `, [
      values.name,
      values.initials,
      values.birthDate,
      values.age,
      values.sex,
      values.phone,
      values.policy,
      values.clinic,
      values.region,
      patientId
    ]);
    if (!result.affectedRows) return null;
    return getPatient(patientId);
  }, () => null);
}

async function getMeta() {
  return withMysql(async (pool) => {
    const [rows] = await pool.query("SELECT finished_at FROM sync_jobs ORDER BY started_at DESC LIMIT 1");
    return {
      ...readJson("meta"),
      source: "mysql",
      lastSync: rows[0]?.finished_at ? toRuDate(rows[0].finished_at) : readJson("meta").lastSync
    };
  }, () => readJson("meta"));
}

module.exports = { getPatient, updatePatient, getMeta };
