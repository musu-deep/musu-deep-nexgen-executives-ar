import { passwordDirectoryHealth } from "../lib/araak-password-directory.js";

const RELEASE = "ceo-office-official-team-nine-2026-08-01-v4-attachment-store";
const DIRECTORY_VERSION = "official-team-nine-v4";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("X-ARAAK-Release", RELEASE);
  response.setHeader("X-ARAAK-Directory-Version", DIRECTORY_VERSION);

  if (request.method !== "GET") {
    return response.status(405).json({ detail: "Method not allowed" });
  }

  try {
    const directory = await passwordDirectoryHealth();
    return response.status(directory.status === "ready" ? 200 : 503).json({
      status: directory.status,
      service: "ARAAK CEO Office",
      release: RELEASE,
      directory_version: directory.directory_version,
      expected_directory_version: DIRECTORY_VERSION,
      authorized_users: directory.user_count,
      authentication: "/api/auth/login",
      directory,
    });
  } catch (error) {
    return response.status(503).json({
      status: "error",
      service: "ARAAK CEO Office",
      release: RELEASE,
      directory_version: null,
      expected_directory_version: DIRECTORY_VERSION,
      authorized_users: 0,
      authentication: "/api/auth/login",
      directory: {
        status: "error",
        detail: error?.message || "تعذر فحص دليل المصادقة.",
      },
    });
  }
}
