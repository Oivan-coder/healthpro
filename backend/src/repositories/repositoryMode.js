const { shouldUseMysql } = require("../db/env");
const { getPool, getUnavailableReason } = require("../db/mysql");

let warned = false;

async function withMysql(operation, fallback) {
  if (!shouldUseMysql()) return fallback();

  try {
    const pool = await getPool();
    return await operation(pool);
  } catch (error) {
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
