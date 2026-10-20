# Growth Academy — Ace

The training companion for Growth Academy. Node + Express, data in one JSON file on the Render disk.

- `server.js` — the app server
- `lib/migrate.js` — one-off upgrade of the old app's data (backs it up first, runs once)
- `content/academy.json` — 10-day content, reviews, book checklists, KPI cheat sheet, traffic lights
- `public/` — the app screens
- `node test.js` — 95 checks, including upgrading a copy of old-format data

Environment (already set on Render): `DB_PATH`, `JWT_SECRET`, `NODE_ENV`. Optional: `OFFICE_TZ` (defaults to Australia/Brisbane).
