# abduqodirteacher — Ingliz tili V2

The school English website: student side in Uzbek, teacher panel in English.
Hosted on GitHub Pages (this repository's root `index.html`), data in Supabase (`abduqodir-teacher`).

## Layout
- `index.html` — the whole site in one file. **Built, do not edit by hand.**
- `app/src/*.js`, `app/vendor/*` — the source. Build with `python3 app/build.py` (writes `index.html`).
- `app/src/net.js` — the database link: login with the school accounts, loads the data, sends every change.
- `app/tools/assign.mjs` — turns special code into the SQL that sends homework (same checks as the Assign page).
- `app/test/` — local test kit (local Postgres + a stand-in for Supabase + headless Chrome).
- `supabase/` — database migrations. `21_v2_site.sql` adds the V2 tables and API next to the old ones;
  `22_v2_import.sql` copies people, classes, timetable, gold and learned words from the old site once.
- `old/` — the previous site, kept as it was (its data is untouched in the database).

## Rules
- Logins live in `public.users` / `public.sessions` and are checked by `public.login()`; V2 never stores passwords in the page.
- V2 only writes `v2_*` tables. Old tables are read once by the import and never changed.
- Assigning from chat: write the code (Special Code Book), run `node app/tools/assign.mjs code.txt --groups "A2" [--week YYYY-MM-DD] --ctx ctx.json`,
  show the summary, and only after the teacher says yes run the printed SQL on the database.
