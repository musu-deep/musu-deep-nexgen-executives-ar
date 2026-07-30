import {
  currentPasswordDirectoryUser,
  listPasswordDirectoryUsers,
  passwordDirectoryApiError,
  rebuildPasswordDirectory,
  resetTemporaryPassword,
  updatePasswordDirectoryUser,
} from "../lib/araak-password-directory.js";

function bodyOf(request) {
  if (request.body == null) return {};
  if (typeof request.body === "object") return request.body;
  try { return JSON.parse(request.body); } catch { return {}; }
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");

  try {
    const actor = await currentPasswordDirectoryUser(request);
    if (!actor) return response.status(401).json({ detail: "انتهت جلسة الدخول. سجّل الدخول مرة أخرى." });

    if (request.method === "GET") {
      return response.status(200).json(await listPasswordDirectoryUsers(actor));
    }

    const payload = bodyOf(request);
    if (request.method === "POST" && payload.action === "rebuild") {
      return response.status(200).json(await rebuildPasswordDirectory(actor));
    }

    if (request.method === "PATCH" && payload.action === "reset_password") {
      if (!payload.user_id) return response.status(422).json({ detail: "معرف المستخدم مطلوب." });
      return response.status(200).json(await resetTemporaryPassword(payload.user_id, actor));
    }

    if (request.method === "PATCH" && payload.user_id) {
      return response.status(200).json(await updatePasswordDirectoryUser(payload.user_id, payload, actor));
    }

    return response.status(405).json({ detail: "Method not allowed" });
  } catch (error) {
    const failure = passwordDirectoryApiError(error);
    return response.status(failure.status).json({ detail: failure.detail });
  }
}
