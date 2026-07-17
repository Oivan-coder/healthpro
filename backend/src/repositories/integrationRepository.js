const { readJson, writeJson } = require("../db/jsonStore");
const { withMysql, currentMode } = require("./repositoryMode");
const { nowRu } = require("../utils/date");

async function getEvents() {
  return withMysql(async (pool) => {
    const [rows] = await pool.query("SELECT icon, kind, level, title, text, event_date AS date FROM events ORDER BY id DESC LIMIT 50");
    return rows.map((row) => ({ ...row, date: row.date || "Только что" }));
  }, () => readJson("events"));
}

async function addEvent(event) {
  return withMysql(async (pool) => {
    await pool.query(
      "INSERT INTO events (icon, kind, level, title, text, event_date) VALUES (?, ?, ?, ?, ?, ?)",
      [event.icon, event.kind, event.level, event.title, event.text, event.date || "Только что"]
    );
    return event;
  }, () => {
    const events = readJson("events");
    events.unshift(event);
    writeJson("events", events);
    return event;
  });
}

async function touchSync(jobType = "manual", importedCount = 0, errorCount = 0) {
  return withMysql(async (pool) => {
    await pool.query(
      "INSERT INTO sync_jobs (source_system, job_type, status, started_at, finished_at, imported_count, error_count) VALUES ('demo', ?, 'success', NOW(), NOW(), ?, ?)",
      [jobType, importedCount, errorCount]
    );
  }, () => {
    const meta = readJson("meta");
    meta.lastSync = nowRu();
    writeJson("meta", meta);
  });
}

async function getStatus() {
  const lastSync = await withMysql(async (pool) => {
    const [rows] = await pool.query("SELECT finished_at FROM sync_jobs ORDER BY started_at DESC LIMIT 1");
    return rows[0]?.finished_at ? rows[0].finished_at.toLocaleString("ru-RU") : readJson("meta").lastSync;
  }, () => readJson("meta").lastSync);

  return {
    source: currentMode().startsWith("mysql") ? "mysql" : "demo",
    lastSync,
    mode: currentMode(),
    readyForPilot: true,
    contour: currentMode().startsWith("mysql") ? "backend + MySQL" : "backend + JSON fallback",
    missingProductionItems: [
      "реальная SMS/OTP авторизация",
      "ИБ и юридический контур",
      "реальная МИС/ЛИС интеграция",
      "медицинская валидация правил интерпретации"
    ],
    readiness: [
      { title: "UI готов", ready: true },
      { title: "Express backend API готов", ready: true },
      { title: "MySQL data layer подключен", ready: currentMode().startsWith("mysql") },
      { title: "JSON fallback сохранен как аварийный режим", ready: true },
      { title: "Импорт JSON готов", ready: true },
      { title: "Реальная авторизация готова", ready: false },
      { title: "Реальная МИС/ЛИС подключена", ready: false },
      { title: "ИБ/юридический контур готов", ready: false }
    ]
  };
}

module.exports = { getEvents, addEvent, touchSync, getStatus };
