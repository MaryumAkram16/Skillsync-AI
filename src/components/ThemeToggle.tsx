import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import React, { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Determine if dark is active
  const isDark = theme === "dark" || (theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  return (
    <button
      onClick={toggleTheme}
      className="w-9 h-9 flex items-center justify-center rounded-xl transition-all border border-border bg-card/60 hover:bg-card hover:border-accent/40 text-text-primary select-none cursor-pointer"
      title="Toggle theme"
    >
      {!mounted ? (
        <span className="w-5 h-5 block animate-pulse bg-text-secondary/20 rounded-full" />
      ) : isDark ? (
        <Sun className="h-5 w-5 text-amber-500 transition-transform hover:rotate-45 duration-300" />
      ) : (
        <Moon className="h-5 w-5 text-slate-700 dark:text-slate-300 transition-transform hover:-rotate-12 duration-300" />
      )}
    </button>
  );
}
