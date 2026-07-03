import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "MTG Pauper Stats",
  description: "Matchup winrates and standings for our MTG Pauper events.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-neutral-950 text-neutral-100">
        <header className="border-b border-neutral-800 bg-neutral-900/60 backdrop-blur">
          <nav className="mx-auto flex max-w-[1400px] items-center gap-6 px-4 py-3">
            <Link href="/" className="font-semibold tracking-tight text-white">
              MTG Pauper<span className="text-emerald-400"> Stats</span>
            </Link>
            <div className="flex items-center gap-4 text-sm text-neutral-300">
              <Link href="/" className="hover:text-white">
                Matchups
              </Link>
              <Link href="/standings" className="hover:text-white">
                Standings
              </Link>
              <Link href="/admin/upload" className="hover:text-white">
                Upload
              </Link>
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
