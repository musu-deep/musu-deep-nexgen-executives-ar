export const DATA_MODES = Object.freeze({
  AUTO: "auto",
  DEMO: "demo",
  LIVE: "live",
});

export const DATA_MODE_OPTIONS = [
  { value: DATA_MODES.AUTO, label: "تلقائي (Auto)" },
  { value: DATA_MODES.DEMO, label: "تجريبي (Demo)" },
  { value: DATA_MODES.LIVE, label: "مباشر (Live)" },
];

const STORAGE_KEY = "araak.executive.data-mode";
const VALID_MODES = new Set(Object.values(DATA_MODES));

export function normalizeDataMode(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return VALID_MODES.has(normalized) ? normalized : DATA_MODES.AUTO;
}

export function getDefaultDataMode() {
  return normalizeDataMode(import.meta.env.VITE_DATA_MODE || DATA_MODES.AUTO);
}

export function getDataMode() {
  if (typeof window === "undefined") return getDefaultDataMode();
  return normalizeDataMode(window.localStorage.getItem(STORAGE_KEY) || getDefaultDataMode());
}

export function setDataMode(value) {
  const mode = normalizeDataMode(value);
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, mode);
  return mode;
}
