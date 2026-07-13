import type { Metadata } from "next";
import Link from "next/link";

import { LocaleToggle } from "@/components/LocaleToggle";
import { ResponsiveNav } from "@/components/ResponsiveNav";
import { ThemeLocaleInit } from "@/components/ThemeLocaleInit";
import { ThemeToggle } from "@/components/ThemeToggle";

import "./globals.css";

export const metadata: Metadata = {
  title: "MTG Pauper Stats",
  description: "Matchup winrates and standings for our MTG Pauper events.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      data-locale="en"
      suppressHydrationWarning
    >
      <body
        suppressHydrationWarning
        className="min-h-full bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100"
      >
        <ThemeLocaleInit />

        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
            <div className="flex w-full items-center justify-between gap-4 px-5 py-3">
              <div className="flex min-w-0 items-center gap-8">
                <Link
                  href="/"
                  className="shrink-0 text-base font-bold tracking-tight text-neutral-950 dark:text-white"
                >
                  MTG Pauper{" "}
                  <span className="text-violet-500 dark:text-violet-400">
                    Stats
                  </span>
                </Link>

                <ResponsiveNav />
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
        </div>
      </body>
    </html>
  );
}