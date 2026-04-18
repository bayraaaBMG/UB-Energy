import { createContext, useContext, useState, useEffect } from "react";
import { storageGet, storageSet } from "../utils/storage";
import { STORAGE_KEYS } from "../config/constants";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [fontSize,     setFontSize]     = useState(() => storageGet(STORAGE_KEYS.fontSize)     || "normal");
  const [highContrast, setHighContrast] = useState(() => storageGet(STORAGE_KEYS.highContrast) === "1");
  const [reduceMotion, setReduceMotion] = useState(() => {
    const stored = storageGet(STORAGE_KEYS.reduceMotion);
    if (stored !== null) return stored === "1";
    // Respect OS preference on first visit
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    const root = document.documentElement;

    // Font size
    if (fontSize === "large")  root.style.fontSize = "18px";
    else if (fontSize === "xlarge") root.style.fontSize = "22px";
    else root.style.fontSize = "16px";
    storageSet(STORAGE_KEYS.fontSize, fontSize);

    // High contrast
    root.classList.toggle("high-contrast", highContrast);
    storageSet(STORAGE_KEYS.highContrast, highContrast ? "1" : "0");

    // Reduce motion
    root.classList.toggle("reduce-motion", reduceMotion);
    storageSet(STORAGE_KEYS.reduceMotion, reduceMotion ? "1" : "0");
  }, [fontSize, highContrast, reduceMotion]);

  return (
    <ThemeContext.Provider value={{ fontSize, setFontSize, highContrast, setHighContrast, reduceMotion, setReduceMotion }}>
      {children}
    </ThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  return useContext(ThemeContext);
}
