const express = require("../utils/expressAdapter");
const controller = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.post("/auth/login", controller.login);
router.get("/auth/me", requireAuth, controller.me);
router.post("/auth/logout", requireAuth, controller.logout);
router.post("/auth/change-password", requireAuth, controller.changePassword);

module.exports = router;