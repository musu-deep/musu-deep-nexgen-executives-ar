import {
  inviteHandler,
  resetInviteHandler,
  send,
  userItemHandler,
  usersHandler,
} from "../../lib/araak-iam-http.js";

function routeSegments(request) {
  try {
    const url = new URL(request.url, "http://localhost");
    const pathname = url.pathname
      .replace(/^\/api\/iam\/?/, "")
      .replace(/^\/+|\/+$/g, "");
    return pathname ? pathname.split("/").map(decodeURIComponent) : [];
  } catch {
    return [];
  }
}

export default async function handler(request, response) {
  if (request.method === "OPTIONS") return send(response, 200, { ok: true });

  const segments = routeSegments(request);
  const route = segments.join("/");

  if (route === "users") return usersHandler(request, response);
  if (route === "users/invite") return inviteHandler(request, response);

  if (segments[0] === "users" && segments[1] && segments[2] === "reset-invite") {
    request.query = { ...(request.query || {}), userId: segments[1] };
    return resetInviteHandler(request, response);
  }

  if (segments[0] === "users" && segments[1] && segments.length === 2) {
    request.query = { ...(request.query || {}), userId: segments[1] };
    return userItemHandler(request, response);
  }

  return send(response, 404, { detail: "مسار إدارة الهوية غير موجود." });
}
