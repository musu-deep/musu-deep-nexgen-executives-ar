import crypto from "node:crypto";
import { apiError, authenticate } from "../lib/araak-iam.js";

const JWT_SECRET = process.env.JWT_SECRET || "nexgen-vercel-hosted-demo-secret-2026";
const LEGACY_TOKEN_IDS = {
  admin: "usr_admin",
  ceo: "usr_ceo",
  vp_development: "usr_dev",
  vp_investment: "usr_inv",
  dev_manager: "usr_mgr",
  tracker: "usr_track",
};

function bodyOf(request) {
  if (request.body == null) return {};
  if (typeof request.body === "object") return request.body;
  try { return JSON.parse(request.body); } catch { return {}; }
}

function signCompatibleToken(user) {
  const payload = Buffer.from(JSON.stringify({
    id: LEGACY_TOKEN_IDS[user.role] || "usr_track",
    profile_id: user.id,
    email: user.email,
    role: user.role,
    exp: Date.now() + 12 * 3600000,
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  if (request.method !== "POST") return response.status(405).json({ detail: "Method not allowed" });

  try {
    const payload = bodyOf(request);
    const user = await authenticate(payload.email, payload.password);
    if (!user) return response.status(401).json({ detail: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
    return response.status(200).json({ user, access_token: signCompatibleToken(user) });
  } catch (error) {
    const failure = apiError(error);
    return response.status(failure.status).json({ detail: failure.detail });
  }
}
