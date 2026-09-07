const express = require("../utils/expressAdapter");
const controller = require("../controllers/labScanController");
const { requireAnyRole } = require("../middleware/auth");

const router = express.Router();
const requirePatient = requireAnyRole("user", "tester");
const rawScan = typeof express.raw === "function"
  ? express.raw({ type: ["application/pdf", "image/jpeg", "image/png"], limit: "10mb" })
  : (req, res, next) => next();

router.post("/lab-scan/analyze", requirePatient, rawScan, controller.analyze);
router.get("/lab-scan/search", requirePatient, controller.search);
router.post("/lab-scan/confirm", requirePatient, controller.confirm);

module.exports = router;
