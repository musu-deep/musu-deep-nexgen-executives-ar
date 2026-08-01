const ADAPTER_KEY = Symbol.for("ARAAK_ODOO_AUTH_DIRECTORY_ATTACHMENT_ADAPTER_V1");
const ATTACHMENT_NAME = "[SYSTEM] ARAAK Authorized Password Directory.json";
const ATTACHMENT_MIMETYPE = "application/json";

function requestUrl(input) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return typeof input?.url === "string" ? input.url : "";
}

function parseRequestBody(init) {
  if (!init?.body) return {};
  if (typeof init.body === "object" && !(init.body instanceof String)) {
    if (Buffer.isBuffer(init.body)) {
      try { return JSON.parse(init.body.toString("utf8")); } catch { return {}; }
    }
  }
  try { return JSON.parse(String(init.body)); } catch { return {}; }
}

function attachmentData(value) {
  return Buffer.from(String(value || ""), "utf8").toString("base64");
}

function decodedAttachmentData(value) {
  try {
    return Buffer.from(String(value || ""), "base64").toString("utf8");
  } catch {
    return "";
  }
}

function transformBody(method, payload) {
  if (method === "search_read") {
    return {
      ...payload,
      domain: [["name", "=", ATTACHMENT_NAME]],
      fields: ["id", "name", "datas", "write_date"],
      order: payload.order || "write_date desc",
      limit: payload.limit || 1,
    };
  }

  if (method === "create") {
    const values = Array.isArray(payload.vals_list) ? payload.vals_list : [];
    return {
      ...payload,
      vals_list: values.map((item) => ({
        name: ATTACHMENT_NAME,
        type: "binary",
        mimetype: ATTACHMENT_MIMETYPE,
        datas: attachmentData(item?.description),
      })),
    };
  }

  if (method === "write") {
    return {
      ...payload,
      vals: {
        name: ATTACHMENT_NAME,
        type: "binary",
        mimetype: ATTACHMENT_MIMETYPE,
        datas: attachmentData(payload?.vals?.description),
      },
    };
  }

  return payload;
}

async function transformSearchResponse(response) {
  if (!response.ok) return response;

  const payload = await response.json().catch(() => null);
  const rows = Array.isArray(payload)
    ? payload.map((row) => ({
        id: row.id,
        description: decodedAttachmentData(row.datas),
        write_date: row.write_date,
      }))
    : payload;

  const headers = new Headers(response.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(rows), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

if (!globalThis[ADAPTER_KEY]) {
  const originalFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = async (input, init = {}) => {
    const url = requestUrl(input);
    const match = url.match(/\/json\/2\/crm\.lead\/(search_read|create|write)(?:\?.*)?$/);
    if (!match) return originalFetch(input, init);

    const method = match[1];
    const targetUrl = url.replace("/json/2/crm.lead/", "/json/2/ir.attachment/");
    const payload = transformBody(method, parseRequestBody(init));
    const response = await originalFetch(targetUrl, {
      ...init,
      body: JSON.stringify(payload),
    });

    return method === "search_read"
      ? transformSearchResponse(response)
      : response;
  };

  globalThis[ADAPTER_KEY] = true;
}

export * from "./araak-password-directory-v4.js";
