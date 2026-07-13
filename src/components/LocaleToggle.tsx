"use client";

import { useSyncExternalStore } from "react";
import { applyLocale } from "@/lib/i18n-client";
import type { Locale } from "@/lib/i18n";

function subscribe() {
  // The attribute only ever changes via a full reload (see toggle() below),
  // so there's nothing to subscribe to — this just satisfies the API.
  return () => {};
}

function getSnapshot(): Locale {
  return document.documentElement.getAttribute("data-locale") === "pt-BR"
    ? "pt-BR"
    : "en";
}

// Must match the server-rendered default in layout.tsx exactly, even though
// the init script may have already flipped the DOM's data-locale attribute
// by the time this hydrates on the client.
function getServerSnapshot(): Locale {
  return "en";
}

const OPTIONS: { code: Locale; label: string; title: string }[] = [
  { code: "en", label: "EN", title: "English" },
  { code: "pt-BR", label: "PT", title: "Português" },
];

export function LocaleToggle() {
  const locale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function select(next: Locale) {
    // Read the live DOM instead of the `locale` closure — see the matching
    // comment in ThemeToggle for why this must not rely on the rendered value.
    if (getSnapshot() === next) return;
    applyLocale(next);
    // Full reload: server-rendered page content (headings, tables, forms)
    // reads the locale cookie per-request, so this is the simplest way to get
    // it translated without threading locale through every component.
    window.location.reload();
  }

  return (
    <div
      role="group"
      aria-label="Language / Idioma"
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
