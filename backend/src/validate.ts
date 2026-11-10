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

export function validState(key: string, v: unknown): boolean {
  if (key === "settings") return validSettings(v);
  if (key === "menu") return validMenu(v);
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
