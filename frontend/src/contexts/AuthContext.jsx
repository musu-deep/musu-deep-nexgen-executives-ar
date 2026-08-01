import React, { createContext, useContext, useEffect, useState } from "react";
import api from "../lib/api";

const AuthContext = createContext(null);
const PROFILE_KEY = "arak_user_profile";
const TOKEN_KEY = "arak_token";
const SESSION_VERSION_KEY = "arak_session_version";
const SESSION_VERSION = "araak-official-team-nine-v3";
const BUILD_RELEASE = "ceo-office-official-team-nine-2026-08-01-v3";

if (typeof window !== "undefined") {
  window.__ARAK_BUILD_RELEASE__ = BUILD_RELEASE;
  console.info(`[ARAAK] build ${BUILD_RELEASE}`);
}

function normalizeUser(user) {
  if (!user || typeof user !== "object") return user;
  const normalized = { ...user };
  if (normalized.department === "الرقابة والجودة") normalized.department = "التفتيش والرقابة والجودة";
  if (normalized.title === "مدير الرقابة والجودة") normalized.title = "مدير التفتيش والرقابة والجودة";
  normalized.access_fabric_ready = false;
  return normalized;
}

function clearStoredSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(PROFILE_KEY);
}

function upgradeStoredSession() {
  const currentVersion = localStorage.getItem(SESSION_VERSION_KEY);
  if (currentVersion === SESSION_VERSION) return;
  clearStoredSession();
  localStorage.setItem(SESSION_VERSION_KEY, SESSION_VERSION);
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const persistProfile = (profile) => {
    const normalized = normalizeUser(profile);
    setUser(normalized);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(normalized));
    return normalized;
  };

  useEffect(() => {
    let cancelled = false;
    upgradeStoredSession();
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setUser(false);
      setLoading(false);
      return () => { cancelled = true; };
    }

    api.get("/auth/me")
      .then((response) => {
        if (!response.data?.user) throw new Error("Missing verified profile");
        if (!cancelled) persistProfile(response.data.user);
      })
      .catch(() => {
        if (!cancelled) {
          clearStoredSession();
          setUser(false);
        }
      })
      .finally(() => !cancelled && setLoading(false));

    const handleExpiredSession = () => {
      clearStoredSession();
      setUser(false);
      setLoading(false);
    };
    window.addEventListener("arak:session-expired", handleExpiredSession);
    return () => {
      cancelled = true;
      window.removeEventListener("arak:session-expired", handleExpiredSession);
    };
  }, []);

  const acceptSession = (payload) => {
    if (!payload?.access_token || !payload?.user) throw new Error("لم يتم إنشاء جلسة دخول مكتملة");
    localStorage.setItem(TOKEN_KEY, payload.access_token);
    localStorage.setItem(SESSION_VERSION_KEY, SESSION_VERSION);
    return persistProfile(payload.user);
  };

  const login = async (email, password) => {
    const response = await api.post("/auth/login", {
      email: String(email || "").trim().toLowerCase(),
      password,
    });
    return acceptSession(response.data);
  };

  const changePassword = async (currentPassword, newPassword) => {
    const response = await api.post("/auth/change-password", {
      current_password: currentPassword,
      new_password: newPassword,
    });
    return acceptSession(response.data);
  };

  const refreshAccess = async () => user;

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    clearStoredSession();
    localStorage.setItem(SESSION_VERSION_KEY, SESSION_VERSION);
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, changePassword, acceptSession, refreshAccess, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
