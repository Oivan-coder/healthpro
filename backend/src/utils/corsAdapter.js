function fallbackCors() {
  return (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      return res.end();
    }
    next();
  };
}

try {
  module.exports = require("cors");
} catch (error) {
  module.exports = fallbackCors;
}
