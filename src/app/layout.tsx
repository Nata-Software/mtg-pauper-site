import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";

import { LocaleToggle } from "@/components/LocaleToggle";
import { ResponsiveNav } from "@/components/ResponsiveNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LOCALE_COOKIE } from "@/lib/i18n";

import "./globals.css";

export const metadata: Metadata = {
  title: "MTG Pauper Stats",
  description: "Matchup winrates and standings for our MTG Pauper events.",
};

const INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("theme");if(t==="light")document.documentElement.setAttribute("data-theme","light")}catch(e){}try{var m=document.cookie.match(/(?:^|; )${LOCALE_COOKIE}=([^;]*)/);if(m&&decodeURIComponent(m[1])==="pt-BR"){document.documentElement.setAttribute("data-locale","pt-BR");document.documentElement.setAttribute("lang","pt-BR")}}catch(e){}})()`;

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
      <body className="min-h-full bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        <Script id="init-theme-locale" strategy="beforeInteractive">
          {INIT_SCRIPT}
        </Script>

        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/75 dark:border-neutral-800 dark:bg-neutral-950/95 dark:supports-[backdrop-filter]:bg-neutral-950/75">
            <div className="flex w-full items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 items-center gap-6">
                <Link
                  href="/"
                  className="shrink-0 text-base font-bold tracking-tight text-neutral-950 dark:text-white"
                >
                  MTG Pauper{" "}
                  <span className="text-violet-600 dark:text-violet-400">
                    Stats
                  </span>
                </Link>

                <div className="hidden md:block">
                  <ResponsiveNav />
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <div className="md:hidden">
                  <ResponsiveNav />
                </div>

                <LocaleToggle />
                <ThemeToggle />
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}