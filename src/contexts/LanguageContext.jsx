import { createContext, useContext, useState, useEffect } from "react";
import mn from "../i18n/mn";
import en from "../i18n/en";
import { storageGet, storageSet } from "../utils/storage";

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => storageGet("ub_lang") || "mn");
  const t = lang === "mn" ? mn : en;

  useEffect(() => {
    document.documentElement.lang = lang === "mn" ? "mn" : "en";
  }, [lang]);

  const toggleLang = () => setLang((prev) => {
    const next = prev === "mn" ? "en" : "mn";
    storageSet("ub_lang", next);
    return next;
  });

  return (
    <LanguageContext.Provider value={{ lang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}
