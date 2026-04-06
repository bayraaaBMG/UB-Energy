import { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [fontSize, setFontSize] = useState(() => localStorage.getItem("ub_font_size") || "normal");
  const [highContrast, setHighContrast] = useState(() => localStorage.getItem("ub_high_contrast") === "1");

  useEffect(() => {
    const root = document.documentElement;
    if (fontSize === "large") root.style.fontSize = "18px";
    else if (fontSize === "xlarge") root.style.fontSize = "22px";
    else root.style.fontSize = "16px";
    localStorage.setItem("ub_font_size", fontSize);

    if (highContrast) root.classList.add("high-contrast");
    else root.classList.remove("high-contrast");
    localStorage.setItem("ub_high_contrast", highContrast ? "1" : "0");
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
