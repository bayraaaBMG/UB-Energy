import { createContext, useContext, useState, useEffect } from "react";
import { storageGet, storageSet } from "../utils/storage";
import { STORAGE_KEYS } from "../config/constants";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [fontSize, setFontSize] = useState(() => storageGet(STORAGE_KEYS.fontSize) || "normal");
  const [highContrast, setHighContrast] = useState(() => storageGet(STORAGE_KEYS.highContrast) === "1");

  useEffect(() => {
    const root = document.documentElement;
    if (fontSize === "large") root.style.fontSize = "18px";
    else if (fontSize === "xlarge") root.style.fontSize = "22px";
    else root.style.fontSize = "16px";
    storageSet(STORAGE_KEYS.fontSize, fontSize);

    if (highContrast) root.classList.add("high-contrast");
    else root.classList.remove("high-contrast");
    storageSet(STORAGE_KEYS.highContrast, highContrast ? "1" : "0");
  }, [fontSize, highContrast]);

  return (
    <ThemeContext.Provider value={{ fontSize, setFontSize, highContrast, setHighContrast }}>
      {children}
    </ThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  return useContext(ThemeContext);
}
