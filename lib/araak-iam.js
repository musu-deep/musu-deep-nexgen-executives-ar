// Retired legacy identity module.
//
// Authentication and user administration now live exclusively in
// araak-password-directory.js, which contains only the six approved executive
// accounts and stores assigned temporary passwords as hashes.

function retiredError() {
  const error = new Error("تم إيقاف خدمة الهوية التجريبية القديمة.");
  error.status = 410;
  return error;
}

export function signToken() {
  throw retiredError();
}

export async function listUsers() {
  return [];
}

export async function findUser() {
  return null;
}

export async function currentUserFromRequest() {
  return null;
}

export async function authenticate() {
  return null;
}

export async function inviteUser() {
  throw retiredError();
}

export async function resetInvitation() {
  throw retiredError();
}

export async function updateUser() {
  throw retiredError();
}

export async function disableUser() {
  throw retiredError();
}

export async function invitationStatus() {
  throw retiredError();
}

export async function activateAccount() {
  throw retiredError();
}

export async function accessMe() {
  throw retiredError();
}

export async function accessBootstrap() {
  throw retiredError();
}

export async function createAccessRecord() {
  throw retiredError();
}

export async function updateAccessRecord() {
  throw retiredError();
}

export async function revokeAccessRecord() {
  throw retiredError();
}

export async function simulateAccess() {
  throw retiredError();
}

export function apiError(error, fallbackStatus = 500) {
  return {
    status: Number(error?.status || fallbackStatus),
    detail: error?.message || "حدث خطأ غير متوقع في خدمة الهوية.",
  };
}
