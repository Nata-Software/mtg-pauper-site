import { winrateColor, pct } from "@/lib/colors";
import { prettyDeck, type Matrix, type ArchetypeRow, type CellStat } from "@/lib/stats";

type SortKey = "matches" | "winrate" | "alpha";

function sortedRows(matrix: Matrix, sort: SortKey): ArchetypeRow[] {
  const rows = [...matrix.rows];
  if (sort === "winrate") {
    rows.sort((a, b) => (b.overall.winrate ?? -1) - (a.overall.winrate ?? -1));
  } else if (sort === "alpha") {
    rows.sort((a, b) => a.deck.localeCompare(b.deck));
  } // "matches" is already the default order
  return rows;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cellHtml(stat: CellStat | undefined): string {
  if (!stat || stat.matches === 0) return '<td class="mx-e"></td>';
  const { bg, fg } = winrateColor(stat.winrate, stat.wins + stat.losses);
  return (
    `<td class="mx-cell" style="background-color:${bg};color:${fg}">` +
    `<div class="r">${pct(stat.ciLow)}–${pct(stat.ciHigh)}</div>` +
    `<div class="w">${pct(stat.winrate)}</div>` +
    `<div class="m">${stat.matches.toLocaleString()}</div></td>`
  );
}

/**
 * The grid can be ~160x160 (26k cells). Building it as an HTML string instead
 * of React elements avoids serializing tens of thousands of nodes, which keeps
 * server render fast. Injected via dangerouslySetInnerHTML.
 */
function buildTableHtml(rows: ArchetypeRow[], cols: string[]): string {
  const head =
    "<thead><tr>" +
    '<th class="mx-corner">Archetype</th>' +
    '<th class="mx-colhead ov">Overall</th>' +
    cols.map((c) => `<th class="mx-colhead">${esc(prettyDeck(c))}</th>`).join("") +
    "</tr></thead>";

  const body =
    "<tbody>" +
    rows
      .map((row, i) => {
        const cells = cols.map((c) => cellHtml(row.vs[c])).join("");
        return (
          `<tr${i % 2 ? ' class="mx-odd"' : ""}>` +
          `<th class="mx-rowhead"><b>${esc(prettyDeck(row.deck))}</b>` +
          `<span>${row.matches.toLocaleString()} matches</span></th>` +
          cellHtml(row.overall) +
          cells +
          "</tr>"
        );
      })
      .join("") +
    "</tbody>";

  return `<table class="mx">${head}${body}</table>`;
}

export function MatrixTable({
  matrix,
  sort,
}: {
  matrix: Matrix;
  sort: SortKey;
}) {
  const rows = sortedRows(matrix, sort);

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-neutral-800 bg-neutral-900 p-6 text-neutral-400">
        No matches for these filters yet.
      </p>
    );
  }

  const html = buildTableHtml(rows, matrix.archetypes);

  // Sticky header row + sticky first column keep deck names visible while
  // scrolling this large grid in both directions.
  return (
    <div
      className="matrix-scroll max-h-[82vh] overflow-auto rounded-lg border border-neutral-800"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
