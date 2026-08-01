const RELEASE = "ceo-office-official-team-nine-2026-08-01-v3";
const DIRECTORY_VERSION = "official-team-nine-v3";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("X-ARAAK-Release", RELEASE);
  response.setHeader("X-ARAAK-Directory-Version", DIRECTORY_VERSION);

  if (request.method !== "GET") {
    return response.status(405).json({ detail: "Method not allowed" });
  }

  return response.status(200).json({
    status: "ready",
    service: "ARAAK CEO Office",
    release: RELEASE,
    directory_version: DIRECTORY_VERSION,
    authorized_users: 9,
    authentication: "/api/auth/login",
  });
}
