const authService = require("../services/authService");
const { runtimeConfig } = require("../config/runtime");

const COOKIE_NAME = "atlas_session";

function parseCookies(header) {
  return String(header || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const index = part.indexOf("=");
      if (index === -1) return acc;
      acc[part.slice(0, index)] = decodeURIComponent(part.slice(index + 1));
      return acc;
    }, {});
}

function sessionToken(req) {
  return parseCookies(req.headers.cookie)[COOKIE_NAME] || "";
}

function cookieHeader(token, maxAgeSeconds) {
  const { isProduction } = runtimeConfig();
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`
  ];
  if (isProduction) parts.push("Secure");
  return parts.join("; ");
}

function setSessionCookie(res, token, expiresAt) {
  const seconds = (new Date(expiresAt).getTime() - Date.now()) / 1000;
  res.setHeader("Set-Cookie", cookieHeader(token, seconds));
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", cookieHeader("", 0));
}

async function attachAuth(req, res, next) {
  try {
    const resolved = await authService.resolveSession(sessionToken(req));
    req.auth = resolved || null;
    next();
  } catch (error) {
    next(error);
  }
}

function requireAuth(req, res, next) {
  if (!req.auth) return res.status(401).json({ error: "authentication_required" });
  next();
}

function requirePasswordReady(req, res, next) {
  if (req.auth?.user?.mustChangePassword) {
    return res.status(403).json({ error: "password_change_required" });
  }
  next();
}

function requireRole(role) {
  return requireAnyRole(role);
}

function requireAnyRole(...roles) {
  const allowed = new Set(roles.flat().filter(Boolean));
  return (req, res, next) => {
    if (!req.auth) return res.status(401).json({ error: "authentication_required" });
    if (!allowed.has(req.auth.user.role)) return res.status(403).json({ error: "forbidden" });
    next();
  };
}

module.exports = {
  COOKIE_NAME,
  attachAuth,
  requireAuth,
  requirePasswordReady,
  requireRole,
  requireAnyRole,
  setSessionCookie,
  clearSessionCookie
};