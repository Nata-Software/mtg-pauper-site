# melee.gg data access — reference

Two ways to pull tournament data from melee. Both confirmed working from a
plain Node/datacenter environment (no Cloudflare challenge).

## 1. Official REST API (preferred for the future)

- Swagger UI: <https://melee.gg/swagger/ui/index>
- Spec JSON: `https://melee.gg/swagger/docs/<version>` (e.g. `v0.3.64.31`)
- Base: `https://melee.gg/api`
- **Auth: HTTP Basic**, per-user. "Requests using these credentials have access
  to tournaments that user has access to on the Melee site." Without auth every
  `/api/*` call returns `401`. → we'd store a melee username/password as secrets.

Key endpoints (all `GET`, `{id}` is a tournament/decklist/player id):

| Endpoint                        | Returns                         |
| ------------------------------- | ------------------------------- |
| `/api/tournament/{id}`          | tournament details              |
| `/api/tournament/list`          | tournaments the user can access |
| `/api/decklist/{id}`            | one decklist **with cards**     |
| `/api/decklist/list/{id}`       | all decklists in a tournament   |
| `/api/decklist/player/{id}`     | a player's decklists            |
| `/api/match/list/round/{id}`    | matches for a round             |
| `/api/standing/list/round/{id}` | standings for a round           |
| `/api/player/{id}`              | player details                  |

## 2. Public web endpoints (what the app scrapes today, no auth)

Used by `src/lib/melee.ts`. No credentials needed; reads public tournaments.

- `GET  /Tournament/View/{id}` — HTML; round ids are the `data-id`s inside
  `#pairings-round-selector-container`.
- `POST /Match/GetRoundMatches/{roundId}` — DataTables JSON. Each competitor
  carries `Decklists[].DecklistName` + `DecklistId`, `GameWins`, `ResultString`.
- `POST /Standing/GetRoundStandings` (body `roundId=...`) — standings JSON with
  `Team.Players[0]`, `Points`, `Rank`, `Decklists[]`.
- `GET  /Decklist/View/{guid}` — HTML; renders the full card list
  (`{{Quantity}} {{CardName}}` linking `/Card/View/{{CardId}}`).

### Enumerating an organization's tournaments (not in the REST spec)

- `POST /Hub/SearchOrganizationTournaments` with body `id=<orgId>` + DataTables
  params. Org **2833 = Mont CardShop**. Returns rows with `ID`, `Name`,
  `StartDate`, `ParticipatingCount`, `Game` (but **not** the Pauper/format flag —
  check that per-tournament via the match/standing `Format` field or the name).
  As of writing: **529 total** tournaments, **~94** with "Pauper" in the name.

## Notes

- The scrape path already gives deck **names + DecklistId** without auth. Full
  **card lists** come from `/Decklist/View/{guid}` (no auth) or
  `/api/decklist/{id}` (auth) — needed for card-based archetype classification.
- For automated future updates, the REST API + Basic auth is the stable choice;
  the scrape endpoints are undocumented and can change.
