import React, { createContext, useContext, useEffect, useState } from "react";
import api from "../lib/api";

const AuthContext = createContext(null);
const PROFILE_KEY = "arak_user_profile";
const FINANCE_EMAIL = "finance@company.demo";

function readCachedProfile() {
  try {
    const value = localStorage.getItem(PROFILE_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // null = loading, false = no user, object = user
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const cachedProfile = readCachedProfile();
    const token = localStorage.getItem("arak_token");

    if (token && cachedProfile?.email === FINANCE_EMAIL) {
      setUser(cachedProfile);
      setLoading(false);
      return () => { cancelled = true; };
    }

    api.get("/auth/me")
      .then((res) => {
        if (cancelled) return;
        setUser(res.data.user);
        localStorage.setItem(PROFILE_KEY, JSON.stringify(res.data.user));
      })
      .catch(() => {
        if (!cancelled) {
          localStorage.removeItem(PROFILE_KEY);
          setUser(false);
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  const login = async (email, password) => {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const endpoint = normalizedEmail === FINANCE_EMAIL ? "/auth/finance-login" : "/auth/login";
    const res = await api.post(endpoint, { email: normalizedEmail, password });
    if (res.data?.access_token) {
      localStorage.setItem("arak_token", res.data.access_token);
    }
    if (res.data?.user) {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(res.data.user));
    }
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    localStorage.removeItem("arak_token");
    localStorage.removeItem(PROFILE_KEY);
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
