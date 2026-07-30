import {
  accessBootstrap,
  accessMe,
  activateAccount,
  apiError,
  createAccessRecord,
  currentUserFromRequest,
  disableUser,
  invitationStatus,
  inviteUser,
  listUsers,
  resetInvitation,
  revokeAccessRecord,
  simulateAccess,
  updateAccessRecord,
  updateUser,
} from "./araak-iam.js";

export function send(response, status, payload) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  return response.status(status).json(payload);
}

export function bodyOf(request) {
  if (request.body == null) return {};
  if (typeof request.body === "object") return request.body;
  try { return JSON.parse(request.body); } catch { return {}; }
}

export function queryValue(request, name) {
  const direct = request.query?.[name];
  if (Array.isArray(direct)) return direct[0];
  if (direct != null) return direct;
  try { return new URL(request.url, "http://localhost").searchParams.get(name); } catch { return null; }
}

export function pathValue(request, name) {
  return queryValue(request, name);
}

async function actorOf(request, { admin = false } = {}) {
  const actor = await currentUserFromRequest(request);
  if (!actor) {
    const error = new Error("انتهت جلسة الدخول. سجّل الدخول مرة أخرى.");
    error.status = 401;
    throw error;
  }
  if (admin && actor.role !== "admin") {
    const error = new Error("هذه العملية حصرية لمدير النظام.");
    error.status = 403;
    throw error;
  }
  return actor;
}

export async function run(response, operation) {
  try {
    return await operation();
  } catch (error) {
    const failure = apiError(error);
    return send(response, failure.status, { detail: failure.detail });
  }
}

export async function usersHandler(request, response) {
  return run(response, async () => {
    const actor = await actorOf(request, { admin: true });
    if (request.method === "GET") return send(response, 200, await listUsers(actor));
    if (request.method === "POST") return send(response, 410, { detail: "تم إيقاف إنشاء الحساب المباشر. استخدم مسار الدعوات الآمنة." });
    return send(response, 405, { detail: "Method not allowed" });
  });
}

export async function inviteHandler(request, response) {
  return run(response, async () => {
    if (request.method !== "POST") return send(response, 405, { detail: "Method not allowed" });
    const actor = await actorOf(request, { admin: true });
    return send(response, 201, await inviteUser(bodyOf(request), actor));
  });
}

export async function userItemHandler(request, response) {
  return run(response, async () => {
    const actor = await actorOf(request, { admin: true });
    const userId = pathValue(request, "userId") || pathValue(request, "id");
    if (!userId) return send(response, 422, { detail: "معرف المستخدم مطلوب." });
    if (request.method === "PATCH") return send(response, 200, await updateUser(userId, bodyOf(request), actor));
    if (request.method === "DELETE") {
      await disableUser(userId, actor);
      return send(response, 200, { ok: true });
    }
    return send(response, 405, { detail: "Method not allowed" });
  });
}

export async function resetInviteHandler(request, response) {
  return run(response, async () => {
    if (request.method !== "POST") return send(response, 405, { detail: "Method not allowed" });
    const actor = await actorOf(request, { admin: true });
    const userId = pathValue(request, "userId") || pathValue(request, "id");
    if (!userId) return send(response, 422, { detail: "معرف المستخدم مطلوب." });
    return send(response, 200, await resetInvitation(userId, actor));
  });
}

export async function invitationHandler(request, response) {
  return run(response, async () => {
    if (request.method !== "GET") return send(response, 405, { detail: "Method not allowed" });
    const token = queryValue(request, "token");
    if (!token) return send(response, 422, { detail: "رمز الدعوة مطلوب." });
    return send(response, 200, await invitationStatus(token));
  });
}

export async function activationHandler(request, response) {
  return run(response, async () => {
    if (request.method !== "POST") return send(response, 405, { detail: "Method not allowed" });
    const payload = bodyOf(request);
    if (!payload.token) return send(response, 422, { detail: "رمز الدعوة مطلوب." });
    return send(response, 200, await activateAccount(payload.token, payload.password));
  });
}

export async function accessMeHandler(request, response) {
  return run(response, async () => {
    if (request.method !== "GET") return send(response, 405, { detail: "Method not allowed" });
    const actor = await actorOf(request);
    return send(response, 200, await accessMe(actor));
  });
}

export async function accessBootstrapHandler(request, response) {
  return run(response, async () => {
    if (request.method !== "GET") return send(response, 405, { detail: "Method not allowed" });
    const actor = await actorOf(request, { admin: true });
    return send(response, 200, await accessBootstrap(actor));
  });
}

export function accessCollectionHandler(kind) {
  return async function handler(request, response) {
    return run(response, async () => {
      if (request.method !== "POST") return send(response, 405, { detail: "Method not allowed" });
      const actor = await actorOf(request, { admin: true });
      return send(response, 201, await createAccessRecord(kind, bodyOf(request), actor));
    });
  };
}

export function accessItemHandler(kind, paramName) {
  return async function handler(request, response) {
    return run(response, async () => {
      const actor = await actorOf(request, { admin: true });
      const recordId = pathValue(request, paramName) || pathValue(request, "id");
      if (!recordId) return send(response, 422, { detail: "معرف السجل مطلوب." });
      if (request.method === "PATCH") return send(response, 200, await updateAccessRecord(kind, recordId, bodyOf(request), actor));
      if (request.method === "DELETE") {
        await revokeAccessRecord(kind, recordId, actor);
        return send(response, 200, { ok: true });
      }
      return send(response, 405, { detail: "Method not allowed" });
    });
  };
}

export async function simulationHandler(request, response) {
  return run(response, async () => {
    if (request.method !== "POST") return send(response, 405, { detail: "Method not allowed" });
    const actor = await actorOf(request, { admin: true });
    return send(response, 200, await simulateAccess(bodyOf(request), actor));
  });
}
