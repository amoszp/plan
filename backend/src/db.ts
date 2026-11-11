import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const DB_PATH = process.env.DB_PATH ?? "./data/homeblock.db";
mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
// One row per user and kind of state: small JSON documents the app replaces whole.
// Workouts and the shopping list live in their own apps (see bridges.ts), not here.
db.exec(`
  CREATE TABLE IF NOT EXISTS state (
    user_id INTEGER NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, key)
  );
`);

// Settings, the edited menu, the food list (own products, nicknames, saved meals, targets), the
// training days (a default week plus changes to single dates), and one document per day
// ("log:2026-11-11": food eaten and activities done), so a day stays small and syncs on its own.
export const STATE_KEYS = ["settings", "menu", "foods", "train"] as const;
const LOG_KEY = /^log:\d{4}-\d{2}-\d{2}$/;
export const isStateKey = (key: string) => (STATE_KEYS as readonly string[]).includes(key) || LOG_KEY.test(key);
/** Days of food log sent with the state: older days stay stored but aren't loaded. */
const LOG_DAYS = 35;

export interface StateEntry {
  value: unknown;
  updatedAt: string;
}

export function getState(userId: number, today = new Date()): Record<string, StateEntry> {
  const from = new Date(today.getTime() - LOG_DAYS * 86400000).toISOString().slice(0, 10);
  const rows = db.prepare("SELECT key, value, updated_at FROM state WHERE user_id = ?").all(userId) as {
    key: string;
    value: string;
    updated_at: string;
  }[];
  const out: Record<string, StateEntry> = {};
  for (const r of rows) {
    if (!isStateKey(r.key) || (r.key.startsWith("log:") && r.key.slice(4) < from)) continue;
    out[r.key] = { value: JSON.parse(r.value), updatedAt: r.updated_at };
  }
  return out;
}

export function putState(userId: number, key: string, value: unknown, updatedAt: string): StateEntry {
  // Last write wins, by the time the change was made on the device, so a phone that was
  // offline doesn't overwrite a newer change made on the PC.
  const current = db.prepare("SELECT value, updated_at FROM state WHERE user_id = ? AND key = ?").get(userId, key) as
    | { value: string; updated_at: string }
    | undefined;
  if (current && current.updated_at > updatedAt) return { value: JSON.parse(current.value), updatedAt: current.updated_at };
  db.prepare(
    "INSERT INTO state (user_id, key, value, updated_at) VALUES (?, ?, ?, ?) " +
      "ON CONFLICT (user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
  ).run(userId, key, JSON.stringify(value), updatedAt);
  return { value, updatedAt };
}
