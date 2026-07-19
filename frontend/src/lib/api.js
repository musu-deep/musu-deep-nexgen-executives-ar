import axios from "axios";
import { translateArabicText } from "../i18n/ar";

const configuredBackend = (import.meta.env.VITE_BACKEND_URL || "")
  .trim()
  .replace(/\/+$/, "");

const isBrowser = typeof window !== "undefined";
const isLocalPage =
  isBrowser && ["localhost", "127.0.0.1"].includes(window.location.hostname);

const BACKEND_URL =
  configuredBackend ||
  (import.meta.env.DEV || isLocalPage ? "http://127.0.0.1:8001" : "");

// في التطوير المحلي يستخدم المشغل VITE_BACKEND_URL تلقائيًا.
// في الإنتاج لا يجوز الرجوع إلى localhost؛ عند غياب المتغير نستخدم /api
// حتى تظهر مشكلة إعداد النشر بوضوح بدل محاولة الاتصال بجهاز الزائر.
export const API = BACKEND_URL ? `${BACKEND_URL}/api` : "/api";
export const HAS_EXPLICIT_BACKEND = Boolean(configuredBackend);
export const IS_LOCAL_API = API.includes("127.0.0.1") || API.includes("localhost");

const api = axios.create({
  baseURL: API,
  withCredentials: false,
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("arak_token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;

export function formatApiError(detail) {
  if (detail == null) {
    if (!import.meta.env.DEV && !HAS_EXPLICIT_BACKEND) {
      return "لم يُضبط رابط الباكند في بيئة النشر. أضف VITE_BACKEND_URL ثم أعد النشر.";
    }
    return `تعذر الاتصال بالباكند على ${API}. شغّل start-local.cmd من مجلد المشروع.`;
  }
  if (typeof detail === "string") return translateArabicText(detail.trim());
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? translateArabicText(e.msg) : JSON.stringify(e)))
      .filter(Boolean)
      .join(" • ");
  if (detail && typeof detail.msg === "string") return translateArabicText(detail.msg);
  return translateArabicText(String(detail));
}

export function formatConnectionError(error) {
  if (error?.response?.data?.detail) {
    return formatApiError(error.response.data.detail);
  }
  if (error?.code === "ECONNABORTED") {
    return "انتهت مهلة الاتصال بالباكند. تحقق من تشغيل مكتب الرئيس التنفيذي الرقمي.";
  }
  return formatApiError(null);
}

export const SECTOR_LABELS = {
  development: "التنمية المؤسسية",
  investment: "استراتيجية الاستثمار",
  arak_development: "العمليات والتنفيذ",
  academy: "بناء القدرات",
  digital: "التحول الرقمي",
  corporate: "الخدمات المؤسسية",
};

export const ROLE_LABELS = {
  admin: "مدير المنصة التنفيذية",
  ceo: "الرئيس التنفيذي",
  vp_development: "نائب الرئيس التنفيذي للتنمية",
  vp_investment: "نائب الرئيس التنفيذي للاستثمار",
  dev_manager: "مدير العمليات والتنفيذ",
  tracker: "المتابعة التنفيذية",
};

export const STATUS_LABELS = {
  planning: "قيد التخطيط",
  active: "نشط",
  on_hold: "معلّق",
  completed: "مكتمل",
  cancelled: "ملغى",
  pending: "قيد الانتظار",
  in_progress: "قيد التنفيذ",
  awaiting_approval: "بانتظار الاعتماد",
  delayed: "متأخر",
  scheduled: "مجدول",
  rescheduled: "أعيدت جدولته",
  approved: "معتمد",
  rejected: "مرفوض",
};

export const PRIORITY_LABELS = {
  low: "منخفضة",
  medium: "متوسطة",
  high: "مرتفعة",
  critical: "حرجة",
};
