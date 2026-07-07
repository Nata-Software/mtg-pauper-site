"use client";

import { useState } from "react";

type Result =
  | {
      ok: true;
      kind: "scrape";
      event: string;
      tournamentName: string;
      tournamentId: string;
      date: string | null;
      matches: number;
      standings: number;
    }
  | { ok: true; kind: "upload"; store: string; matches: number; standings: number }
  | { ok: false; error: string };

const inputCls =
  "block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-emerald-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100";
const fileCls =
  "block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 file:mr-3 file:rounded file:border-0 file:bg-neutral-200 file:px-3 file:py-1.5 file:text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:file:bg-neutral-800 dark:file:text-neutral-200";
const labelSpan = "mb-1 block text-xs text-neutral-500 dark:text-neutral-400";
const btnCls =
  "rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50";

export default function UploadPage() {
  const [busy, setBusy] = useState<"scrape" | "upload" | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function submit(
    e: React.FormEvent<HTMLFormElement>,
    endpoint: string,
    kind: "scrape" | "upload",
  ) {
    e.preventDefault();
    setBusy(kind);
    setResult(null);
    try {
      const form = new FormData(e.currentTarget);
      const res = await fetch(endpoint, { method: "POST", body: form });
      const json = (await res.json()) as Result;
      setResult(json);
    } catch (err) {
      setResult({ ok: false, error: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-bold uppercase tracking-tight text-neutral-950 dark:text-white">
        Import data
      </h1>

      {/* --- Import a melee tournament (primary) --- */}
      <h2 className="mt-6 text-lg font-semibold text-neutral-950 dark:text-white">
        Import a melee tournament
      </h2>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Paste a melee.gg tournament URL, choose which league it belongs to, and
        it&apos;s scraped and added automatically. Re-importing the same
        tournament just refreshes it.
      </p>

      <form
        onSubmit={(e) => submit(e, "/api/scrape", "scrape")}
        className="mt-4 space-y-4 rounded-lg border border-neutral-200 bg-neutral-50/70 p-5 dark:border-neutral-800 dark:bg-neutral-900/50"
      >
        <label className="block">
          <span className={labelSpan}>Melee URL</span>
          <input
            name="url"
            placeholder="https://melee.gg/Tournament/View/…"
            className={inputCls}
          />
        </label>

        <label className="block">
          <span className={labelSpan}>Add to league</span>
          <select name="event" defaultValue="" className={inputCls}>
            <option value="" disabled>
              Choose a league…
            </option>
            <option value="Tuesday">Tuesday</option>
            <option value="Friday">Friday</option>
          </select>
        </label>

        <label className="block">
          <span className={labelSpan}>Password</span>
          <input
            type="password"
            name="password"
            autoComplete="off"
            placeholder="Required on the live site"
            className={inputCls}
          />
        </label>

        <input type="hidden" name="store" value="default" />

        <button type="submit" disabled={busy !== null} className={btnCls}>
          {busy === "scrape" ? "Importing…" : "Import tournament"}
        </button>
      </form>

      {/* --- Bulk CSV upload (fallback) --- */}
      <details className="mt-8">
        <summary className="cursor-pointer text-sm font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">
          Bulk CSV upload (Ranking + Rounds tabs) — replaces all data
        </summary>
        <form
          onSubmit={(e) => submit(e, "/api/upload", "upload")}
          className="mt-4 space-y-4 rounded-lg border border-neutral-200 bg-neutral-50/70 p-5 dark:border-neutral-800 dark:bg-neutral-900/50"
        >
          <label className="block">
            <span className={labelSpan}>Store</span>
            <input name="store" defaultValue="default" className={inputCls} />
          </label>
          <label className="block">
            <span className={labelSpan}>Password</span>
            <input
              type="password"
              name="password"
              autoComplete="off"
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className={labelSpan}>Rounds CSV</span>
            <input type="file" name="rounds" accept=".csv,text/csv" className={fileCls} />
          </label>
          <label className="block">
            <span className={labelSpan}>Ranking CSV</span>
            <input type="file" name="ranking" accept=".csv,text/csv" className={fileCls} />
          </label>
          <button type="submit" disabled={busy !== null} className={btnCls}>
            {busy === "upload" ? "Uploading…" : "Upload CSVs"}
          </button>
        </form>
      </details>

      {result && (
        <div
          className={`mt-4 rounded-md border p-4 text-sm ${
            result.ok
              ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
              : "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
          }`}
        >
          {result.ok && result.kind === "scrape" ? (
            <>
              Imported <strong>{result.tournamentName}</strong>
              {result.date ? ` (${result.date})` : ""} into{" "}
              <strong>{result.event}</strong>: {result.matches.toLocaleString()}{" "}
              match rows, {result.standings.toLocaleString()} standings.{" "}
              <a href="/" className="underline">
                View matchups →
              </a>
            </>
          ) : result.ok ? (
            <>
              Uploaded into store <strong>{result.store}</strong>:{" "}
              {result.matches.toLocaleString()} match rows,{" "}
              {result.standings.toLocaleString()} standings.{" "}
              <a href="/" className="underline">
                View matchups →
              </a>
            </>
          ) : (
            <>Error: {result.error}</>
          )}
        </div>
      )}
    </div>
  );
}
