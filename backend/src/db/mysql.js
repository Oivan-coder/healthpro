const { dbConfig, shouldUseMysql } = require("./env");

let pool;
let unavailableReason = "";

async function getPool() {
  if (!shouldUseMysql()) {
    const error = new Error("mysql_disabled");
    error.code = "MYSQL_DISABLED";
    throw error;
  }

  if (unavailableReason) {
    const error = new Error(unavailableReason);
    error.code = "MYSQL_UNAVAILABLE";
    throw error;
  }

  try {
    const mysql = require("mysql2/promise");
    if (!pool) {
      const config = dbConfig();
      pool = mysql.createPool({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
        waitForConnections: true,
        connectionLimit: 10,
        namedPlaceholders: true
      });
      await pool.query("SELECT 1");
    }
    return pool;
  } catch (error) {
    unavailableReason = error.message || "mysql_unavailable";
    throw error;
  }
}

async function closePool() {
  if (pool) await pool.end();
  pool = undefined;
}

function getUnavailableReason() {
  return unavailableReason;
}

module.exports = { getPool, closePool, getUnavailableReason };
