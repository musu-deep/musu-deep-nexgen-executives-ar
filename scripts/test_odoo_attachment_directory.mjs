import assert from "node:assert/strict";

process.env.ODOO_API_KEY = "test-api-key";
process.env.ODOO_URL = "https://odoo.test";
process.env.ODOO_DATABASE = "araak-test";
process.env.JWT_SECRET = "test-jwt-secret";

let storedLead = null;
const requestedUrls = [];

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const originalMockFetch = async (input, init = {}) => {
  const url = typeof input === "string" ? input : input.url;
  requestedUrls.push(url);
  const body = init.body ? JSON.parse(String(init.body)) : {};

  if (url.endsWith("/json/2/crm.lead/search_read")) {
    const wantsDirectory = Array.isArray(body.domain)
      && body.domain.some((item) => Array.isArray(item) && String(item[2] || "").includes("ARAAK_PASSWORD_DIRECTORY_V1:"));
    if (wantsDirectory) return jsonResponse(storedLead ? [{ ...storedLead }] : []);
    return jsonResponse([]);
  }

  if (url.endsWith("/json/2/crm.lead/create")) {
    const values = body.vals_list?.[0] || {};
    storedLead = {
      id: 901,
      name: values.name,
      description: values.description,
      write_date: new Date().toISOString(),
    };
    return jsonResponse(901);
  }

  if (url.endsWith("/json/2/crm.lead/write")) {
    assert.equal(body.ids?.[0], 901);
    storedLead = {
      ...storedLead,
      ...body.vals,
      write_date: new Date().toISOString(),
    };
    return jsonResponse(true);
  }

  if (url.endsWith("/json/2/ir.attachment/search_read")) {
    return jsonResponse([]);
  }

  return jsonResponse({ message: `Unexpected URL: ${url}` }, 404);
};

globalThis.fetch = originalMockFetch;
const directory = await import(`../lib/araak-password-directory.js?isolation-test=${Date.now()}`);

// Importing the password directory must never replace global fetch.
assert.equal(globalThis.fetch, originalMockFetch);

const health = await directory.passwordDirectoryHealth();
assert.equal(health.status, "ready");
assert.equal(health.storage, "odoo");
assert.equal(health.persistent, true);
assert.equal(health.user_count, 9);
assert.equal(health.active_user_count, 9);
assert.ok(storedLead?.description?.includes("ARAAK_PASSWORD_DIRECTORY_V1:"));

const users = await directory.listPasswordDirectoryUsers({ id: "test-admin", role: "admin" });
assert.equal(users.length, 9);
assert.equal(users[0].email, "louiabdalla1@gmail.com");
assert.equal("password_hash" in users[0], false);
assert.equal("password_salt" in users[0], false);

await directory.resetTemporaryPassword("usr_admin", { id: "test-admin", role: "admin" });

// Regression guard: directory traffic stays on its own CRM lead record and
// unrelated attachment/marketing calls are not rewritten by a global adapter.
assert.ok(requestedUrls.some((url) => url.includes("/crm.lead/")));
assert.ok(requestedUrls.every((url) => !url.includes("/ir.attachment/create")));
assert.equal(globalThis.fetch, originalMockFetch);

console.log("Odoo password directory isolation test passed");
