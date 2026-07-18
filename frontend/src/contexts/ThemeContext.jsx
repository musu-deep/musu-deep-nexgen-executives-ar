import React, { createContext, useContext, useEffect, useState } from "react";
import api from "../lib/api";

const ThemeContext = createContext(null);

export const THEMES = {
  luxury: {
    name: "الفخامة الGoldة",
    bg: "#0A0D14", surface: "#111622", accent: "#D4AF37", accent2: "#FDE047",
    text: "#F8FAFC", banner: "linear-gradient(135deg, #0A0D14 0%, #1a1208 50%, #0A0D14 100%)",
  },
  vision2030: {
    name: "رؤية المملكة 2030",
    bg: "#0a1c14", surface: "#0f2620", accent: "#006C35", accent2: "#10b981",
    text: "#F0FDF4", banner: "linear-gradient(135deg, #022c1d 0%, #006C35 50%, #022c1d 100%)",
  },
  spring: {
    name: "الربيع",
    bg: "#0c1815", surface: "#10231f", accent: "#34d399", accent2: "#a7f3d0",
    text: "#ECFDF5", banner: "linear-gradient(135deg, #064e3b 0%, #10b981 30%, #fbbf24 70%, #f472b6 100%)",
  },
  midnight: {
    name: "Fromتصف الليل",
    bg: "#0a0a1a", surface: "#13132a", accent: "#818cf8", accent2: "#c084fc",
    text: "#EEF2FF", banner: "linear-gradient(135deg, #1e1b4b 0%, #4338ca 50%, #1e1b4b 100%)",
  },
};

export const ThemeProvider = ({ children }) => {
  const [active, setActive] = useState("luxury");

  useEffect(() => {
    api.get("/theme").then(r => setActive(r.data?.active_theme || "luxury")).catch(() => {});
  }, []);

  useEffect(() => {
    const t = THEMES[active] || THEMES.luxury;
    const root = document.documentElement;
    root.style.setProperty("--bg-base", t.bg);
    root.style.setProperty("--bg-surface", t.surface);
    root.style.setProperty("--brand-gold", t.accent);
    root.style.setProperty("--brand-gold-hover", t.accent2);
    root.style.setProperty("--text-primary", t.text);
    root.style.setProperty("--banner-gradient", t.banner);
  }, [active]);

  const change = async (name) => {
    setActive(name);
    try { await api.put("/theme", { active_theme: name }); } catch {}
  };

  return <ThemeContext.Provider value={{ active, change, themes: THEMES }}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
