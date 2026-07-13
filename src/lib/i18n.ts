export type Locale = "en" | "pt-BR";

export const LOCALE_COOKIE = "locale";
export const DEFAULT_LOCALE: Locale = "en";

export function parseLocale(value: string | undefined | null): Locale {
  return value === "pt-BR" ? "pt-BR" : DEFAULT_LOCALE;
}

const dict = {
  "nav.matchups": { en: "Matchups", "pt-BR": "Confrontos" },
  "nav.standings": { en: "Standings", "pt-BR": "Classificação" },
  "nav.league": { en: "League", "pt-BR": "Liga" },
  "nav.upload": { en: "Upload", "pt-BR": "Importar" },

  "matchups.title": {
    en: "Top MTG Pauper Archetypes Winrates",
    "pt-BR": "Taxas de Vitória dos Principais Arquétipos de MTG Pauper",
  },
  "matchups.subtitle": {
    en: 'Winrate against the most present archetypes (at least {minPct}% of the matches){eventClause} between {range} — {count} archetypes. Draws are excluded from winrate.',
    "pt-BR":
      'Taxa de vitória contra os arquétipos mais presentes (pelo menos {minPct}% das partidas){eventClause} entre {range} — {count} arquétipos. Empates são excluídos da taxa de vitória.',
  },
  "matchups.inEvent": { en: ' in "{event}"', "pt-BR": ' em "{event}"' },
  "matchups.noDataBefore": {
    en: "No data yet. Go to ",
    "pt-BR": "Ainda não há dados. Vá para ",
  },
  "matchups.noDataAfter": {
    en: " to import the Ranking and Rounds CSVs.",
    "pt-BR": " para importar os CSVs de Ranking e Rounds.",
  },
  "matchups.rangeStart": { en: "start", "pt-BR": "início" },
  "matchups.rangeNow": { en: "now", "pt-BR": "agora" },
  "matchups.rangeTo": { en: "to", "pt-BR": "até" },
  "matchups.allTime": { en: "all time", "pt-BR": "todo o período" },

  "filter.store": { en: "Store", "pt-BR": "Loja" },
  "filter.event": { en: "Event", "pt-BR": "Evento" },
  "filter.allEvents": { en: "All events", "pt-BR": "Todos os eventos" },
  "filter.from": { en: "From", "pt-BR": "De" },
  "filter.to": { en: "To", "pt-BR": "Até" },
  "filter.minPct": { en: "Min % of matches", "pt-BR": "Mín. % das partidas" },
  "filter.sortBy": { en: "Sort by", "pt-BR": "Ordenar por" },
  "filter.sort.matches": { en: "Number of matches", "pt-BR": "Número de partidas" },
  "filter.sort.winrate": { en: "Winrate", "pt-BR": "Taxa de vitória" },
  "filter.sort.alpha": { en: "Alphabetical", "pt-BR": "Alfabético" },
  "filter.apply": { en: "Apply", "pt-BR": "Aplicar" },
  "filter.reset": { en: "Reset", "pt-BR": "Limpar" },

  "matrix.noMatches": {
    en: "No matches for these filters yet.",
    "pt-BR": "Nenhuma partida para esses filtros ainda.",
  },
  "matrix.archetype": { en: "Archetype", "pt-BR": "Arquétipo" },
  "matrix.overall": { en: "Overall", "pt-BR": "Geral" },
  "matrix.matchesSuffix": { en: " matches", "pt-BR": " partidas" },
  "matrix.focusHint": {
    en: "One archetype row may be focused at a time. Click the focused row again to return to the original table order.",
    "pt-BR":
      "Apenas uma linha de arquétipo pode ser focada por vez. Clique na linha focada novamente para retornar à ordem original da tabela.",
  },
  "matrix.focused": { en: "focused", "pt-BR": "focado" },
  "matrix.clickToFocus": { en: "Click to focus this row", "pt-BR": "Clique para focar esta linha" },
  "matrix.clickToUnfocus": { en: "Click to remove focus", "pt-BR": "Clique para remover o foco" },

  "standings.title": { en: "Standings", "pt-BR": "Classificação" },
  "standings.subtitle": {
    en: "Player performance. The yearly view ranks by matches played; the monthly views rank by points (win 3 · draw 1 · loss 0). Byes are excluded from standings.",
    "pt-BR":
      "Desempenho dos jogadores. A visão anual classifica por partidas jogadas; as visões mensais classificam por pontos (vitória 3 · empate 1 · derrota 0). Byes são excluídos da classificação.",
  },
  "standings.tab.year": { en: "Whole year", "pt-BR": "Ano inteiro" },
  "standings.tab.tuesday": { en: "Tuesday", "pt-BR": "Terça-feira" },
  "standings.tab.friday": { en: "Friday", "pt-BR": "Sexta-feira" },
  "standings.tab.tournamentData": { en: "Tournament Data", "pt-BR": "Dados do Torneio" },
  "standings.noMonthMatches": {
    en: "No {event} matches recorded yet.",
    "pt-BR": "Nenhuma partida de {event} registrada ainda.",
  },
  "standings.yearView.title": { en: "Whole year — {year}", "pt-BR": "Ano inteiro — {year}" },
  "standings.yearView.subtitle": {
    en: "All events. Win / loss / draw rate per player, ranked by matches played by default. Byes are excluded. Click a name for their per-deck breakdown, or a column header to change sorting.",
    "pt-BR":
      "Todos os eventos. Taxa de vitória/derrota/empate por jogador, classificado por partidas jogadas por padrão. Byes são excluídos. Clique em um nome para ver o detalhamento por deck, ou em um cabeçalho de coluna para mudar a ordenação.",
  },
  "standings.monthly.subtitle": {
    en: "Ranked by points by default (win 3 · draw 1 · loss 0). Byes are excluded. Click a column header to change sorting.",
    "pt-BR":
      "Classificado por pontos por padrão (vitória 3 · empate 1 · derrota 0). Byes são excluídos. Clique em um cabeçalho de coluna para mudar a ordenação.",
  },
  "standings.older": { en: "← Older", "pt-BR": "← Mais antigo" },
  "standings.newer": { en: "Newer →", "pt-BR": "Mais recente →" },

  "table.player": { en: "Player", "pt-BR": "Jogador" },
  "table.matches": { en: "Matches", "pt-BR": "Partidas" },
  "table.winPct": { en: "Win %", "pt-BR": "Vitória %" },
  "table.lossPct": { en: "Loss %", "pt-BR": "Derrota %" },
  "table.drawPct": { en: "Draw %", "pt-BR": "Empate %" },
  "table.points": { en: "Points", "pt-BR": "Pontos" },
  "table.wld": { en: "W–L–D", "pt-BR": "V–D–E" },
  "table.deck": { en: "Deck", "pt-BR": "Deck" },
  "table.noMatchesPeriod": {
    en: "No matches in this period yet.",
    "pt-BR": "Nenhuma partida neste período ainda.",
  },
  "table.noMatchesMonth": {
    en: "No matches in this month yet.",
    "pt-BR": "Nenhuma partida neste mês ainda.",
  },
  "table.showingTop": {
    en: "Showing top {shown} of {total} players",
    "pt-BR": "Mostrando os {shown} melhores de {total} jogadores",
  },

  "deck.titlePrefix": { en: "Win rate by deck", "pt-BR": "Taxa de vitória por deck" },
  "deck.subtitle": {
    en: "{total} matches across {count} {deckWord}. Byes included.",
    "pt-BR": "{total} partidas em {count} {deckWord}. Byes incluídos.",
  },
  "deck.deckWord.singular": { en: "deck", "pt-BR": "deck" },
  "deck.deckWord.plural": { en: "decks", "pt-BR": "decks" },
  "deck.back": { en: "← Back to players", "pt-BR": "← Voltar para jogadores" },
  "deck.noMatches": {
    en: "No matches for this player in this period.",
    "pt-BR": "Nenhuma partida para este jogador neste período.",
  },

  "upload.title": { en: "Import data", "pt-BR": "Importar dados" },
  "upload.meleeHeading": { en: "Import a melee tournament", "pt-BR": "Importar um torneio do melee" },
  "upload.meleeDesc": {
    en: "Paste a melee.gg tournament URL, choose which league it belongs to, and it's scraped and added automatically. Re-importing the same tournament just refreshes it.",
    "pt-BR":
      "Cole a URL de um torneio do melee.gg, escolha a qual liga ele pertence, e ele será coletado e adicionado automaticamente. Reimportar o mesmo torneio apenas o atualiza.",
  },
  "upload.meleeUrlLabel": { en: "Melee URL", "pt-BR": "URL do Melee" },
  "upload.addToLeague": { en: "Add to league", "pt-BR": "Adicionar à liga" },
  "upload.chooseLeague": { en: "Choose a league…", "pt-BR": "Escolha uma liga…" },
  "upload.passwordLabel": { en: "Password", "pt-BR": "Senha" },
  "upload.passwordPlaceholder": {
    en: "Required on the live site",
    "pt-BR": "Obrigatório no site em produção",
  },
  "upload.importBtn": { en: "Import tournament", "pt-BR": "Importar torneio" },
  "upload.importing": { en: "Importing…", "pt-BR": "Importando…" },
  "upload.bulkSummary": {
    en: "Bulk CSV upload (Ranking + Rounds tabs) — replaces all data",
    "pt-BR": "Upload de CSV em lote (abas Ranking + Rounds) — substitui todos os dados",
  },
  "upload.storeLabel": { en: "Store", "pt-BR": "Loja" },
  "upload.roundsCsvLabel": { en: "Rounds CSV", "pt-BR": "CSV de Rounds" },
  "upload.rankingCsvLabel": { en: "Ranking CSV", "pt-BR": "CSV de Ranking" },
  "upload.uploadBtn": { en: "Upload CSVs", "pt-BR": "Enviar CSVs" },
  "upload.uploading": { en: "Uploading…", "pt-BR": "Enviando…" },
  "upload.imported": { en: "Imported", "pt-BR": "Torneio importado:" },
  "upload.into": { en: "into", "pt-BR": "na liga" },
  "upload.matchRows": { en: "match rows", "pt-BR": "linhas de partidas" },
  "upload.standingsRows": { en: "standings", "pt-BR": "classificações" },
  "upload.viewMatchups": { en: "View matchups →", "pt-BR": "Ver confrontos →" },
  "upload.uploadedIntoStore": { en: "Uploaded into store", "pt-BR": "Enviado para a loja" },
  "upload.error": { en: "Error", "pt-BR": "Erro" },

  "league.title": { en: "League", "pt-BR": "Liga" },
  "league.subtitle": {
    en: "Points-based ranking for each weekly league (win 3 · draw 1 · loss 0), for the selected month.",
    "pt-BR":
      "Classificação por pontos de cada liga semanal (vitória 3 · empate 1 · derrota 0), no mês selecionado.",
  },
  "league.year": { en: "Year", "pt-BR": "Ano" },
  "league.month": { en: "Month", "pt-BR": "Mês" },
  "league.noData": {
    en: "No matches for this league in the selected month.",
    "pt-BR": "Nenhuma partida dessa liga no mês selecionado.",
  },

  "nextTournaments.title": {
    en: "Next Tournaments",
    "pt-BR": "Próximos Torneios",
  },
  "nextTournaments.subtitle": {
    en: "Upcoming tournaments happening today or later, sorted by date, time, then name.",
    "pt-BR":
      "Torneios futuros acontecendo hoje ou depois, ordenados por data, horário e nome.",
  },
  "nextTournaments.source": {
    en: "Source: Melee organization page",
    "pt-BR": "Fonte: página da organização no Melee",
  },

  "month.01": { en: "January", "pt-BR": "Janeiro" },
  "month.02": { en: "February", "pt-BR": "Fevereiro" },
  "month.03": { en: "March", "pt-BR": "Março" },
  "month.04": { en: "April", "pt-BR": "Abril" },
  "month.05": { en: "May", "pt-BR": "Maio" },
  "month.06": { en: "June", "pt-BR": "Junho" },
  "month.07": { en: "July", "pt-BR": "Julho" },
  "month.08": { en: "August", "pt-BR": "Agosto" },
  "month.09": { en: "September", "pt-BR": "Setembro" },
  "month.10": { en: "October", "pt-BR": "Outubro" },
  "month.11": { en: "November", "pt-BR": "Novembro" },
  "month.12": { en: "December", "pt-BR": "Dezembro" },
} as const satisfies Record<string, Record<Locale, string>>;

export type TranslationKey = keyof typeof dict;

export function t(
  locale: Locale,
  key: TranslationKey,
  vars?: Record<string, string | number>,
): string {
  let str: string = dict[key][locale];
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replaceAll(`{${k}}`, String(v));
    }
  }
  return str;
}
