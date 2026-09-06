const crypto = require("crypto");
const authRepository = require("../repositories/authRepository");
const passkeyRepository = require("../repositories/passkeyRepository");
const authService = require("./authService");

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const RP_NAME = "Атлас здоровья";

function serviceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function simpleWebAuthn() {
  return import("@simplewebauthn/server");
}

function encodePublicKey(value) {
  return Buffer.from(value).toString("base64url");
}

function decodePublicKey(value) {
  return new Uint8Array(Buffer.from(String(value || ""), "base64url"));
}

function normalizeRp({ origin, rpID }) {
  const safeOrigin = String(origin || "").trim();
  const safeRpID = String(rpID || "").trim();
  if (!safeOrigin || !safeRpID) throw serviceError("passkey_origin_required", 400);
  return { origin: safeOrigin, rpID: safeRpID };
}

async function list(userId) {
  const passkeys = await passkeyRepository.listUserPasskeys(userId);
  return passkeys.map((item) => ({
    id: item.id,
    label: item.label || "Face ID / отпечаток",
    deviceType: item.deviceType,
    backedUp: item.backedUp,
    lastUsedAt: item.lastUsedAt,
    createdAt: item.createdAt
  }));
}

async function registrationOptions({ userId, origin, rpID }) {
  const user = await authRepository.findUserById(userId);
  if (!user || user.status !== "active") throw serviceError("user_not_found", 404);
  if (user.mustChangePassword) throw serviceError("password_change_required", 403);
  const existing = await passkeyRepository.listUserPasskeys(userId);
  const { generateRegistrationOptions } = await simpleWebAuthn();
  const rp = normalizeRp({ origin, rpID });
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: rp.rpID,
    userName: user.login,
    userDisplayName: user.displayName,
    userID: new Uint8Array(Buffer.from(user.id, "utf8")),
    attestationType: "none",
    excludeCredentials: existing.map((item) => ({ id: item.credentialId, transports: item.transports })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "required",
      authenticatorAttachment: "platform"
    },
    supportedAlgorithmIDs: [-7, -257]
  });
  const requestId = crypto.randomUUID();
  await passkeyRepository.createChallenge({
    id: requestId,
    userId,
    purpose: "registration",
    challenge: options.challenge,
    expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS)
  });
  return { requestId, options };
}

async function verifyRegistration({ userId, requestId, response, origin, rpID, label }) {
  const challenge = await passkeyRepository.consumeChallenge(requestId, "registration");
  if (!challenge || challenge.user_id !== userId) throw serviceError("passkey_challenge_invalid", 400);
  const { verifyRegistrationResponse } = await simpleWebAuthn();
  const rp = normalizeRp({ origin, rpID });
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: rp.origin,
      expectedRPID: rp.rpID,
      requireUserVerification: true,
      supportedAlgorithmIDs: [-7, -257]
    });
  } catch (error) {
    throw serviceError("passkey_registration_failed", 400);
  }
  if (!verification.verified || !verification.registrationInfo) {
    throw serviceError("passkey_registration_failed", 400);
  }
  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  await passkeyRepository.createPasskey({
    id: crypto.randomUUID(),
    userId,
    credentialId: credential.id,
    publicKey: encodePublicKey(credential.publicKey),
    counter: credential.counter,
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp,
    transports: credential.transports || response?.response?.transports || [],
    label: String(label || "Face ID / отпечаток").slice(0, 128)
  });
  return { verified: true };
}

async function authenticationOptions({ login, origin, rpID }) {
  const user = await authRepository.findUserByLogin(login);
  if (!user || user.status !== "active") throw serviceError("passkey_not_available", 404);
  if (user.mustChangePassword) throw serviceError("password_change_required", 403);
  const passkeys = await passkeyRepository.listUserPasskeys(user.id);
  if (!passkeys.length) throw serviceError("passkey_not_available", 404);
  const { generateAuthenticationOptions } = await simpleWebAuthn();
  const rp = normalizeRp({ origin, rpID });
  const options = await generateAuthenticationOptions({
    rpID: rp.rpID,
    allowCredentials: passkeys.map((item) => ({ id: item.credentialId, transports: item.transports })),
    userVerification: "required"
  });
  const requestId = crypto.randomUUID();
  await passkeyRepository.createChallenge({
    id: requestId,
    userId: user.id,
    purpose: "authentication",
    challenge: options.challenge,
    expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS)
  });
  return { requestId, options };
}

async function verifyAuthentication({ requestId, response, origin, rpID, ip, userAgent }) {
  const challenge = await passkeyRepository.consumeChallenge(requestId, "authentication");
  if (!challenge) throw serviceError("passkey_challenge_invalid", 400);
  const stored = await passkeyRepository.findPasskeyByCredentialId(response?.id);
  if (!stored || stored.user_id !== challenge.user_id) throw serviceError("passkey_authentication_failed", 401);
  if (stored.status !== "active") throw serviceError("user_blocked", 403);
  const { verifyAuthenticationResponse } = await simpleWebAuthn();
  const rp = normalizeRp({ origin, rpID });
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: rp.origin,
      expectedRPID: rp.rpID,
      credential: {
        id: stored.credential_id,
        publicKey: decodePublicKey(stored.public_key),
        counter: Number(stored.counter || 0),
        transports: String(stored.transports || "").split(",").map((item) => item.trim()).filter(Boolean)
      },
      requireUserVerification: true
    });
  } catch (error) {
    throw serviceError("passkey_authentication_failed", 401);
  }
  if (!verification.verified) throw serviceError("passkey_authentication_failed", 401);
  await passkeyRepository.updatePasskeyUsage(stored.credential_id, verification.authenticationInfo.newCounter);
  const user = await authRepository.findUserById(stored.user_id);
  return authService.createSessionForUser({ user, ip, userAgent });
}

async function remove(userId, passkeyId) {
  const removed = await passkeyRepository.deletePasskey(userId, passkeyId);
  if (!removed) throw serviceError("passkey_not_found", 404);
  return { ok: true };
}

module.exports = {
  list,
  registrationOptions,
  verifyRegistration,
  authenticationOptions,
  verifyAuthentication,
  remove
};
