import {
  accessBootstrapHandler,
  accessCollectionHandler,
  accessItemHandler,
  accessMeHandler,
  send,
  simulationHandler,
} from "../../lib/araak-iam-http.js";

const SUPPORTED = new Set([
  "organizations", "roles", "assignments", "groups",
  "memberships", "delegations", "policies",
]);

function routeParts(request) {
  const value = request.query?.path;
  if (Array.isArray(value)) return value.map(String);
  if (value) return String(value).split("/").filter(Boolean);
  try {
    const pathname = new URL(request.url, "http://localhost").pathname;
    return pathname.replace(/^\/api\/access\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  } catch {
    return [];
  }
}

export default async function handler(request, response) {
  const parts = routeParts(request);
  const route = parts.join("/");
  if (route === "me") return accessMeHandler(request, response);
  if (route === "bootstrap") return accessBootstrapHandler(request, response);
  if (route === "simulate") return simulationHandler(request, response);

  const kind = parts[0];
  if (!SUPPORTED.has(kind)) return send(response, 404, { detail: "مسار نسيج الصلاحيات غير موجود." });
  if (parts.length === 1) return accessCollectionHandler(kind)(request, response);
  if (parts.length === 2) {
    request.query = { ...(request.query || {}), id: parts[1] };
    return accessItemHandler(kind, "id")(request, response);
  }
  return send(response, 404, { detail: "مسار نسيج الصلاحيات غير موجود." });
}
