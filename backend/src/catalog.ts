// The store's online catalogue for one warehouse, kept by the server so products can be searched
// in the app. Loaded at start (one request per category, one at a time), saved next to the
// database, refreshed once a day; searches always answer from the copy in memory.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const CAT_URL = process.env.STORE_CAT_URL ?? "https://tienda.mercadona.es/api/categories/";
const WH = process.env.STORE_WH ?? "2717";
const FILE = join(dirname(process.env.DB_PATH ?? "./data/homeblock.db"), `catalogue_${WH}.json`);
const UA = "home-plan/1.0 (personal food log)";
const DAY = 86400000;
const IMG_HOST = "prod-mercadona.imgix.net";

export interface Product {
  id: string;
  name: string;
  pack: string | null;
  price: number | null;
  size: number | null;
  fmt: string | null;
  thumb: string | null;
  words: string[]; // normalised name words, for searching
}

let products: Product[] = [];
let byId = new Map<string, Product>();
let fetchedAt = 0;
let loading: Promise<void> | null = null;

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ ]/g, " ").replace(/\s+/g, " ").trim();

/** Singular and plural forms of a Spanish word: "nueces" ↔ "nuez", "huevos" ↔ "huevo". */
function forms(w: string): string[] {
  const out = [w];
  if (w.endsWith("ces") && w.length > 4) out.push(w.slice(0, -3) + "z");
  if (w.endsWith("es") && w.length > 3) out.push(w.slice(0, -2));
  if (w.endsWith("s") && w.length > 2) out.push(w.slice(0, -1));
  if (w.endsWith("z")) out.push(w.slice(0, -1) + "ces");
  return out;
}

function use(list: Product[], at: number) {
  products = list;
  byId = new Map(list.map((p) => [p.id, p]));
  fetchedAt = at;
}

async function getJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.json();
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function download(): Promise<void> {
  const top = await getJson(`${CAT_URL}?lang=es&wh=${WH}`);
  const ids: number[] = top.results.flatMap((t: any) => t.categories.map((c: any) => c.id));
  const seen = new Map<string, Product>();
  for (const id of ids) {
    const cat = await getJson(`${CAT_URL}${id}/?lang=es&wh=${WH}`);
    for (const sub of cat.categories ?? [])
      for (const p of sub.products ?? []) {
        if (seen.has(String(p.id)) || typeof p.display_name !== "string") continue;
        const pi = p.price_instructions ?? {};
        seen.set(String(p.id), {
          id: String(p.id),
          name: p.display_name,
          pack: typeof p.packaging === "string" ? p.packaging : null,
          price: pi.unit_price != null && Number.isFinite(Number(pi.unit_price)) ? Number(pi.unit_price) : null,
          size: typeof pi.unit_size === "number" ? pi.unit_size : null,
          fmt: typeof pi.size_format === "string" ? pi.size_format : null,
          thumb: typeof p.thumbnail === "string" ? p.thumbnail : null,
          words: norm(p.display_name).split(" "),
        });
      }
    await pause(150); // gentle on the store: one category at a time
  }
  if (seen.size < 500) throw new Error(`only ${seen.size} products, keeping the old copy`);
  const list = [...seen.values()];
  use(list, Date.now());
  try {
    mkdirSync(dirname(FILE), { recursive: true });
    writeFileSync(FILE, JSON.stringify({ fetchedAt, products: list }));
  } catch (err) {
    console.error(`[catalogue] can't save the copy: ${String(err)}`);
  }
  console.log(`[catalogue] ${list.length} products for warehouse ${WH}`);
}

/** Loads the saved copy, and downloads a new one when there is none or it's a day old. Never throws. */
export function refresh(): Promise<void> {
  if (!products.length) {
    try {
      const saved = JSON.parse(readFileSync(FILE, "utf8"));
      if (Array.isArray(saved.products) && saved.products.length) use(saved.products, Number(saved.fetchedAt) || 0);
    } catch {}
  }
  if (Date.now() - fetchedAt < DAY) return Promise.resolve();
  if (!loading)
    loading = download()
      .catch((err) => console.error(`[catalogue] ${String(err)}`))
      .finally(() => {
        loading = null;
      });
  return loading;
}

export const catalogueReady = () => products.length > 0;

/** Products whose name has every word typed (singular or plural, or the start of a word), best first. */
export function search(q: string, limit = 30): Product[] {
  const qw = norm(q).split(" ").filter(Boolean).slice(0, 6);
  if (!qw.length) return [];
  const scored: { p: Product; s: number }[] = [];
  for (const p of products) {
    let s = 0;
    const ok = qw.every((w) => {
      const fs = forms(w);
      const i = p.words.findIndex((x) => fs.some((f) => x === f || forms(x).includes(f)));
      if (i >= 0) { s += i === 0 ? 30 : 20; return true; }
      const j = w.length >= 3 ? p.words.findIndex((x) => x.startsWith(w)) : -1;
      if (j >= 0) { s += j === 0 ? 12 : 6; return true; }
      return false;
    });
    if (ok) scored.push({ p, s: s - p.words.length });
  }
  return scored.sort((a, b) => b.s - a.s || a.p.name.length - b.p.name.length).slice(0, limit).map((x) => x.p);
}

/** The product's photo address, only ever one from the catalogue (never a URL from the request). */
export function photoUrl(id: string): string | null {
  const p = byId.get(id);
  if (!p || !p.thumb) return null;
  try {
    const u = new URL(p.thumb);
    if (u.protocol !== "https:" || u.hostname !== IMG_HOST) return null;
    u.searchParams.set("w", "160");
    u.searchParams.set("h", "160");
    return u.toString();
  } catch {
    return null;
  }
}
