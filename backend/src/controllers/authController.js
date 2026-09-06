const authService = require("../services/authService");
const { setSessionCookie, clearSessionCookie } = require("../middleware/auth");

async function login(req, res, next) {
  try {
    const result = await authService.login({
      login: req.body?.login,
      password: req.body?.password,
      ip: req.ip || req.socket?.remoteAddress || null,
      userAgent: req.headers["user-agent"] || null
    });
    setSessionCookie(res, result.token, result.expiresAt);
    res.json({ user: result.user });
  } catch (error) {
    next(error);
  }
}

function me(req, res) {
  res.json({ user: req.auth.user });
}

async function logout(req, res, next) {
  try {
    await authService.logout(req.auth?.sessionId);
    clearSessionCookie(res);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}

async function changePassword(req, res, next) {
  try {
    await authService.changePassword(
      req.auth.user.id,
      req.body?.currentPassword,
      req.body?.newPassword
    );
    clearSessionCookie(res);
    res.json({ ok: true, reauthRequired: true });
  } catch (error) {
    next(error);
  }
}

module.exports = { login, me, logout, changePassword };