const express = require("../utils/expressAdapter");
const controller = require("../controllers/labController");
const { createRateLimiter, withRateLimit } = require("../utils/rateLimit");

const router = express.Router();
const labReportPdfDownloadRateLimit = createRateLimiter({
  name: "lab_report_pdf_download",
  limit: 60,
  windowMs: 5 * 60 * 1000
});

router.get("/labs", controller.getLabs);
router.get("/labs/catalog", controller.getCatalog);
router.get("/labs/history", controller.getHistory);
router.post("/labs/import", controller.importLabs);
router.post("/labs/validate", controller.validateLabs);
router.get("/lab-reports", controller.getLabReports);
router.get("/lab-reports/:id/pdf", withRateLimit(labReportPdfDownloadRateLimit, controller.downloadLabReportPdf));
router.get("/lab-reports/:id", controller.getLabReportById);
router.get("/lab-tests/:testCode/history", controller.getTestHistory);
router.post("/integration/lab-report", controller.importLabReport);
router.get("/lab-mappings/unmapped", controller.getUnmapped);

module.exports = router;
