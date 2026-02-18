import { create } from "zustand";

const applyTheme = (theme) => {
  document.documentElement.setAttribute("data-theme", theme);
};

export const useThemeStore = create((set, get) => ({
  theme: localStorage.getItem("chat-theme") || "retro",

  initializeTheme: () => {
    applyTheme(get().theme);
  },

  setTheme: (theme) => {
    localStorage.setItem("chat-theme", theme);
    applyTheme(theme);
    set({ theme });
  },
}));
