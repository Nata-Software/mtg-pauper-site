"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@/lib/i18n";

type StageRow = {
  ordinal: number;
  name: string;
  date: string | null;
  players: number;
  spotWinners: string[];
};

type Candidate = {
  rank: number;
  username: string;
  player: string;
  record: string | null;
  points: number;
  alreadyClassified: boolean;
  spotHere: boolean;
};

type Awarding = {
  ordinal: number;
  name: string;
  date: string | null;
  candidates: Candidate[];
  suggested: string[];
};

type SpotRow = {
  id: number;
  ordinal: number;
  player: string;
  source: string;
  sourceType: string;
  date: string | null;
  meleeUsername: string | null;
  stageId: number | null;
};

function copy(locale: Locale) {
  const pt = locale === "pt-BR";
  return {
    title: pt ? "Administração do MPL" : "MPL admin",
    subtitle: pt
      ? "Importe um Open, defina quem ficou com as vagas e registre vagas conquistadas fora do MPL."
      : "Import an Open, decide who took its Final spots, and record spots won elsewhere.",
    importTitle: pt ? "1 · Importar um Open" : "1 · Import an Open",
    importDesc: pt
      ? "Cole a URL do torneio no melee. O número da etapa é lido do nome (\"10º Open MPL\" → 10) — preencha se o nome não tiver número."
      : 'Paste the melee tournament URL. The stage number is read from the name ("10º Open MPL" → 10) — fill it in when the name has none.',
    meleeUrl: pt ? "URL do melee" : "Melee URL",
    stageNo: pt ? "Número da etapa" : "Stage number",
    stageNoHint: pt ? "Detectado pelo nome" : "Auto-detected from the name",
    teamEvent: pt
      ? "Evento por equipes (Trios) — fora do ranking de pontos"
      : "Team event (Trios) — excluded from the points ranking",
    importBtn: pt ? "Importar Open" : "Import Open",
    importing: pt ? "Importando…" : "Importing…",
    awardTitle: pt ? "2 · Definir as vagas" : "2 · Award the spots",
    awardDesc: pt
      ? "Escolha o Open. Já vêm marcados os melhores colocados que ainda não têm vaga — se alguém recusar ou já estiver classificado, desmarque e marque o próximo."
      : "Pick the Open. The top finishers who don't already hold a spot come pre-ticked — if someone declines or is already in, untick them and tick the next player down.",
    chooseOpen: pt ? "Open" : "Open",
    chooseOpenPlaceholder: pt ? "Escolha um Open…" : "Choose an Open…",
    howMany: pt ? "Vagas" : "Spots",
    noResults: pt
      ? "Esse Open ainda não tem resultados importados."
      : "That Open has no imported results yet.",
    hasSpot: pt ? "já classificado" : "already classified",
    saveWinners: pt ? "Salvar vagas" : "Save spot winners",
    saving: pt ? "Salvando…" : "Saving…",
    manualTitle: pt ? "3 · Vaga de fora do MPL" : "3 · Spot won elsewhere",
    manualDesc: pt
      ? "Para vagas de lojas parceiras e rankings paralelos — sem melee, só o nome e a origem."
      : "For partner stores and parallel rankings — no melee, just the name and where it came from.",
    playerName: pt ? "Nome do jogador" : "Player name",
    sourceLabel: pt ? "Classificado por" : "Classified via",
    sourcePlaceholder: pt ? "ex.: Arcade - Vaga 2" : "e.g. Arcade - Vaga 2",
    dateLabel: pt ? "Data" : "Date",
    addSpot: pt ? "Adicionar vaga" : "Add spot",
    listTitle: pt ? "Vagas registradas" : "Recorded spots",
    remove: pt ? "Remover" : "Remove",
    confirmRemove: pt ? "Remover a vaga de" : "Remove the spot for",
    password: pt ? "Senha" : "Password",
    passwordHint: pt ? "A mesma senha do admin" : "The same admin password",
    viewPublic: pt ? "Ver a lista pública" : "View the public list",
  };
}

const inputCls =
  "block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-violet-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100";
