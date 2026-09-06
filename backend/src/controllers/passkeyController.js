const passkeyService = require("../services/passkeyService");
const { setSessionCookie } = require("../middleware/auth");

function requestOrigin(req) {
  const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "https").split(",")[0].trim();
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  return `${proto}://${host}`;
}

function requestRpID(req) {
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  return host.replace(/:\d+$/, "");
}

function clientMeta(req) {
  return {
    origin: requestOrigin(req),
    rpID: requestRpID(req),
    ip: req.ip || req.socket?.remoteAddress || null,
    userAgent: req.headers["user-agent"] || null
  };
}

async function list(req, res, next) {
  try {
    res.json({ passkeys: await passkeyService.list(req.auth.user.id) });
  } catch (error) { next(error); }
}

async function registrationOptions(req, res, next) {
  try {
    const result = await passkeyService.registrationOptions({
      userId: req.auth.user.id,
      ...clientMeta(req)
    });
    res.json(result);
  } catch (error) { next(error); }
}

async function verifyRegistration(req, res, next) {
  try {
    const result = await passkeyService.verifyRegistration({
      userId: req.auth.user.id,
      requestId: req.body?.requestId,
      response: req.body?.response,
      label: req.body?.label,
      ...clientMeta(req)
    });
    res.json(result);
  } catch (error) { next(error); }
}

async function authenticationOptions(req, res, next) {
  try {
    const result = await passkeyService.authenticationOptions({
      login: req.body?.login,
      ...clientMeta(req)
    });
    res.json(result);
  } catch (error) { next(error); }
}

async function verifyAuthentication(req, res, next) {
  try {
    const result = await passkeyService.verifyAuthentication({
      requestId: req.body?.requestId,
      response: req.body?.response,
      ...clientMeta(req)
    });
    setSessionCookie(res, result.token, result.expiresAt);
    res.json({ user: result.user });
  } catch (error) { next(error); }
}

async function remove(req, res, next) {
  try {
    res.json(await passkeyService.remove(req.auth.user.id, req.params.id));
  } catch (error) { next(error); }
}

module.exports = {
  list,
  registrationOptions,
  verifyRegistration,
  authenticationOptions,
  verifyAuthentication,
  remove
};
