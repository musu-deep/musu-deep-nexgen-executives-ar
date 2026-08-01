import crypto from "node:crypto";
import {
  authenticatePasswordDirectory,
  currentPasswordDirectoryUser,
} from "./araak-password-directory.js";

// Only these institutional identities may enter the executive platform.
// Temporary passwords are never stored in plaintext; only scrypt hashes are committed.
const AUTHORIZED_ACCOUNTS = Object.freeze({
  "admin@arak.com": {
    id: "usr_admin",
    salt: "829f0230290fa2bdc04b2befed01cf1c",
    hash: "80ec5c871007db6f586196b43b7bffb8932aab5bee8d0c6b420ca0aa767e86b671d6a23f6d4ade6bef1b59feb87522e0c281ab0731cf8209fce9ac8cc49ad59e",
  },
  "ceo@arak.com": {
    id: "usr_ceo",
    salt: "f8b8438d42eab17de0b90fad43446d33",
    hash: "03d9f6722b694ad7037d804bf7ee2267d2fa1be9d0f560711be2e08ec84225b123418728b6241845d8647144a343900f60fad413d1bd14da08b433403760886d",
  },
  "vp.dev@arak.com": {
    id: "usr_dev",
    salt: "8925cf73f08ebef96519fa65fe9daaab",
    hash: "392e027916e710f21513c562f1a422fd007b4433707e8a86b43d86a90a767f0421029201410f52cf3bd845340807d69cb5e0e2a09be14873a5e099f46abd569b",
  },
  "vp.invest@arak.com": {
    id: "usr_inv",
    salt: "8483e575a54ad26d3f3ac3069a5250d8",
    hash: "513b254934f31b6fedd26ce94a43dabdfebb9f962a4ff2870a76f523590427c0354b2e92d0b9d0ff073e8cd267d8b3047244e53acabef2cb09b62428d8b7b962",
  },
  "dev.manager@arak.com": {
    id: "usr_mgr",
    salt: "7060061cac1b3ac15395aca96fa71fd6",
    hash: "b0d459df80df91de1264294d98ba6421ca7ef426768a4fd8eae64f6f948de4e20e78749ae9bc16528e122e93872c41b244a50aacd68384280ee6444e4721762b",
  },
  "tracker@arak.com": {
    id: "usr_track",
    salt: "cddd1929619c23ffd5468188569d72a8",
    hash: "e37b928f1d5b6799d5de84943ea034dd00a71aef30094dca6fae0a7c72cf2b6d3807d9912f95bb0e2a0ed27417be80f618497356e150e457337f65e1c17d9708",
  },
});

const AUTHORIZED_IDS = new Set(Object.values(AUTHORIZED_ACCOUNTS).map((account) => account.id));
const LEGACY_DIRECTORY_TEMP_PASSWORD = process.env.DEFAULT_TEMP_PASSWORD || "Arak@2026";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function verifyAssignedTemporaryPassword(password, account) {
  try {
    const actual = crypto.scryptSync(String(password || ""), account.salt, 64);
    const expected = Buffer.from(account.hash, "hex");
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function isAuthorizedExecutiveIdentity(identity) {
  if (!identity) return false;
  const email = normalizeEmail(typeof identity === "string" ? identity : identity.email);
  const id = typeof identity === "object" ? String(identity.id || identity.profile_id || "") : "";
  return Boolean(AUTHORIZED_ACCOUNTS[email] || (id && AUTHORIZED_IDS.has(id)));
}

export function isAuthorizedExecutiveUserId(userId) {
  return AUTHORIZED_IDS.has(String(userId || ""));
}

export function filterAuthorizedExecutiveUsers(users) {
  return (Array.isArray(users) ? users : []).filter(isAuthorizedExecutiveIdentity);
}

export async function authenticateAuthorizedExecutive(email, password) {
  const normalizedEmail = normalizeEmail(email);
  const account = AUTHORIZED_ACCOUNTS[normalizedEmail];
  if (!account) return null;

  // Unique assigned temporary credentials unlock the legacy directory's one-time
  // password only on the server. The shared legacy value is never accepted directly.
  if (verifyAssignedTemporaryPassword(password, account)) {
    const user = await authenticatePasswordDirectory(normalizedEmail, LEGACY_DIRECTORY_TEMP_PASSWORD);
    return isAuthorizedExecutiveIdentity(user) ? user : null;
  }

  if (String(password || "") === LEGACY_DIRECTORY_TEMP_PASSWORD) return null;

  const user = await authenticatePasswordDirectory(normalizedEmail, password);
  return isAuthorizedExecutiveIdentity(user) ? user : null;
}

export async function currentAuthorizedExecutiveUser(request) {
  const user = await currentPasswordDirectoryUser(request);
  return isAuthorizedExecutiveIdentity(user) ? user : null;
}
