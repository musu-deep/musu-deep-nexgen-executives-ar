import { apiError, currentUserFromRequest } from "../lib/araak-iam.js";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  if (request.method !== "GET") return response.status(405).json({ detail: "Method not allowed" });

  try {
    const user = await currentUserFromRequest(request);
    if (!user) return response.status(401).json({ detail: "Not authenticated" });
    return response.status(200).json({ user });
  } catch (error) {
    const failure = apiError(error);
    return response.status(failure.status).json({ detail: failure.detail });
  }
}
