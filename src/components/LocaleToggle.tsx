"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { applyLocale } from "@/lib/i18n-client";
import { DEFAULT_LOCALE, parseLocale, type Locale } from "@/lib/i18n";

const OPTIONS: { code: Locale; label: string; title: string }[] = [
  { code: "en", label: "EN", title: "English" },
  { code: "pt-BR", label: "PT", title: "Português" },
];

function readInitialLocale(): Locale {
  if (typeof window === "undefined") {
    return DEFAULT_LOCALE;
  }

  return parseLocale(
    window.localStorage.getItem("locale") ??
      document.documentElement.getAttribute("data-locale") ??
      DEFAULT_LOCALE,
  );
}

export function LocaleToggle() {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>(readInitialLocale);
  const [isPending, startTransition] = useTransition();

  function select(next: Locale) {
    if (next === locale) return;

    document.documentElement.setAttribute("data-locale", next);
    document.documentElement.setAttribute("lang", next);

    setLocale(next);
    applyLocale(next);

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div
      role="group"
      aria-label="Language / Idioma"
      aria-busy={isPending}
      className="inline-flex items-center gap-0.5 rounded-md border border-neutral-300 bg-neutral-100 p-0.5 dark:border-neutral-700 dark:bg-neutral-800"
    >
      {OPTIONS.map((option) => {
        const active = locale === option.code;

        return (
          <button
            key={option.code}
            type="button"
            onClick={() => select(option.code)}
            aria-pressed={active}
            title={option.title}
            className={
              active
                ? "rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white"
                : "rounded px-2 py-1 text-xs font-semibold text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}