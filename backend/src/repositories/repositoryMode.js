const { shouldUseMysql } = require("../db/env");
const { getPool, getUnavailableReason } = require("../db/mysql");

let warned = false;

function isProduction() {
  return process.env.NODE_ENV === "production";
}

async function withMysql(operation, fallback) {
  if (!shouldUseMysql()) {
    if (isProduction()) throw new Error("mysql_required_in_production");
    return fallback();
  }

  try {
    const pool = await getPool();
    return await operation(pool);
  } catch (error) {
    if (isProduction()) throw error;

    if (!warned) {
      warned = true;
      const reason = getUnavailableReason() || error.message;
      console.warn(`MySQL недоступен, используется JSON fallback: ${reason}`);
    }
    return fallback();
  }
}

function currentMode() {
  if (!shouldUseMysql()) return "json";
  return getUnavailableReason() ? "json-fallback" : "mysql";
}

module.exports = { withMysql, currentMode };