const labelSpan = "mb-1 block text-xs text-neutral-500 dark:text-neutral-400";
const btnCls =
  "rounded-md bg-[#8b2fb0] px-4 py-2 text-sm font-medium text-white hover:bg-[#7a299b] disabled:opacity-50";
const panelCls =
  "rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950";

export function MplAdmin({
  locale,
  season,
  stages,
  awarding,
  spotCount,
  spots,
}: {
  locale: Locale;
  season: number;
  stages: StageRow[];
  awarding: Awarding | null;
  spotCount: number;
  spots: SpotRow[];
}) {
  const c = copy(locale);
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // Held once and reused by every form on the page, so awarding spots after an
  // import doesn't mean typing it three times.
  const [password, setPassword] = useState("");

  async function post(
    endpoint: string,
    form: FormData,
    key: string,
  ): Promise<void> {
    setBusy(key);
    setMsg(null);
    form.set("password", password);
    try {
      const res = await fetch(endpoint, { method: "POST", body: form });
      const json = await res.json();
      if (!json.ok) {
        setMsg({ ok: false, text: String(json.error ?? "Failed.") });
      } else {
        setMsg({ ok: true, text: describe(json, c) });
        router.refresh();
      }
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-bold uppercase tracking-tight text-neutral-950 dark:text-white">
        {c.title} · {season}
      </h1>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        {c.subtitle}{" "}
        <Link href="/mpl?view=classified" className="text-violet-600 hover:underline dark:text-violet-400">
          {c.viewPublic}
        </Link>
      </p>

      <label className="mt-5 block max-w-xs">
        <span className={labelSpan}>{c.password}</span>
        <input
          type="password"
          autoComplete="off"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={c.passwordHint}
          className={inputCls}
        />
      </label>

      {msg && (
        <div
          className={`mt-4 rounded-md border p-3 text-sm ${
            msg.ok
              ? "border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200"
              : "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* 1 — import */}
      <section className={`mt-6 ${panelCls}`}>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[#8b2fb0] dark:text-violet-400">
          {c.importTitle}
        </h2>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          {c.importDesc}
        </p>
        <form
          className="mt-3 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            f.set("event", "MPL Open");
            void post("/api/scrape", f, "import");
          }}
        >
          <label className="block">
            <span className={labelSpan}>{c.meleeUrl}</span>
            <input name="url" placeholder="https://melee.gg/Tournament/View/…" className={inputCls} />
          </label>
          <label className="block">
            <span className={labelSpan}>{c.stageNo}</span>
            <input
              name="ordinal"
              type="number"
              min="1"
              inputMode="numeric"
              placeholder={c.stageNoHint}
              className={inputCls}
            />
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" name="teamEvent" className="mt-0.5 h-4 w-4 rounded" />
            <span className="text-xs text-neutral-500 dark:text-neutral-400">{c.teamEvent}</span>
          </label>
          <button type="submit" disabled={busy !== null} className={btnCls}>
            {busy === "import" ? c.importing : c.importBtn}
          </button>
        </form>
      </section>

      {/* 2 — award */}
      <section className={`mt-5 ${panelCls}`}>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[#8b2fb0] dark:text-violet-400">
          {c.awardTitle}
        </h2>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          {c.awardDesc}
        </p>

        <form method="get" className="mt-3 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className={labelSpan}>{c.chooseOpen}</span>
            <select
              name="stage"
              defaultValue={awarding ? String(awarding.ordinal) : ""}
              className={inputCls}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
            >
              <option value="" disabled>
                {c.chooseOpenPlaceholder}
              </option>
              {stages.map((s) => (
                <option key={s.ordinal} value={s.ordinal}>
                  {s.ordinal}. {s.name}
                  {s.date ? ` · ${s.date}` : ""}
                  {s.spotWinners.length ? ` · ✓ ${s.spotWinners.join(", ")}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block w-24">
            <span className={labelSpan}>{c.howMany}</span>
            <input
              name="spots"
              type="number"
              min="0"
              max="16"
              defaultValue={spotCount}
              className={inputCls}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
            />
          </label>
        </form>

        {awarding && awarding.candidates.length === 0 && (
          <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">{c.noResults}</p>
        )}

        {awarding && awarding.candidates.length > 0 && (
          <form
            className="mt-4"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              f.set("action", "award");
              f.set("stageOrdinal", String(awarding.ordinal));
              void post("/api/mpl/spots", f, "award");
            }}
          >
            <ul className="divide-y divide-neutral-100 dark:divide-neutral-900">
              {awarding.candidates.map((cand) => (
                <li key={cand.username} className="flex items-center gap-3 py-1.5">
                  <input
                    type="checkbox"
                    name="winner"
                    value={cand.username}
                    defaultChecked={
                      cand.spotHere || awarding.suggested.includes(cand.username)
                    }
                    className="h-4 w-4 shrink-0 rounded"
                  />
                  <span className="w-8 shrink-0 text-right text-xs tabular-nums text-neutral-400">
                    #{cand.rank}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-neutral-900 dark:text-neutral-100">
                    {cand.player}
                    <span className="ml-2 text-xs text-neutral-400">{cand.username}</span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
                    {cand.record} · {cand.points}
                  </span>
                  {cand.alreadyClassified && !cand.spotHere && (
                    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                      {c.hasSpot}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <button type="submit" disabled={busy !== null} className={`mt-3 ${btnCls}`}>
              {busy === "award" ? c.saving : c.saveWinners}
            </button>
          </form>
        )}
      </section>

      {/* 3 — manual */}
      <section className={`mt-5 ${panelCls}`}>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[#8b2fb0] dark:text-violet-400">
          {c.manualTitle}
        </h2>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{c.manualDesc}</p>
        <form
          className="mt-3 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            f.set("action", "manual");
            void post("/api/mpl/spots", f, "manual");
            e.currentTarget.reset();
          }}
        >
          <label className="block">
            <span className={labelSpan}>{c.playerName}</span>
            <input name="player" className={inputCls} />
          </label>
          <label className="block">
            <span className={labelSpan}>{c.sourceLabel}</span>
            <input name="source" placeholder={c.sourcePlaceholder} className={inputCls} />
          </label>
          <label className="block max-w-[12rem]">
            <span className={labelSpan}>{c.dateLabel}</span>
            <input name="date" type="date" className={inputCls} />
          </label>
          <button type="submit" disabled={busy !== null} className={btnCls}>
            {busy === "manual" ? c.saving : c.addSpot}
          </button>
        </form>
      </section>

      {/* 4 — current list */}
      <section className={`mt-5 ${panelCls}`}>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[#8b2fb0] dark:text-violet-400">
          {c.listTitle} ({spots.length})
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-900">
              {spots.map((s) => (
                <tr key={s.id}>
                  <td className="py-1.5 pr-3 text-xs tabular-nums text-neutral-400">{s.ordinal}</td>
                  <td className="py-1.5 pr-3 font-medium text-neutral-900 dark:text-neutral-100">
                    {s.player}
                    {s.meleeUsername && (
                      <span className="ml-2 text-xs font-normal text-neutral-400">
                        {s.meleeUsername}
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 pr-3 text-xs text-neutral-500 dark:text-neutral-400">
                    {s.source}
                  </td>
                  <td className="py-1.5 pr-3 text-right text-xs tabular-nums text-neutral-400">
                    {s.date ?? "—"}
                  </td>
                  <td className="py-1.5 text-right">
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => {
                        if (!confirm(`${c.confirmRemove} ${s.player}?`)) return;
                        const f = new FormData();
                        f.set("action", "remove");
                        f.set("id", String(s.id));
                        void post("/api/mpl/spots", f, `remove-${s.id}`);
                      }}
                      className="text-xs text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
                    >
                      {c.remove}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function describe(json: Record<string, unknown>, c: ReturnType<typeof copy>): string {
  if (json.kind === "mpl") {
    return `${json.tournamentName} · ${c.stageNo} ${json.ordinal} · ${json.results} ${
      json.replaced ? "(updated)" : ""
    }`;
  }
  if (json.action === "award") {
    return `${json.stage}: ${json.added} ✓`;
  }
  if (json.action === "manual") return `${json.player} ✓`;
  if (json.action === "remove") return `${json.player} ✗`;
  return "OK";
}
