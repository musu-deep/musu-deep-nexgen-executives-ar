import assert from "node:assert/strict";

process.env.ODOO_API_KEY = "test-api-key";
process.env.ODOO_URL = "https://odoo.test";
process.env.ODOO_DATABASE = "araak-test";
process.env.JWT_SECRET = "test-jwt-secret";

let storedAttachment = null;
const requestedUrls = [];

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === "string" ? input : input.url;
  requestedUrls.push(url);
  const body = init.body ? JSON.parse(String(init.body)) : {};

  if (url.endsWith("/json/2/ir.attachment/search_read")) {
    return jsonResponse(storedAttachment ? [{ ...storedAttachment }] : []);
  }

  if (url.endsWith("/json/2/ir.attachment/create")) {
    const values = body.vals_list?.[0];
    assert.equal(values.name, "[SYSTEM] ARAAK Authorized Password Directory.json");
    assert.equal(values.mimetype, "application/json");
    storedAttachment = {
      id: 901,
      name: values.name,
      datas: values.datas,
      write_date: new Date().toISOString(),
    };
    return jsonResponse(901);
  }

  if (url.endsWith("/json/2/ir.attachment/write")) {
    assert.equal(body.ids?.[0], 901);
    storedAttachment = {
      ...storedAttachment,
      ...body.vals,
      write_date: new Date().toISOString(),
    };
    return jsonResponse(true);
  }

  return jsonResponse({ message: `Unexpected URL: ${url}` }, 404);
};

const directory = await import(`../lib/araak-password-directory.js?attachment-test=${Date.now()}`);

const health = await directory.passwordDirectoryHealth();
assert.equal(health.status, "ready");
assert.equal(health.storage, "odoo");
assert.equal(health.persistent, true);
assert.equal(health.user_count, 9);
assert.equal(health.active_user_count, 9);
assert.ok(storedAttachment?.datas);

const users = await directory.listPasswordDirectoryUsers({ id: "test-admin", role: "admin" });
assert.equal(users.length, 9);
assert.equal(users[0].email, "louiabdalla1@gmail.com");
assert.equal("password_hash" in users[0], false);
assert.equal("password_salt" in users[0], false);

await directory.resetTemporaryPassword("usr_admin", { id: "test-admin", role: "admin" });
assert.ok(requestedUrls.every((url) => !url.includes("/crm.lead/")));
assert.ok(requestedUrls.some((url) => url.includes("/ir.attachment/")));

const encoded = Buffer.from(storedAttachment.datas, "base64").toString("utf8");
assert.match(encoded, /ARAAK_PASSWORD_DIRECTORY_V1:/);

console.log("Odoo attachment password directory test passed");
