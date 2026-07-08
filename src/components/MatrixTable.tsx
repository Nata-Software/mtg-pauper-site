import { winrateColor, pct } from "@/lib/colors";
import { prettyDeck, type Matrix, type ArchetypeRow, type CellStat } from "@/lib/stats";
import { t, type Locale } from "@/lib/i18n";

export type MatrixSortKey = "matches" | "winrate" | "alpha";

function sortedRows(matrix: Matrix, sort: MatrixSortKey): ArchetypeRow[] {
  const rows = [...matrix.rows];
  if (sort === "winrate") {
    rows.sort((a, b) => (b.overall.winrate ?? -1) - (a.overall.winrate ?? -1));
  } else if (sort === "alpha") {
    rows.sort((a, b) => a.deck.localeCompare(b.deck));
  } // "matches" is already the default order
  return rows;
}

/** Pulls the focused deck's row to the top of the list, if present. */
function rowsWithFocus(
  rows: ArchetypeRow[],
  focusedDeck: string | undefined,
): { rows: ArchetypeRow[]; focusedDeck?: string } {
  if (!focusedDeck) return { rows };

  const normalized = focusedDeck.trim().toLowerCase();
  const focusedIndex = rows.findIndex((row) => row.deck === normalized);
  if (focusedIndex === -1) return { rows };

  const nextRows = [...rows];
  const [focused] = nextRows.splice(focusedIndex, 1);

  return { rows: [focused, ...nextRows], focusedDeck: normalized };
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
  if (!query) return baseHref;
  const separator = baseHref.includes("?") ? "&" : "?";
  return `${baseHref}${separator}${query}`;
}

function focusHref(baseHref: string, deck: string): string {
  return joinUrl(baseHref, new URLSearchParams({ focus: deck }));
}

function cellHtml(stat: CellStat | undefined, href?: string): string {
  if (!stat || stat.matches === 0) return '<td class="mx-e"></td>';
  const { bgLight, fgLight, bgDark, fgDark } = winrateColor(
    stat.winrate,
    stat.wins + stat.losses,
  );
  // Both variants ride along as custom properties; globals.css picks the
  // right pair via the `[data-theme="dark"]` selector (see .mx-cell).
  const style = `--cb-l:${bgLight};--cf-l:${fgLight};--cb-d:${bgDark};--cf-d:${fgDark}`;
  const content =
    `<div class="r">${pct(stat.ciLow)}–${pct(stat.ciHigh)}</div>` +
    `<div class="w">${pct(stat.winrate)}</div>` +
    `<div class="m">${stat.matches.toLocaleString()}</div>`;
  const inner = href
    ? `<a href="${attrEsc(href)}" class="mx-cell-link">${content}</a>`
    : content;
  return `<td class="mx-cell" style="${style}">${inner}</td>`;
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
  locale,
}: {
  rows: ArchetypeRow[];
  cols: string[];
  focusedDeck?: string;
  baseHref: string;
  locale: Locale;
}): string {
  const matchesSuffix = t(locale, "matrix.matchesSuffix");
  const focusedLabel = esc(t(locale, "matrix.focused"));
  const clickToFocus = t(locale, "matrix.clickToFocus");
  const clickToUnfocus = t(locale, "matrix.clickToUnfocus");

  const head =
    "<thead><tr>" +
    `<th class="mx-corner">${esc(t(locale, "matrix.archetype"))}</th>` +
    `<th class="mx-colhead ov">${esc(t(locale, "matrix.overall"))}</th>` +
    cols.map((c) => `<th class="mx-colhead">${esc(prettyDeck(c))}</th>`).join("") +
    "</tr></thead>";

  const body =
    "<tbody>" +
    rows
      .map((row, i) => {
        const isFocused = focusedDeck === row.deck;
        const rowHref = isFocused ? baseHref : focusHref(baseHref, row.deck);

        const trClasses = [i % 2 ? "mx-odd" : "", isFocused ? "mx-row-focused" : ""]
          .filter(Boolean)
          .join(" ");
        const rowheadClass = `mx-rowhead${isFocused ? " mx-focused" : ""}`;
        const focusBadge = isFocused
          ? `<span class="mx-focus-badge">${focusedLabel}</span>`
          : "";

        const cells = cols.map((c) => cellHtml(row.vs[c], rowHref)).join("");

        return (
          `<tr${trClasses ? ` class="${trClasses}"` : ""}>` +
          `<th class="${rowheadClass}"><a href="${attrEsc(rowHref)}" title="${attrEsc(
            isFocused ? clickToUnfocus : clickToFocus,
          )}">` +
          `<b>${esc(prettyDeck(row.deck))}</b>${focusBadge}` +
          `<span>${row.matches.toLocaleString()}${esc(matchesSuffix)}</span></a></th>` +
          cellHtml(row.overall, rowHref) +
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
  focus,
  baseHref,
  locale,
}: {
  matrix: Matrix;
  sort: MatrixSortKey;
  focus?: string;
  baseHref: string;
  locale: Locale;
}) {
  const sorted = sortedRows(matrix, sort);
  const { rows, focusedDeck } = rowsWithFocus(sorted, focus);

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-neutral-200 bg-neutral-50 p-6 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
        {t(locale, "matrix.noMatches")}
      </p>
    );
  }

  const html = buildTableHtml({
    rows,
    cols: matrix.archetypes,
    focusedDeck,
    baseHref,
    locale,
  });

  // Sticky header row + sticky first column keep deck names visible while
  // scrolling this large grid in both directions.
  return (
    <div
      className="matrix-scroll max-h-[82vh] overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-800"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
