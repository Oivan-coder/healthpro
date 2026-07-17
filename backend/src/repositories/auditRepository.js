const { readJson, writeJson } = require("../db/jsonStore");
const { withMysql } = require("./repositoryMode");

function normalizeEvent(row) {
  if (!row) return null;
  let details = row.details_json || row.detailsJson || row.details || {};
  if (typeof details === "string") {
    try { details = JSON.parse(details); } catch (error) { details = {}; }
  }
  return {
    id: row.id,
    eventType: row.event_type || row.eventType,
    patientId: row.patient_id || row.patientId || null,
    actorType: row.actor_type || row.actorType,
    actorId: row.actor_id || row.actorId || null,
    resourceType: row.resource_type || row.resourceType,
    resourceId: row.resource_id || row.resourceId || null,
    status: row.status,
    ip: row.ip || null,
    userAgent: row.user_agent || row.userAgent || null,
    details,
    createdAt: row.created_at || row.createdAt
  };
}

async function createAuditEvent(event) {
  const createdAt = event.createdAt ? new Date(event.createdAt) : new Date();
  return withMysql(async (pool) => {
    await pool.query(
      `INSERT INTO audit_events
        (id, event_type, patient_id, actor_type, actor_id, resource_type, resource_id, status, ip, user_agent, details_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.id,
        event.eventType,
        event.patientId || null,
        event.actorType,
        event.actorId || null,
        event.resourceType,
        event.resourceId || null,
        event.status,
        event.ip || null,
        event.userAgent || null,
        JSON.stringify(event.details || {}),
        createdAt
      ]
    );
    return event;
  }, () => {
    let events = [];
    try { events = readJson("auditEvents"); } catch (error) { events = []; }
    events.unshift(event);
    writeJson("auditEvents", events.slice(0, 500));
    return event;
  });
}

async function getRecentAuditEvents(limit = 50) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 50));
  return withMysql(async (pool) => {
    const [rows] = await pool.query(
      `SELECT id, event_type, patient_id, actor_type, actor_id, resource_type, resource_id, status, ip, user_agent, details_json, created_at
       FROM audit_events
       ORDER BY created_at DESC
       LIMIT ?`,
      [safeLimit]
    );
    return rows.map(normalizeEvent);
  }, () => {
    let events = [];
    try { events = readJson("auditEvents"); } catch (error) { events = []; }
    return events.slice(0, safeLimit).map(normalizeEvent);
  });
}

module.exports = { createAuditEvent, getRecentAuditEvents };
