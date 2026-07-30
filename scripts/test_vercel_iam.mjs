import loginHandler from "../api/staff-login.js";
import meHandler from "../api/staff-me.js";
import accessHandler from "../api/access/[...path].js";
import usersHandler from "../api/users.js";
import inviteHandler from "../api/users/invite.js";
import invitationHandler from "../api/auth/invitation.js";
import businessHandler from "../api/[...path].js";

function requestFor({ method = "GET", url = "/", body = null, token = "", query = {} } = {}) {
  return {
    method,
    url,
    body,
    query,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  };
}

async function invoke(handler, request) {
  let statusCode = 200;
  let payload;
  const headers = {};
  const response = {
    setHeader(name, value) { headers[String(name).toLowerCase()] = value; },
    status(code) { statusCode = code; return this; },
    json(value) { payload = value; return value; },
    end() { return undefined; },
  };
  await handler(request, response);
  return { status: statusCode, body: payload, headers };
}

function expect(condition, message, context) {
  if (!condition) {
    console.error("FAILED:", message, context || "");
    process.exitCode = 1;
    throw new Error(message);
  }
}

const login = await invoke(loginHandler, requestFor({
  method: "POST",
  url: "/api/auth/login",
  body: { email: "admin@company.demo", password: "ExecAgent2026!" },
}));
expect(login.status === 200, "demo administrator login must succeed", login);
expect(login.body?.access_token, "login must return an access token", login);
const token = login.body.access_token;

const me = await invoke(meHandler, requestFor({ method: "GET", url: "/api/auth/me", token }));
expect(me.status === 200 && me.body?.user?.role === "admin", "session endpoint must resolve administrator", me);

const accessMe = await invoke(accessHandler, requestFor({
  method: "GET",
  url: "/api/access/me",
  token,
  query: { path: ["me"] },
}));
expect(accessMe.status === 200, "access/me must be available", accessMe);
expect(accessMe.body?.modules?.includes("dashboard"), "dashboard must be in effective modules", accessMe);

const bootstrap = await invoke(accessHandler, requestFor({
  method: "GET",
  url: "/api/access/bootstrap",
  token,
  query: { path: ["bootstrap"] },
}));
expect(bootstrap.status === 200, "access/bootstrap must be available", bootstrap);
expect(Array.isArray(bootstrap.body?.roles) && bootstrap.body.roles.length > 0, "bootstrap must include roles", bootstrap);
expect(Array.isArray(bootstrap.body?.permissions) && bootstrap.body.permissions.length > 0, "bootstrap must include permissions", bootstrap);

const users = await invoke(usersHandler, requestFor({ method: "GET", url: "/api/users", token }));
expect(users.status === 200 && Array.isArray(users.body), "users list must be available", users);

const invalidInvite = await invoke(inviteHandler, requestFor({
  method: "POST",
  url: "/api/users/invite",
  token,
  body: {},
}));
expect(invalidInvite.status === 422, "empty invite must return validation error instead of 405", invalidInvite);

const invalidToken = await invoke(invitationHandler, requestFor({
  method: "GET",
  url: "/api/auth/invitation?token=invalid",
  query: { token: "invalid" },
}));
expect(invalidToken.status === 404, "invalid invitation token must return 404", invalidToken);

const dashboard = await invoke(businessHandler, requestFor({
  method: "GET",
  url: "/api/dashboard",
  token,
}));
expect(dashboard.status === 200, "institutional token must remain compatible with hosted business API", dashboard);

console.log("Vercel IAM functional checks passed.");
