"use client";

import Link from "next/link";
import { useState } from "react";
import { t, type Locale } from "@/lib/i18n";

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
      warnings?: string[];
    }
  | {
      ok: true;
      kind: "upload";
      store: string;
      matches: number;
      standings: number;
    }
  | { ok: false; error: string };

const inputCls =
  "block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-violet-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100";
const fileCls =
  "block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 file:mr-3 file:rounded file:border-0 file:bg-neutral-200 file:px-3 file:py-1.5 file:text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:file:bg-neutral-800 dark:file:text-neutral-200";
const labelSpan = "mb-1 block text-xs text-neutral-500 dark:text-neutral-400";
const btnCls =
  "rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50";

export function UploadForm({ locale }: { locale: Locale }) {
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
        {t(locale, "upload.title")}
      </h1>

      {/* --- Import a melee tournament (primary) --- */}
      <h2 className="mt-6 text-lg font-semibold text-neutral-950 dark:text-white">
        {t(locale, "upload.meleeHeading")}
      </h2>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        {t(locale, "upload.meleeDesc")}
      </p>

      <form
        onSubmit={(e) => submit(e, "/api/scrape", "scrape")}
        className="mt-4 space-y-4 rounded-lg border border-neutral-200 bg-neutral-50/70 p-5 dark:border-neutral-800 dark:bg-neutral-900/50"
      >
        <label className="block">
          <span className={labelSpan}>{t(locale, "upload.meleeUrlLabel")}</span>
          <input
            name="url"
            placeholder="https://melee.gg/Tournament/View/…"
            className={inputCls}
          />
        </label>

        <label className="block">
          <span className={labelSpan}>{t(locale, "upload.addToLeague")}</span>
          <select name="event" defaultValue="" className={inputCls}>
            <option value="" disabled>
              {t(locale, "upload.chooseLeague")}
            </option>
            <option value="Tuesday">
              {t(locale, "standings.tab.tuesday")}
            </option>
            <option value="Friday">{t(locale, "standings.tab.friday")}</option>
          </select>
        </label>

        <label className="block">
          <span className={labelSpan}>{t(locale, "upload.passwordLabel")}</span>
          <input
            type="password"
            name="password"
            autoComplete="off"
            placeholder={t(locale, "upload.passwordPlaceholder")}
            className={inputCls}
          />
        </label>

        <input type="hidden" name="store" value="default" />

        <button type="submit" disabled={busy !== null} className={btnCls}>
          {busy === "scrape"
            ? t(locale, "upload.importing")
            : t(locale, "upload.importBtn")}
        </button>
      </form>

      {/* --- Bulk CSV upload (fallback) --- */}
      <details className="mt-8">
        <summary className="cursor-pointer text-sm font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">
          {t(locale, "upload.bulkSummary")}
        </summary>
        <form
          onSubmit={(e) => submit(e, "/api/upload", "upload")}
          className="mt-4 space-y-4 rounded-lg border border-neutral-200 bg-neutral-50/70 p-5 dark:border-neutral-800 dark:bg-neutral-900/50"
        >
          <label className="block">
            <span className={labelSpan}>{t(locale, "upload.storeLabel")}</span>
            <input name="store" defaultValue="default" className={inputCls} />
          </label>
          <label className="block">
            <span className={labelSpan}>
              {t(locale, "upload.passwordLabel")}
            </span>
            <input
              type="password"
              name="password"
              autoComplete="off"
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className={labelSpan}>
              {t(locale, "upload.roundsCsvLabel")}
            </span>
            <input
              type="file"
              name="rounds"
              accept=".csv,text/csv"
              className={fileCls}
            />
          </label>
          <label className="block">
            <span className={labelSpan}>
              {t(locale, "upload.rankingCsvLabel")}
            </span>
            <input
              type="file"
              name="ranking"
              accept=".csv,text/csv"
              className={fileCls}
            />
          </label>
          <button type="submit" disabled={busy !== null} className={btnCls}>
            {busy === "upload"
              ? t(locale, "upload.uploading")
              : t(locale, "upload.uploadBtn")}
          </button>
        </form>
      </details>

      {result && (
        <div
          className={`mt-4 rounded-md border p-4 text-sm ${
            result.ok
              ? "border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200"
              : "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
          }`}
        >
          {result.ok && result.kind === "scrape" ? (
            <>
              {t(locale, "upload.imported")}{" "}
              <strong>{result.tournamentName}</strong>
              {result.date ? ` (${result.date})` : ""}{" "}
              {t(locale, "upload.into")} <strong>{result.event}</strong>:{" "}
              {result.matches.toLocaleString()} {t(locale, "upload.matchRows")},{" "}
              {result.standings.toLocaleString()}{" "}
              {t(locale, "upload.standingsRows")}.{" "}
              <Link href="/" className="underline">
                {t(locale, "upload.viewMatchups")}
              </Link>
              {result.warnings && result.warnings.length > 0 && (
                <div className="mt-3 rounded-md border border-amber-400 bg-amber-50 p-3 text-amber-900 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-200">
                  <div className="font-semibold">
                    ⚠ {t(locale, "upload.partialWarning")}
                  </div>
                  <ul className="mt-1 list-disc pl-5">
                    {result.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : result.ok ? (
            <>
              {t(locale, "upload.uploadedIntoStore")}{" "}
              <strong>{result.store}</strong>: {result.matches.toLocaleString()}{" "}
              {t(locale, "upload.matchRows")},{" "}
              {result.standings.toLocaleString()}{" "}
              {t(locale, "upload.standingsRows")}.{" "}
              <Link href="/" className="underline">
                {t(locale, "upload.viewMatchups")}
              </Link>
            </>
          ) : (
            <>
              {t(locale, "upload.error")}: {result.error}
            </>
          )}
        </div>
      )}
    </div>
  );
}
