const DEFAULT_MESSAGE = "Слишком много запросов. Попробуйте позже.";

function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || "unknown";
}

function createRateLimiter({ name, limit, windowMs }) {
  const buckets = new Map();

  return function rateLimit(req, res, next) {
    const now = Date.now();
    const key = `${name}:${clientIp(req)}`;
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    bucket.count += 1;
    if (bucket.count <= limit) return next();

    res.status(429).json({
      error: "too_many_requests",
      message: DEFAULT_MESSAGE
    });
  };
}

function withRateLimit(limiter, handler) {
  return (req, res, next) => limiter(req, res, (error) => {
    if (error) return next(error);
    return handler(req, res, next);
  });
}

module.exports = { createRateLimiter, withRateLimit };
