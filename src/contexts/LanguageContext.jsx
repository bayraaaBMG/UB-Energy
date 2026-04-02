import { createContext, useContext, useState } from "react";
import mn from "../i18n/mn";
import en from "../i18n/en";

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState("mn");
  const t = lang === "mn" ? mn : en;

  const toggleLang = () => setLang((prev) => (prev === "mn" ? "en" : "mn"));

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}
