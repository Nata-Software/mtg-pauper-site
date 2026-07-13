"use client";

import { useEffect } from "react";

export function ThemeLocaleInit() {
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("theme");
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;

      const shouldUseDark =
        savedTheme === "dark" || (!savedTheme && prefersDark);

      document.documentElement.classList.toggle("dark", shouldUseDark);
      document.documentElement.dataset.theme = shouldUseDark ? "dark" : "light";

      const savedLocale = localStorage.getItem("locale");

      if (savedLocale === "pt-BR" || savedLocale === "en") {
        document.documentElement.dataset.locale = savedLocale;

        document.cookie = `locale=${savedLocale}; path=/; max-age=31536000; SameSite=Lax`;
      }
    } catch {
      // Ignore localStorage/cookie errors.
    }
  }, []);

  return null;
}