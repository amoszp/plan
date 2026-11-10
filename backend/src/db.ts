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

export const STATE_KEYS = ["settings", "menu"] as const;
export type StateKey = (typeof STATE_KEYS)[number];

export interface StateEntry {
  value: unknown;
  updatedAt: string;
}

export function getState(userId: number): Record<string, StateEntry> {
  const rows = db.prepare("SELECT key, value, updated_at FROM state WHERE user_id = ?").all(userId) as {
    key: string;
    value: string;
    updated_at: string;
  }[];
  const out: Record<string, StateEntry> = {};
  for (const r of rows) if ((STATE_KEYS as readonly string[]).includes(r.key)) out[r.key] = { value: JSON.parse(r.value), updatedAt: r.updated_at };
  return out;
}

export function putState(userId: number, key: StateKey, value: unknown, updatedAt: string): StateEntry {
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
