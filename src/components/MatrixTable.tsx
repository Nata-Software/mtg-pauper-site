import { winrateColor, pct } from "@/lib/colors";
import {
  prettyDeck,
  type Matrix,
  type ArchetypeRow,
  type CellStat,
} from "@/lib/stats";

export type MatrixSortKey = "matches" | "winrate" | "alpha";

function sortedRows(matrix: Matrix, sort: MatrixSortKey): ArchetypeRow[] {
  const rows = [...matrix.rows];

  if (sort === "winrate") {
    rows.sort(
      (a, b) => (b.overall.winrate ?? -1) - (a.overall.winrate ?? -1),
    );
  } else if (sort === "alpha") {
    rows.sort((a, b) => a.deck.localeCompare(b.deck));
  }

  // "matches" is already the default order.
  return rows;
}

function rowsWithFocus(
  rows: ArchetypeRow[],
  focusedDeck: string | undefined,
): { rows: ArchetypeRow[]; focusedDeck?: string } {
  if (!focusedDeck) {
    return { rows };
  }

  const normalized = focusedDeck.trim().toLowerCase();
  const focusedIndex = rows.findIndex((row) => row.deck === normalized);

  if (focusedIndex === -1) {
    return { rows };
  }

  const nextRows = [...rows];
  const [focused] = nextRows.splice(focusedIndex, 1);

  return {
    rows: [focused, ...nextRows],
    focusedDeck: normalized,
  };
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function attrEsc(s: string): string {
  return esc(s).replace(/'/g, "&#39;");
}

function joinUrl(baseHref: string, params: URLSearchParams): string {
  const query = params.toString();

  if (!query) {
    return baseHref;
  }

  const separator = baseHref.includes("?") ? "&" : "?";
  return `${baseHref}${separator}${query}`;
}

function focusHref(baseHref: string, deck: string): string {
  const params = new URLSearchParams({ focus: deck });
  return joinUrl(baseHref, params);
}

function cellHtml(stat: CellStat | undefined, href?: string): string {
  if (!stat || stat.matches === 0) return "";

  const { bg, fg } = winrateColor(stat.winrate, stat.wins + stat.losses);

  const content =
    `<div class="text-[10px] opacity-70">${pct(stat.ciLow)}–${pct(
      stat.ciHigh,
    )}</div>` +
    `<div class="font-bold">${pct(stat.winrate)}</div>` +
    `<div class="text-[10px] opacity-70">${stat.matches.toLocaleString()}</div>`;

  const inner = href
    ? `<a href="${attrEsc(href)}" class="block h-full w-full">${content}</a>`
    : content;

  return `<td class="px-2 py-1 text-center align-middle" style="background:${bg};color:${fg}">${inner}</td>`;
}

/**
 * The grid can be ~160x160 (26k cells). Building it as an HTML string instead
 * of React elements avoids serializing tens of thousands of nodes, which keeps
 * server render fast. Injected via dangerouslySetInnerHTML.
 */
function buildTableHtml({
  rows,
  cols,
  focusedDeck,
  baseHref,
}: {
  rows: ArchetypeRow[];
  cols: string[];
  focusedDeck?: string;
  baseHref: string;
}): string {
  const head =
    "<thead><tr>" +
    '<th class="sticky left-0 top-0 z-30 bg-neutral-100 px-3 py-2 text-left dark:bg-neutral-900">Archetype</th>' +
    '<th class="sticky top-0 z-20 bg-neutral-100 px-3 py-2 text-center dark:bg-neutral-900">Overall</th>' +
    cols
      .map(
        (c) =>
          `<th class="sticky top-0 z-20 bg-neutral-100 px-3 py-2 text-center dark:bg-neutral-900">${esc(
            prettyDeck(c),
          )}</th>`,
      )
      .join("") +
    "</tr></thead>";

  const body =
    "<tbody>" +
    rows
      .map((row) => {
        const isFocused = focusedDeck === row.deck;
        const rowHref = isFocused ? baseHref : focusHref(baseHref, row.deck);

        const trClass = isFocused
          ? "border-t border-neutral-200 bg-emerald-50 dark:border-neutral-800 dark:bg-emerald-950/30"
          : "border-t border-neutral-200 odd:bg-white even:bg-neutral-50 dark:border-neutral-800 dark:odd:bg-neutral-950 dark:even:bg-neutral-900";

        const archetypeClass = isFocused
          ? "sticky left-0 z-10 border-l-4 border-emerald-500 bg-emerald-100 px-3 py-2 font-semibold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
          : "sticky left-0 z-10 bg-inherit px-3 py-2 font-medium";

        const focusHint = isFocused
          ? '<span class="ml-2 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">focused</span>'
          : "";

        const cells = cols
          .map((c) => cellHtml(row.vs[c], rowHref))
          .join("");

        return (
          `<tr class="${trClass}">` +
          `<th class="${archetypeClass}" scope="row">` +
          `<a href="${attrEsc(
            rowHref,
          )}" class="block hover:underline" title="${
            isFocused ? "Click to remove focus" : "Click to focus this row"
          }">` +
          `<span>${esc(prettyDeck(row.deck))}</span>${focusHint}` +
          `<div class="text-xs font-normal text-neutral-500 dark:text-neutral-400">${row.matches.toLocaleString()} matches</div>` +
          "</a>" +
          "</th>" +
          cellHtml(row.overall, rowHref) +
          cells +
          "</tr>"
        );
      })
      .join("") +
    "</tbody>";

  return `${head}${body}`;
}

export function MatrixTable({
  matrix,
  sort,
  focus,
  baseHref,
}: {
  matrix: Matrix;
  sort: MatrixSortKey;
  focus?: string;
  baseHref: string;
}) {
  const sorted = sortedRows(matrix, sort);
  const { rows, focusedDeck } = rowsWithFocus(sorted, focus);

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-neutral-200 bg-neutral-50 p-6 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
        No matches for these filters yet.
      </p>
    );
  }

  const html = buildTableHtml({
    rows,
    cols: matrix.archetypes,
    focusedDeck,
    baseHref,
  });

  // Sticky header row + sticky first column keep deck names visible while
  // scrolling this large grid in both directions.
  return (
    <div className="matrix-scroll max-h-[75vh] overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
      <table
        className="min-w-full border-collapse text-xs"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
