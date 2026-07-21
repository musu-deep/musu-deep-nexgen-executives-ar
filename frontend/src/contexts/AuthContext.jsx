import React, { createContext, useContext, useEffect, useState } from "react";
import api from "../lib/api";

const AuthContext = createContext(null);
const PROFILE_KEY = "arak_user_profile";
const TOKEN_KEY = "arak_token";
const SESSION_VERSION_KEY = "arak_session_version";
const SESSION_VERSION = "hosted-api-unified-v2";

function normalizeUser(user) {
  if (!user || typeof user !== "object") return user;
  const normalized = { ...user };
  if (normalized.department === "الرقابة والجودة") normalized.department = "التفتيش والرقابة والجودة";
  if (normalized.title === "مدير الرقابة والجودة") normalized.title = "مدير التفتيش والرقابة والجودة";
  return normalized;
}

function readCachedProfile() {
  try {
    const value = localStorage.getItem(PROFILE_KEY);
    return value ? normalizeUser(JSON.parse(value)) : null;
  } catch {
    return null;
  }
}

function upgradeStoredSession() {
  const currentVersion = localStorage.getItem(SESSION_VERSION_KEY);
  if (currentVersion === SESSION_VERSION) return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(PROFILE_KEY);
  localStorage.setItem(SESSION_VERSION_KEY, SESSION_VERSION);
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    upgradeStoredSession();

    const token = localStorage.getItem(TOKEN_KEY);
    const cachedProfile = readCachedProfile();

    if (!token) {
      setUser(false);
      setLoading(false);
      return () => { cancelled = true; };
    }

    api.get("/auth/me")
      .then((res) => {
        if (cancelled) return;
        const profile = normalizeUser(res.data.user);
        setUser(profile);
        localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      })
      .catch(() => {
        if (!cancelled) {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(PROFILE_KEY);
          setUser(cachedProfile && token ? cachedProfile : false);
        }
      })
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, []);

  const acceptSession = (payload) => {
    const profile = normalizeUser(payload?.user);
    if (payload?.access_token) localStorage.setItem(TOKEN_KEY, payload.access_token);
    if (profile) localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    localStorage.setItem(SESSION_VERSION_KEY, SESSION_VERSION);
    setUser(profile || false);
    return profile;
  };

  const login = async (email, password) => {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const res = await api.post("/auth/login", { email: normalizedEmail, password });
    return acceptSession(res.data);
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(PROFILE_KEY);
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
