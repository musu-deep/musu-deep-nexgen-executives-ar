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

// في الإنتاج نستخدم API داخل النطاق نفسه افتراضيًا، ولا نطلب رابط باكند خارجي.
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

let sessionExpiryDispatched = false;
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const requestUrl = String(error?.config?.url || "");
    const isLoginRequest = requestUrl.includes("/auth/login");
    const hasStoredToken = Boolean(localStorage.getItem("arak_token"));

    if (status === 401 && !isLoginRequest && hasStoredToken && !sessionExpiryDispatched) {
      sessionExpiryDispatched = true;
      localStorage.removeItem("arak_token");
      localStorage.removeItem("arak_user_profile");
      window.dispatchEvent(new Event("arak:session-expired"));
      window.setTimeout(() => {
        sessionExpiryDispatched = false;
        if (window.location.pathname !== "/login") window.location.replace("/login");
      }, 0);
    }

    return Promise.reject(error);
  },
);

export default api;

export function formatApiError(detail) {
  if (detail == null) {
    return import.meta.env.DEV || isLocalPage
      ? `تعذر الاتصال بخدمة المنصة على ${API}. تحقق من تشغيل الباكند المحلي.`
      : "تعذر الوصول إلى خدمة المنصة في النسخة المنشورة. أعد تحميل الصفحة، وإن استمرت المشكلة فتحقق من اكتمال نشر وظائف API على Vercel.";
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
  if (error?.response?.status === 401) {
    return "انتهت جلسة الدخول. سجّل الدخول مرة أخرى.";
  }
  if (error?.response?.status === 404) {
    return "مسار الخدمة غير متاح في النسخة المنشورة حاليًا. يلزم نشر باكند Vercel مع الواجهة.";
  }
  if (error?.code === "ECONNABORTED") {
    return "انتهت مهلة الاتصال بخدمة المنصة.";
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
