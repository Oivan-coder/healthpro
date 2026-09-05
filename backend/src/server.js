const path = require("path");
const express = require("./utils/expressAdapter");
const cors = require("./utils/corsAdapter");
const securityHeaders = require("./utils/securityHeaders");
const apiRoutes = require("./routes");
const { runtimeConfig, assertProductionConfig, isCorsOriginAllowed } = require("./config/runtime");
const { getPool } = require("./db/mysql");
const { attachAuth } = require("./middleware/auth");

const app = express();
const config = runtimeConfig();

assertProductionConfig();

if (typeof app.disable === "function") app.disable("x-powered-by");
app.use(securityHeaders);
app.use(cors({
  origin(origin, callback) {
    if (isCorsOriginAllowed(origin)) return callback(null, true);
    const error = new Error("cors_origin_denied");
    error.statusCode = 403;
    return callback(error);
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Demo-Patient-Id"]
}));
app.use(express.json({ limit: "1mb" }));
app.use(attachAuth);

app.use("/api", apiRoutes);

// In hosted demo/production, serve the static patient cabinet from the same
// origin as the API. This keeps HttpOnly session cookies first-party and avoids
// cross-site cookie/CORS problems on mobile browsers.
if (typeof express.static === "function") {
  const frontendDir = path.resolve(__dirname, "../../frontend");
  app.use(express.static(frontendDir));
  app.get("*", (req, res, next) => {
    if (req.path && req.path.startsWith("/api/")) return next();
    return res.sendFile(path.join(frontendDir, "index.html"));
  });
}

app.use((req, res) => {
  res.status(404).json({ error: "not_found" });
});

app.use((error, req, res, next) => {
  const status = error.statusCode || 500;
  res.status(status).json({
    error: error.message || "internal_error"
  });
});

async function start() {
  if (config.isProduction) {
    await getPool();
  }

  app.listen(config.port, () => {
    console.log(`Атлас здоровья backend API listening on port ${config.port} (${config.nodeEnv})`);
  });
}

start().catch((error) => {
  console.error("Backend startup failed:", error.message || error);
  process.exitCode = 1;
});