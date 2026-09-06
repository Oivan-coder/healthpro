const path = require("path");
const express = require("./utils/expressAdapter");
const securityHeaders = require("./utils/securityHeaders");
const apiRoutes = require("./routes");
const { runtimeConfig, assertProductionConfig, isCorsOriginAllowed } = require("./config/runtime");
const { getPool } = require("./db/mysql");
const { attachAuth } = require("./middleware/auth");

const app = express();
const config = runtimeConfig();

assertProductionConfig();

function requestHost(req) {
  const forwardedHost = String(req.headers?.["x-forwarded-host"] || "")
    .split(",")[0]
    .trim();
  return forwardedHost || String(req.headers?.host || "").trim();
}

function isSameOriginRequest(req, origin) {
  if (!origin) return true;
  try {
    return new URL(origin).host === requestHost(req);
  } catch (error) {
    return false;
  }
}

function corsMiddleware(req, res, next) {
  const origin = String(req.headers?.origin || "").trim();
  const sameOrigin = isSameOriginRequest(req, origin);

  // First-party browser requests do not depend on CORS_ORIGIN. This is the
  // normal deployment mode for the hosted demo: frontend and API share a host.
  if (origin && !sameOrigin) {
    if (!isCorsOriginAllowed(origin)) {
      return res.status(403).json({ error: "cors_origin_denied" });
    }
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
  }

  if (origin) {
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Demo-Patient-Id");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
  }

  if (req.method === "OPTIONS") return res.status(204).end();
  return next();
}

if (typeof app.disable === "function") app.disable("x-powered-by");
app.use(securityHeaders);
app.use(corsMiddleware);
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