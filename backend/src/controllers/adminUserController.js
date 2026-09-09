const service = require("../services/adminUserService");

async function listUsers(req, res, next) {
  try {
    res.json({ users: await service.listUsers(req.auth.user) });
  } catch (error) {
    next(error);
  }
}

async function createUser(req, res, next) {
  try {
    const user = await service.createUser(req.auth.user, req.body || {});
    res.status(201).json({ user });
  } catch (error) {
    next(error);
  }
}

async function setStatus(req, res, next) {
  try {
    res.json(await service.setStatus(req.auth.user, req.params.id, req.body?.status));
  } catch (error) {
    next(error);
  }
}

async function resetPassword(req, res, next) {
  try {
    res.json(await service.resetPassword(req.auth.user, req.params.id, req.body?.temporaryPassword));
  } catch (error) {
    next(error);
  }
}

module.exports = { listUsers, createUser, setStatus, resetPassword };