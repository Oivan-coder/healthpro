CREATE TABLE users (
  id UUID PRIMARY KEY,
  phone VARCHAR(32) UNIQUE NOT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'patient',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE patients (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  full_name TEXT NOT NULL,
  birth_date DATE,
  sex VARCHAR(16),
  policy_number TEXT,
  clinic_name TEXT,
  region TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE patient_mis_links (
  id UUID PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES patients(id),
  source_system TEXT NOT NULL,
  mis_patient_id TEXT NOT NULL,
  mis_card TEXT NOT NULL,
  verified_at TIMESTAMPTZ,
  UNIQUE (source_system, mis_patient_id)
);

CREATE TABLE lab_catalog (
  id UUID PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  local_code TEXT,
  loinc TEXT,
  name TEXT NOT NULL,
  group_name TEXT NOT NULL,
  unit TEXT,
  ref_low NUMERIC,
  ref_high NUMERIC,
  graphable BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE lab_reports (
  id UUID PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES patients(id),
  source_system TEXT,
  external_report_id TEXT,
  report_date DATE NOT NULL,
  laboratory_name TEXT,
  status TEXT NOT NULL DEFAULT 'final',
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE lab_report_documents (
  id UUID PRIMARY KEY,
  lab_report_id UUID NOT NULL REFERENCES lab_reports(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  storage_key TEXT NOT NULL,
  source_filename TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'application/pdf',
  file_size_bytes BIGINT,
  checksum_sha256 TEXT,
  signature_status TEXT NOT NULL DEFAULT 'unknown',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lab_report_id, patient_id)
);

CREATE TABLE lab_observations (
  id UUID PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES patients(id),
  report_id UUID REFERENCES lab_reports(id),
  catalog_id UUID NOT NULL REFERENCES lab_catalog(id),
  observed_at TIMESTAMPTZ NOT NULL,
  value_num NUMERIC,
  value_text TEXT,
  unit TEXT,
  ref_low NUMERIC,
  ref_high NUMERIC,
  status TEXT,
  method TEXT,
  fasting_status TEXT,
  source_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (patient_id, catalog_id, observed_at, value_num, source_hash)
);

CREATE TABLE visits (
  id UUID PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES patients(id),
  external_visit_id TEXT,
  visit_at TIMESTAMPTZ NOT NULL,
  specialty TEXT,
  doctor_name TEXT,
  room TEXT,
  status TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE medical_reports (
  id UUID PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES patients(id),
  visit_id UUID REFERENCES visits(id),
  title TEXT NOT NULL,
  doctor_name TEXT,
  report_date DATE NOT NULL,
  status TEXT,
  text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE documents (
  id UUID PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES patients(id),
  source_system TEXT,
  title TEXT NOT NULL,
  document_type TEXT,
  file_url TEXT,
  file_size_bytes BIGINT,
  document_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE appointments (
  id UUID PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES patients(id),
  specialty TEXT NOT NULL,
  doctor_id TEXT,
  doctor_name TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested',
  source_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sync_jobs (
  id UUID PRIMARY KEY,
  source_system TEXT NOT NULL,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  imported_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  details JSONB
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  actor_user_id UUID REFERENCES users(id),
  patient_id UUID REFERENCES patients(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  ip_address INET,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  patient_id TEXT,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  status TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  details_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
