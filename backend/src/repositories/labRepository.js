const { readJson, writeJson } = require("../db/jsonStore");
const { withMysql } = require("./repositoryMode");
const { ruDateToMysql, toRuDate } = require("./formatters");

const serviceCodeByGroup = {
  "ОАК": "CBC",
  "ОАМ": "UAM",
  "Биохимия": "BIOCHEM",
  "Липидный профиль": "LIPID",
  "Коагулограмма": "COAG",
  "Гормоны": "HORMONES",
  "Воспаление": "INFLAM"
};

function serviceCode(group) {
  return serviceCodeByGroup[group] || group.toUpperCase().replace(/\s+/g, "_");
}

function mapTest(row) {
  return {
    code: row.code,
    name: row.name,
    group: row.group_name || row.group,
    unit: row.unit || "",
    low: row.low_value == null ? null : Number(row.low_value),
    high: row.high_value == null ? null : Number(row.high_value),
    loinc: row.loinc || "",
    graphable: Boolean(row.graphable)
  };
}

async function getCatalog() {
  return getTests();
}

async function getServices() {
  return withMysql(async (pool) => {
    const [rows] = await pool.query("SELECT id, code, name, source_service_code FROM lab_services ORDER BY name");
    return rows;
  }, () => {
    const groups = Array.from(new Set(readJson("labCatalog").map((item) => item.group)));
    return groups.map((group, index) => ({
      id: `svc_${index + 1}`,
      code: serviceCode(group),
      name: group,
      sourceServiceCode: serviceCode(group),
      source_service_code: serviceCode(group)
    }));
  });
}

async function getTests() {
  return withMysql(async (pool) => {
    const [rows] = await pool.query("SELECT code, name, default_group AS group_name, unit, low_value, high_value, loinc, graphable, source_test_code FROM lab_tests ORDER BY default_group, name");
    return rows.map(mapTest);
  }, () => readJson("labCatalog"));
}

async function getObservations(patientId) {
  return withMysql(async (pool) => {
    const patientWhere = patientId ? "WHERE r.patient_id = ?" : "";
    const params = patientId ? [patientId] : [];
    const [rows] = await pool.query(`
      SELECT
        COALESCE(t.code, o.source_test_code) AS code,
        COALESCE(o.value_num, o.value_text) AS value,
        r.report_date AS date,
        o.source_test_code,
        o.mapping_status,
        r.id AS report_id,
        r.service_id
      FROM lab_observations o
      JOIN lab_reports r ON r.id = o.report_id
      LEFT JOIN lab_tests t ON t.id = o.test_id
      ${patientWhere}
      ORDER BY r.report_date
    `, params);
    return rows.map((row) => ({
      code: row.code,
      value: row.value,
      date: toRuDate(row.date),
      sourceTestCode: row.source_test_code,
      mappingStatus: row.mapping_status,
      reportId: row.report_id,
      serviceId: row.service_id
    }));
  }, () => readJson("labObservations"));
}

async function addObservations(items) {
  return withMysql(async (pool) => {
    if (!items.length) return [];
    const [reports] = await pool.query("SELECT id FROM lab_reports ORDER BY report_date DESC LIMIT 1");
    let reportId = reports[0]?.id;
    if (!reportId) {
      const [services] = await pool.query("SELECT id FROM lab_services ORDER BY id LIMIT 1");
      reportId = `lr_${Date.now()}`;
      await pool.query(
        "INSERT INTO lab_reports (id, service_id, source_service_code, report_date, status) VALUES (?, ?, 'IMPORT', CURDATE(), 'final')",
        [reportId, services[0]?.id || null]
      );
    }
    const [tests] = await pool.query("SELECT id, code FROM lab_tests");
    const byCode = Object.fromEntries(tests.map((test) => [test.code, test.id]));
    await pool.query(
      "INSERT IGNORE INTO lab_observations (report_id, test_id, source_test_code, value_num, mapping_status) VALUES ?",
      [items.map((item) => [reportId, byCode[item.code], item.code, item.value, byCode[item.code] ? "mapped" : "unmapped"])]
    );
    return items;
  }, () => {
    const observations = readJson("labObservations");
    observations.push(...items);
    writeJson("labObservations", observations);
    return items;
  });
}

