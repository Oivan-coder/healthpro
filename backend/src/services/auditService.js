const auditRepository = require("../repositories/auditRepository");

function createId() {
  return `aud_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function requestIp(req) {
  return req.headers["x-forwarded-for"]?.split(",")[0]?.trim()
    || req.socket?.remoteAddress
    || req.ip
    || "";
}

function eventFromRequest(req, event) {
  return {
    id: createId(),
    eventType: event.eventType,
    patientId: event.patientId || null,
    actorType: event.actorType || "demo_user",
    actorId: event.actorId || null,
    resourceType: event.resourceType,
    resourceId: event.resourceId || null,
    status: event.status,
    ip: requestIp(req),
    userAgent: req.headers["user-agent"] || "",
    details: event.details || {},
    createdAt: new Date().toISOString()
  };
}

async function createAuditEvent(event) {
  try {
    return await auditRepository.createAuditEvent(event);
  } catch (error) {
    console.warn(`Audit log unavailable: ${error.message}`);
    return null;
  }
}

async function createAuditEventFromRequest(req, event) {
  return createAuditEvent(eventFromRequest(req, event));
}

async function getRecentAuditEvents(limit = 50) {
  return auditRepository.getRecentAuditEvents(limit);
}

module.exports = { createAuditEvent, createAuditEventFromRequest, getRecentAuditEvents, eventFromRequest };
