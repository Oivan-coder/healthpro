const express = require("../utils/expressAdapter");
const controller = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");
const { createRateLimiter, withRateLimit } = require("../utils/rateLimit");

const router = express.Router();
const loginRateLimit = createRateLimiter({ name: "auth_login", limit: 10, windowMs: 10 * 60 * 1000 });
const passwordRateLimit = createRateLimiter({ name: "auth_password", limit: 10, windowMs: 10 * 60 * 1000 });

router.post("/auth/login", withRateLimit(loginRateLimit, controller.login));
router.get("/auth/me", requireAuth, controller.me);
router.post("/auth/logout", requireAuth, controller.logout);
router.post("/auth/change-password", requireAuth, withRateLimit(passwordRateLimit, controller.changePassword));

module.exports = router;
