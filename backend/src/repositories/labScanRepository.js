const crypto = require("crypto");
const { getPool } = require("../db/mysql");

function mapDictionaryRow(row) {
  return {
    testId: String(row.test_id),
    code: row.code || "",
    sourceTestCode: row.source_test_code || "",
    name: row.display_name || row.name || "",
    rawName: row.name || "",
    unit: row.unit || "",
    serviceId: String(row.service_id),
    serviceCode: row.service_code || "",
    serviceName: row.service_name || "",
    sortOrder: Number(row.sort_order || 0)
  };
}

async function getPatient(patientId) {
  const pool = await getPool();
  const [rows] = await pool.query("SELECT id, name, birth_date, age, sex FROM patients WHERE id = ? LIMIT 1", [patientId]);
  const row = rows[0];
  return row ? { id: row.id, name: row.name, birthDate: row.birth_date, age: row.age, sex: row.sex || "" } : null;
}

async function listDictionaryRows() {
  const pool = await getPool();
  const [rows] = await pool.query(`
    SELECT
      t.id AS test_id, t.code, t.source_test_code, t.name, t.display_name,
      COALESCE(t.preferred_unit, t.unit, '') AS unit,
      s.id AS service_id, s.code AS service_code, s.name AS service_name,
      st.sort_order
    FROM lab_tests t
    JOIN lab_service_tests st ON st.test_id = t.id
    JOIN lab_services s ON s.id = st.service_id
    WHERE t.active = 1 AND s.active = 1
    ORDER BY t.id, st.sort_order, s.name
  `);
  return rows.map(mapDictionaryRow);
}

async function searchDictionaryRows(query, limit = 30) {
  const text = String(query || "").trim();
  if (!text) return [];
  const pool = await getPool();
  const like = `%${text.replace(/[%_]/g, "\\$&")}%`;
  const [rows] = await pool.query(`
    SELECT
      t.id AS test_id, t.code, t.source_test_code, t.name, t.display_name,
      COALESCE(t.preferred_unit, t.unit, '') AS unit,
      s.id AS service_id, s.code AS service_code, s.name AS service_name,
      st.sort_order
    FROM lab_tests t
    JOIN lab_service_tests st ON st.test_id = t.id
    JOIN lab_services s ON s.id = st.service_id
    WHERE t.active = 1 AND s.active = 1
      AND (
        t.name LIKE ? ESCAPE '\\'
        OR t.display_name LIKE ? ESCAPE '\\'
        OR t.code LIKE ? ESCAPE '\\'
        OR t.source_test_code LIKE ? ESCAPE '\\'
      )
    ORDER BY
      CASE
        WHEN t.code = ? OR t.source_test_code = ? THEN 0
        WHEN t.name = ? OR t.display_name = ? THEN 1
        WHEN t.name LIKE ? OR t.display_name LIKE ? THEN 2
        ELSE 3
      END,
      COALESCE(t.display_name, t.name), st.sort_order, s.name
    LIMIT ?
  `, [like, like, like, like, text, text, text, text, `${text}%`, `${text}%`, Math.max(1, Math.min(Number(limit) || 30, 50))]);
  return rows.map(mapDictionaryRow);
}

function parseValue(raw) {
  const valueRaw = String(raw ?? "").trim();
  if (!valueRaw) {
    const error = new Error("result_value_required");
    error.statusCode = 400;
    throw error;
  }
  const normalized = valueRaw.replace(",", ".");
  if (/^-?\d+(?:\.\d+)?$/.test(normalized)) return { valueRaw, valueNum: Number(normalized), valueText: null };
  return { valueRaw, valueNum: null, valueText: valueRaw };
}

