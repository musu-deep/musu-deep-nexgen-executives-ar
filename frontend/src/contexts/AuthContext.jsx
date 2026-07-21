import React, { createContext, useContext, useEffect, useState } from "react";
import api from "../lib/api";

const AuthContext = createContext(null);
const PROFILE_KEY = "arak_user_profile";
const TOKEN_KEY = "arak_token";
const SESSION_VERSION_KEY = "arak_session_version";
const SESSION_VERSION = "hosted-api-stateless-v6";
const BUILD_RELEASE = "ceo-office-stateless-auth-2026-07-21-v6";

if (typeof window !== "undefined") {
  window.__ARAK_BUILD_RELEASE__ = BUILD_RELEASE;
  console.info(`[ARAAK] build ${BUILD_RELEASE}`);
}

function normalizeUser(user) {
  if (!user || typeof user !== "object") return user;
  const normalized = { ...user };
  if (normalized.department === "الرقابة والجودة") normalized.department = "التفتيش والرقابة والجودة";
  if (normalized.title === "مدير الرقابة والجودة") normalized.title = "مدير التفتيش والرقابة والجودة";
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
      .then((res) => {
        if (cancelled) return;
        const profile = normalizeUser(res.data.user);
        if (!profile) throw new Error("Missing verified profile");
        setUser(profile);
        localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
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
    const profile = normalizeUser(payload?.user);
    if (!payload?.access_token || !profile) {
      throw new Error("لم يتم إنشاء جلسة دخول مكتملة");
    }
    localStorage.setItem(TOKEN_KEY, payload.access_token);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    localStorage.setItem(SESSION_VERSION_KEY, SESSION_VERSION);
    setUser(profile);
    return profile;
  };

  const login = async (email, password) => {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const res = await api.post("/auth/login", { email: normalizedEmail, password });
    return acceptSession(res.data);
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    clearStoredSession();
    localStorage.setItem(SESSION_VERSION_KEY, SESSION_VERSION);
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, acceptSession, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
