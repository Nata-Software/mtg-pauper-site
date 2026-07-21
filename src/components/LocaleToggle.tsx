"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { Locale } from "@/lib/i18n";
import { applyLocale } from "@/lib/i18n-client";

const OPTIONS: { code: Locale; label: string; title: string }[] = [
  { code: "en", label: "EN", title: "English" },
  { code: "pt-BR", label: "PT", title: "Português" },
];

function readInitialLocale(): Locale {
  if (typeof document === "undefined") return "en";

  return document.documentElement.getAttribute("data-locale") === "pt-BR"
    ? "pt-BR"
    : "en";
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
    <div className="inline-flex rounded-md border border-neutral-300 p-0.5 text-xs dark:border-neutral-700">
      {OPTIONS.map((option) => {
        const active = option.code === locale;

        return (
          <button
            key={option.code}
            type="button"
            title={option.title}
            disabled={isPending}
            onClick={() => select(option.code)}
            className={
              active
                ? "rounded bg-violet-600 px-2 py-1 font-semibold text-white"
                : "rounded px-2 py-1 text-neutral-600 hover:bg-neutral-100 disabled:opacity-60 dark:text-neutral-300 dark:hover:bg-neutral-800"
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
