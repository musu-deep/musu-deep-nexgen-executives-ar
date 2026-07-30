import {
  authenticatePasswordDirectory,
  passwordDirectoryApiError,
  signPasswordDirectoryToken,
} from "../lib/araak-password-directory.js";

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
    const payload = bodyOf(request);
    const user = await authenticatePasswordDirectory(payload.email, payload.password);
    if (!user) return response.status(401).json({ detail: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
    return response.status(200).json({ user, access_token: signPasswordDirectoryToken(user) });
  } catch (error) {
    const failure = passwordDirectoryApiError(error);
    return response.status(failure.status).json({ detail: failure.detail });
  }
}
