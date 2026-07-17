const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mysql = require("mysql2/promise");
const { dbConfig } = require("../db/env");

const EXPECTED_COLUMNS = 14;
const FORWARD_FILL_COLUMNS = [0, 1, 2, 3, 9, 10, 11];
const STATUS_READY = "ready";
const STATUS_NEEDS_REVIEW = "needs_review";
const STATUS_SKIPPED_HEADER = "skipped_header";
const SOURCE_SYSTEM = "dictionary_csv";
const HEADER_MARKERS = [
  "наименование исследован",
  "наименование тест",
  "(указывается при необходимости)"
];

function clean(value) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(value) {
  return clean(value).toLowerCase();
}

function hash(value, length = 14) {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, length);
}

function detectDelimiter(line) {
  const candidates = [",", ";", "\t"];
  let best = ",";
  let bestCount = -1;
  for (const candidate of candidates) {
    const count = splitCsvLine(line, candidate).length;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

function splitCsvLine(line, delimiter) {
  const cells = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === delimiter && !inQuotes) {
      cells.push(clean(cell));
      cell = "";
      continue;
    }
    cell += char;
  }
  cells.push(clean(cell));
  return cells;
}

function readCsv(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV file not found: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = content.split("\n").filter((line) => line.trim());
  const firstDataLine = lines.find((line) => line.trim()) || "";
  const delimiter = detectDelimiter(firstDataLine);
  return lines.map((line, index) => {
    const cells = splitCsvLine(line, delimiter);
    return { rowNumber: index + 1, rawLine: line, cells, originalColumnCount: cells.length };
  });
}

function readXlsx(filePath, sheetName) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`XLSX file not found: ${filePath}`);
  }

  const xlsx = require("xlsx");
  const workbook = xlsx.readFile(filePath, { cellDates: false });
  const selectedSheet = sheetName || workbook.SheetNames[0];
  const sheet = workbook.Sheets[selectedSheet];
  if (!sheet) {
    throw new Error(`Sheet not found: ${selectedSheet}`);
  }

  const data = xlsx.utils.sheet_to_json(sheet, {
    header: 1,
    blankrows: false,
    defval: "",
    raw: false
  });

  return data
    .map((cells, index) => {
      const normalizedCells = cells.slice(0, EXPECTED_COLUMNS).map(clean);
      while (normalizedCells.length < EXPECTED_COLUMNS) normalizedCells.push("");
      return {
        rowNumber: index + 1,
        rawLine: normalizedCells.join(","),
        cells: normalizedCells,
        originalColumnCount: EXPECTED_COLUMNS
      };
    })
    .filter((row) => row.cells.some((cell) => clean(cell)));
}

function readDictionaryRows(filePath, options = {}) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".xlsx") return readXlsx(filePath, options.sheet);
  return readCsv(filePath);
}

