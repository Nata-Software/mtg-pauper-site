"use client";

import { useState } from "react";

type Result =
  | { ok: true; store: string; matches: number; standings: number }
  | { ok: false; error: string };

export default function UploadPage() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const form = new FormData(e.currentTarget);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const json = (await res.json()) as Result;
      setResult(json);
    } catch (err) {
      setResult({ ok: false, error: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 file:mr-3 file:rounded file:border-0 file:bg-neutral-200 file:px-3 file:py-1.5 file:text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:file:bg-neutral-800 dark:file:text-neutral-200";

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-bold uppercase tracking-tight text-neutral-950 dark:text-white">
        Upload data
      </h1>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Export the <strong>Ranking</strong> and <strong>Rounds</strong> tabs
        from the Google Sheet as CSV and upload them here. Uploading replaces the
        existing data for the chosen store.
      </p>

      <form
        onSubmit={onSubmit}
        className="mt-6 space-y-4 rounded-lg border border-neutral-200 bg-neutral-50/70 p-5 dark:border-neutral-800 dark:bg-neutral-900/50"
      >
        <label className="block">
          <span className="mb-1 block text-xs text-neutral-500 dark:text-neutral-400">Store</span>
          <input
            name="store"
            defaultValue="default"
            className={inputCls.replace("file:mr-3", "")}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-neutral-500 dark:text-neutral-400">
            Upload password
          </span>
          <input
            type="password"
            name="password"
            autoComplete="off"
            placeholder="Required on the live site"
            className={inputCls.replace("file:mr-3", "")}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-neutral-500 dark:text-neutral-400">
            Rounds CSV
          </span>
          <input
            type="file"
            name="rounds"
            accept=".csv,text/csv"
            className={inputCls}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-neutral-500 dark:text-neutral-400">
            Ranking CSV
          </span>
          <input
            type="file"
            name="ranking"
            accept=".csv,text/csv"
            className={inputCls}
          />
        </label>

        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {busy ? "Uploading…" : "Upload"}
        </button>
      </form>

      {result && (
        <div
          className={`mt-4 rounded-md border p-4 text-sm ${
            result.ok
              ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
              : "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
          }`}
        >
          {result.ok ? (
            <>
              Imported into store <strong>{result.store}</strong>:{" "}
              {result.matches.toLocaleString()} match rows,{" "}
              {result.standings.toLocaleString()} standing rows.{" "}
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