async function getLabReports(patientId) {
  return withMysql(async (pool) => {
    const patientWhere = patientId ? "WHERE r.patient_id = ?" : "";
    const params = patientId ? [patientId] : [];
    const [rows] = await pool.query(`
      SELECT
        r.id,
        r.report_date AS date,
        r.status,
        r.source_service_code,
        s.code AS service_code,
        s.name AS service_name,
        COUNT(o.id) AS test_count,
        SUM(CASE
          WHEN o.value_num IS NULL OR t.id IS NULL THEN 0
          WHEN o.value_num > t.high_value OR o.value_num < t.low_value THEN 1
          ELSE 0
        END) AS abnormal_count
      FROM lab_reports r
      LEFT JOIN lab_services s ON s.id = r.service_id
      LEFT JOIN lab_observations o ON o.report_id = r.id
      LEFT JOIN lab_tests t ON t.id = o.test_id
      ${patientWhere}
      GROUP BY r.id, r.report_date, r.status, r.source_service_code, s.code, s.name
      ORDER BY r.report_date DESC, r.id DESC
    `, params);
    return rows.map((row) => ({
      id: row.id,
      date: toRuDate(row.date),
      status: row.status,
      serviceCode: row.service_code,
      sourceServiceCode: row.source_service_code,
      name: row.service_name || row.source_service_code || "Неизвестное исследование",
      testCount: Number(row.test_count || 0),
      abnormalCount: Number(row.abnormal_count || 0)
    }));
  }, async () => buildJsonReports());
}

async function getLabReportById(id, patientId) {
  return withMysql(async (pool) => {
    const patientWhere = patientId ? "AND r.patient_id = ?" : "";
    const params = patientId ? [id, patientId] : [id];
    const [reports] = await pool.query(`
      SELECT r.id, r.report_date AS date, r.status, r.source_service_code, s.code AS service_code, s.name AS service_name
      FROM lab_reports r
      LEFT JOIN lab_services s ON s.id = r.service_id
      WHERE r.id = ? ${patientWhere}
    `, params);
    if (!reports[0]) return null;
    const [rows] = await pool.query(`
      SELECT
        o.id,
        o.source_test_code,
        o.value_num AS value,
        o.value_text,
        o.mapping_status,
        t.code,
        t.name,
        t.unit,
        t.low_value,
        t.high_value,
        t.loinc,
        t.default_group AS group_name
      FROM lab_observations o
      LEFT JOIN lab_tests t ON t.id = o.test_id
      WHERE o.report_id = ?
      ORDER BY COALESCE(t.name, o.source_test_code)
    `, [id]);
    const report = reports[0];
    const observations = rows.map(mapReportObservation);
    return {
      id: report.id,
      date: toRuDate(report.date),
      status: report.status,
      serviceCode: report.service_code,
      sourceServiceCode: report.source_service_code,
      name: report.service_name || report.source_service_code || "Неизвестное исследование",
      testCount: observations.length,
      abnormalCount: observations.filter((item) => ["high", "low"].includes(item.flag)).length,
      observations
    };
  }, async () => (await buildJsonReports()).find((report) => report.id === id) || null);
}

