import { t, type Locale } from "@/lib/i18n";

type Props = {
  action: string;
  stores: string[];
  events: string[];
  store: string;
  event?: string;
  from?: string;
  to?: string;
  bounds: { min: string; max: string };
  locale: Locale;
  showMinPct?: boolean;
  minPct?: number;
  showSort?: boolean;
  sort?: string;
};

const inputCls =
  "rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900 focus:border-violet-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100";
const labelCls = "flex flex-col gap-1 text-xs text-neutral-500 dark:text-neutral-400";

export function FilterBar(props: Props) {
  const {
    action,
    stores,
    events,
    store,
    event,
    from,
    to,
    locale,
    showMinPct,
    minPct,
    showSort,
    sort,
  } = props;

  return (
    <form
      method="get"
      action={action}
      className="mb-5 flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-neutral-50/70 p-3 dark:border-neutral-800 dark:bg-neutral-900/50"
    >
      {stores.length > 1 && (
        <label className={labelCls}>
          {t(locale, "filter.store")}
          <select name="store" defaultValue={store} className={inputCls}>
            {stores.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className={labelCls}>
        {t(locale, "filter.event")}
        <select name="event" defaultValue={event ?? ""} className={inputCls}>
          <option value="">{t(locale, "filter.allEvents")}</option>
          {events.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      </label>

      <label className={labelCls}>
        {t(locale, "filter.from")}
        <input
          type="date"
          name="from"
          defaultValue={from ?? ""}
          className={inputCls}
        />
      </label>

      <label className={labelCls}>
        {t(locale, "filter.to")}
        <input
          type="date"
          name="to"
          defaultValue={to ?? ""}
          className={inputCls}
        />
      </label>

      {showMinPct && (
        <label className={labelCls}>
          {t(locale, "filter.minPct")}
          <input
            type="number"
            name="minPct"
            step="0.5"
            min="0"
            max="100"
            defaultValue={minPct ?? 1}
            className={`${inputCls} w-24`}
          />
        </label>
      )}

      {showSort && (
        <label className={labelCls}>
          {t(locale, "filter.sortBy")}
          <select name="sort" defaultValue={sort ?? "matches"} className={inputCls}>
            <option value="matches">{t(locale, "filter.sort.matches")}</option>
            <option value="winrate">{t(locale, "filter.sort.winrate")}</option>
            <option value="alpha">{t(locale, "filter.sort.alpha")}</option>
          </select>
        </label>
      )}

      <button
        type="submit"
        className="rounded-md bg-violet-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-500"
      >
        {t(locale, "filter.apply")}
      </button>
      <a
        href={action}
        className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
      >
        {t(locale, "filter.reset")}
      </a>
    </form>
  );
}
