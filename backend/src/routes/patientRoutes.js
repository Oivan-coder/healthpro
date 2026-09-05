const express = require("../utils/expressAdapter");
const controller = require("../controllers/patientController");

const router = express.Router();

router.get("/patient", controller.getPatient);
router.patch("/patient", controller.updatePatient);
router.get("/summary", controller.getSummary);

module.exports = router;
