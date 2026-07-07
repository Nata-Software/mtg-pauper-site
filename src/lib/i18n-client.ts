import { LOCALE_COOKIE, type Locale } from "@/lib/i18n";

export function applyLocale(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000`;
}
