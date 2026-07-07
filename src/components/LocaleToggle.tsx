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

export function LocaleToggle() {
  const locale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle() {
    // Read the live DOM instead of the `locale` closure — see the matching
    // comment in ThemeToggle for why this must not rely on the rendered value.
    const next: Locale = getSnapshot() === "en" ? "pt-BR" : "en";
    applyLocale(next);
    // Full reload: server-rendered page content (headings, tables, forms)
    // reads the locale cookie per-request, so this is the simplest way to
    // get it translated without threading locale through every component.
    window.location.reload();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={locale === "en" ? "Mudar para português" : "Switch to English"}
      title={locale === "en" ? "Mudar para português" : "Switch to English"}
      className="flex h-8 items-center justify-center rounded-md border border-neutral-300 px-2 text-xs font-semibold uppercase text-neutral-600 hover:bg-neutral-200 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
    >
      {locale === "en" ? "EN" : "PT-BR"}
    </button>
  );
}
