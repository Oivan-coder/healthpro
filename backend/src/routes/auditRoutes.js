const express = require("../utils/expressAdapter");
const controller = require("../controllers/auditController");

const router = express.Router();

router.get("/audit/events", controller.getRecentAuditEvents);

module.exports = router;
