import { createContext, useContext, useState, useEffect } from "react";
import { storageGet, storageSet } from "../utils/storage";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [fontSize, setFontSize] = useState(() => storageGet("ub_font_size") || "normal");
  const [highContrast, setHighContrast] = useState(() => storageGet("ub_high_contrast") === "1");

  useEffect(() => {
    const root = document.documentElement;
    if (fontSize === "large") root.style.fontSize = "18px";
    else if (fontSize === "xlarge") root.style.fontSize = "22px";
    else root.style.fontSize = "16px";
    storageSet("ub_font_size", fontSize);

    if (highContrast) root.classList.add("high-contrast");
    else root.classList.remove("high-contrast");
    storageSet("ub_high_contrast", highContrast ? "1" : "0");
  }, [fontSize, highContrast]);

  return (
    <ThemeContext.Provider value={{ fontSize, setFontSize, highContrast, setHighContrast }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
