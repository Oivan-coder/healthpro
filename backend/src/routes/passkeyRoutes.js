const express = require("../utils/expressAdapter");
const controller = require("../controllers/passkeyController");
const { requireAuth, requirePasswordReady } = require("../middleware/auth");
const { createRateLimiter, withRateLimit } = require("../utils/rateLimit");

const router = express.Router();
const passkeyRateLimit = createRateLimiter({ name: "auth_passkey", limit: 20, windowMs: 10 * 60 * 1000 });

router.post("/auth/passkey/authentication/options", withRateLimit(passkeyRateLimit, controller.authenticationOptions));
router.post("/auth/passkey/authentication/verify", withRateLimit(passkeyRateLimit, controller.verifyAuthentication));
router.get("/auth/passkeys", requireAuth, requirePasswordReady, controller.list);
router.post("/auth/passkey/registration/options", requireAuth, requirePasswordReady, withRateLimit(passkeyRateLimit, controller.registrationOptions));
router.post("/auth/passkey/registration/verify", requireAuth, requirePasswordReady, withRateLimit(passkeyRateLimit, controller.verifyRegistration));
router.delete("/auth/passkeys/:id", requireAuth, requirePasswordReady, controller.remove);

module.exports = router;
