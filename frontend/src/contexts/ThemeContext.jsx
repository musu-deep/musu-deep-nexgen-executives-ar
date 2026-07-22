import React, { createContext, useContext, useEffect, useState } from "react";
import api from "../lib/api";

const ThemeContext = createContext(null);
const COLOR_MODE_KEY = "araak_color_mode";

export const THEMES = {
  luxury: {
    name: "الفخامة الذهبية",
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
    name: "منتصف الليل",
    bg: "#0a0a1a", surface: "#13132a", accent: "#818cf8", accent2: "#c084fc",
    text: "#EEF2FF", banner: "linear-gradient(135deg, #1e1b4b 0%, #4338ca 50%, #1e1b4b 100%)",
  },
};

const ARAAK_DAY = {
  bg: "#F4F7F1",
  surface: "#FFFFFF",
  surfaceHover: "#EAF2E6",
  accent: "#B28A00",
  accent2: "#D5A90A",
  green: "#287A3D",
  greenDark: "#174E2A",
  red: "#B92D35",
  text: "#173226",
  secondary: "#4E6759",
  muted: "#77887D",
  border: "rgba(40, 122, 61, 0.16)",
  banner: "linear-gradient(135deg, #FFFFFF 0%, #EEF5EA 48%, #FFF7D9 100%)",
};

function readInitialMode() {
  if (typeof window === "undefined") return "dark";
  const saved = window.localStorage.getItem(COLOR_MODE_KEY);
  return saved === "light" || saved === "dark" ? saved : "dark";
}

export const ThemeProvider = ({ children }) => {
  const [active, setActive] = useState("luxury");
  const [mode, setModeState] = useState(readInitialMode);

  useEffect(() => {
    api.get("/theme").then((response) => setActive(response.data?.active_theme || "luxury")).catch(() => {});
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const theme = THEMES[active] || THEMES.luxury;
    const isLight = mode === "light";

    root.dataset.colorMode = mode;
    root.classList.toggle("light-mode", isLight);
    root.classList.toggle("dark-mode", !isLight);
    root.style.colorScheme = isLight ? "light" : "dark";

    if (isLight) {
      root.style.setProperty("--bg-base", ARAAK_DAY.bg);
      root.style.setProperty("--bg-surface", ARAAK_DAY.surface);
      root.style.setProperty("--bg-surface-hover", ARAAK_DAY.surfaceHover);
      root.style.setProperty("--text-primary", ARAAK_DAY.text);
      root.style.setProperty("--text-secondary", ARAAK_DAY.secondary);
      root.style.setProperty("--text-muted", ARAAK_DAY.muted);
      root.style.setProperty("--brand-gold", ARAAK_DAY.accent);
      root.style.setProperty("--brand-gold-hover", ARAAK_DAY.accent2);
      root.style.setProperty("--brand-green", ARAAK_DAY.green);
      root.style.setProperty("--brand-green-dark", ARAAK_DAY.greenDark);
      root.style.setProperty("--brand-red", ARAAK_DAY.red);
      root.style.setProperty("--border-glass", ARAAK_DAY.border);
      root.style.setProperty("--banner-gradient", ARAAK_DAY.banner);
    } else {
      root.style.setProperty("--bg-base", theme.bg);
      root.style.setProperty("--bg-surface", theme.surface);
      root.style.setProperty("--bg-surface-hover", "#1A2235");
      root.style.setProperty("--text-primary", theme.text);
      root.style.setProperty("--text-secondary", "#94A3B8");
      root.style.setProperty("--text-muted", "#475569");
      root.style.setProperty("--brand-gold", theme.accent);
      root.style.setProperty("--brand-gold-hover", theme.accent2);
      root.style.setProperty("--brand-green", "#34D399");
      root.style.setProperty("--brand-green-dark", "#064E3B");
      root.style.setProperty("--brand-red", "#FB7185");
      root.style.setProperty("--border-glass", "rgba(255, 255, 255, 0.08)");
      root.style.setProperty("--banner-gradient", theme.banner);
    }

    window.localStorage.setItem(COLOR_MODE_KEY, mode);
  }, [active, mode]);

  const change = async (name) => {
    setActive(name);
    try { await api.put("/theme", { active_theme: name }); } catch {}
  };

  const setMode = (nextMode) => {
    if (nextMode === "light" || nextMode === "dark") setModeState(nextMode);
  };

  const toggleMode = () => setModeState((current) => current === "light" ? "dark" : "light");

  return (
    <ThemeContext.Provider value={{ active, change, themes: THEMES, mode, setMode, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);