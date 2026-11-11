// Product lookup for the food log: the store's public product page gives the name, pack size and
// barcode (it has no nutrition table), and Open Food Facts gives the values per 100 g / 100 ml by barcode.
// Nothing here is trusted blindly: the app shows the numbers and the user confirms or corrects them.

const STORE_API = process.env.STORE_API_URL ?? "https://tienda.mercadona.es/api/products/";
const OFF_API = process.env.OFF_API_URL ?? "https://world.openfoodfacts.org/api/v2/product/";
const UA = "home-plan/1.0 (personal food log)";

export class LookupError extends Error {
  constructor(public code: "not_found" | "unavailable", message: string) {
    super(message);
  }
}

/** The product id from a store link ("…/product/86341/copos-avena…") or a bare id. */
export function productId(input: string): string | null {
  const s = input.trim();
  const m = s.match(/\/product\/(\d{1,8}(?:\.\d{1,2})?)(?:[/?#]|$)/) ?? s.match(/^(\d{1,8}(?:\.\d{1,2})?)$/);
  return m ? m[1] : null;
}

async function getJson(url: string): Promise<{ status: number; data: any }> {
  let res: globalThis.Response;
  try {
    res = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  } catch (err) {
    throw new LookupError("unavailable", `can't reach ${new URL(url).host} (${String(err)})`);
  }
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {}
  return { status: res.status, data };
}

export interface Nutrition {
  p: number;
  c: number;
  f: number;
  k: number;
}

/** Energy should be close to 4 × protein + 4 × carbs + 9 × fat; fibre and alcohol explain a small gap. */
export function addsUp(n: Nutrition): boolean {
  const calc = 4 * n.p + 4 * n.c + 9 * n.f;
  return Math.abs(n.k - calc) <= Math.max(25, n.k * 0.12);
}

const r1 = (x: number) => Math.round(x * 10) / 10;

export interface Lookup {
  id: string;
  name: string;
  brand: string | null;
  unit: "g" | "ml";
  size: number | null; // pack size in g or ml
  ean: string | null;
  nut: Nutrition | null;
  source: "off" | null;
  check: "ok" | "missing" | "doesnt_add_up";
}

export async function lookupProduct(id: string): Promise<Lookup> {
  const store = await getJson(STORE_API + encodeURIComponent(id) + "/");
  if (store.status === 404 || store.status === 410) throw new LookupError("not_found", "no such product");
  if (store.status !== 200 || !store.data || typeof store.data.display_name !== "string")
    throw new LookupError("unavailable", `store answered ${store.status}`);
  const d = store.data;
  const pi = d.price_instructions ?? {};
  const fmt = String(pi.size_format ?? pi.reference_format ?? "").toLowerCase();
  const unit: "g" | "ml" = fmt === "l" || fmt === "ml" ? "ml" : "g";
  const size = typeof pi.unit_size === "number" && pi.unit_size > 0 ? Math.round(pi.unit_size * (fmt === "kg" || fmt === "l" ? 1000 : 1)) : null;
  const ean = typeof d.ean === "string" && /^\d{8,14}$/.test(d.ean) ? d.ean : null;

  let nut: Nutrition | null = null;
  if (ean) {
    try {
      const off = await getJson(`${OFF_API}${ean}.json?fields=nutriments`);
      const n = off.status === 200 && off.data?.status === 1 ? off.data.product?.nutriments : null;
      const v = (k: string) => (typeof n?.[k] === "number" && Number.isFinite(n[k]) && n[k] >= 0 ? n[k] : null);
      const kcal = v("energy-kcal_100g") ?? (v("energy_100g") !== null ? (v("energy_100g") as number) / 4.184 : null);
      const p = v("proteins_100g"), c = v("carbohydrates_100g"), f = v("fat_100g");
      if (p !== null && c !== null && f !== null && kcal !== null) nut = { p: r1(p), c: r1(c), f: r1(f), k: Math.round(kcal) };
    } catch {
      // Open Food Facts down: the user types the values from the label.
    }
  }
  return {
    id,
    name: d.display_name.slice(0, 80),
    brand: typeof d.brand === "string" ? d.brand.slice(0, 40) : null,
    unit,
    size,
    ean,
    nut,
    source: nut ? "off" : null,
    check: !nut ? "missing" : addsUp(nut) ? "ok" : "doesnt_add_up",
  };
}
