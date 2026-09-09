const express = require('../utils/expressAdapter');
const controller = require('../controllers/patientHistoryController');

const router = express.Router();

router.get('/patient-history', controller.list);
router.post('/patient-history', controller.create);

module.exports = router;
