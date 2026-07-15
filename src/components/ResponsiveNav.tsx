"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

function Bilingual({ en, pt }: { en: string; pt: string }) {
  return (
    <>
      <span className="pt:hidden">{en}</span>
      <span className="hidden pt:inline">{pt}</span>
    </>
  );
}

const NAV_ITEMS = [
  { href: "/", en: "Matchups", pt: "Confrontos" },
  // { href: "/metagame", en: "Metagame", pt: "Metagame" },
  { href: "/league", en: "League", pt: "Liga" },
  { href: "/data", en: "Data", pt: "Dados" },
  { href: "/next-tournaments", en: "Next Tournaments", pt: "Próximos Torneios" },
  // { href: "/admin/upload", en: "Upload", pt: "Upload" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";

  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavItem({
  href,
  en,
  pt,
  active,
  onClick,
}: {
  href: string;
  en: string;
  pt: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={
        active
          ? "rounded-md bg-neutral-200 px-3 py-2 text-sm font-bold text-neutral-950 dark:bg-neutral-800 dark:text-white"
          : "rounded-md px-3 py-2 text-sm font-semibold text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:hover:text-white"
      }
    >
      <Bilingual en={en} pt={pt} />
    </Link>
  );
}

export function ResponsiveNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <nav className="hidden items-center gap-1 md:flex">
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            en={item.en}
            pt={item.pt}
            active={isActive(pathname, item.href)}
          />
        ))}
      </nav>

      <div className="relative md:hidden">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label="Open navigation menu"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-neutral-300 bg-neutral-100 text-neutral-800 hover:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
        >
          <span className="sr-only">Menu</span>
          <span className="flex flex-col gap-1.5">
            <span className="block h-0.5 w-5 rounded bg-current" />
            <span className="block h-0.5 w-5 rounded bg-current" />
            <span className="block h-0.5 w-5 rounded bg-current" />
          </span>
        </button>

        {open && (
          <div className="absolute right-0 top-11 z-50 w-64 rounded-xl border border-neutral-200 bg-white p-2 shadow-xl dark:border-neutral-800 dark:bg-neutral-950">
            <nav className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  en={item.en}
                  pt={item.pt}
                  active={isActive(pathname, item.href)}
                  onClick={() => setOpen(false)}
                />
              ))}
            </nav>
          </div>
        )}
      </div>
    </>
  );
}