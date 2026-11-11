"use strict";
/* The food log maths, shared by the app and the tests (no DOM, no network).
   Foods are the plan's ingredients plus the user's own products. Each has nicknames, a unit
   (g, ml or ud) and protein / carbs / fat / kcal per 100 g or 100 ml, or per unit.
   A line like "400 leche, 8 cacao, 42 avena" is matched against the nicknames: no guessing,
   anything not recognised is reported so it can be added. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FL = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const SLOTS = [
    ["breakfast", "Breakfast"], ["midmorning", "Mid-morning"], ["lunch", "Lunch"],
    ["afternoon", "Afternoon"], ["dinner", "Dinner"], ["late", "Late snack"],
  ];
  const SLOT_LABEL = Object.fromEntries(SLOTS);
  const DEFAULT_TARGETS = { p: 140, c: 250, f: 65, k: 2200 };

  // Spanish names first: that's how the food is called at home and in the store.
  const PLAN_NICK = {
    bread: ["panecillo", "pan"], burgos: ["burgos", "queso burgos"], batido: ["batido", "queso batido"],
    lomo: ["lomo", "lomo embuchado"], milk: ["leche"], cacao: ["cacao", "colacao"], coffee: ["cafe", "capsula"],
    peanuts: ["cacahuete", "mani"], banana: ["platano"], pear: ["pera"], grapes: ["uva"],
    chicken: ["pollo", "pechuga"], egg: ["huevo"], tuna: ["atun", "lata atun"], caballa: ["caballa"],
    potato: ["papa", "patata"], onion: ["cebolla"], pepper: ["pimiento"], beans: ["judia", "judias verdes"],
    rice: ["arroz"], pasta: ["espagueti", "pasta", "spaghetti"], tomato: ["tomate frito", "tomate"],
    cheese: ["queso rallado"], oil: ["aceite"], mojo: ["mojo"], soy: ["soja", "salsa de soja"],
  };

  /** Lower case, no accents, single spaces: "Plátano " → "platano". */
  const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ.,+ ]/g, " ").replace(/\s+/g, " ").trim();
  const nickOk = (s) => /^[a-z0-9ñ ]{1,30}$/.test(s);
  const r1 = (x) => Math.round(x * 10) / 10;

  /** Every food the log knows: key → { k, n, u, nut, perunit, piece, nick, own }. */
  function catalog(plan, foods) {
    const out = {};
    const nickOver = (foods && foods.nick) || {};
    for (const [k, x] of Object.entries(plan.ing)) {
      out[k] = { k, n: x.n, u: x.u, nut: x.nut, perunit: !!x.perunit, piece: x.piece || null,
                 nick: nickOver[k] || PLAN_NICK[k] || [norm(x.n).split(" ")[0]], own: false };
    }
    for (const [k, x] of Object.entries((foods && foods.products) || {})) {
      out[k] = { k, n: x.n, u: x.u, nut: x.nut, perunit: x.u === "ud", piece: x.piece || null, nick: x.nick || [], own: true,
                 src: x.src, mid: x.mid, ean: x.ean };
    }
    return out;
  }

  /** Nickname → food key. A nickname belongs to one food only. */
  function nickIndex(cat) {
    const idx = {};
    for (const f of Object.values(cat)) for (const n of f.nick) if (!idx[n]) idx[n] = f.k;
    return idx;
  }

  /** The food a piece of text names: exact nickname, then the plural, then a nickname the text starts with. */
  function findFood(text, cat, idx) {
    const t = norm(text).replace(/^de /, "");
    if (!t) return null;
    if (idx[t]) return cat[idx[t]];
    for (const cut of [t.replace(/es$/, ""), t.replace(/s$/, "")]) if (idx[cut]) return cat[idx[cut]];
    // "leche semidesnatada" → leche; the longest nickname wins ("queso rallado" over "queso").
    let best = null;
    for (const [n, k] of Object.entries(idx)) {
      const words = t.split(" ").map((w) => w.replace(/s$/, ""));
      const hit = t.startsWith(n + " ") || words.join(" ").startsWith(n + " ") || words.join(" ") === n;
      if (hit && (!best || n.length > best.n.length)) best = { n, k };
    }
    return best ? cat[best.k] : null;
  }

  const UNIT = /^(kg|kilos?|g|gr|grs|gramos?|mg|l|litros?|cl|ml|ud|uds|u|x|unidad|unidades|pieza|piezas|lata|latas|cucharada|cucharadas)$/;

  /** One part of a line → { food, amount } or { error }. Numbers may come before or after the food. */
  function parsePart(raw, cat, idx) {
    const s = norm(raw).replace(/(\d),(\d)/g, "$1.$2");
    if (!s) return null;
    const words = s.split(" ");
    let qty = null, unit = null, rest = [];
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      const m = w.match(/^(\d+(?:\.\d+)?)([a-z]+)?$/);
      if (qty === null && m) {
        qty = +m[1];
        if (m[2] && UNIT.test(m[2])) unit = m[2];
        else if (m[2]) rest.push(m[2]);
        if (!unit && words[i + 1] && UNIT.test(words[i + 1])) { unit = words[i + 1]; i++; }
        continue;
      }
      rest.push(w);
    }
    const name = rest.join(" ").replace(/^(de|of) /, "");
    const food = findFood(name, cat, idx);
    if (!food) return { error: "unknown", text: raw.trim(), name };
    if (qty === null) return { error: "amount", text: raw.trim(), food };
    let a;
    const count = !unit || /^(ud|uds|u|x|unidad|unidades|pieza|piezas|lata|latas)$/.test(unit);
    if (unit && /^(kg|kilos?)$/.test(unit)) a = qty * 1000;
    else if (unit && /^(l|litros?)$/.test(unit)) a = qty * 1000;
    else if (unit === "cl") a = qty * 10;
    else if (unit === "mg") a = qty / 1000;
    else if (unit && /^cucharadas?$/.test(unit)) a = qty * (food.u === "ml" ? 10 : 8);
    else if (food.perunit) {
      if (!count) return { error: "unit", text: raw.trim(), food };
      a = qty;
    } else if (count && unit) {
      if (!food.piece) return { error: "piece", text: raw.trim(), food };
      a = qty * food.piece;
    } else if (!unit && food.piece && qty <= 12) a = qty * food.piece; // "2 panecillos"
    else if (!unit && qty <= 3) return { error: "tiny", text: raw.trim(), food, qty }; // "3 pollo": 3 g, or 3 fillets?
    else a = qty;
    if (food.perunit && unit && !count) return { error: "unit", text: raw.trim(), food };
    if (!(a > 0) || a > 10000) return { error: "amount", text: raw.trim(), food };
    return { food, a: r1(a) };
  }

  /** A whole line: "400 leche, 8 cacao + 42 avena y 1 platano". */
  function parse(text, cat) {
    const idx = nickIndex(cat);
    // "62,5 burgos" is a decimal, not two foods.
    const parts = String(text).replace(/(\d),(\d)/g, "$1.$2").split(/[,;\n+]| y | and | con /i).map((x) => x.trim()).filter(Boolean);
    const items = [], problems = [];
    for (const p of parts) {
      const r = parsePart(p, cat, idx);
      if (!r) continue;
      if (r.error) problems.push(r);
      else items.push(item(r.food, r.a));
    }
    return { items, problems };
  }

  /** A logged food: name, amount and its own values, so the log never changes when a product is edited later. */
  function item(food, a) {
    const f = food.perunit ? a : a / 100;
    return { k: food.k, n: food.n, a, u: food.u, m: food.nut.map((v, i) => (i === 3 ? Math.round(v * f) : r1(v * f))) };
  }

  /** Text that parses back to the same foods: "400 ml leche, 1 platano". */
  function textFor(ingredients, cat) {
    return Object.entries(ingredients).filter(([k]) => cat[k]).map(([k, a]) => {
      const f = cat[k], amt = r1(a);
      return f.perunit ? `${amt} ${f.nick[0]}` : `${amt} ${f.u} ${f.nick[0]}`;
    }).join(", ");
  }

  function sum(items) {
    const t = [0, 0, 0, 0];
    for (const i of items) for (let k = 0; k < 4; k++) t[k] += i.m[k];
    return { p: r1(t[0]), c: r1(t[1]), f: r1(t[2]), k: Math.round(t[3]) };
  }
  const dayTotals = (entries) => sum(entries.flatMap((e) => e.items));

  /** Plain sentences on where the day stands against the targets. */
  function status(tot, t) {
    const out = [];
    const dk = Math.round(t.k - tot.k), band = Math.max(50, t.k * 0.03);
    if (Math.abs(dk) <= band) out.push({ m: "k", tone: "good", text: "Calories on target" });
    else if (dk > 0) out.push({ m: "k", tone: "todo", text: `${dk.toLocaleString("es-ES")} kcal to go` });
    else out.push({ m: "k", tone: "over", text: `${(-dk).toLocaleString("es-ES")} kcal over` });
    const dp = Math.round(t.p - tot.p);
    out.push(dp > 0 ? { m: "p", tone: "todo", text: `${dp} g protein to go` } : { m: "p", tone: "good", text: dp < 0 ? `Protein reached, ${-dp} g above` : "Protein reached" });
    for (const [m, name] of [["c", "carbs"], ["f", "fat"]]) {
      const d = Math.round(t[m] - tot[m]);
      out.push(d >= 0 ? { m, tone: "todo", text: `${d} g ${name} left` } : { m, tone: "over", text: `${-d} g over your ${name}` });
    }
    return out;
  }

  /** Where one macro came from: each meal's share of the day, and each food's share inside it. */
  function breakdown(entries, m) {
    const key = { p: 0, c: 1, f: 2, k: 3 }[m];
    const total = entries.reduce((a, e) => a + e.items.reduce((b, i) => b + i.m[key], 0), 0);
    const pct = (v) => (total > 0 ? Math.round((v / total) * 100) : 0);
    const slots = [];
    for (const [slot, label] of SLOTS) {
      const es = entries.filter((e) => e.slot === slot);
      if (!es.length) continue;
      const foods = {};
      for (const i of es.flatMap((e) => e.items)) {
        const f = (foods[i.n] = foods[i.n] || { n: i.n, v: 0, a: 0, u: i.u });
        f.v += i.m[key]; f.a += i.a;
      }
      const v = Object.values(foods).reduce((a, f) => a + f.v, 0);
      slots.push({ slot, label, v: key === 3 ? Math.round(v) : r1(v), pct: pct(v),
        foods: Object.values(foods).sort((a, b) => b.v - a.v).map((f) => ({ ...f, v: key === 3 ? Math.round(f.v) : r1(f.v), a: r1(f.a), pct: pct(f.v) })) });
    }
    return { total: key === 3 ? Math.round(total) : r1(total), slots };
  }

  /** Energy should be close to 4 × protein + 4 × carbs + 9 × fat; fibre explains a small gap. */
  function addsUp(nut) {
    const [p, c, f, k] = nut;
    return Math.abs(k - (4 * p + 4 * c + 9 * f)) <= Math.max(25, k * 0.12);
  }

  /** The meal slot for a time of day. */
  function slotAt(d) {
    const h = d.getHours() + d.getMinutes() / 60;
    return h < 10.5 ? "breakfast" : h < 13 ? "midmorning" : h < 16 ? "lunch" : h < 19.5 ? "afternoon" : h < 22.5 ? "dinner" : "late";
  }

  /** Cleans nicknames typed by the user: "Leche, leche desnatada" → ["leche", "leche desnatada"]. */
  function nicks(text) {
    return [...new Set(String(text).split(",").map((x) => norm(x).replace(/[.,+]/g, "").trim()).filter(nickOk))].slice(0, 8);
  }

  /** Which nicknames are already another food's. */
  function nickClash(cat, key, list) {
    const out = [];
    for (const n of list) for (const f of Object.values(cat)) if (f.k !== key && f.nick.includes(n)) out.push({ n, food: f.n });
    return out;
  }

  return { SLOTS, SLOT_LABEL, DEFAULT_TARGETS, PLAN_NICK, norm, catalog, parse, item, textFor, sum, dayTotals, status, breakdown, addsUp, slotAt, nicks, nickClash };
});
