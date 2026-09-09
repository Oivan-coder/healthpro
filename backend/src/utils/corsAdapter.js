function fallbackCors(options = {}) {
  return (req, res, next) => {
    const origin = req.headers?.origin;
    const allowOrigin = (value) => {
      if (value) res.setHeader("Access-Control-Allow-Origin", value);
      if (options.credentials) res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader(
        "Access-Control-Allow-Headers",
        Array.isArray(options.allowedHeaders) ? options.allowedHeaders.join(",") : "Content-Type,Authorization,X-Demo-Patient-Id"
      );
      res.setHeader(
        "Access-Control-Allow-Methods",
        Array.isArray(options.methods) ? options.methods.join(",") : "GET,POST,PATCH,PUT,DELETE,OPTIONS"
      );
      if (req.method === "OPTIONS") {
        res.statusCode = 204;
        return res.end();
      }
      return next();
    };

    if (typeof options.origin === "function") {
      return options.origin(origin, (error, allowed) => {
        if (error || !allowed) {
          res.statusCode = error?.statusCode || 403;
          return res.end();
        }
        return allowOrigin(origin || "*");
      });
    }

    return allowOrigin(origin || "*");
  };
}

try {
  module.exports = require("cors");
} catch (error) {
  module.exports = fallbackCors;
}
