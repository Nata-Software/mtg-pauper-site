import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";

import { LocaleToggle } from "@/components/LocaleToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LOCALE_COOKIE } from "@/lib/i18n";

import "./globals.css";

export const metadata: Metadata = {
  title: "MTG Pauper Stats",
  description: "Matchup winrates and standings for our MTG Pauper events.",
};

const INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("theme");if(t==="light")document.documentElement.setAttribute("data-theme","light")}catch(e){}try{var m=document.cookie.match(/(?:^|; )${LOCALE_COOKIE}=([^;]*)/);if(m&&decodeURIComponent(m[1])==="pt-BR"){document.documentElement.setAttribute("data-locale","pt-BR");document.documentElement.setAttribute("lang","pt-BR")}}catch(e){}})()`;

function Bilingual({ en, pt }: { en: string; pt: string }) {
  return (
    <>
      <span className="pt:hidden">{en}</span>
      <span className="hidden pt:inline">{pt}</span>
    </>
  );
}

function NavLink({
  href,
  en,
  pt,
}: {
  href: string;
  en: string;
  pt: string;
}) {
  return (
    <Link
      href={href}
      className="text-sm font-medium text-neutral-600 hover:text-neutral-950 dark:text-neutral-300 dark:hover:text-white"
    >
      <Bilingual en={en} pt={pt} />
    </Link>
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
    >
      <body className="min-h-full flex flex-col bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        <Script id="init-theme-locale" strategy="beforeInteractive">
          {INIT_SCRIPT}
        </Script>

        <header className="border-b border-neutral-200 bg-neutral-50/60 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/60">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3">
            <div className="flex min-w-0 items-center gap-8">
              <Link
                href="/"
                className="shrink-0 text-base font-bold tracking-tight text-neutral-950 dark:text-white"
              >
                MTG Pauper{" "}
                <span className="text-violet-600 dark:text-violet-400">
                  Stats
                </span>
              </Link>

              <nav className="flex flex-wrap items-center gap-4">
                <NavLink href="/" en="Matchups" pt="Confrontos" />
                {/* <NavLink href="/metagame" en="Metagame" pt="Metagame" /> */}
                <NavLink href="/league" en="League" pt="Liga" />
                <NavLink href="/data" en="Data" pt="Dados" />
                <NavLink href="/admin/upload" en="Upload" pt="Upload" />
              </nav>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <LocaleToggle />
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}