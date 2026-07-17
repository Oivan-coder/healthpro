const auditService = require("../services/auditService");

async function getRecentAuditEvents(req, res, next) {
  try {
    res.json({
      scope: "demo_admin_only",
      events: await auditService.getRecentAuditEvents(50)
    });
  } catch (error) { next(error); }
}

module.exports = { getRecentAuditEvents };
