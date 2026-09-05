const express = require("../utils/expressAdapter");
const authRoutes = require("./authRoutes");
const adminUserRoutes = require("./adminUserRoutes");
const manualLabRoutes = require("./manualLabRoutes");
const patientRoutes = require("./patientRoutes");
const labRoutes = require("./labRoutes");
const appointmentRoutes = require("./appointmentRoutes");
const reportRoutes = require("./reportRoutes");
const integrationRoutes = require("./integrationRoutes");
const assistantRoutes = require("./assistantRoutes");
const auditRoutes = require("./auditRoutes");
const { requireAuth, requirePasswordReady } = require("../middleware/auth");

const router = express.Router();

router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "health-id-backend",
    version: "5.0.0",
    timestamp: new Date().toISOString()
  });
});

router.use(authRoutes);
router.use(requireAuth);
router.use(requirePasswordReady);
router.use(adminUserRoutes);
router.use(manualLabRoutes);
router.use(patientRoutes);
router.use(labRoutes);
router.use(appointmentRoutes);
router.use(reportRoutes);
router.use(integrationRoutes);
router.use(assistantRoutes);
router.use(auditRoutes);

module.exports = router;