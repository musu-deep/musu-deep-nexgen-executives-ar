import api from "./api";

export const INTELLIGENCE_FILE_ACCEPT = ".pdf,.docx,.xlsx,.xlsm,.csv,.txt,.md,.json,.pptx,.html,.htm,.xml,.tsv";
export const MAX_INTELLIGENCE_FILE_BYTES = 4_000_000;

export function formatFileSize(bytes = 0) {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateIntelligenceFiles(files) {
  const values = Array.from(files || []).slice(0, 12);
  const oversized = values.find((file) => file.size > MAX_INTELLIGENCE_FILE_BYTES);
  if (oversized) {
    throw new Error(`الملف «${oversized.name}» أكبر من 4 ميجابايت. قسّمه أو ارفع نسخة أخف.`);
  }
  return values;
}

export async function uploadIntelligenceFile(file, metadata = {}) {
  const formData = new FormData();
  formData.append("file", file);
  Object.entries(metadata).forEach(([key, value]) => {
    if (value !== undefined && value !== null) formData.append(key, String(value));
  });
  const response = await api.post("/documents/upload", formData, { timeout: 90000 });
  return response.data;
}

export async function downloadIntelligenceFile(attachment) {
  const url = attachment?.url;
  if (!url) return;
  if (/^https?:\/\//i.test(url)) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  const response = await api.get(url.replace(/^\/api/, ""), { responseType: "blob", timeout: 90000 });
  const objectUrl = URL.createObjectURL(response.data);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = attachment.file_name || attachment.title || "document";
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
