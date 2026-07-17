const express = require("../utils/expressAdapter");
const controller = require("../controllers/reportController");
const { createRateLimiter, withRateLimit } = require("../utils/rateLimit");

const router = express.Router();
const documentDownloadRateLimit = createRateLimiter({
  name: "document_download",
  limit: 60,
  windowMs: 5 * 60 * 1000
});

router.get("/reports", controller.getReports);
router.get("/documents", controller.getDocuments);
router.get("/documents/:id/download", withRateLimit(documentDownloadRateLimit, controller.downloadDocument));

module.exports = router;
