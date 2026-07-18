import axios from "axios";
import { translateArabicText } from "../i18n/ar";

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  "https://nexgen-executives.onrender.com";

export const API = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API,
  withCredentials: false,
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
  if (detail == null) return "حدث خطأ غير متوقع";
  if (typeof detail === "string") return translateArabicText(detail.trim());
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? translateArabicText(e.msg) : JSON.stringify(e)))
      .filter(Boolean)
      .join(" • ");
  if (detail && typeof detail.msg === "string") return translateArabicText(detail.msg);
  return translateArabicText(String(detail));
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
