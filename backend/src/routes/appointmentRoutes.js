const express = require("../utils/expressAdapter");
const controller = require("../controllers/appointmentController");

const router = express.Router();

router.get("/visits", controller.getVisits);
router.get("/appointments/dictionary", controller.getBookingDictionary);
router.post("/appointments/book", controller.bookAppointment);

module.exports = router;
