import React, { createContext, useContext, useEffect, useState } from "react";
import api from "../lib/api";

const AuthContext = createContext(null);
const PROFILE_KEY = "arak_user_profile";

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

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem("arak_token");
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
          localStorage.removeItem("arak_token");
          localStorage.removeItem(PROFILE_KEY);
          setUser(cachedProfile && token ? cachedProfile : false);
        }
      })
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, []);

  const acceptSession = (payload) => {
    const profile = normalizeUser(payload?.user);
    if (payload?.access_token) localStorage.setItem("arak_token", payload.access_token);
    if (profile) localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
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
    localStorage.removeItem("arak_token");
    localStorage.removeItem(PROFILE_KEY);
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, acceptSession, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
