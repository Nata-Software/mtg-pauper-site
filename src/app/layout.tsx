import type { Metadata } from "next";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "MTG Pauper Stats",
  description: "Matchup winrates and standings for our MTG Pauper events.",
};

// Runs synchronously during HTML parsing, before first paint, so the saved
// theme applies with no flash. Defaults to dark when nothing is stored yet.
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("theme");if(t==="light")document.documentElement.setAttribute("data-theme","light")}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning className="h-full antialiased">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        <header className="border-b border-neutral-200 bg-neutral-50/60 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/60">
          <nav className="mx-auto flex max-w-[1400px] items-center gap-6 px-4 py-3">
            <Link href="/" className="font-semibold tracking-tight text-neutral-950 dark:text-white">
              MTG Pauper<span className="text-emerald-600 dark:text-emerald-400"> Stats</span>
            </Link>
            <div className="flex items-center gap-4 text-sm text-neutral-600 dark:text-neutral-300">
              <Link href="/" className="hover:text-neutral-950 dark:hover:text-white">
                Matchups
              </Link>
              <Link href="/standings" className="hover:text-neutral-950 dark:hover:text-white">
                Standings
              </Link>
              <Link href="/admin/upload" className="hover:text-neutral-950 dark:hover:text-white">
                Upload
              </Link>
            </div>
            <div className="ml-auto">
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