function mapReportObservation(row) {
  const mapped = row.mapping_status !== "unmapped" && row.code;
  const value = row.value === null || row.value === undefined ? row.value_text : Number(row.value);
  const low = mapped && row.low_value != null ? Number(row.low_value) : null;
  const high = mapped && row.high_value != null ? Number(row.high_value) : null;
  const flag = !mapped ? "unmapped" : typeof value !== "number" || !Number.isFinite(value) ? "info"
    : high != null && value > high ? "high" : low != null && value < low ? "low"
    : low != null || high != null ? "normal" : "info";
  return {
    id: row.id,
    code: row.code || row.source_test_code,
    sourceTestCode: row.source_test_code,
    name: row.name || row.source_test_code || "Unmapped test",
    group: row.group_name || "Unmapped",
    value,
    unit: row.unit || "",
    low,
    high,
    loinc: row.loinc || "",
    flag,
    mappingStatus: mapped ? "mapped" : "unmapped"
  };
}

async function getTestHistory(testCode, patientId) {
  return withMysql(async (pool) => {
    const patientWhere = patientId ? "r.patient_id = ? AND " : "";
    const params = patientId ? [patientId, testCode, testCode] : [testCode, testCode];
    const [rows] = await pool.query(`
      SELECT
        r.report_date AS date,
        r.id AS report_id,
        COALESCE(o.value_num, o.value_text) AS value,
        t.code,
        t.name,
        t.unit,
        t.low_value,
        t.high_value,
        t.loinc,
        t.default_group AS group_name
      FROM lab_observations o
      JOIN lab_reports r ON r.id = o.report_id
      JOIN lab_tests t ON t.id = o.test_id
      WHERE ${patientWhere}(t.code = ? OR o.source_test_code = ?)
      ORDER BY r.report_date
    `, params);
    return rows.map((row) => ({
      code: row.code,
      name: row.name,
      group: row.group_name,
      unit: row.unit || "",
      low: row.low_value == null ? null : Number(row.low_value),
      high: row.high_value == null ? null : Number(row.high_value),
      loinc: row.loinc || "",
      reportId: row.report_id,
      value: row.value,
      date: toRuDate(row.date)
    }));
  }, async () => {
    const byCode = Object.fromEntries(readJson("labCatalog").map((item) => [item.code, item]));
    return readJson("labObservations")
      .filter((item) => item.code === testCode)
      .map((item) => ({ ...byCode[item.code], ...item, value: Number(item.value) }))
      .sort((a, b) => new Date(ruDateToMysql(a.date)) - new Date(ruDateToMysql(b.date)));
  });
}

async function importLabReport(payload = {}) {
  return withMysql(async (pool) => {
    const reportId = payload.id || `lr_${Date.now()}`;
    const sourceServiceCode = payload.source_service_code || payload.sourceServiceCode || payload.serviceCode || "UNKNOWN_SERVICE";
    const reportDate = ruDateToMysql(payload.date || payload.report_date);
    const [services] = await pool.query("SELECT id FROM lab_services WHERE code = ? OR source_service_code = ? LIMIT 1", [sourceServiceCode, sourceServiceCode]);
    const serviceId = services[0]?.id || null;
    await pool.query(
      "INSERT INTO lab_reports (id, service_id, source_service_code, report_date, status, raw_payload_json) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE raw_payload_json=VALUES(raw_payload_json)",
      [reportId, serviceId, sourceServiceCode, reportDate, payload.status || "final", JSON.stringify(payload)]
    );
    const items = payload.observations || payload.tests || [];
    const [tests] = await pool.query("SELECT id, code, source_test_code FROM lab_tests");
    const byCode = {};
    tests.forEach((test) => {
      byCode[test.code] = test.id;
      if (test.source_test_code) byCode[test.source_test_code] = test.id;
    });
    const rows = items.map((item) => {
      const sourceTestCode = item.source_test_code || item.sourceTestCode || item.code;
      const testId = byCode[sourceTestCode] || byCode[item.code] || null;
      return [reportId, testId, sourceTestCode, item.value === undefined ? null : Number(item.value), item.value_text || null, testId ? "mapped" : "unmapped"];
    });
    if (rows.length) {
      await pool.query("INSERT INTO lab_observations (report_id, test_id, source_test_code, value_num, value_text, mapping_status) VALUES ?", [rows]);
    }
    return getLabReportById(reportId);
  }, async () => importJsonLabReport(payload));
}

