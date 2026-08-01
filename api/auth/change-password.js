import {
  changeFirstLoginPassword,
  passwordDirectoryApiError,
  signPasswordDirectoryToken,
} from "../../lib/araak-password-directory.js";
import { currentAuthorizedExecutiveUser } from "../../lib/authorized-access.js";

function bodyOf(request) {
  if (request.body == null) return {};
  if (typeof request.body === "object") return request.body;
  try { return JSON.parse(request.body); } catch { return {}; }
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  if (request.method !== "POST") return response.status(405).json({ detail: "Method not allowed" });

  try {
    const actor = await currentAuthorizedExecutiveUser(request);
    if (!actor) return response.status(401).json({ detail: "انتهت جلسة الدخول. سجّل الدخول مرة أخرى." });

    const user = await changeFirstLoginPassword(request, bodyOf(request));
    return response.status(200).json({
      user,
      access_token: signPasswordDirectoryToken(user),
      message: "تم تغيير كلمة المرور بنجاح.",
    });
  } catch (error) {
    const failure = passwordDirectoryApiError(error);
    return response.status(failure.status).json({ detail: failure.detail });
  }
}
