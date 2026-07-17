const express = require("../utils/expressAdapter");
const controller = require("../controllers/assistantController");
const { createRateLimiter, withRateLimit } = require("../utils/rateLimit");

const router = express.Router();
const assistantRateLimit = createRateLimiter({
  name: "assistant",
  limit: 30,
  windowMs: 5 * 60 * 1000
});

router.post("/assistant/chat", withRateLimit(assistantRateLimit, controller.chat));

module.exports = router;
