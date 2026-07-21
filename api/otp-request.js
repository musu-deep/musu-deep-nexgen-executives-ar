export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");

  if (request.method !== "POST") {
    return response.status(405).json({ detail: "Method not allowed" });
  }

  return response.status(503).json({
    detail: "خدمة التحقق عبر واتساب جاهزة للربط وتحتاج إعداد بيانات المزود وأرقام الموظفين.",
    code: "WHATSAPP_SETUP_REQUIRED",
  });
}
