const crypto = require("crypto");
const { getPool } = require("../db/mysql");

function mapPatient(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    birthDate: row.birth_date,
    age: row.age === null || row.age === undefined ? null : Number(row.age),
    sex: row.sex || ""
  };
}

async function listServices() {
  const pool = await getPool();
  const [rows] = await pool.query(`
    SELECT s.id, s.code, s.source_service_code, s.name, COUNT(st.test_id) AS test_count
    FROM lab_services s
    JOIN lab_service_tests st ON st.service_id = s.id
    WHERE s.active = 1
    GROUP BY s.id, s.code, s.source_service_code, s.name
    ORDER BY s.name
  `);
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    sourceServiceCode: row.source_service_code,
    name: row.name,
    testCount: Number(row.test_count || 0)
  }));
}

async function getPatient(patientId) {
  const pool = await getPool();
  const [rows] = await pool.query(
    "SELECT id, name, birth_date, age, sex FROM patients WHERE id = ? LIMIT 1",
    [patientId]
  );
  return mapPatient(rows[0]);
}

async function isPatientAccessible(organizationId, patientId) {
  const pool = await getPool();
  const [rows] = await pool.query(
    `SELECT p.id
     FROM patients p
     JOIN users u ON u.patient_id = p.id
     WHERE p.id = ? AND u.organization_id = ? AND u.role = 'user'
     LIMIT 1`,
    [patientId, organizationId]
  );
  return Boolean(rows[0]);
}

async function listServiceTests(serviceId) {
  const pool = await getPool();
  const [tests] = await pool.query(`
    SELECT
      t.id, t.code, t.source_test_code, t.name, t.display_name,
      t.biomaterial, t.preferred_unit, t.unit, t.method, t.timepoint,
      t.value_type, t.default_group, st.sort_order
    FROM lab_service_tests st
    JOIN lab_tests t ON t.id = st.test_id
    WHERE st.service_id = ? AND t.active = 1
    ORDER BY st.sort_order, COALESCE(t.display_name, t.name), t.name
  `, [serviceId]);

  if (!tests.length) return [];
  const ids = tests.map((test) => test.id);
  const [references] = await pool.query(`
    SELECT
      id, test_id, biomaterial, unit, reference_group,
      reference_low_raw, reference_high_raw,
      reference_low_numeric, reference_high_numeric,
      critical_low_raw, critical_high_raw, method, source
    FROM lab_test_references
    WHERE test_id IN (?)
    ORDER BY test_id, id
  `, [ids]);

  const referencesByTest = new Map();
  references.forEach((row) => {
    const list = referencesByTest.get(row.test_id) || [];
    list.push({
      id: Number(row.id),
      biomaterial: row.biomaterial || "",
      unit: row.unit || "",
      group: row.reference_group || "",
      lowRaw: row.reference_low_raw || "",
      highRaw: row.reference_high_raw || "",
      low: row.reference_low_numeric === null ? null : Number(row.reference_low_numeric),
      high: row.reference_high_numeric === null ? null : Number(row.reference_high_numeric),
      criticalLowRaw: row.critical_low_raw || "",
      criticalHighRaw: row.critical_high_raw || "",
      method: row.method || "",
      source: row.source || ""
    });
    referencesByTest.set(row.test_id, list);
  });

  return tests.map((row) => ({
    id: row.id,
    code: row.code,
    sourceTestCode: row.source_test_code,
    name: row.display_name || row.name,
    biomaterial: row.biomaterial || "",
    unit: row.preferred_unit || row.unit || "",
    method: row.method || "",
    timepoint: row.timepoint || "",
    valueType: row.value_type || "numeric",
    group: row.default_group || "",
    sortOrder: Number(row.sort_order || 0),
    references: referencesByTest.get(row.id) || []
  }));
}

async function getReferenceDataByCodes(codes) {
  const uniqueCodes = [...new Set((codes || []).filter(Boolean))];
  if (!uniqueCodes.length) return [];
  const pool = await getPool();
  const [tests] = await pool.query(`
    SELECT id, code, name, display_name, biomaterial, preferred_unit, unit, method, value_type
    FROM lab_tests
    WHERE code IN (?)
  `, [uniqueCodes]);
  if (!tests.length) return [];

  const ids = tests.map((test) => test.id);
  const [references] = await pool.query(`
    SELECT
      id, test_id, biomaterial, unit, reference_group,
      reference_low_raw, reference_high_raw,
      reference_low_numeric, reference_high_numeric,
      method, source
    FROM lab_test_references
    WHERE test_id IN (?)
    ORDER BY test_id, id
  `, [ids]);
  const refs = new Map();
  references.forEach((row) => {
    const list = refs.get(row.test_id) || [];
    list.push({
      id: Number(row.id),
      group: row.reference_group || "",
      lowRaw: row.reference_low_raw || "",
      highRaw: row.reference_high_raw || "",
      low: row.reference_low_numeric === null ? null : Number(row.reference_low_numeric),
      high: row.reference_high_numeric === null ? null : Number(row.reference_high_numeric),
      unit: row.unit || "",
      biomaterial: row.biomaterial || "",
      method: row.method || "",
      source: row.source || ""
    });
    refs.set(row.test_id, list);
  });
  return tests.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.display_name || row.name,
    biomaterial: row.biomaterial || "",
    unit: row.preferred_unit || row.unit || "",
    method: row.method || "",
    valueType: row.value_type || "numeric",
    references: refs.get(row.id) || []
  }));
}

