const express = require("../utils/expressAdapter");
const controller = require("../controllers/auditController");
const { requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/audit/events", requireRole("admin"), controller.getRecentAuditEvents);

module.exports = router;
