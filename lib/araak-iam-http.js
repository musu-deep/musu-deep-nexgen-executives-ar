// Legacy Access Fabric HTTP handlers were retired in favor of the six-account
// password directory. This compatibility module intentionally exposes no users,
// invitations, credentials, or access-management data.

export function send(response, status, payload) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  return response.status(status).json(payload);
}

function retired(response) {
  return send(response, 410, {
    detail: "تم إيقاف مسار إدارة الهوية القديم. استخدم إدارة الحسابات المخولة داخل المنصة.",
  });
}

export async function usersHandler(_request, response) { return retired(response); }
export async function inviteHandler(_request, response) { return retired(response); }
export async function userItemHandler(_request, response) { return retired(response); }
export async function resetInviteHandler(_request, response) { return retired(response); }
export async function invitationHandler(_request, response) { return retired(response); }
export async function activationHandler(_request, response) { return retired(response); }
export async function accessMeHandler(_request, response) { return retired(response); }
export async function accessBootstrapHandler(_request, response) { return retired(response); }
export async function simulationHandler(_request, response) { return retired(response); }
export function accessCollectionHandler() { return async (_request, response) => retired(response); }
export function accessItemHandler() { return async (_request, response) => retired(response); }
