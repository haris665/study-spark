import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export const THEMES = [
  { id: "aurora", label: "Aurora Library", hint: "Teal navy / luminous calm" },
  { id: "heritage", label: "Heritage Studio", hint: "Warm ivory / academic brass" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

const ThemeContext = createContext<{ theme: ThemeId; setTheme: (t: ThemeId) => void }>({
  theme: "aurora",
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>("aurora");

  useEffect(() => {
    const stored = window.localStorage.getItem("oblique-theme");
    const migratedTheme = stored === "porcelain" || stored === "ember" ? "heritage" : stored;
    if (migratedTheme && THEMES.some((t) => t.id === migratedTheme)) {
      setThemeState(migratedTheme as ThemeId);
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem("oblique-theme", theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeState }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
