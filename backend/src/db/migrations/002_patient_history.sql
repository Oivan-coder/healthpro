CREATE TABLE IF NOT EXISTS patient_history_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  patient_id VARCHAR(64) NOT NULL,
  event_type VARCHAR(64) NOT NULL DEFAULT 'symptom',
  title VARCHAR(255) NOT NULL,
  details TEXT,
  started_at DATETIME NULL,
  ended_at DATETIME NULL,
  severity VARCHAR(32) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'confirmed',
  source VARCHAR(32) NOT NULL DEFAULT 'patient_chat',
  source_text TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_history_patient_date (patient_id, started_at),
  INDEX idx_history_patient_type (patient_id, event_type),
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);