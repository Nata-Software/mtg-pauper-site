import { winrateColor, pct } from "@/lib/colors";
import { prettyDeck, type Matrix, type CellStat } from "@/lib/stats";

type SortKey = "matches" | "winrate" | "alpha";

function sortedRows(matrix: Matrix, sort: SortKey) {
  const rows = [...matrix.rows];
  if (sort === "winrate") {
    rows.sort(
      (a, b) => (b.overall.winrate ?? -1) - (a.overall.winrate ?? -1),
    );
  } else if (sort === "alpha") {
    rows.sort((a, b) => a.deck.localeCompare(b.deck));
  } // "matches" is already the default order
  return rows;
}

function Cell({ stat }: { stat: CellStat | undefined }) {
  if (!stat || stat.matches === 0) {
    return (
      <td className="border border-neutral-800/60 px-2 py-1 text-center text-neutral-700">
        <span className="text-xs">–</span>
      </td>
    );
  }
  const { bg, fg } = winrateColor(stat.winrate, stat.wins + stat.losses);
  return (
    <td
      className="border border-neutral-800/60 px-2 py-1 text-center align-middle"
      style={{ backgroundColor: bg, color: fg }}
    >
      <div className="text-[10px] leading-tight opacity-80">
        {pct(stat.ciLow)} – {pct(stat.ciHigh)}
      </div>
      <div className="text-sm font-bold leading-tight">{pct(stat.winrate)}</div>
      <div className="text-[10px] leading-tight opacity-70">
        {stat.matches.toLocaleString()} matches
      </div>
    </td>
  );
}

export function MatrixTable({
  matrix,
  sort,
}: {
  matrix: Matrix;
  sort: SortKey;
}) {
  const rows = sortedRows(matrix, sort);
  const cols = matrix.archetypes;

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-neutral-800 bg-neutral-900 p-6 text-neutral-400">
        No matches for these filters yet.
      </p>
    );
  }

  return (
    <div className="matrix-scroll overflow-x-auto rounded-lg border border-neutral-800">
      <table className="border-collapse text-neutral-100">
        <thead>
          <tr>
            <th className="sticky left-0 z-20 min-w-[150px] border border-neutral-800 bg-neutral-900 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Archetype
            </th>
            <th className="border border-neutral-800 bg-neutral-900 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-neutral-300">
              Overall
            </th>
            {cols.map((c) => (
              <th
                key={c}
                className="min-w-[86px] border border-neutral-800 bg-neutral-900 px-2 py-2 text-center text-[11px] font-medium leading-tight text-neutral-300"
              >
                {prettyDeck(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.deck} className="odd:bg-neutral-900/30">
              <th className="sticky left-0 z-10 min-w-[150px] border border-neutral-800 bg-neutral-900 px-3 py-1 text-left">
                <div className="text-xs font-semibold leading-tight">
                  {prettyDeck(row.deck)}
                </div>
                <div className="text-[10px] text-neutral-500">
                  {row.matches.toLocaleString()} matches
                </div>
              </th>
              <Cell stat={row.overall} />
              {cols.map((c) => (
                <Cell key={c} stat={row.vs[c]} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
