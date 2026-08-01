import {
  authenticatePasswordDirectory,
  currentPasswordDirectoryUser,
} from "./araak-password-directory.js";

const AUTHORIZED_EMAILS = new Set([
  "admin@arak.com",
  "ceo@arak.com",
  "vp.dev@arak.com",
  "vp.invest@arak.com",
  "dev.manager@arak.com",
  "tracker@arak.com",
]);

const AUTHORIZED_IDS = new Set([
  "usr_admin",
  "usr_ceo",
  "usr_dev",
  "usr_inv",
  "usr_mgr",
  "usr_track",
]);

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function isAuthorizedExecutiveIdentity(identity) {
  if (!identity) return false;
  const email = normalizeEmail(typeof identity === "string" ? identity : identity.email);
  const id = typeof identity === "object" ? String(identity.id || identity.profile_id || "") : "";
  return AUTHORIZED_EMAILS.has(email) || AUTHORIZED_IDS.has(id);
}

export function isAuthorizedExecutiveUserId(userId) {
  return AUTHORIZED_IDS.has(String(userId || ""));
}

export function filterAuthorizedExecutiveUsers(users) {
  return (Array.isArray(users) ? users : []).filter(isAuthorizedExecutiveIdentity);
}

export async function authenticateAuthorizedExecutive(email, password) {
  if (!AUTHORIZED_EMAILS.has(normalizeEmail(email))) return null;
  const user = await authenticatePasswordDirectory(email, password);
  return isAuthorizedExecutiveIdentity(user) ? user : null;
}

export async function currentAuthorizedExecutiveUser(request) {
  const user = await currentPasswordDirectoryUser(request);
  return isAuthorizedExecutiveIdentity(user) ? user : null;
}