function resolveInputPath(fileArg) {
  const candidates = [
    path.resolve(process.cwd(), fileArg),
    path.resolve(process.cwd(), "..", fileArg)
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

function resolveOutputPath(fileArg) {
  const candidates = [
    path.resolve(process.cwd(), fileArg),
    path.resolve(process.cwd(), "..", fileArg)
  ];
  return candidates.find((candidate) => fs.existsSync(path.dirname(candidate))) || candidates[0];
}

function parseNumeric(value) {
  const raw = clean(value).replace(",", ".");
  if (!raw) return null;
  if (/[<>≤≥a-zа-я]/i.test(raw)) return null;
  const match = raw.match(/^-?\d+(?:\.\d+)?$/);
  if (!match) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractTimepoint(testName) {
  const text = normalize(testName);
  const patterns = [
    /натощак/,
    /через\s*\d+\s*(?:минут|мин|часа|час|ч)/,
    /\b\d+\s*(?:мин|минут)\s*после/,
    /\b\d+\s*(?:час|часа|ч)\s*после/
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return clean(match[0]);
  }
  return "";
}

function baseAnalyte(testName, timepoint) {
  let value = clean(testName);
  if (timepoint) value = value.replace(new RegExp(timepoint, "i"), "");
  return clean(value.replace(/\s*\([^)]*\)\s*/g, " "));
}

function valueType(referenceLow, referenceHigh) {
  const combined = `${referenceLow} ${referenceHigh}`.toLowerCase();
  if (/не обнаружено|отрицательно|положительно|следы|норма|нет|да/.test(combined)) return "text";
  return "numeric";
}

function contextFrom(row) {
  return [row.normalizedSection, row.normalizedSubsection].filter(Boolean).join(" / ");
}

function testIdentity(row) {
  return [
    row.normalizedTestName,
    row.normalizedBiomaterial,
    contextFrom(row),
    row.timepoint,
    row.normalizedMethod
  ].map(normalize).join("|");
}

function serviceKey(row) {
  return row.normalizedServiceName;
}

function serviceCode(row) {
  return `DICT_SVC_${hash(serviceKey(row), 10).toUpperCase()}`;
}

function serviceId(row) {
  return `dict_svc_${hash(serviceKey(row), 16)}`;
}

function testCode(row) {
  return `DICT_T_${hash(testIdentity(row), 10).toUpperCase()}`;
}

function testId(row) {
  return `dict_test_${hash(testIdentity(row), 16)}`;
}

function referenceKey(testIdValue, row) {
  return [
    testIdValue,
    row.normalizedBiomaterial,
    row.normalizedUnit,
    row.rawReferenceGroup,
    row.rawReferenceLow,
    row.rawReferenceHigh,
    row.rawCriticalLow,
    row.rawCriticalHigh,
    row.normalizedMethod,
    SOURCE_SYSTEM
  ].map((value) => clean(value)).join("|");
}

function hasReference(row) {
  return Boolean(
    row.rawReferenceLow ||
    row.rawReferenceHigh ||
    row.rawReferenceGroup ||
    row.rawCriticalLow ||
    row.rawCriticalHigh
  );
}

function isHeaderRow(rowNumber, cells, skipRows = 0) {
  if (rowNumber <= skipRows) return true;
  const text = normalize(cells.map(clean).join(" "));
  return HEADER_MARKERS.some((marker) => text.includes(marker));
}

function buildRow(rowNumber, rawLine, cells, originalColumnCount, importStatus = STATUS_READY, reviewComment = "") {
  const filled = cells.slice(0, EXPECTED_COLUMNS);
  while (filled.length < EXPECTED_COLUMNS) filled.push("");

  const row = {
    rowNumber,
    rawLine,
    originalColumnCount,
    rawServiceName: clean(filled[0]),
    rawTestName: clean(filled[1]),
    rawBiomaterial: clean(filled[2]),
    rawUnit: clean(filled[3]),
    rawReferenceLow: clean(filled[4]),
    rawReferenceHigh: clean(filled[5]),
    rawReferenceGroup: clean(filled[6]),
    rawCriticalLow: clean(filled[7]),
    rawCriticalHigh: clean(filled[8]),
    rawMethod: clean(filled[9]),
    rawSection: clean(filled[10]),
    rawSubsection: clean(filled[11]),
    rawSynonymsRu: clean(filled[12]),
    rawSynonymsEn: clean(filled[13])
  };

  row.normalizedServiceName = clean(row.rawServiceName);
  row.normalizedTestName = clean(row.rawTestName);
  row.normalizedBiomaterial = clean(row.rawBiomaterial);
  row.normalizedUnit = clean(row.rawUnit);
  row.normalizedMethod = clean(row.rawMethod);
  row.normalizedSection = clean(row.rawSection);
  row.normalizedSubsection = clean(row.rawSubsection);
  row.timepoint = extractTimepoint(row.rawTestName);
  row.baseAnalyte = baseAnalyte(row.rawTestName, row.timepoint);
  row.importStatus = importStatus;
  row.reviewComment = reviewComment;
  return row;
}

function prepareRows(filePath, options = {}) {
  const skipRows = Number(options.skipRows || 0);
  const rawRows = readDictionaryRows(filePath, options);
  const last = Array(EXPECTED_COLUMNS).fill("");
  const prepared = rawRows.map(({ rowNumber, rawLine, cells, originalColumnCount }) => {
    if (isHeaderRow(rowNumber, cells, skipRows)) {
      return buildRow(rowNumber, rawLine, cells, originalColumnCount, STATUS_SKIPPED_HEADER);
    }

    if (originalColumnCount !== EXPECTED_COLUMNS) {
      return buildRow(rowNumber, rawLine, cells, originalColumnCount, STATUS_NEEDS_REVIEW, "invalid_column_count");
    }

    const filled = cells.slice(0, EXPECTED_COLUMNS);
    FORWARD_FILL_COLUMNS.forEach((index) => {
      if (filled[index]) last[index] = filled[index];
      else filled[index] = last[index];
    });

    return buildRow(rowNumber, rawLine, filled, originalColumnCount);
  });

  markNeedsReview(prepared);
  return prepared;
}

function markNeedsReview(rows) {
  const unitsByIdentity = new Map();
  rows.forEach((row) => {
    if (row.importStatus !== STATUS_READY) return;

    const comments = [];
    if (!row.normalizedServiceName) comments.push("missing_service_name");
    if (!row.normalizedTestName) comments.push("missing_test_name");

    const identity = testIdentity(row);
    const unit = normalize(row.normalizedUnit);
    if (row.normalizedTestName) {
      const previousUnits = unitsByIdentity.get(identity) || new Set();
      if (previousUnits.size && unit && !previousUnits.has(unit)) comments.push("unit_conflict_for_same_test_context");
      if (unit) previousUnits.add(unit);
      unitsByIdentity.set(identity, previousUnits);
    }

    if (comments.length) {
      row.importStatus = STATUS_NEEDS_REVIEW;
      row.reviewComment = comments.join("; ");
    }
  });
}

function inspectRows(rows) {
  const services = new Set();
  const tests = new Set();
  const links = new Set();
  let references = 0;
  rows.forEach((row) => {
    if (row.importStatus !== STATUS_READY) return;

    if (row.normalizedServiceName) services.add(serviceKey(row));
    if (row.normalizedTestName) tests.add(testIdentity(row));
    if (row.normalizedServiceName && row.normalizedTestName) links.add(`${serviceKey(row)}|${testIdentity(row)}`);
    if (hasReference(row)) references += 1;
  });

  return {
    rowsRead: rows.length,
    columnCount: EXPECTED_COLUMNS,
    services: services.size,
    tests: tests.size,
    serviceTestLinks: links.size,
    referenceRows: references,
    skippedHeaderRows: rows.filter((row) => row.importStatus === STATUS_SKIPPED_HEADER).length,
    invalidColumnCountRows: rows.filter((row) => row.reviewComment === "invalid_column_count").length,
    readyRows: rows.filter((row) => row.importStatus === STATUS_READY).length,
    needsReviewRows: rows.filter((row) => row.importStatus === STATUS_NEEDS_REVIEW).length,
    firstReadyRows: rows.filter((row) => row.importStatus === STATUS_READY).slice(0, 10).map(printableRow),
    needsReviewExamples: rows.filter((row) => row.importStatus === STATUS_NEEDS_REVIEW).slice(0, 10).map(printableRow)
  };
}

function parseArgs(argv) {
  const command = argv[2];
  const args = argv.slice(3);
  const fileArg = args.find((arg) => !arg.startsWith("--"));
  const skipRowsArg = args.find((arg) => arg.startsWith("--skip-rows="));
  const exportReviewArg = args.find((arg) => arg.startsWith("--export-review="));
  const sheetArg = args.find((arg) => arg.startsWith("--sheet="));
  const skipRows = skipRowsArg ? Number(skipRowsArg.split("=")[1]) : 0;
  if (!Number.isInteger(skipRows) || skipRows < 0) {
    throw new Error("--skip-rows must be a non-negative integer");
  }
  return {
    command,
    fileArg,
    skipRows,
    sheet: sheetArg ? sheetArg.split("=").slice(1).join("=") : "",
    exportReviewArg: exportReviewArg ? exportReviewArg.split("=").slice(1).join("=") : ""
  };
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function exportReviewRows(filePath, rows) {
  const reviewRows = rows.filter((row) => row.importStatus !== STATUS_READY);
  const columns = [
    "row_number",
    "status",
    "review_comment",
    "raw_line",
    "columns_count",
    "parsed_service",
    "parsed_test",
    "parsed_biomaterial",
    "parsed_unit",
    "parsed_method"
  ];
  const lines = [
    columns.join(","),
    ...reviewRows.map((row) => [
      row.rowNumber,
      row.reviewComment === "invalid_column_count" ? "invalid_column_count" : row.importStatus,
      row.reviewComment,
      row.rawLine,
      row.originalColumnCount,
      row.normalizedServiceName,
      row.normalizedTestName,
      row.normalizedBiomaterial,
      row.normalizedUnit,
      row.normalizedMethod
    ].map(csvEscape).join(","))
  ];

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
  return reviewRows.length;
}

function printableRow(row) {
  return {
    row: row.rowNumber,
    service: row.normalizedServiceName,
    test: row.normalizedTestName,
    biomaterial: row.normalizedBiomaterial,
    unit: row.normalizedUnit,
    method: row.normalizedMethod,
    timepoint: row.timepoint,
    status: row.importStatus,
    review: row.reviewComment
  };
}

function printInspect(filePath, rows) {
  const summary = inspectRows(rows);
  console.log(`Dictionary inspect: ${filePath}`);
  console.table([{
    rows_read: summary.rowsRead,
    columns_expected: summary.columnCount,
    unique_services: summary.services,
    unique_tests: summary.tests,
    service_test_links: summary.serviceTestLinks,
    reference_rows: summary.referenceRows,
    skipped_header_rows: summary.skippedHeaderRows,
    invalid_column_count_rows: summary.invalidColumnCountRows,
    ready_rows: summary.readyRows,
    needs_review_rows: summary.needsReviewRows
  }]);
  console.log("First 10 ready rows:");
  console.table(summary.firstReadyRows);
  console.log("Needs review examples:");
  console.table(summary.needsReviewExamples);
}

async function connect() {
  const config = dbConfig();
  return mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    multipleStatements: true
  });
}

async function insertStaging(connection, sourceFile, rows) {
  await connection.query("DELETE FROM lab_dictionary_import_rows WHERE source_file = ?", [sourceFile]);
  const columns = [
    "source_file",
    "row_number",
    "raw_service_name",
    "raw_test_name",
    "raw_biomaterial",
    "raw_unit",
    "raw_reference_low",
    "raw_reference_high",
    "raw_reference_group",
    "raw_critical_low",
    "raw_critical_high",
    "raw_method",
    "raw_section",
    "raw_subsection",
    "raw_synonyms_ru",
    "raw_synonyms_en",
    "normalized_service_name",
    "normalized_test_name",
    "normalized_biomaterial",
    "normalized_unit",
    "import_status",
    "review_comment"
  ];

  const values = rows.map((row) => [
    sourceFile,
    row.rowNumber,
    row.rawServiceName,
    row.rawTestName,
    row.rawBiomaterial,
    row.rawUnit,
    row.rawReferenceLow,
    row.rawReferenceHigh,
    row.rawReferenceGroup,
    row.rawCriticalLow,
    row.rawCriticalHigh,
    row.rawMethod,
    row.rawSection,
    row.rawSubsection,
    row.rawSynonymsRu,
    row.rawSynonymsEn,
    row.normalizedServiceName,
    row.normalizedTestName,
    row.normalizedBiomaterial,
    row.normalizedUnit,
    row.importStatus,
    row.reviewComment
  ]);

  for (let index = 0; index < values.length; index += 500) {
    const chunk = values.slice(index, index + 500);
    const columnSql = columns.map((column) => `\`${column}\``).join(",");
    await connection.query(`INSERT INTO lab_dictionary_import_rows (${columnSql}) VALUES ?`, [chunk]);
  }
  return rows.length;
}

async function loadExisting(connection) {
  const [services] = await connection.query("SELECT id, code, name FROM lab_services");
  const [tests] = await connection.query(
    "SELECT id, code, name, display_name, biomaterial, preferred_unit, unit, base_analyte, context, timepoint, method FROM lab_tests"
  );
  const [links] = await connection.query("SELECT service_id, test_id FROM lab_service_tests");
  const [references] = await connection.query(
    "SELECT test_id, biomaterial, unit, reference_group, reference_low_raw, reference_high_raw, critical_low_raw, critical_high_raw, method, source FROM lab_test_references"
  );

  const serviceByName = new Map(services.map((service) => [normalize(service.name), service]));
  const serviceByCode = new Map(services.map((service) => [service.code, service]));
  const testByCode = new Map(tests.map((test) => [test.code, test]));
  const testByIdentity = new Map(tests.map((test) => {
    const identity = [
      clean(test.display_name || test.name),
      clean(test.biomaterial || ""),
      clean(test.context || ""),
      clean(test.timepoint || ""),
      clean(test.method || "")
    ].map(normalize).join("|");
    return [identity, test];
  }));
  const linkSet = new Set(links.map((link) => `${link.service_id}|${link.test_id}`));
  const referenceSet = new Set(references.map((reference) => [
    reference.test_id,
    reference.biomaterial,
    reference.unit,
    reference.reference_group,
    reference.reference_low_raw,
    reference.reference_high_raw,
    reference.critical_low_raw,
    reference.critical_high_raw,
    reference.method,
    reference.source
  ].map((value) => clean(value)).join("|")));

  return { serviceByName, serviceByCode, testByCode, testByIdentity, linkSet, referenceSet };
}

async function upsertService(connection, existing, row, counters) {
  const byName = existing.serviceByName.get(normalize(row.normalizedServiceName));
  if (byName) return byName.id;

  const code = serviceCode(row);
  const id = serviceId(row);
  const byCode = existing.serviceByCode.get(code);
  await connection.query(
    `INSERT INTO lab_services (id, code, source_service_code, name, kind, active)
     VALUES (?, ?, ?, ?, 'panel', 1)
     ON DUPLICATE KEY UPDATE name=VALUES(name), active=1`,
    [id, code, code, row.normalizedServiceName]
  );
  if (byCode) counters.servicesUpdated += 1;
  else counters.servicesCreated += 1;

  const service = { id, code, name: row.normalizedServiceName };
  existing.serviceByName.set(normalize(row.normalizedServiceName), service);
  existing.serviceByCode.set(code, service);
  return id;
}

async function upsertTest(connection, existing, row, counters) {
  const identity = testIdentity(row);
  const byIdentity = existing.testByIdentity.get(identity);
  if (byIdentity) return byIdentity.id;

  const code = testCode(row);
  const id = testId(row);
  const byCode = existing.testByCode.get(code);
  const group = row.normalizedSubsection || row.normalizedSection || "Справочник";
  const lowNumeric = parseNumeric(row.rawReferenceLow);
  const highNumeric = parseNumeric(row.rawReferenceHigh);

  await connection.query(
    `INSERT INTO lab_tests
      (id, code, source_test_code, name, display_name, biomaterial, preferred_unit, base_analyte, context, timepoint, method, value_type, synonyms_ru, synonyms_en, default_group, unit, low_value, high_value, graphable, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)
     ON DUPLICATE KEY UPDATE
      name=VALUES(name),
      display_name=VALUES(display_name),
      biomaterial=VALUES(biomaterial),
      preferred_unit=VALUES(preferred_unit),
      base_analyte=VALUES(base_analyte),
      context=VALUES(context),
      timepoint=VALUES(timepoint),
      method=VALUES(method),
      value_type=VALUES(value_type),
      synonyms_ru=VALUES(synonyms_ru),
      synonyms_en=VALUES(synonyms_en),
      default_group=VALUES(default_group),
      unit=VALUES(unit)`,
    [
      id,
      code,
      code,
      row.normalizedTestName,
      row.normalizedTestName,
      row.normalizedBiomaterial,
      row.normalizedUnit,
      row.baseAnalyte,
      contextFrom(row),
      row.timepoint,
      row.normalizedMethod,
      valueType(row.rawReferenceLow, row.rawReferenceHigh),
      row.rawSynonymsRu,
      row.rawSynonymsEn,
      group,
      row.normalizedUnit,
      lowNumeric,
      highNumeric
    ]
  );

  if (byCode) counters.testsUpdated += 1;
  else counters.testsCreated += 1;

  const test = { id, code, name: row.normalizedTestName };
  existing.testByCode.set(code, test);
  existing.testByIdentity.set(identity, test);
  return id;
}

async function upsertLink(connection, existing, serviceIdValue, testIdValue, row, counters) {
  const key = `${serviceIdValue}|${testIdValue}`;
  if (existing.linkSet.has(key)) return;
  const [result] = await connection.query(
    `INSERT IGNORE INTO lab_service_tests (service_id, test_id, sort_order, source_test_code)
     VALUES (?, ?, ?, ?)`,
    [serviceIdValue, testIdValue, row.rowNumber, testCode(row)]
  );
  if (result.affectedRows) counters.serviceTestLinksCreated += 1;
  existing.linkSet.add(key);
}

async function insertReference(connection, existing, testIdValue, row, counters) {
  if (!hasReference(row)) return;
  const key = referenceKey(testIdValue, row);
  if (existing.referenceSet.has(key)) return;
  await connection.query(
    `INSERT INTO lab_test_references
      (test_id, biomaterial, unit, reference_group, reference_low_raw, reference_high_raw, reference_low_numeric, reference_high_numeric, critical_low_raw, critical_high_raw, method, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      testIdValue,
      row.normalizedBiomaterial,
      row.normalizedUnit,
      row.rawReferenceGroup,
      row.rawReferenceLow,
      row.rawReferenceHigh,
      parseNumeric(row.rawReferenceLow),
      parseNumeric(row.rawReferenceHigh),
      row.rawCriticalLow,
      row.rawCriticalHigh,
      row.normalizedMethod,
      SOURCE_SYSTEM
    ]
  );
  existing.referenceSet.add(key);
  counters.referencesCreated += 1;
}

async function importRows(filePath, rows) {
  const sourceFile = path.relative(process.cwd(), filePath);
  const connection = await connect();
  const counters = {
    rowsRead: rows.length,
    stagingRowsSaved: 0,
    servicesCreated: 0,
    servicesUpdated: 0,
    testsCreated: 0,
    testsUpdated: 0,
    serviceTestLinksCreated: 0,
    referencesCreated: 0,
    needsReviewRows: rows.filter((row) => row.importStatus === STATUS_NEEDS_REVIEW).length,
    skippedRows: 0
  };

  try {
    await connection.beginTransaction();
    counters.stagingRowsSaved = await insertStaging(connection, sourceFile, rows);
    const existing = await loadExisting(connection);
    for (const row of rows) {
      if (row.importStatus !== STATUS_READY) {
        counters.skippedRows += 1;
        continue;
      }
      const serviceIdValue = await upsertService(connection, existing, row, counters);
      const testIdValue = await upsertTest(connection, existing, row, counters);
      await upsertLink(connection, existing, serviceIdValue, testIdValue, row, counters);
      await insertReference(connection, existing, testIdValue, row, counters);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
  return counters;
}

function printImportReport(report) {
  console.log("Dictionary import report:");
  console.table([{
    rows_read: report.rowsRead,
    staging_rows_saved: report.stagingRowsSaved,
    services_created: report.servicesCreated,
    services_updated: report.servicesUpdated,
    tests_created: report.testsCreated,
    tests_updated: report.testsUpdated,
    service_test_links_created: report.serviceTestLinksCreated,
    references_created: report.referencesCreated,
    needs_review_rows: report.needsReviewRows,
    skipped_rows: report.skippedRows
  }]);
}

async function main() {
  const { command, fileArg, skipRows, sheet, exportReviewArg } = parseArgs(process.argv);
  if (!["inspect", "import"].includes(command) || !fileArg) {
    console.error("Usage:");
    console.error("  node src/import/dictionaryImport.js inspect backend/import/dictionaries/lab_dictionary_full.xlsx --skip-rows=3 --sheet=Sheet1");
    console.error("  node src/import/dictionaryImport.js import backend/import/dictionaries/lab_dictionary_full.xlsx --skip-rows=3 --sheet=Sheet1");
    process.exit(1);
  }

  const filePath = resolveInputPath(fileArg);
  const rows = prepareRows(filePath, { skipRows, sheet });
  if (command === "inspect") {
    printInspect(filePath, rows);
    if (exportReviewArg) {
      const exportPath = resolveOutputPath(exportReviewArg);
      const exportedRows = exportReviewRows(exportPath, rows);
      console.log(`Review rows exported: ${exportPath} (${exportedRows} rows)`);
    }
    return;
  }

  const report = await importRows(filePath, rows);
  printImportReport(report);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  prepareRows,
  inspectRows,
  parseArgs,
  parseNumeric,
  testIdentity
};
