import type { MplClassified } from "@/lib/mpl/queries";
import { t, type Locale, type TranslationKey } from "@/lib/i18n";

function fmtDate(date: Date | null, locale: Locale): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString(
    locale === "pt-BR" ? "pt-BR" : "en-US",
    { day: "2-digit", month: "short", timeZone: "UTC" },
  );
}

const SOURCE_STYLE: Record<string, string> = {
  open: "border-[#8b2fb0]/40 bg-[#8b2fb0]/10 text-[#8b2fb0] dark:text-[#c77dff]",
  parallel_mont:
    "border-[#d4a72c]/50 bg-[#d4a72c]/10 text-[#a07d16] dark:text-[#e6c04d]",
  partner_store:
    "border-neutral-300 bg-neutral-100 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  last_chance:
    "border-emerald-400/50 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300",
};

export function MplClassifiedTable({
  rows,
  locale,
}: {
  rows: MplClassified[];
  locale: Locale;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        {t(locale, "mpl.noData")}
      </p>
    );
  }

  return (
    <section>
      <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
        {t(locale, "mpl.classified.subtitle", { count: rows.length })}
      </p>

      <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
              <th className="px-3 py-2.5">#</th>
              <th className="px-3 py-2.5">{t(locale, "table.player")}</th>
              <th className="px-3 py-2.5">{t(locale, "mpl.classified.via")}</th>
              <th className="px-3 py-2.5 text-right">{t(locale, "league.month")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-900">
            {rows.map((r) => {
              const typeKey = `mpl.source.${r.sourceType}` as TranslationKey;
              return (
                <tr key={r.ordinal}>
                  <td className="px-3 py-2.5 text-neutral-400 tabular-nums dark:text-neutral-500">
                    {r.ordinal}
                  </td>
                  <td className="px-3 py-2.5 font-semibold text-neutral-950 dark:text-white">
                    {r.player}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`mr-2 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${SOURCE_STYLE[r.sourceType] ?? SOURCE_STYLE.partner_store}`}
                    >
                      {t(locale, typeKey)}
                    </span>
                    <span className="text-neutral-600 dark:text-neutral-300">
                      {r.source}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-neutral-500 tabular-nums dark:text-neutral-400">
                    {fmtDate(r.date, locale)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
