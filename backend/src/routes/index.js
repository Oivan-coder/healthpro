const express = require("../utils/expressAdapter");
const patientRoutes = require("./patientRoutes");
const labRoutes = require("./labRoutes");
const appointmentRoutes = require("./appointmentRoutes");
const reportRoutes = require("./reportRoutes");
const integrationRoutes = require("./integrationRoutes");
const assistantRoutes = require("./assistantRoutes");
const auditRoutes = require("./auditRoutes");

const router = express.Router();

router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "health-id-backend",
    version: "5.0.0",
    timestamp: new Date().toISOString()
  });
});

router.use(patientRoutes);
router.use(labRoutes);
router.use(appointmentRoutes);
router.use(reportRoutes);
router.use(integrationRoutes);
router.use(assistantRoutes);
router.use(auditRoutes);

module.exports = router;
