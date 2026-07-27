import React, { useRef } from "react";
import { FileText, UploadCloud, X } from "lucide-react";
import { INTELLIGENCE_FILE_ACCEPT, formatFileSize, validateIntelligenceFiles } from "../lib/intelligenceFiles";

export default function IntelligenceFilePicker({ files = [], onChange, multiple = true, compact = false }) {
  const inputRef = useRef(null);

  const selectFiles = (event) => {
    try {
      const selected = validateIntelligenceFiles(event.target.files);
      onChange(multiple ? selected : selected.slice(0, 1));
    } finally {
      event.target.value = "";
    }
  };

  const removeFile = (index) => onChange(files.filter((_, itemIndex) => itemIndex !== index));

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept={INTELLIGENCE_FILE_ACCEPT}
        multiple={multiple}
        className="hidden"
        onChange={selectFiles}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={`w-full rounded-2xl border border-dashed border-yellow-500/35 bg-yellow-500/[0.06] text-right transition hover:bg-yellow-500/10 ${compact ? "p-4" : "p-5"}`}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-yellow-500/25 bg-yellow-500/10 text-yellow-300">
            <UploadCloud size={21} />
          </div>
          <div>
            <div className="font-bold text-slate-100">اختر الملفات للرفع والقراءة والتحليل</div>
            <div className="mt-1 text-[11px] leading-5 text-slate-500">PDF وWord وExcel وCSV وPowerPoint والنصوص — بحد أقصى 4 MB لكل ملف</div>
          </div>
        </div>
      </button>

      {files.length > 0 && (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {files.map((file, index) => (
            <div key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
              <FileText size={16} className="shrink-0 text-yellow-300" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-bold text-slate-200">{file.name}</div>
                <div className="mt-1 text-[10px] text-slate-500">{formatFileSize(file.size)}</div>
              </div>
              <button type="button" onClick={() => removeFile(index)} className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-300" aria-label="إزالة الملف">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
