// Checks what the app sends before it is stored or passed on. Anything outside these shapes is refused.

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const WORD = /^[a-z]{1,12}$/;
const RECIPE = /^R\d{1,2}$/;

export function validSettings(v: unknown): boolean {
  if (!isObj(v)) return false;
  const allowed: Record<string, (x: unknown) => boolean> = {
    sets: (x) => x === "auto" || x === 2 || x === 3,
  };
  return Object.entries(v).every(([k, x]) => k in allowed && allowed[k](x));
}

/** 14 days × [lunch, dinner]; each meal a recipe, a flavour, an optional note and ingredient swaps. */
export function validMenu(v: unknown): boolean {
  if (!Array.isArray(v) || v.length !== 14) return false;
  return v.every(
    (day) =>
      Array.isArray(day) &&
      day.length === 2 &&
      day.every(
        (m) =>
          isObj(m) &&
          Object.keys(m).every((k) => ["r", "v", "note", "swaps"].includes(k)) &&
          typeof m.r === "string" && RECIPE.test(m.r) &&
          typeof m.v === "string" && WORD.test(m.v) &&
          (m.note === undefined || (typeof m.note === "string" && m.note.length <= 120)) &&
          (m.swaps === undefined ||
            (isObj(m.swaps) && Object.keys(m.swaps).length <= 6 &&
              Object.entries(m.swaps).every(([from, to]) => WORD.test(from) && typeof to === "string" && WORD.test(to))))
      )
  );
}

const text = (x: unknown, max: number) => typeof x === "string" && x.trim().length > 0 && x.length <= max;
const amount = (x: unknown, max: number) => typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= max;
const nut4 = (x: unknown) => Array.isArray(x) && x.length === 4 && x.every((n) => amount(n, 10000));
const FOOD_KEY = /^(?:[a-z]{1,12}|x[a-z0-9]{1,12})$/;
const NICK = /^[a-z0-9ñ ]{1,30}$/;
export const SLOT_KEYS = ["breakfast", "midmorning", "lunch", "afternoon", "dinner", "late"] as const;
const nicks = (x: unknown) => Array.isArray(x) && x.length <= 8 && x.every((n) => typeof n === "string" && NICK.test(n));

/** The user's own products (values per 100 g / 100 ml, or per unit), nicknames, saved meals and targets. */
export function validFoods(v: unknown): boolean {
  if (!isObj(v) || !Object.keys(v).every((k) => ["products", "nick", "meals", "targets"].includes(k))) return false;
  const { products, nick, meals, targets } = v;
  if (products !== undefined) {
    if (!isObj(products) || Object.keys(products).length > 300) return false;
    for (const [k, x] of Object.entries(products)) {
      if (!/^x[a-z0-9]{1,12}$/.test(k) || !isObj(x)) return false;
      if (!Object.keys(x).every((f) => ["n", "nick", "u", "nut", "piece", "src", "mid", "ean"].includes(f))) return false;
      if (!text(x.n, 80) || !nicks(x.nick) || !["g", "ml", "ud"].includes(x.u as string) || !nut4(x.nut)) return false;
      if (x.piece !== undefined && x.piece !== null && !amount(x.piece, 5000)) return false;
      if (x.src !== undefined && !["off", "label"].includes(x.src as string)) return false;
      if (x.mid !== undefined && !(typeof x.mid === "string" && /^\d{1,8}(?:\.\d{1,2})?$/.test(x.mid))) return false;
      if (x.ean !== undefined && !(typeof x.ean === "string" && /^\d{8,14}$/.test(x.ean))) return false;
    }
  }
  if (nick !== undefined && !(isObj(nick) && Object.keys(nick).length <= 60 && Object.entries(nick).every(([k, x]) => WORD.test(k) && nicks(x))))
    return false;
  if (meals !== undefined) {
    if (!Array.isArray(meals) || meals.length > 100) return false;
    if (!meals.every((m) => isObj(m) && Object.keys(m).every((f) => ["id", "name", "slot", "text"].includes(f)) &&
        typeof m.id === "string" && /^[a-z0-9]{1,16}$/.test(m.id) && text(m.name, 60) && text(m.text, 300) &&
        (m.slot === undefined || SLOT_KEYS.includes(m.slot as never)))) return false;
  }
  if (targets !== undefined) {
    if (!isObj(targets) || !Object.keys(targets).every((k) => ["p", "c", "f", "k"].includes(k))) return false;
    if (!Object.values(targets).every((x) => amount(x, 10000))) return false;
  }
  return true;
}

