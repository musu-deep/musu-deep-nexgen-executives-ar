import React, { useEffect, useMemo, useState } from "react";

const SIZE_CLASSES = {
  sm: "w-10 h-10 text-sm",
  md: "w-14 h-14 text-lg",
  lg: "w-20 h-20 text-2xl",
  xl: "w-24 h-24 text-3xl",
};

function getInitials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "؟";
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`;
}

function storageKey(user) {
  const identity = user?.email || user?.id || "guest";
  return `arak-user-avatar:${String(identity).toLowerCase()}`;
}

function resolveAvatar(user) {
  if (!user) return "";
  const direct = user.avatar || user.avatar_url || user.photo || user.photo_url || user.image;
  if (direct) return direct;
  try {
    return localStorage.getItem(storageKey(user)) || "";
  } catch {
    return "";
  }
}

export default function UserAvatar({ user, size = "md", className = "", showStatus = false }) {
  const [src, setSrc] = useState(() => resolveAvatar(user));
  const initials = useMemo(() => getInitials(user?.name), [user?.name]);

  useEffect(() => {
    setSrc(resolveAvatar(user));

    const refresh = () => setSrc(resolveAvatar(user));
    window.addEventListener("storage", refresh);
    window.addEventListener("arak-avatar-updated", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("arak-avatar-updated", refresh);
    };
  }, [user?.email, user?.id, user?.avatar, user?.avatar_url, user?.photo_url]);

  return (
    <div className={`relative flex-shrink-0 ${className}`}>
      <div
        className={`${SIZE_CLASSES[size] || SIZE_CLASSES.md} rounded-2xl overflow-hidden border border-yellow-500/30 bg-gradient-to-br from-yellow-500/20 via-amber-500/10 to-slate-900 flex items-center justify-center font-heading font-black text-yellow-200 shadow-lg shadow-black/20`}
        aria-label={`صورة ${user?.name || "المستخدم"}`}
      >
        {src ? (
          <img
            src={src}
            alt={user?.name || "صورة المستخدم"}
            className="w-full h-full object-cover"
            onError={() => setSrc("")}
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>
      {showStatus && (
        <span className="absolute -bottom-0.5 -left-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#0b0f18]" title="متصل الآن" />
      )}
    </div>
  );
}

export { storageKey as getUserAvatarStorageKey };
