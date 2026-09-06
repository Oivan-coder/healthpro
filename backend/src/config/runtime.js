function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function runtimeConfig() {
  const nodeEnv = process.env.NODE_ENV || "development";
  return {
    nodeEnv,
    isProduction: nodeEnv === "production",
    port: Number(process.env.PORT) || 3001,
    corsOrigins: parseCsv(process.env.CORS_ORIGIN)
  };
}

function assertProductionConfig() {
  const config = runtimeConfig();
  if (!config.isProduction) return;

  const missing = [];
  if (process.env.USE_DB !== "mysql") missing.push("USE_DB=mysql");
  ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME", "CORS_ORIGIN"].forEach((key) => {
    if (!String(process.env[key] || "").trim()) missing.push(key);
  });

  if (missing.length) {
    throw new Error(`production_config_missing: ${missing.join(", ")}`);
  }
}

function isCorsOriginAllowed(origin) {
  if (!origin) return true;
  const { corsOrigins, isProduction } = runtimeConfig();
  if (!corsOrigins.length) return !isProduction;
  return corsOrigins.includes(origin);
}

module.exports = { runtimeConfig, assertProductionConfig, isCorsOriginAllowed };