async function saveConfirmed(user, reportDate, rows, meta = {}) {
  const patientId = String(user.patientId || "").trim();
  if (!patientId) {
    const error = new Error("patient_context_required");
    error.statusCode = 403;
    throw error;
  }
  const pool = await getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [access] = await connection.query(
      `SELECT p.id FROM patients p JOIN users u ON u.patient_id = p.id
       WHERE p.id = ? AND u.id = ? AND u.organization_id = ? AND u.status = 'active' LIMIT 1`,
      [patientId, user.id, user.organizationId]
    );
    if (!access[0]) {
      const error = new Error("patient_not_available");
      error.statusCode = 404;
      throw error;
    }

    const groups = new Map();
    rows.forEach((row) => {
      const key = String(row.serviceId || "").trim();
      if (!key) return;
      const list = groups.get(key) || [];
      list.push(row);
      groups.set(key, list);
    });
    if (!groups.size) {
      const error = new Error("observations_required");
      error.statusCode = 400;
      throw error;
    }

    const reports = [];
    for (const [serviceId, items] of groups.entries()) {
      const [serviceRows] = await connection.query(
        "SELECT id, code, name FROM lab_services WHERE id = ? AND active = 1 LIMIT 1",
        [serviceId]
      );
      const service = serviceRows[0];
      if (!service) {
        const error = new Error("lab_service_not_found");
        error.statusCode = 404;
        throw error;
      }
      const testIds = [...new Set(items.map((item) => String(item.testId || "").trim()).filter(Boolean))];
      const [testRows] = await connection.query(`
        SELECT t.id, t.code, t.source_test_code, t.name, t.display_name, t.biomaterial,
               t.preferred_unit, t.unit, t.method
        FROM lab_service_tests st JOIN lab_tests t ON t.id = st.test_id
        WHERE st.service_id = ? AND t.id IN (?) AND t.active = 1
      `, [serviceId, testIds]);
      const tests = new Map(testRows.map((row) => [String(row.id), row]));
      if (tests.size !== testIds.length) {
        const error = new Error("test_not_in_service");
        error.statusCode = 400;
        throw error;
      }

      const reportId = `scan_${crypto.randomUUID()}`;
      const rawPayload = {
        source: "scan",
        actorUserId: user.id,
        patientId,
        serviceId,
        reportDate,
        file: { name: meta.fileName || "", mimeType: meta.mimeType || "" },
        extraction: { laboratory: meta.laboratory || "", reportName: meta.reportName || "" },
        observations: items.map((item) => ({
          testId: String(item.testId),
          value: String(item.value || ""),
          extractedName: String(item.extractedName || ""),
          extractedUnit: String(item.extractedUnit || ""),
          extractedReference: String(item.extractedReference || "")
        }))
      };
      await connection.query(
        `INSERT INTO lab_reports
          (id, patient_id, service_id, source_service_code, report_date, status, raw_payload_json)
         VALUES (?, ?, ?, ?, ?, 'final', ?)`,
        [reportId, patientId, service.id, `SCAN:${service.code}`, reportDate, JSON.stringify(rawPayload)]
      );

      const observationRows = items.map((item) => {
        const test = tests.get(String(item.testId));
        const value = parseValue(item.value);
        return [
          reportId,
          test.id,
          test.source_test_code || test.code,
          test.biomaterial || "",
          test.method || "",
          `SCAN:${service.code}`,
          test.display_name || test.name,
          test.preferred_unit || test.unit || "",
          value.valueNum,
          value.valueText,
          "mapped"
        ];
      });
      await connection.query(`
        INSERT INTO lab_observations
          (report_id, test_id, source_test_code, biomaterial, method, source_service_code,
           source_test_name, source_unit, value_num, value_text, mapping_status)
        VALUES ?
      `, [observationRows]);

      reports.push({
        id: reportId,
        patientId,
        serviceId: String(service.id),
        serviceCode: service.code,
        name: service.name,
        date: reportDate,
        status: "final",
        testCount: observationRows.length
      });
    }
    await connection.commit();
    return reports;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { getPatient, listDictionaryRows, searchDictionaryRows, saveConfirmed };
