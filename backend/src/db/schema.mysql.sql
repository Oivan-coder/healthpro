CREATE TABLE IF NOT EXISTS patients (
  id VARCHAR(64) PRIMARY KEY,
  mis_patient_id VARCHAR(128),
  mis_card VARCHAR(128) NOT NULL,
  name VARCHAR(255) NOT NULL,
  initials VARCHAR(16),
  phone VARCHAR(64),
  birth_date DATE,
  age INT,
  sex VARCHAR(32),
  policy VARCHAR(255),
  clinic VARCHAR(255),
  region VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS patient_mis_links (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  patient_id VARCHAR(64) NOT NULL,
  source_system VARCHAR(128) NOT NULL,
  mis_patient_id VARCHAR(128) NOT NULL,
  mis_card VARCHAR(128) NOT NULL,
  verified_at TIMESTAMP NULL,
  UNIQUE KEY uniq_patient_source (source_system, mis_patient_id),
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

CREATE TABLE IF NOT EXISTS lab_services (
  id VARCHAR(64) PRIMARY KEY,
  code VARCHAR(64) UNIQUE NOT NULL,
  source_service_code VARCHAR(128),
  name VARCHAR(255) NOT NULL,
  kind VARCHAR(64) DEFAULT 'panel',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lab_tests (
  id VARCHAR(64) PRIMARY KEY,
  code VARCHAR(64) UNIQUE NOT NULL,
  source_test_code VARCHAR(128),
  name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  biomaterial VARCHAR(128),
  preferred_unit VARCHAR(64),
  base_analyte VARCHAR(255),
  context VARCHAR(255),
  timepoint VARCHAR(128),
  method VARCHAR(255),
  value_type VARCHAR(64),
  synonyms_ru TEXT,
  synonyms_en TEXT,
  default_group VARCHAR(128),
  unit VARCHAR(64),
  low_value DECIMAL(12,4),
  high_value DECIMAL(12,4),
  loinc VARCHAR(64),
  graphable BOOLEAN DEFAULT TRUE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lab_service_tests (
  service_id VARCHAR(64) NOT NULL,
  test_id VARCHAR(64) NOT NULL,
  sort_order INT DEFAULT 0,
  source_test_code VARCHAR(128),
  PRIMARY KEY (service_id, test_id),
  FOREIGN KEY (service_id) REFERENCES lab_services(id),
  FOREIGN KEY (test_id) REFERENCES lab_tests(id)
);

CREATE TABLE IF NOT EXISTS lab_reports (
  id VARCHAR(64) PRIMARY KEY,
  patient_id VARCHAR(64),
  service_id VARCHAR(64) NULL,
  source_service_code VARCHAR(128) NOT NULL,
  report_date DATE NOT NULL,
  status VARCHAR(64) DEFAULT 'final',
  raw_payload_json JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (service_id) REFERENCES lab_services(id)
);

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
);

CREATE TABLE IF NOT EXISTS lab_observations (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  report_id VARCHAR(64) NOT NULL,
  test_id VARCHAR(64) NULL,
  source_test_code VARCHAR(128) NOT NULL,
  biomaterial VARCHAR(128),
  method VARCHAR(255),
  timepoint VARCHAR(128),
  source_service_code VARCHAR(128),
  source_test_name VARCHAR(255),
  source_unit VARCHAR(64),
  value_num DECIMAL(12,4) NULL,
  value_text TEXT NULL,
  mapping_status VARCHAR(32) NOT NULL DEFAULT 'mapped',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_observation_test (test_id),
  KEY idx_observation_source_test (source_test_code),
  FOREIGN KEY (report_id) REFERENCES lab_reports(id),
  FOREIGN KEY (test_id) REFERENCES lab_tests(id)
);

CREATE TABLE IF NOT EXISTS lab_source_mappings (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  source_system VARCHAR(128) NOT NULL,
  source_service_code VARCHAR(128),
  source_service_name VARCHAR(255),
  source_test_code VARCHAR(128),
  source_test_name VARCHAR(255),
  source_biomaterial VARCHAR(128),
  source_unit VARCHAR(64),
  source_timepoint VARCHAR(128),
  target_service_id VARCHAR(64) NULL,
  target_test_id VARCHAR(64) NULL,
  mapping_status VARCHAR(64) NOT NULL DEFAULT 'needs_review',
  confidence DECIMAL(5,4),
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_source_mapping_source (source_system, source_service_code, source_test_code),
  KEY idx_source_mapping_target_test (target_test_id),
  FOREIGN KEY (target_service_id) REFERENCES lab_services(id),
  FOREIGN KEY (target_test_id) REFERENCES lab_tests(id)
);

CREATE TABLE IF NOT EXISTS lab_test_references (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  test_id VARCHAR(64) NOT NULL,
  biomaterial VARCHAR(128),
  unit VARCHAR(64),
  reference_group VARCHAR(255),
  reference_low_raw VARCHAR(255),
  reference_high_raw VARCHAR(255),
  reference_low_numeric DECIMAL(12,4) NULL,
  reference_high_numeric DECIMAL(12,4) NULL,
  critical_low_raw VARCHAR(255),
  critical_high_raw VARCHAR(255),
  method VARCHAR(255),
  source VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_lab_test_references_test (test_id),
  FOREIGN KEY (test_id) REFERENCES lab_tests(id)
);

CREATE TABLE IF NOT EXISTS lab_dictionary_import_rows (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  source_file VARCHAR(512) NOT NULL,
  `row_number` INT NOT NULL,
  raw_service_name TEXT,
  raw_test_name TEXT,
  raw_biomaterial TEXT,
  raw_unit TEXT,
  raw_reference_low TEXT,
  raw_reference_high TEXT,
  raw_reference_group TEXT,
  raw_critical_low TEXT,
  raw_critical_high TEXT,
  raw_method TEXT,
  raw_section TEXT,
  raw_subsection TEXT,
  raw_synonyms_ru TEXT,
  raw_synonyms_en TEXT,
  normalized_service_name VARCHAR(255),
  normalized_test_name VARCHAR(255),
  normalized_biomaterial VARCHAR(128),
  normalized_unit VARCHAR(64),
  import_status VARCHAR(64) NOT NULL DEFAULT 'pending',
  review_comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_dictionary_import_source (source_file, `row_number`),
  KEY idx_dictionary_import_status (import_status)
);

CREATE TABLE IF NOT EXISTS visits (
  id VARCHAR(64) PRIMARY KEY,
  visit_date DATE NOT NULL,
  visit_time VARCHAR(16) NOT NULL,
  specialty VARCHAR(128),
  doctor VARCHAR(255),
  room VARCHAR(64),
  status VARCHAR(64),
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS medical_reports (
  id VARCHAR(64) PRIMARY KEY,
  report_date DATE NOT NULL,
  title VARCHAR(255) NOT NULL,
  doctor VARCHAR(255),
  status VARCHAR(64),
  text TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS documents (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  document_date DATE NOT NULL,
  type VARCHAR(64),
  size VARCHAR(64),
  icon VARCHAR(16),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS appointments (
  id VARCHAR(64) PRIMARY KEY,
  specialty VARCHAR(128) NOT NULL,
  doctor_id VARCHAR(64),
  doctor VARCHAR(255),
  appointment_date DATE NOT NULL,
  appointment_time VARCHAR(16) NOT NULL,
  status VARCHAR(64) NOT NULL,
  payload_json JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  icon VARCHAR(16),
  kind VARCHAR(64),
  level VARCHAR(64),
  title VARCHAR(255) NOT NULL,
  text TEXT,
  event_date VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sync_jobs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  source_system VARCHAR(128) NOT NULL,
  job_type VARCHAR(128) NOT NULL,
  status VARCHAR(64) NOT NULL,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMP NULL,
  imported_count INT DEFAULT 0,
  error_count INT DEFAULT 0,
  details_json JSON
);

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
);