async function getUnmapped() {
  return withMysql(async (pool) => {
    const [rows] = await pool.query(`
      SELECT r.id AS report_id, r.source_service_code, r.report_date AS date, o.source_test_code, o.value_num, o.value_text
      FROM lab_observations o
      JOIN lab_reports r ON r.id = o.report_id
      WHERE o.mapping_status = 'unmapped' OR o.test_id IS NULL OR r.service_id IS NULL
      ORDER BY r.report_date DESC
    `);
    return rows.map((row) => ({ ...row, date: toRuDate(row.date) }));
  }, () => {
    try {
      return readJson("labUnmapped");
    } catch (error) {
      return [];
    }
  });
}

async function buildJsonReports() {
  const catalog = readJson("labCatalog");
  const byCode = Object.fromEntries(catalog.map((item) => [item.code, item]));
  const grouped = {};
  readJson("labObservations").forEach((obs) => {
    const meta = byCode[obs.code];
    if (!meta) return;
    const key = `${serviceCode(meta.group)}|${obs.date}`;
    if (!grouped[key]) {
      grouped[key] = {
        id: `json_${serviceCode(meta.group)}_${obs.date.replace(/\./g, "")}`,
        date: obs.date,
        status: "final",
        serviceCode: serviceCode(meta.group),
        sourceServiceCode: serviceCode(meta.group),
        name: meta.group,
        observations: []
      };
    }
    const value = Number(obs.value);
    grouped[key].observations.push({
      code: obs.code,
      sourceTestCode: obs.code,
      name: meta.name,
      group: meta.group,
      value,
      unit: meta.unit,
      low: meta.low,
      high: meta.high,
      loinc: meta.loinc,
      flag: value > meta.high ? "high" : value < meta.low ? "low" : "normal",
      mappingStatus: "mapped"
    });
  });
  return Object.values(grouped)
    .map((report) => ({
      ...report,
      testCount: report.observations.length,
      abnormalCount: report.observations.filter((item) => item.flag !== "normal").length
    }))
    .sort((a, b) => new Date(ruDateToMysql(b.date)) - new Date(ruDateToMysql(a.date)));
}

async function importJsonLabReport(payload) {
  const catalog = readJson("labCatalog");
  const validCodes = new Set(catalog.map((item) => item.code));
  const items = payload.observations || payload.tests || [];
  const valid = [];
  const unmapped = [];
  items.forEach((item) => {
    const code = item.code || item.source_test_code || item.sourceTestCode;
    if (validCodes.has(code) && !Number.isNaN(Number(item.value))) {
      valid.push({ code, value: Number(item.value), date: payload.date || payload.report_date });
    } else {
      unmapped.push({
        report_id: payload.id || `json_import_${Date.now()}`,
        source_service_code: payload.source_service_code || payload.sourceServiceCode || payload.serviceCode,
        date: payload.date || payload.report_date,
        source_test_code: code,
        value_num: item.value,
        value_text: item.value_text || null
      });
    }
  });
  if (valid.length) await addObservations(valid);
  if (unmapped.length) {
    let previous = [];
    try { previous = readJson("labUnmapped"); } catch (error) { previous = []; }
    writeJson("labUnmapped", [...unmapped, ...previous]);
  }
  return {
    id: payload.id || `json_import_${Date.now()}`,
    date: payload.date || payload.report_date,
    status: payload.status || "final",
    sourceServiceCode: payload.source_service_code || payload.sourceServiceCode || payload.serviceCode,
    testCount: items.length,
    abnormalCount: 0,
    observations: []
  };
}

module.exports = {
  getCatalog,
  getServices,
  getTests,
  getObservations,
  addObservations,
  getLabReports,
  getLabReportById,
  getTestHistory,
  importLabReport,
  getUnmapped
};
