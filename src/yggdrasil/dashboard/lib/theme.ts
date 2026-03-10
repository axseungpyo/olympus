export type ThemeMode = "dark" | "light";

export function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  return (localStorage.getItem("yggdrasil-theme") as ThemeMode) || "dark";
}

export function setStoredTheme(mode: ThemeMode): void {
  localStorage.setItem("yggdrasil-theme", mode);
}

export function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement;
  root.classList.remove("dark", "light");
  root.classList.add(mode);
}

export function toggleTheme(): ThemeMode {
  const current = getStoredTheme();
  const next: ThemeMode = current === "dark" ? "light" : "dark";
  setStoredTheme(next);
  applyTheme(next);
  return next;
}