const ACT_TYPES = ["walk", "run", "bike", "football", "padel", "other"];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Training days: a default week (0 = Monday) and changes to single dates ("-" = rest). */
export function validTrain(v: unknown): boolean {
  if (!isObj(v) || !Object.keys(v).every((k) => k === "weekly" || k === "moves")) return false;
  const sess = (x: unknown) => x === "A" || x === "B" || x === "C" || x === "-";
  if (v.weekly !== undefined && !(isObj(v.weekly) && Object.entries(v.weekly).every(([k, x]) => /^[0-6]$/.test(k) && sess(x)))) return false;
  if (v.moves !== undefined && !(isObj(v.moves) && Object.keys(v.moves).length <= 200 && Object.entries(v.moves).every(([k, x]) => DAY.test(k) && sess(x))))
    return false;
  return true;
}

/** One day: foods eaten and activities done. Each food keeps its own name and values, so later product edits don't rewrite the past. */
export function validLog(v: unknown): boolean {
  if (!isObj(v) || !Object.keys(v).every((k) => k === "entries" || k === "acts") || !Array.isArray(v.entries) || v.entries.length > 60) return false;
  if (v.acts !== undefined && !(Array.isArray(v.acts) && v.acts.length <= 20 && v.acts.every((a) =>
      isObj(a) && Object.keys(a).every((f) => ["id", "t", "km", "min", "at"].includes(f)) &&
      typeof a.id === "string" && /^[a-z0-9]{1,16}$/.test(a.id) && ACT_TYPES.includes(a.t as string) &&
      (a.km === undefined || amount(a.km, 300)) && (a.min === undefined || amount(a.min, 1440)) &&
      (a.km !== undefined || a.min !== undefined) && (a.at === undefined || validTime(a.at))))) return false;
  return v.entries.every(
    (e) =>
      isObj(e) && Object.keys(e).every((f) => ["id", "slot", "text", "items", "at"].includes(f)) &&
      typeof e.id === "string" && /^[a-z0-9]{1,16}$/.test(e.id) && SLOT_KEYS.includes(e.slot as never) &&
      (e.text === undefined || (typeof e.text === "string" && e.text.length <= 300)) &&
      (e.at === undefined || validTime(e.at)) &&
      Array.isArray(e.items) && e.items.length >= 1 && e.items.length <= 30 &&
      e.items.every(
        (i) =>
          isObj(i) && Object.keys(i).every((f) => ["k", "n", "a", "u", "m"].includes(f)) &&
          typeof i.k === "string" && FOOD_KEY.test(i.k) && text(i.n, 80) && amount(i.a, 10000) &&
          ["g", "ml", "ud"].includes(i.u as string) && nut4(i.m)
      )
  );
}

export function validState(key: string, v: unknown): boolean {
  if (key === "settings") return validSettings(v);
  if (key === "menu") return validMenu(v);
  if (key === "foods") return validFoods(v);
  if (key === "train") return validTrain(v);
  if (key.startsWith("log:")) return validLog(v);
  return false;
}

export function validTime(v: unknown): v is string {
  return typeof v === "string" && v.length <= 40 && !Number.isNaN(Date.parse(v));
}

export const validDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
export const validName = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= 80;

const num = (x: unknown, max: number) => x === "" || (typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= max);

export function validSets(v: unknown): v is { weight: number | ""; reps: number | "" }[] {
  return Array.isArray(v) && v.length <= 10 && v.every((s) => isObj(s) && num(s.weight, 500) && num(s.reps, 1000));
}

export function validRoutines(v: unknown): boolean {
  return (
    Array.isArray(v) && v.length <= 6 &&
    v.every(
      (r) =>
        isObj(r) && validName(r.name) && Array.isArray(r.exercises) && r.exercises.length <= 20 &&
        r.exercises.every(
          (e) =>
            isObj(e) && validName(e.name) && Number.isInteger(e.sets) && (e.sets as number) >= 1 && (e.sets as number) <= 10 &&
            (e.defaultWeight === undefined || num(e.defaultWeight, 500)) && (e.defaultReps === undefined || num(e.defaultReps, 1000))
        )
    )
  );
}

export function validItems(v: unknown): v is { name: string; quantity: number }[] {
  return (
    Array.isArray(v) && v.length <= 80 &&
    v.every((i) => isObj(i) && typeof i.name === "string" && i.name.trim().length > 0 && i.name.length <= 200 &&
      Number.isInteger(i.quantity) && (i.quantity as number) >= 1 && (i.quantity as number) <= 999)
  );
}
