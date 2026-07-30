import {
  accessBootstrapHandler,
  accessCollectionHandler,
  accessItemHandler,
  accessMeHandler,
  send,
  simulationHandler,
  usersHandler,
} from "../lib/araak-iam-http.js";

const SUPPORTED = new Set([
  "organizations",
  "roles",
  "assignments",
  "groups",
  "memberships",
  "delegations",
  "policies",
]);

function accessParts(request) {
  const value = request.query?.accessPath;
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (value != null && String(value).trim()) {
    return String(value).split("/").filter(Boolean).map(decodeURIComponent);
  }
  return [];
}

async function accessHandler(request, response) {
  const parts = accessParts(request);
  const route = parts.join("/");

  if (route === "me") return accessMeHandler(request, response);
  if (route === "bootstrap") return accessBootstrapHandler(request, response);
  if (route === "simulate") return simulationHandler(request, response);

  const kind = parts[0];
  if (!SUPPORTED.has(kind)) {
    return send(response, 404, { detail: "مسار نسيج الصلاحيات غير موجود." });
  }
  if (parts.length === 1) return accessCollectionHandler(kind)(request, response);
  if (parts.length === 2) {
    request.query = { ...(request.query || {}), id: parts[1] };
    return accessItemHandler(kind, "id")(request, response);
  }
  return send(response, 404, { detail: "مسار نسيج الصلاحيات غير موجود." });
}

export default async function handler(request, response) {
  if (request.query?.accessPath != null) {
    return accessHandler(request, response);
  }
  return usersHandler(request, response);
}
