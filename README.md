# Home Block One

A small self-hosted web app for a home training block and the food plan that goes with it. One app for two screens: on a computer it opens on the workout; on a phone it opens on today's meals.

It doesn't duplicate data that belongs elsewhere: sets, weights and routines are saved in a companion **gym log** app, and the shopping list goes to a companion **shopping list** app. This app is the "what to do today" layer: the menu, the recipes and a guided workout.

## What it does

- **Today:** the day's meals in order with protein, carbs, fat and calories against the daily target, and whether it's a training day. Every day of the two-week menu is one tap away.
- **Menu:** both weeks, lunch and dinner. Copy a meal to other days, swap two meals, or pick another recipe. On a computer, drag a meal onto another one and choose copy or swap. Every change can be undone, and the whole menu can be reset. Each day and the week average show their numbers; a day under the protein floor is flagged.
- **Cook:** eight recipes. Ingredients first, then one step per screen. Opened from a meal, the carb (rice, papas, spaghetti, bread) or protein (chicken, tuna, eggs, mackerel) can be swapped for that meal only; the amount keeps the same carbs or protein, and the numbers update.
- **Buy:** big shop, top-up and pantry lists worked out from the current menu with the cheapest pack mix, in the store's walking order. "Send to Mercheck" puts the items on a list in the shopping-list app, where they're ticked while shopping.
- **Train:** three home sessions (A, B, C) with start and end photos for every exercise, every warm-up move and every circuit move. Each set's weight and reps are logged straight into the gym log app under today's date, and the next session starts from those numbers. The sessions are added to the gym log as routines the first time.
- **Settings:** sets per exercise, food targets and costs, account.

Settings and menu edits are saved on the device first and synced to the account, so a computer and a phone show the same thing. The app, the plan and the photos work offline once loaded; sets logged offline are sent when the gym log can be reached.

## How it's built

- `frontend/`: a plain HTML, CSS and JavaScript PWA. No framework, no third-party requests; fonts are self-hosted. `planmath.js` holds the food maths (meal ingredients after swaps, macros, shopping lists) and is shared with the tests. `data/plan.json` is the plan data; `exercises.js` the sessions.
- `backend/`: Node 24, TypeScript and Express. Serves the app with a strict Content-Security-Policy and a small API. Settings and the edited menu are stored in SQLite through `node:sqlite`.
- Sign-in uses a separate accounts service reached over a private Docker network (`ACCOUNTS_URL`, `ACCOUNTS_SERVICE_TOKEN`).
- `src/bridges.ts` talks to the companion apps over the same network (`GYMAKER_URL`, `MERCHECK_URL`), passing the signed-in user's own token, so it can only read and write that user's data.
- `tools/build_plan.py` builds `plan.json` from a store catalogue file and downloads the product photos. It also stores its own results for the unedited menu, which the tests compare with `planmath.js`.

### API

All routes except sign-in need the session cookie.

| Method | Path | |
| --- | --- | --- |
| POST | `/api/auth/login`, `/api/auth/signup`, `/api/auth/logout` | Session |
| GET | `/api/auth/me` | Current user |
| GET | `/api/state` | Settings and the edited menu, each with `updatedAt` |
| PUT | `/api/state/:key` | `settings` or `menu`; `{ value, updatedAt }`. An older change never overwrites a newer one. |
| POST | `/api/gym/last` | `{ names, date }`: each exercise's sets from the last earlier workout, and today's |
| POST | `/api/gym/log` | `{ date, name, sets }`: replaces that exercise's sets in that day's workout |
| POST | `/api/gym/routines` | Adds the given routines if missing; never changes existing ones |
| POST | `/api/list/send` | `{ list, items }`: puts the items on the named list as "to buy" |

## Run locally

```bash
cd backend
npm install
npm test
# stand-ins for the accounts service (demo / demo), the gym log and the shopping list
node ../tools/dev-accounts.mjs &
ACCOUNTS_URL=http://127.0.0.1:4699 GYMAKER_URL=http://127.0.0.1:4698 MERCHECK_URL=http://127.0.0.1:4697 \
  ACCOUNTS_SERVICE_TOKEN=dev COOKIE_SECURE=false npm run dev
```

Open `http://localhost:4480`.

The server fingerprints `styles.css`, `exercises.js`, `planmath.js`, `app.js` and `data/plan.json` when it starts, so restart it after changing any of them, or the browser keeps the old copy.

Rebuild the plan after changing the menu, recipes or prices:

```bash
python tools/build_plan.py
```

## Deploy

A push to `main` builds the image and publishes it to GitHub Container Registry. On the server:

```bash
cp .env.example .env   # fill in the accounts token
docker compose up -d
```

The container joins the accounts service's external `accounts` network, which the companion apps are on too, and keeps its database in `./data`. A container auto-updater such as Watchtower can pull new images.
