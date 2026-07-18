import React, { createContext, useContext, useEffect, useMemo } from "react";

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  useEffect(() => {
    localStorage.setItem("arak_lang", "ar");
    document.documentElement.lang = "ar";
    document.documentElement.dir = "rtl";
    document.body.dir = "rtl";
  }, []);

  const value = useMemo(
    () => ({ lang: "ar", setLang: () => {}, isArabic: true }),
    []
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext) || { lang: "ar", setLang: () => {}, isArabic: true };
}

// النسخة مستقلة وعربية بالكامل؛ أُبقي المكوّن للتوافق مع أي استدعاءات قديمة.
export function LanguageToggle() {
  return null;
}
