const express = require("../utils/expressAdapter");
const controller = require("../controllers/manualLabController");
const { requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/admin/lab-entry/services", requireRole("admin"), controller.listServices);
router.get("/admin/lab-entry/services/:serviceId/tests", requireRole("admin"), controller.listServiceTests);
router.post("/admin/lab-entry/reports", requireRole("admin"), controller.createReport);

module.exports = router;
