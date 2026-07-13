"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavItem = {
  href: string;
  en: string;
  pt: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", en: "Matchups", pt: "Confrontos" },
  { href: "/standings", en: "Standings", pt: "Classificação" },
  { href: "/league", en: "League", pt: "Liga" },
  {
    href: "/next-tournaments",
    en: "Next Tournaments",
    pt: "Próximos Torneios",
  },
  { href: "/admin/upload", en: "Upload", pt: "Importar" },
];

function Bilingual({ en, pt }: { en: string; pt: string }) {
  return (
    <>
      <span className="pt:hidden">{en}</span>
      <span className="hidden pt:inline">{pt}</span>
    </>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";

  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  item,
  pathname,
  onClick,
  mobile = false,
}: {
  item: NavItem;
  pathname: string;
  onClick?: () => void;
  mobile?: boolean;
}) {
  const active = isActive(pathname, item.href);

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={
        mobile
          ? active
            ? "block rounded-lg bg-neutral-900 px-4 py-3 text-sm font-semibold text-white dark:bg-white dark:text-neutral-950"
            : "block rounded-lg px-4 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
          : active
            ? "font-semibold text-neutral-950 dark:text-white"
            : "text-neutral-600 hover:text-neutral-950 dark:text-neutral-300 dark:hover:text-white"
      }
    >
      <Bilingual en={item.en} pt={item.pt} />
    </Link>
  );
}

export function ResponsiveNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <nav className="hidden items-center gap-4 text-sm md:flex">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>

      <button
        type="button"
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800 md:hidden"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="sr-only">
          {open ? "Close menu" : "Open menu"}
        </span>

        <span className="flex flex-col gap-1.5">
          <span
            className={
              open
                ? "block h-0.5 w-5 translate-y-2 rotate-45 bg-current transition"
                : "block h-0.5 w-5 bg-current transition"
            }
          />
          <span
            className={
              open
                ? "block h-0.5 w-5 opacity-0 transition"
                : "block h-0.5 w-5 bg-current transition"
            }
          />
          <span
            className={
              open
                ? "block h-0.5 w-5 -translate-y-2 -rotate-45 bg-current transition"
                : "block h-0.5 w-5 bg-current transition"
            }
          />
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-64 rounded-xl border border-neutral-200 bg-white p-2 shadow-lg dark:border-neutral-800 dark:bg-neutral-950 md:hidden">
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                pathname={pathname}
                mobile
                onClick={() => setOpen(false)}
              />
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}