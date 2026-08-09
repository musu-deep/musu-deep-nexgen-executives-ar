import * as base from "./araak-password-directory-v4.js";

// IMPORTANT: v7 deliberately builds on the directory implementation directly.
// It does NOT install the v5 global fetch adapter. That adapter rewrote every
// crm.lead request in the process and could hijack unrelated modules such as
// the marketing/opportunities gateway.
const TARGET_USER_ID = "usr_marketing";
const TARGET_PROFILE = Object.freeze({
  name: "محمود عوض مالك",
  title: "مسؤول منصة التسويق والمبيعات",
  department: "التسويق والمبيعات",
});

function normalizeUser(user) {
  if (!user || user.id !== TARGET_USER_ID) return user;
  return { ...user, ...TARGET_PROFILE };
}

function normalizeUserResult(result) {
  if (!result || typeof result !== "object") return result;
  if (Array.isArray(result)) return result.map(normalizeUser);
  if (result.user) return { ...result, user: normalizeUser(result.user) };
  if (Array.isArray(result.users)) return { ...result, users: result.users.map(normalizeUser) };
  return normalizeUser(result);
}

export * from "./araak-password-directory-v4.js";

export async function authenticatePasswordDirectory(...args) {
  return normalizeUser(await base.authenticatePasswordDirectory(...args));
}

export async function currentPasswordDirectoryUser(...args) {
  return normalizeUser(await base.currentPasswordDirectoryUser(...args));
}

export async function listPasswordDirectoryUsers(...args) {
  return normalizeUserResult(await base.listPasswordDirectoryUsers(...args));
}

export async function rebuildPasswordDirectory(...args) {
  return normalizeUserResult(await base.rebuildPasswordDirectory(...args));
}

export async function resetTemporaryPassword(...args) {
  return normalizeUserResult(await base.resetTemporaryPassword(...args));
}

export async function updatePasswordDirectoryUser(userId, payload, actor) {
  const nextPayload = userId === TARGET_USER_ID
    ? { ...(payload || {}), ...TARGET_PROFILE }
    : payload;
  return normalizeUser(await base.updatePasswordDirectoryUser(userId, nextPayload, actor));
}

export async function changeFirstLoginPassword(...args) {
  return normalizeUser(await base.changeFirstLoginPassword(...args));
}
