// Links to the two apps that own the data: the gym log (workouts, sets, routines) and the shopping
// list. Each call uses the signed-in user's own token, so this app can only touch that user's data.
import { randomUUID } from "node:crypto";

const GYM_URL = process.env.GYMAKER_URL ?? "http://gymaker-server:4481";
const LIST_URL = process.env.MERCHECK_URL ?? "http://mercheck:4480";

export class BridgeError extends Error {
  constructor(public app: "gym" | "list", message: string) {
    super(message);
  }
}

async function call(app: "gym" | "list", base: string, token: string, method: string, path: string, body?: unknown) {
  let res: globalThis.Response;
  try {
    res = await fetch(base + path, {
      method,
      headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "content-type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    throw new BridgeError(app, `can't reach it (${String(err)})`);
  }
  const text = await res.text();
  if (!res.ok) throw new BridgeError(app, `answered ${res.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

/* ---------------- gym log ---------------- */

export interface GymSet {
  weight: number | "";
  reps: number | "";
}

const uid = () => randomUUID().replace(/-/g, "").slice(0, 9);

/** Estimated one-rep max, the same formula the gym app uses. */
export function brzycki(weight: number | "", reps: number | ""): number {
  const w = Number(weight || 0), r = Number(reps || 0);
  if (w <= 0 || r <= 0) return 0;
  if (r >= 35) return Math.round(w * 1.03 * 10) / 10;
  const denom = 1.0278 - 0.0278 * r;
  if (denom <= 0) return Math.round(w * 1.05 * 10) / 10;
  return Math.round((w / denom) * 10) / 10;
}

type AnyObj = Record<string, any>;

async function gymState(token: string): Promise<AnyObj> {
  return call("gym", GYM_URL, token, "GET", "/api/state");
}

/** For each exercise name: the sets from the last time it was done, and today's sets if already logged. */
export async function gymLast(token: string, names: string[], date: string) {
  const state = await gymState(token);
  const library: AnyObj = state.library ?? {};
  const today: AnyObj = state.workouts?.[date] ?? { exercises: [] };
  const out: Record<string, { last: GymSet[]; lastDate: string | null; today: GymSet[] | null }> = {};
  // "Last time" means the latest workout before this date that has the exercise. The library's
  // "last used" can't be used for it: it only keeps the newest sets, which are today's once logged.
  const earlier = Object.keys(state.workouts ?? {}).filter((k) => k < date).sort().reverse();
  const same = (e: AnyObj, name: string) => String(e.name).toLowerCase() === name.toLowerCase();
  for (const name of names) {
    const done = (today.exercises as AnyObj[]).find((e) => same(e, name));
    let last: AnyObj | null = null, lastDate: string | null = null;
    for (const k of earlier) {
      const hit = (state.workouts[k].exercises as AnyObj[] ?? []).find((e) => same(e, name) && e.sets?.length);
      if (hit) { last = hit; lastDate = k; break; }
    }
    // Older data may only be in the library (e.g. a workout day deleted later).
    const lib = library[name.toLowerCase()];
    if (!last && lib?.lastUsed && lib.lastUsed.dateKey < date) { last = lib.lastUsed; lastDate = lib.lastUsed.dateKey; }
    out[name] = {
      last: (last?.sets ?? []).map((s: AnyObj) => ({ weight: s.weight, reps: s.reps })),
      lastDate,
      today: done ? done.sets.map((s: AnyObj) => ({ weight: s.weight, reps: s.reps })) : null,
    };
  }
  return { routines: Array.isArray(state.routines) ? state.routines.map((r: AnyObj) => r.name) : null, exercises: out };
}

/**
 * Puts one exercise's sets into that day's workout (replacing what was logged for it before), and
 * makes them the exercise's "last used" sets. Both documents are sent together.
 */
export async function gymLog(token: string, date: string, name: string, sets: GymSet[]) {
  const state = await gymState(token);
  const workout: AnyObj = state.workouts?.[date] ? structuredClone(state.workouts[date]) : { dateKey: date, exercises: [] };
  const library: AnyObj = state.library ? structuredClone(state.library) : {};
  const made = sets.map((s) => ({ id: uid(), weight: s.weight, reps: s.reps, e1RM: brzycki(s.weight, s.reps) }));
  const i = (workout.exercises as AnyObj[]).findIndex((e) => String(e.name).toLowerCase() === name.toLowerCase());
  if (made.length === 0) {
    if (i >= 0) workout.exercises.splice(i, 1);
  } else if (i >= 0) {
    workout.exercises[i] = { ...workout.exercises[i], sets: made };
  } else {
    workout.exercises.push({ id: uid(), name, tags: [], sets: made });
  }
  const changes: AnyObj[] = [{ kind: "workout", key: date, data: workout.exercises.length ? workout : null }];
  if (made.length) {
    const key = name.toLowerCase();
    const entry = library[key] ?? { name, tags: [] };
    library[key] = { ...entry, name: entry.name ?? name, lastUsed: { sets: made, dateKey: date, tags: entry.tags ?? [] } };
    changes.push({ kind: "library", data: library });
  }
  await call("gym", GYM_URL, token, "POST", "/api/sync", { changes });
  return { logged: made.length };
}

export interface RoutineSeed {
  name: string;
  exercises: { name: string; sets: number; defaultWeight?: number; defaultReps?: number }[];
}

/** Adds the routines that aren't there yet (matched by name); never changes one that exists. */
export async function gymEnsureRoutines(token: string, routines: RoutineSeed[]) {
  const state = await gymState(token);
  // The gym app fills in its own default routines the first time it's opened; until then, wait.
  if (!Array.isArray(state.routines)) return { added: [], waiting: true };
  const have = new Set(state.routines.map((r: AnyObj) => String(r.name).toLowerCase()));
  const add = routines.filter((r) => !have.has(r.name.toLowerCase())).map((r) => ({ id: uid(), name: r.name, exercises: r.exercises }));
  if (add.length) await call("gym", GYM_URL, token, "POST", "/api/sync", { changes: [{ kind: "routines", data: [...state.routines, ...add] }] });
  return { added: add.map((r) => r.name), waiting: false };
}

/* ---------------- shopping list ---------------- */

/** Puts the items on the named list as "to buy" with these quantities; creates the list and items if needed. */
export async function listSend(token: string, listName: string, items: { name: string; quantity: number }[]) {
  const state = await call("list", LIST_URL, token, "GET", "/api/state");
  const op = (body: AnyObj) => call("list", LIST_URL, token, "POST", "/api/ops", body);
  let list = (state.lists as AnyObj[]).find((l) => String(l.name).toLowerCase() === listName.toLowerCase());
  if (!list) {
    list = { id: `plan-${uid()}`, name: listName, items: [] };
    await op({ type: "addList", list });
  }
  let added = 0, updated = 0;
  for (const it of items) {
    const found = (list.items as AnyObj[]).find((x) => String(x.name).toLowerCase() === it.name.toLowerCase());
    if (found) {
      if (!found.checked) await op({ type: "setItemChecked", listId: list.id, itemId: found.id, checked: true });
      if (found.quantity !== it.quantity) await op({ type: "setQuantity", listId: list.id, itemId: found.id, quantity: it.quantity });
      updated++;
    } else {
      await op({ type: "addItem", listId: list.id, item: { id: `plan-${uid()}`, name: it.name, checked: true, quantity: it.quantity } });
      added++;
    }
  }
  return { list: list.name, added, updated };
}
