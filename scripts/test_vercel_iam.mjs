import loginHandler from "../api/staff-login.js";
import meHandler from "../api/staff-me.js";
import changePasswordHandler from "../api/auth/change-password.js";
import usersHandler from "../api/users.js";
import businessHandler from "../api/[...path].js";

const temporaryPassword = String(process.env.TEST_ADMIN_TEMP_PASSWORD || "");
if (!temporaryPassword) {
  console.log("IAM functional test skipped: TEST_ADMIN_TEMP_PASSWORD is not configured.");
  process.exit(0);
}

function requestFor({ method = "GET", url = "/", body = null, token = "", query = {} } = {}) {
  return { method, url, body, query, headers: token ? { authorization: `Bearer ${token}` } : {} };
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
  body: { email: "louiabdalla1@gmail.com", password: temporaryPassword },
}));
expect(login.status === 200, "temporary administrator login must succeed", login);
expect(login.body?.user?.must_change_password === true, "first login must require password change", login);
expect(login.body?.access_token, "login must return an access token", login);
let token = login.body.access_token;

const me = await invoke(meHandler, requestFor({ method: "GET", url: "/api/auth/me", token }));
expect(me.status === 200 && me.body?.user?.role === "admin", "session endpoint must resolve administrator", me);
expect(me.body?.user?.must_change_password === true, "session must preserve password-change requirement", me);

const users = await invoke(usersHandler, requestFor({ method: "GET", url: "/api/users", token }));
expect(users.status === 200 && Array.isArray(users.body), "users list must be available", users);
expect(users.body.length === 9, "directory must contain only the approved official team accounts", users);

const newPassword = `TestOnly!${Date.now()}Aa1`;
const changed = await invoke(changePasswordHandler, requestFor({
  method: "POST",
  url: "/api/auth/change-password",
  token,
  body: { current_password: temporaryPassword, new_password: newPassword },
}));
expect(changed.status === 200, "first-login password change must succeed", changed);
expect(changed.body?.user?.must_change_password === false, "changed account must be released from first-login gate", changed);
token = changed.body.access_token;

const newLogin = await invoke(loginHandler, requestFor({
  method: "POST",
  url: "/api/auth/login",
  body: { email: "louiabdalla1@gmail.com", password: newPassword },
}));
expect(newLogin.status === 200 && newLogin.body?.user?.must_change_password === false, "new password must authenticate", newLogin);

const dashboard = await invoke(businessHandler, requestFor({ method: "GET", url: "/api/dashboard", token }));
expect(dashboard.status === 200, "password-directory token must remain compatible with hosted business API", dashboard);

const rebuilt = await invoke(usersHandler, requestFor({
  method: "POST",
  url: "/api/users",
  token,
  body: { action: "rebuild" },
}));
expect(rebuilt.status === 200 && rebuilt.body?.users?.length === 9, "administrator must be able to rebuild the approved directory", rebuilt);
expect(!Object.prototype.hasOwnProperty.call(rebuilt.body || {}, "temporary_password"), "API must not reveal temporary passwords", rebuilt);

console.log("Authorized executive first-login checks passed.");
