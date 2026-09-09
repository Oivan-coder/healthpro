const { getPool } = require('../db/mysql');

let schemaReady = false;

async function ensureSchema() {
  if (schemaReady) return;
  const pool = await getPool();
  await pool.query(`
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
    )
  `);
  schemaReady = true;
}

function normalize(text) {
  return String(text || '').toLowerCase().replace(/ё/g, 'е');
}

const SYMPTOMS = [
  ['температура', /(температур|лихорад|жар\b)/i],
  ['головная боль', /(болел[аи]? голова|головн.*бол)/i],
  ['кашель', /кашел/i],
  ['насморк', /(насморк|заложен.*нос)/i],
  ['боль в горле', /(бол.*горл|горло бол)/i],
  ['слабость', /(слабост|разбитост)/i],
  ['тошнота', /тошнот/i],
  ['рвота', /рвот/i],
  ['диарея', /(диаре|понос)/i],
  ['боль в животе', /(бол.*живот|живот бол)/i],
  ['головокружение', /головокруж/i],
  ['одышка', /(одышк|не хват.*воздух)/i],
  ['боль в груди', /(бол.*груд|груд.*бол)/i],
  ['сыпь', /сып/i]
];

function parseTemperature(text) {
  const match = String(text || '').match(/(?:температур[аы]?\s*(?:была|до|около|примерно)?\s*)(3[5-9](?:[.,]\d)?|4[0-2](?:[.,]\d)?)/i);
  return match ? match[1].replace(',', '.') : null;
}

function suggestFromMessage(message) {
  const raw = String(message || '').trim();
  if (!raw || raw.length < 3) return null;
  const normalized = normalize(raw);
  const found = SYMPTOMS.filter(([, pattern]) => pattern.test(normalized)).map(([label]) => label);
  if (!found.length) return null;

  const temp = parseTemperature(raw);
  const titleParts = [...found];
  if (temp && found.includes('температура')) {
    const idx = titleParts.indexOf('температура');
    titleParts[idx] = `температура до ${temp} °C`;
  }

  return {
    event_type: 'symptom',
    title: titleParts.join(', '),
    details: raw,
    started_at: null,
    ended_at: null,
    severity: null,
    source: 'patient_chat',
    source_text: raw
  };
}

async function list(patientId, limit = 20) {
  await ensureSchema();
  const pool = await getPool();
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const [rows] = await pool.query(
    `SELECT id, event_type, title, details, started_at, ended_at, severity, status, source, created_at
       FROM patient_history_events
      WHERE patient_id = ? AND status = 'confirmed'
      ORDER BY COALESCE(started_at, created_at) DESC, id DESC
      LIMIT ${safeLimit}`,
    [patientId]
  );
  return rows;
}

async function create(patientId, payload = {}) {
  await ensureSchema();
  const pool = await getPool();
  const title = String(payload.title || '').trim();
  if (!title) {
    const error = new Error('history_title_required');
    error.statusCode = 400;
    throw error;
  }
  const [result] = await pool.query(
    `INSERT INTO patient_history_events
      (patient_id, event_type, title, details, started_at, ended_at, severity, status, source, source_text)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?)`,
    [
      patientId,
      String(payload.event_type || 'symptom').slice(0, 64),
      title.slice(0, 255),
      payload.details ? String(payload.details).slice(0, 4000) : null,
      payload.started_at || null,
      payload.ended_at || null,
      payload.severity ? String(payload.severity).slice(0, 32) : null,
      String(payload.source || 'patient_chat').slice(0, 32),
      payload.source_text ? String(payload.source_text).slice(0, 4000) : null
    ]
  );
  const [rows] = await pool.query(
    `SELECT id, event_type, title, details, started_at, ended_at, severity, status, source, created_at
       FROM patient_history_events WHERE id = ? AND patient_id = ?`,
    [result.insertId, patientId]
  );
  return rows[0];
}

module.exports = { ensureSchema, suggestFromMessage, list, create };
