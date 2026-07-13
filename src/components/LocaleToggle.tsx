"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyLocale } from "@/lib/i18n-client";
import type { Locale } from "@/lib/i18n";

function domLocale(): Locale {
  return document.documentElement.getAttribute("data-locale") === "pt-BR"
    ? "pt-BR"
    : "en";
}

const OPTIONS: { code: Locale; label: string; title: string }[] = [
  { code: "en", label: "EN", title: "English" },
  { code: "pt-BR", label: "PT", title: "Português" },
];

export function LocaleToggle() {
  // Start from the server-rendered default ("en") for a clean hydration, then
  // sync to whatever the pre-paint init script actually applied.
  const [locale, setLocale] = useState<Locale>("en");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    setLocale(domLocale());
  }, []);

  function select(next: Locale) {
    if (next === locale) return;

    // 1) Optimistic, instant UI: flip the CSS variant + button highlight now.
    //    The `pt:` Tailwind variant keys off <html data-locale>, so nav labels
    //    and any CSS-driven strings switch with zero latency.
    document.documentElement.setAttribute("data-locale", next);
    document.documentElement.setAttribute("lang", next);
    setLocale(next);

    // 2) Persist the choice so future requests (and full reloads) honor it.
    applyLocale(next);

    // 3) Soft-refresh only the server-rendered content (headings, tables) with
    //    the new locale cookie — no white flash, no JS re-download, no re-run
    //    of the init script. Much faster than window.location.reload().
    startTransition(() => router.refresh());
  }

  return (
    <div
      role="group"
      aria-label="Language / Idioma"
      aria-busy={isPending}
      className="inline-flex items-center gap-0.5 rounded-md border border-neutral-300 bg-neutral-100 p-0.5 dark:border-neutral-700 dark:bg-neutral-800"
    >
      {OPTIONS.map((o) => {
        const active = locale === o.code;
        return (
          <button
            key={o.code}
            type="button"
            onClick={() => select(o.code)}
            aria-pressed={active}
            title={o.title}
            className={
              active
                ? "rounded px-2 py-1 text-xs font-semibold text-white bg-emerald-600"
                : "rounded px-2 py-1 text-xs font-semibold text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
