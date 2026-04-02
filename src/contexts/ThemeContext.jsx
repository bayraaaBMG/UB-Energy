import { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [fontSize, setFontSize] = useState("normal"); // normal | large | xlarge
  const [highContrast, setHighContrast] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (fontSize === "large") root.style.fontSize = "18px";
    else if (fontSize === "xlarge") root.style.fontSize = "22px";
    else root.style.fontSize = "16px";

    if (highContrast) {
      root.classList.add("high-contrast");
    } else {
      root.classList.remove("high-contrast");
    }
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
