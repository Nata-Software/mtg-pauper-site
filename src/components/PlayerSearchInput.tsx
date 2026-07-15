"use client";

import { useMemo, useState } from "react";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function PlayerSearchInput({
  players,
  selectedPlayer,
  label,
  placeholder,
  noResultsLabel,
  minimumLabel,
}: {
  players: string[];
  selectedPlayer: string;
  label: string;
  placeholder: string;
  noResultsLabel: string;
  minimumLabel: string;
}) {
  const [query, setQuery] = useState(selectedPlayer);
  const [selected, setSelected] = useState(selectedPlayer);
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    const q = normalize(query);

    if (q.length < 3) return [];

    return players
      .filter((player) => normalize(player).includes(q))
      .slice(0, 12);
  }, [players, query]);

  const showMinimum = query.length > 0 && query.trim().length < 3;
  const showResults = open && query.trim().length >= 3;

  function choosePlayer(player: string) {
    setQuery(player);
    setSelected(player);
    setOpen(false);
  }

  function updateQuery(value: string) {
    setQuery(value);
    setOpen(true);

    if (value !== selected) {
      setSelected("");
    }
  }

  return (
    <label className="relative flex flex-col gap-1 text-sm">
      {label}

      <input type="hidden" name="player" value={selected} />

      <input
        type="search"
        value={query}
        onChange={(event) => updateQuery(event.target.value)}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        className="rounded-md border border-neutral-300 bg-white px-2 py-2 dark:border-neutral-700 dark:bg-neutral-950"
      />

      {showMinimum && (
        <div className="text-xs text-neutral-500 dark:text-neutral-400">
          {minimumLabel}
        </div>
      )}

      {showResults && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-auto rounded-md border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-950">
          {results.length === 0 ? (
            <div className="px-3 py-2 text-sm text-neutral-500 dark:text-neutral-400">
              {noResultsLabel}
            </div>
          ) : (
            results.map((player) => (
              <button
                key={player}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  choosePlayer(player);
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-900"
              >
                {player}
              </button>
            ))
          )}
        </div>
      )}
    </label>
  );
}