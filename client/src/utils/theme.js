// Theme persistence and DOM sync utilities

const STORAGE_KEY = "pulmo-theme";

export function initializeTheme() {
  return localStorage.getItem(STORAGE_KEY) === "dark";
}

export function toggleTheme(isDark) {
  localStorage.setItem(STORAGE_KEY, isDark ? "dark" : "light");
  document.documentElement.classList.toggle("dark", isDark);
}
