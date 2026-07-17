const fs = require("fs");
const path = require("path");
const { dbConfig } = require("./env");

async function main() {
  const config = dbConfig();
  let mysql;
  try {
    mysql = require("mysql2/promise");
  } catch (error) {
    console.error("mysql2 не установлен. Выполните: npm install");
    process.exit(1);
  }

  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    multipleStatements: true
  });

  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await connection.query(`USE \`${config.database}\``);
  const schema = fs.readFileSync(path.join(__dirname, "schema.mysql.sql"), "utf8");
  await connection.query(schema);
  await ensureContextColumns(connection, config.database);
  await connection.end();

  console.log(`MySQL schema initialized: ${config.database}`);
}

async function ensureContextColumns(connection, database) {
  const columns = [
    ["lab_tests", "display_name", "VARCHAR(255) NULL"],
    ["lab_tests", "biomaterial", "VARCHAR(128) NULL"],
    ["lab_tests", "preferred_unit", "VARCHAR(64) NULL"],
    ["lab_tests", "base_analyte", "VARCHAR(255) NULL"],
    ["lab_tests", "context", "VARCHAR(255) NULL"],
    ["lab_tests", "timepoint", "VARCHAR(128) NULL"],
    ["lab_tests", "method", "VARCHAR(255) NULL"],
    ["lab_tests", "value_type", "VARCHAR(64) NULL"],
    ["lab_tests", "synonyms_ru", "TEXT NULL"],
    ["lab_tests", "synonyms_en", "TEXT NULL"],
    ["lab_observations", "biomaterial", "VARCHAR(128) NULL"],
    ["lab_observations", "method", "VARCHAR(255) NULL"],
    ["lab_observations", "timepoint", "VARCHAR(128) NULL"],
    ["lab_observations", "source_service_code", "VARCHAR(128) NULL"],
    ["lab_observations", "source_test_name", "VARCHAR(255) NULL"],
    ["lab_observations", "source_unit", "VARCHAR(64) NULL"]
  ];

  await connection.query(`
    CREATE TABLE IF NOT EXISTS lab_report_documents (
      id VARCHAR(64) PRIMARY KEY,
      lab_report_id VARCHAR(64) NOT NULL,
      patient_id VARCHAR(64) NOT NULL,
      storage_key VARCHAR(512) NOT NULL,
      source_filename VARCHAR(255) NOT NULL,
      content_type VARCHAR(128) NOT NULL DEFAULT 'application/pdf',
      file_size BIGINT,
      checksum_sha256 CHAR(64),
      signature_status VARCHAR(64) NOT NULL DEFAULT 'unknown',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_lab_report_document (lab_report_id, patient_id),
      KEY idx_lab_report_documents_patient (patient_id),
      FOREIGN KEY (lab_report_id) REFERENCES lab_reports(id),
      FOREIGN KEY (patient_id) REFERENCES patients(id)
    )
  `);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS audit_events (
      id VARCHAR(64) PRIMARY KEY,
      event_type VARCHAR(128) NOT NULL,
      patient_id VARCHAR(64) NULL,
      actor_type VARCHAR(64) NOT NULL,
      actor_id VARCHAR(128) NULL,
      resource_type VARCHAR(128) NOT NULL,
      resource_id VARCHAR(128) NULL,
      status VARCHAR(64) NOT NULL,
      ip VARCHAR(128),
      user_agent TEXT,
      details_json JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_audit_events_created_at (created_at),
      KEY idx_audit_events_patient (patient_id),
      KEY idx_audit_events_resource (resource_type, resource_id)
    )
  `);

  for (const [table, column, definition] of columns) {
    const [rows] = await connection.query(
      `SELECT COUNT(*) AS count
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [database, table, column]
    );
    if (!rows[0].count) {
      await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
