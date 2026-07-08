import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LocaleToggle } from "@/components/LocaleToggle";
import { LOCALE_COOKIE } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: "MTG Pauper Stats",
  description: "Matchup winrates and standings for our MTG Pauper events.",
};

// Runs synchronously during HTML parsing, before first paint, so the saved
// theme/locale apply with no flash. Defaults to dark + English when nothing
// is stored yet. Keeping this logic client-side (instead of reading the
// locale cookie via `cookies()` here) keeps the root layout static, so
// client-side navigation doesn't re-fetch it on every route change.
const INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("theme");if(t==="light")document.documentElement.setAttribute("data-theme","light")}catch(e){}try{var m=document.cookie.match(/(?:^|; )${LOCALE_COOKIE}=([^;]*)/);if(m&&decodeURIComponent(m[1])==="pt-BR"){document.documentElement.setAttribute("data-locale","pt-BR");document.documentElement.setAttribute("lang","pt-BR")}}catch(e){}})()`;

// Nav labels are short, fixed strings, so both languages are rendered and
// CSS (the `pt:` variant) shows the right one — no per-request locale read.
function Bilingual({ en, pt }: { en: string; pt: string }) {
  return (
    <>
      <span className="pt:hidden">{en}</span>
      <span className="hidden pt:inline">{pt}</span>
    </>
  );
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      data-locale="en"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <head>
        <Script
          id="init-theme-locale"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: INIT_SCRIPT }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-neutral-100 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        <header className="border-b border-neutral-200 bg-neutral-50/60 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/60">
          <nav className="mx-auto flex max-w-[1400px] items-center gap-6 px-4 py-3">
            <Link href="/" className="font-semibold tracking-tight text-neutral-950 dark:text-white">
              MTG Pauper<span className="text-violet-600 dark:text-violet-400"> Stats</span>
            </Link>
            <div className="flex items-center gap-4 text-sm text-neutral-600 dark:text-neutral-300">
              <Link href="/" className="hover:text-neutral-950 dark:hover:text-white">
                <Bilingual en="Matchups" pt="Confrontos" />
              </Link>
              <Link href="/standings" className="hover:text-neutral-950 dark:hover:text-white">
                <Bilingual en="Standings" pt="Classificação" />
              </Link>
              <Link href="/league" className="hover:text-neutral-950 dark:hover:text-white">
                <Bilingual en="League" pt="Liga" />
              </Link>
              <Link href="/admin/upload" className="hover:text-neutral-950 dark:hover:text-white">
                <Bilingual en="Upload" pt="Importar" />
              </Link>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <LocaleToggle />
              <ThemeToggle />
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
