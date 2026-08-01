import {
  passwordDirectoryApiError,
  signPasswordDirectoryToken,
} from "../lib/araak-password-directory.js";
import { authenticateAuthorizedExecutive } from "../lib/authorized-access.js";

const RELEASE = "ceo-office-official-team-nine-2026-08-01-v3";
const DIRECTORY_VERSION = "official-team-nine-v3";

function bodyOf(request) {
  if (request.body == null) return {};
  if (typeof request.body === "object") return request.body;
  try { return JSON.parse(request.body); } catch { return {}; }
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("X-ARAAK-Release", RELEASE);
  response.setHeader("X-ARAAK-Directory-Version", DIRECTORY_VERSION);
  if (request.method !== "POST") return response.status(405).json({ detail: "Method not allowed" });

  try {
    const payload = bodyOf(request);
    const user = await authenticateAuthorizedExecutive(payload.email, payload.password);
    if (!user) {
      return response.status(401).json({
        detail: "البريد الإلكتروني أو كلمة المرور غير صحيحة",
        release: RELEASE,
        directory_version: DIRECTORY_VERSION,
      });
    }
    return response.status(200).json({
      user,
      access_token: signPasswordDirectoryToken(user),
      release: RELEASE,
      directory_version: DIRECTORY_VERSION,
    });
  } catch (error) {
    const failure = passwordDirectoryApiError(error);
    return response.status(failure.status).json({
      detail: failure.detail,
      release: RELEASE,
      directory_version: DIRECTORY_VERSION,
    });
  }
}
