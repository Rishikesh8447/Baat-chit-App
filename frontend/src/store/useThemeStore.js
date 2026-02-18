import { create } from "zustand";
import { THEMES } from "../constants";

const applyTheme = (theme) => {
  document.documentElement.setAttribute("data-theme", theme);
};

const getInitialTheme = () => {
  const savedTheme = localStorage.getItem("chat-theme");
  if (savedTheme && THEMES.includes(savedTheme)) return savedTheme;
  return "dark";
};

export const useThemeStore = create((set, get) => ({
  theme: getInitialTheme(),

  initializeTheme: () => {
    const currentTheme = get().theme;
    if (!THEMES.includes(currentTheme)) {
      localStorage.setItem("chat-theme", "dark");
      set({ theme: "dark" });
      applyTheme("dark");
      return;
    }
    applyTheme(currentTheme);
  },

  setTheme: (theme) => {
    localStorage.setItem("chat-theme", theme);
    applyTheme(theme);
    set({ theme });
  },
}));
