const express = require("../utils/expressAdapter");
const controller = require("../controllers/manualLabController");
const { requireAnyRole } = require("../middleware/auth");

const router = express.Router();
const requireLabEntryAccess = requireAnyRole("admin", "tester");

router.get("/admin/lab-entry/services", requireLabEntryAccess, controller.listServices);
router.get("/admin/lab-entry/services/:serviceId/tests", requireLabEntryAccess, controller.listServiceTests);
router.post("/admin/lab-entry/reports", requireLabEntryAccess, controller.createReport);

module.exports = router;
