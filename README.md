# Home Block One

A small self-hosted web app for a home training block and the food plan that goes with it. One app for two screens: on a computer it opens on the workout; on a phone it opens on today's meals.

It doesn't duplicate data that belongs elsewhere: sets, weights and routines are saved in a companion **gym log** app, and the shopping list goes to a companion **shopping list** app. This app is the "what to do today" layer: the menu, the recipes and a guided workout.

## What it does

- **Today:** the day's meals in order with protein, carbs, fat and calories against the daily target, and whether it's a training day. Every day of the two-week menu is one tap away. A session can be moved to another day of that week (two sessions swap), skipped, or added on a rest day, for that date only; the usual week is set in Settings. Activities (walk, run, bike, football, padel, other) are added to any day with distance and time.
- **Menu:** both weeks, lunch and dinner. Copy a meal to other days, swap two meals, or pick another recipe. On a computer, drag a meal onto another one and choose copy or swap. Every change can be undone, and the whole menu can be reset. Each day and the week average show their numbers; a day under the protein floor is flagged.
- **Cook:** eight recipes. Ingredients first, then one step per screen. Opened from a meal, the carb (rice, papas, spaghetti, bread) or protein (chicken, tuna, eggs, mackerel) can be swapped for that meal only; the amount keeps the same carbs or protein, and the numbers update.
- **Buy:** big shop, top-up and pantry lists worked out from the current menu with the cheapest pack mix, in the store's walking order. "Send to Mercheck" puts the items on a list in the shopping-list app, where they're ticked while shopping.
- **Train:** three home sessions (A, B, C) with start and end photos for every exercise, every warm-up move and every circuit move. Each set's weight and reps are logged straight into the gym log app under today's date, and the next session starts from those numbers. The sessions are added to the gym log as routines the first time.
- **Log:** a food log without searching a database. Type what you ate in one line, amount first: `400 leche, 8 cacao, 42 avena`. Each word is matched to one of your foods (the plan's ingredients plus your own products) and the preview shows what matched; anything unknown is flagged with an "Add it" button, never guessed. Grams by default; ml, kg, l and units work too. Save any line as a meal. Your meals, today's plan meals and recent entries open as a meal screen: change any amount, remove a food or add more, pick the meal, and log it in one tap (or turn it back into text). A logged meal opens the same way to add more food, change amounts or move it to another meal; "Add to breakfast" (or any meal) puts the cursor back in the box for that meal. The day's totals are said in words against your targets ("400 kcal to go", "20 g over your fat"), and a breakdown shows where each macro came from, per meal and per food, in grams and percent.
- **Products by search:** Add a product opens on a search of the store's catalogue (one warehouse, `STORE_WH`): results with photo, pack, size and price; open one and press "Use this product". The search only runs for words that aren't one of your foods: an unknown word in the log line turns Log into "Find <word> at Mercadona" (the line is kept and logged after), an unknown word in a meal's "Add more" opens it the same way, and a saved word typed in the search box says which food it already is. The server keeps its own copy of the catalogue (one request per category, one at a time), saved next to the database and refreshed once a day; photos are served through the server, only from the catalogue's image host.
- **Products by link:** or paste a store product link. The server reads the product's name, pack size and barcode from the store's public product endpoint (it has no nutrition table) and the values per 100 g / 100 ml from Open Food Facts by barcode. The form shows them for confirmation and says when they're missing or don't add up (energy vs 4 × protein + 4 × carbs + 9 × fat), so they can be typed from the label.
- **Settings:** sets per exercise, the usual training days, daily targets (protein, carbs, fat, calories), costs, account.

Settings, menu edits, your foods and the food log (one document per day) are saved on the device first and synced to the account, so a computer and a phone show the same thing. The app, the plan and the photos work offline once loaded; sets logged offline are sent when the gym log can be reached.

Navigation: phones get five places in a 78 px bottom bar flush with the screen's bottom edge (Today, Log, Train, Cook, Buy); the menu editor opens from Today. Every screen opened from another one (a meal, a product, Foods and meals, a recipe, cook mode, Settings) has a back arrow in the header, and the phone's Back button and Escape close it too, returning to where it was opened. Changes save at once and can be undone, logging included.

## How it's built

- `frontend/`: a plain HTML, CSS and JavaScript PWA. No framework, no third-party requests; fonts are self-hosted. `planmath.js` holds the food maths (meal ingredients after swaps, macros, shopping lists) and `foodlog.js` the food log maths (matching typed lines, totals, status, breakdown); both are shared with the tests. `data/plan.json` is the plan data; `exercises.js` the sessions.
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
| GET | `/api/state` | Settings, the edited menu, foods and the last five weeks of the food log, each with `updatedAt` |
| PUT | `/api/state/:key` | `settings`, `menu`, `foods`, `train` (usual week and per-date changes) or `log:YYYY-MM-DD` (foods and activities); `{ value, updatedAt }`. An older change never overwrites a newer one. |
| GET | `/api/food/search?q=` | Products in the server's copy of the store catalogue whose name has every word (singular or plural, or a word start); 503 while the first copy is loading |
| GET | `/api/food/img/:id` | A catalogue product's photo, fetched by the server |
| GET | `/api/food/lookup?q=` | A store product link or id → name, unit, pack size, barcode and values per 100 g / 100 ml with a check (`ok`, `missing`, `doesnt_add_up`) |
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
