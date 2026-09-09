const crypto = require("crypto");
const { promisify } = require("util");

const scryptAsync = promisify(crypto.scrypt);
const KEY_LENGTH = 64;
const N = 16384;
const R = 8;
const P = 1;

async function hashPassword(password) {
  const value = String(password || "");
  if (value.length < 10) {
    const error = new Error("password_too_short");
    error.statusCode = 400;
    throw error;
  }
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = await scryptAsync(value, salt, KEY_LENGTH, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${N}$${R}$${P}$${salt}$${Buffer.from(derived).toString("hex")}`;
}

async function verifyPassword(password, encoded) {
  const parts = String(encoded || "").split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, nRaw, rRaw, pRaw, salt, hashHex] = parts;
  const n = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!n || !r || !p || !salt || !hashHex) return false;

  const expected = Buffer.from(hashHex, "hex");
  const derived = Buffer.from(await scryptAsync(String(password || ""), salt, expected.length, {
    N: n,
    r,
    p,
    maxmem: 64 * 1024 * 1024
  }));
  return expected.length === derived.length && crypto.timingSafeEqual(expected, derived);
}

module.exports = { hashPassword, verifyPassword };