async function getReportReferenceSelections(reportId) {
  const pool = await getPool();
  const [rows] = await pool.query(
    "SELECT raw_payload_json FROM lab_reports WHERE id = ? LIMIT 1",
    [reportId]
  );
  if (!rows[0]?.raw_payload_json) return {};
  try {
    const payload = typeof rows[0].raw_payload_json === "string"
      ? JSON.parse(rows[0].raw_payload_json)
      : rows[0].raw_payload_json;
    const result = {};
    (payload?.observations || []).forEach((item) => {
      if (item?.testId && item?.referenceId) result[item.testId] = Number(item.referenceId);
    });
    return result;
  } catch (error) {
    return {};
  }
}

async function createManualReport({ organizationId, actorUserId, patientId, serviceId, reportDate, observations }) {
  const pool = await getPool();
  const connection = await pool.getConnection();
  const reportId = `manual_${crypto.randomUUID()}`;

  try {
    await connection.beginTransaction();

    const [patientRows] = await connection.query(
      `SELECT p.id
       FROM patients p
       JOIN users u ON u.patient_id = p.id
       WHERE p.id = ? AND u.organization_id = ? AND u.role = 'user'
       LIMIT 1`,
      [patientId, organizationId]
    );
    if (!patientRows[0]) {
      const error = new Error("patient_not_available");
      error.statusCode = 404;
      throw error;
    }

    const [serviceRows] = await connection.query(
      "SELECT id, code, source_service_code, name FROM lab_services WHERE id = ? AND active = 1 LIMIT 1",
      [serviceId]
    );
    const service = serviceRows[0];
    if (!service) {
      const error = new Error("lab_service_not_found");
      error.statusCode = 404;
      throw error;
    }

    const [testRows] = await connection.query(`
      SELECT
        t.id, t.code, t.source_test_code, t.name, t.display_name,
        t.biomaterial, t.preferred_unit, t.unit, t.method, t.value_type
      FROM lab_service_tests st
      JOIN lab_tests t ON t.id = st.test_id
      WHERE st.service_id = ? AND t.active = 1
    `, [serviceId]);
    const testsById = new Map(testRows.map((row) => [row.id, row]));

    const rawPayload = {
      source: "manual",
      actorUserId,
      patientId,
      serviceId,
      reportDate,
      observations: observations.map((item) => ({
        testId: item.testId,
        referenceId: item.referenceId || null,
        value: item.valueRaw
      }))
    };

    await connection.query(
      `INSERT INTO lab_reports
        (id, patient_id, service_id, source_service_code, report_date, status, raw_payload_json)
       VALUES (?, ?, ?, ?, ?, 'final', ?)`,
      [reportId, patientId, service.id, `MANUAL:${service.code}`, reportDate, JSON.stringify(rawPayload)]
    );

    const rows = observations.map((item) => {
      const test = testsById.get(item.testId);
      if (!test) {
        const error = new Error("test_not_in_service");
        error.statusCode = 400;
        throw error;
      }
      const sourceCode = test.source_test_code || test.code;
      return [
        reportId,
        test.id,
        sourceCode,
        test.biomaterial || "",
        test.method || "",
        `MANUAL:${service.code}`,
        test.display_name || test.name,
        test.preferred_unit || test.unit || "",
        item.valueNum,
        item.valueText,
        "mapped"
      ];
    });

    if (rows.length) {
      await connection.query(`
        INSERT INTO lab_observations
          (report_id, test_id, source_test_code, biomaterial, method, source_service_code,
           source_test_name, source_unit, value_num, value_text, mapping_status)
        VALUES ?
      `, [rows]);
    }

    await connection.commit();
    return {
      id: reportId,
      patientId,
      serviceId: service.id,
      serviceCode: service.code,
      name: service.name,
      date: reportDate,
      status: "final",
      testCount: rows.length
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  listServices,
  getPatient,
  isPatientAccessible,
  listServiceTests,
  getReferenceDataByCodes,
  getReportReferenceSelections,
  createManualReport
};
