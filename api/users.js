import {
  listPasswordDirectoryUsers,
  passwordDirectoryApiError,
  rebuildPasswordDirectory,
  resetTemporaryPassword,
  updatePasswordDirectoryUser,
} from "../lib/araak-password-directory.js";
import {
  currentAuthorizedExecutiveUser,
  filterAuthorizedExecutiveUsers,
  isAuthorizedExecutiveUserId,
} from "../lib/authorized-access.js";

function bodyOf(request) {
  if (request.body == null) return {};
  if (typeof request.body === "object") return request.body;
  try { return JSON.parse(request.body); } catch { return {}; }
}

function requireAuthorizedTarget(userId) {
  if (!isAuthorizedExecutiveUserId(userId)) {
    const error = new Error("الحساب غير مخول بالدخول إلى منصة الرئيس التنفيذي.");
    error.status = 404;
    throw error;
  }
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");

  try {
    const actor = await currentAuthorizedExecutiveUser(request);
    if (!actor) return response.status(401).json({ detail: "انتهت جلسة الدخول. سجّل الدخول مرة أخرى." });

    if (request.method === "GET") {
      const users = await listPasswordDirectoryUsers(actor);
      return response.status(200).json(filterAuthorizedExecutiveUsers(users));
    }

    const payload = bodyOf(request);
    if (request.method === "POST" && payload.action === "rebuild") {
      const result = await rebuildPasswordDirectory(actor);
      return response.status(200).json({
        users: filterAuthorizedExecutiveUsers(result?.users),
        message: "تمت إعادة تهيئة الحسابات المخولة بكلماتها المؤقتة الفردية.",
      });
    }

    if (request.method === "PATCH" && payload.action === "reset_password") {
      if (!payload.user_id) return response.status(422).json({ detail: "معرف المستخدم مطلوب." });
      requireAuthorizedTarget(payload.user_id);
      const user = await resetTemporaryPassword(payload.user_id, actor);
      return response.status(200).json(user);
    }

    if (request.method === "PATCH" && payload.user_id) {
      requireAuthorizedTarget(payload.user_id);
      const user = await updatePasswordDirectoryUser(payload.user_id, payload, actor);
      return response.status(200).json(user);
    }

    return response.status(405).json({ detail: "Method not allowed" });
  } catch (error) {
    const failure = passwordDirectoryApiError(error);
    return response.status(failure.status).json({ detail: failure.detail });
  }
}
