"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

<<<<<<< Updated upstream
import { applyLocale } from "@/lib/i18n-client";
import type { Locale } from "@/lib/i18n";

const OPTIONS: { code: Locale; label: string; title: string }[] = [
  { code: "en", label: "EN", title: "English" },
  { code: "pt-BR", label: "PT", title: "Português" },
];
=======
import { DEFAULT_LOCALE, LOCALE_COOKIE, parseLocale, type Locale } from "@/lib/i18n";
>>>>>>> Stashed changes

function readInitialLocale(): Locale {
  if (typeof document === "undefined") {
    return "en";
  }

  return document.documentElement.getAttribute("data-locale") === "pt-BR"
    ? "pt-BR"
    : "en";
}

function setLocaleCookie(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; SameSite=Lax`;
}

export function LocaleToggle() {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(readInitialLocale);

  function setLocale(nextLocale: Locale) {
    setLocaleState(nextLocale);

    document.documentElement.setAttribute("data-locale", nextLocale);
    document.documentElement.setAttribute("lang", nextLocale);

    localStorage.setItem("locale", nextLocale);
    setLocaleCookie(nextLocale);

    router.refresh();
  }

  return (
    <div className="inline-flex rounded-lg border border-neutral-300 bg-neutral-100 p-1 text-xs font-semibold dark:border-neutral-700 dark:bg-neutral-900">
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={
          locale === "en"
            ? "rounded-md bg-emerald-600 px-3 py-1.5 text-white"
            : "rounded-md px-3 py-1.5 text-neutral-500 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
        }
      >
        EN
      </button>

      <button
        type="button"
        onClick={() => setLocale("pt-BR")}
        className={
          locale === "pt-BR"
            ? "rounded-md bg-emerald-600 px-3 py-1.5 text-white"
            : "rounded-md px-3 py-1.5 text-neutral-500 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
        }
      >
        PT
      </button>
    </div>
  );
}
