type Props = {
  action: string; // path to submit to, e.g. "/" or "/standings"
  stores: string[];
  events: string[];
  store: string;
  event?: string;
  from?: string;
  to?: string;
  bounds: { min: string; max: string };
  showMinPct?: boolean;
  minPct?: number;
  showSort?: boolean;
  sort?: string;
};

const inputCls =
  "rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-100 focus:border-emerald-500 focus:outline-none";
const labelCls = "flex flex-col gap-1 text-xs text-neutral-400";

export function FilterBar(props: Props) {
  const {
    action,
    stores,
    events,
    store,
    event,
    from,
    to,
    bounds,
    showMinPct,
    minPct,
    showSort,
    sort,
  } = props;

  return (
    <form
      method="get"
      action={action}
      className="mb-5 flex flex-wrap items-end gap-3 rounded-lg border border-neutral-800 bg-neutral-900/50 p-3"
    >
      {stores.length > 1 && (
        <label className={labelCls}>
          Store
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
        Event
        <select name="event" defaultValue={event ?? ""} className={inputCls}>
          <option value="">All events</option>
          {events.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      </label>

      <label className={labelCls}>
        From
        <input
          type="date"
          name="from"
          defaultValue={from ?? ""}
          className={inputCls}
        />
      </label>

      <label className={labelCls}>
        To
        <input
          type="date"
          name="to"
          defaultValue={to ?? ""}
          className={inputCls}
        />
      </label>

      {showMinPct && (
        <label className={labelCls}>
          Min % of matches
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
          Sort by
          <select name="sort" defaultValue={sort ?? "matches"} className={inputCls}>
            <option value="matches">Number of matches</option>
            <option value="winrate">Winrate</option>
            <option value="alpha">Alphabetical</option>
          </select>
        </label>
      )}

      <button
        type="submit"
        className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
      >
        Apply
      </button>
      <a
        href={action}
        className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800"
      >
        Reset
      </a>
    </form>
  );
}
