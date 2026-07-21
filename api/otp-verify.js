export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");

  if (request.method !== "POST") {
    return response.status(405).json({ detail: "Method not allowed" });
  }

  return response.status(503).json({
    detail: "التحقق عبر واتساب يحتاج تفعيل مزود الرسائل وربط أرقام المستخدمين أولًا.",
    code: "WHATSAPP_SETUP_REQUIRED",
  });
}
