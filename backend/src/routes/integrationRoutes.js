const express = require("../utils/expressAdapter");
const controller = require("../controllers/integrationController");

const router = express.Router();

router.get("/integration/status", controller.getStatus);
router.get("/integration/examples/lab-report-full-example.json", controller.downloadLabReportExample);
router.get("/integration/examples/lab-export-fields.csv", controller.downloadLabExportFields);
router.get("/integration/protocol/lab-report", controller.downloadIntegrationProtocol);

module.exports = router;
