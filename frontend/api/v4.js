import healthHandler from "../../api/health.js";
import loginHandler from "../../api/staff-login.js";
import meHandler from "../../api/staff-me.js";
import changePasswordHandler from "../../api/auth/change-password.js";
import usersHandler from "../../api/users.js";
import businessHandler from "../../api/[...path].js";

const RELEASE = "ceo-office-official-team-nine-2026-08-01-v4-attachment-store";

function requestedRoute(request) {
  const value = request?.query?.route;
  const raw = Array.isArray(value)
    ? value.join("/")
    : value || new URL(request.url || "/api/v4", "http://localhost").searchParams.get("route") || "";
  return String(raw).replace(/^\/+|\/+$/g, "");
}

function delegatedUrl(request, route) {
  const url = new URL(request.url || "/api/v4", "http://localhost");
  url.searchParams.delete("route");
  const query = url.searchParams.toString();
  return `/api/${route}${query ? `?${query}` : ""}`;
}

export default async function handler(request, response) {
  response.setHeader("X-ARAAK-Gateway", "frontend-single-gateway-v4-attachment-store");
  response.setHeader("X-ARAAK-Release", RELEASE);

  const route = requestedRoute(request);
  const originalUrl = request.url;

  try {
    if (route === "health") return await healthHandler(request, response);
    if (route === "auth/login") return await loginHandler(request, response);
    if (route === "auth/me") return await meHandler(request, response);
    if (route === "auth/change-password") return await changePasswordHandler(request, response);
    if (route === "users" || route.startsWith("users/")) return await usersHandler(request, response);

    request.url = delegatedUrl(request, route);
    return await businessHandler(request, response);
  } finally {
    request.url = originalUrl;
  }
}
