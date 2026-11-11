import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServer, type Server } from "node:http";

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), "homeblock-food-")), "test.db");

const FL = require("../../frontend/foodlog.js");
const PM = require("../../frontend/planmath.js");
const plan = JSON.parse(readFileSync(join(__dirname, "../../frontend/data/plan.json"), "utf8"));
const { validFoods, validLog, validState, validTrain } = require("../src/validate");
const { getState, putState, isStateKey } = require("../src/db");

const oats = { n: "Copos de avena", nick: ["avena", "copos"], u: "g", nut: [14, 59, 7, 375], src: "off", mid: "86341", ean: "4008713713411" };
const foods = { products: { x86341: oats } };
const cat = FL.catalog(plan, foods);

test("a typed breakfast is matched to the user's own products", () => {
  const r = FL.parse("400 leche, 8 cacao, 42 avena", cat);
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.items.map((i: any) => [i.k, i.a, i.u]), [["milk", 400, "ml"], ["cacao", 8, "g"], ["x86341", 42, "g"]]);
  const t = FL.sum(r.items);
  // milk 3.2/4.7/1.6/46, cacao 12/36/9/319, oats 14/59/7/375 per 100
  assert.equal(t.p, 19.7);
  assert.equal(t.k, 368);
});

test("units, accents, plurals, decimals and the word order are understood", () => {
  const r = FL.parse("400ml leche + 8g cacao y 42 g de avena; 2 huevos, 1 plátano, leche 250 ml, 0,5 l leche, 62,5 burgos, 2 panecillos", cat);
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.items.map((i: any) => i.a), [400, 8, 42, 2, 1, 250, 500, 62.5, 90]);
});

test("singular and plural both match, including z → ces", () => {
  const nuts = FL.catalog(plan, { products: { x123: { n: "Nuez natural Hacendado", nick: ["nuez"], u: "g", nut: [15, 7, 65, 650] } } });
  for (const t of ["30 nueces", "30 nuez", "30 g de nueces"]) {
    const r = FL.parse(t, nuts);
    assert.deepEqual(r.problems, [], t);
    assert.equal(r.items[0].k, "x123", t);
  }
  assert.equal(FL.parse("2 huevos, 100 judias verdes", nuts).items.map((i: any) => i.k).join(","), "egg,beans");
  assert.deepEqual(FL.nickClash(nuts, "xother", ["nueces"]), [{ n: "nueces", food: "Nuez natural Hacendado" }]);
});

test("anything not recognised is reported, never guessed", () => {
  const r = FL.parse("200 pizza, avena, 60 g atun, 3 pollo", cat);
  assert.equal(r.items.length, 0);
  assert.deepEqual(r.problems.map((p: any) => p.error), ["unknown", "amount", "unit", "tiny"]);
  assert.equal(r.problems[0].name, "pizza");
});

test("a plan meal turns into text that parses back to the same foods", () => {
  const d = 2, meal = PM.mealIngredients(plan, PM.defaultMenu(plan)[d][0], d, 0);
  for (const ing of [plan.fixed[0].ing, plan.fixed[1].ing, meal]) {
    const r = FL.parse(FL.textFor(ing, cat), cat);
    assert.deepEqual(r.problems, []);
    assert.deepEqual(Object.fromEntries(r.items.map((i: any) => [i.k, i.a])), ing);
    // same numbers as the plan's own maths, up to rounding
    const pm = PM.macros(plan, ing), fl = FL.sum(r.items);
    assert.ok(Math.abs(pm.p - fl.p) <= 1 && Math.abs(pm.k - fl.k) <= 10, JSON.stringify([pm, fl]));
  }
});

test("the day's status is said in words", () => {
  const t = { p: 140, c: 250, f: 65, k: 2200 };
  const st = FL.status({ p: 150, c: 200, f: 85, k: 1800 }, t);
  assert.deepEqual(st.map((x: any) => x.text), ["400 kcal to go", "Protein reached, 10 g above", "50 g carbs left", "20 g over your fat"]);
  assert.deepEqual(st.map((x: any) => x.tone), ["todo", "good", "todo", "over"]);
  assert.equal(FL.status({ p: 0, c: 0, f: 0, k: 2230 }, t)[0].text, "Calories on target");
  assert.equal(FL.status({ p: 0, c: 0, f: 0, k: 2500 }, t)[0].text, "300 kcal over");
});

test("the breakdown says where each macro came from, by meal and by food", () => {
  const es = [
    { slot: "breakfast", items: FL.parse("400 leche, 42 avena", cat).items },
    { slot: "lunch", items: FL.parse("150 pollo", cat).items },
    { slot: "breakfast", items: FL.parse("100 leche", cat).items },
  ];
  const b = FL.breakdown(es, "p");
  assert.deepEqual(b.slots.map((s: any) => s.slot), ["breakfast", "lunch"]);
  const bf = b.slots[0];
  assert.equal(bf.foods[0].n, "Leche semidesnatada");
  assert.equal(bf.foods[0].a, 500); // both milk entries together
  assert.equal(bf.pct + b.slots[1].pct, 100);
  assert.equal(b.total, 55.7); // 16 milk + 5.9 oats + 33.8 chicken
});

test("nicknames are cleaned and can't belong to two foods", () => {
  assert.deepEqual(FL.nicks("Avena, COPOS de avena,, avena"), ["avena", "copos de avena"]);
  assert.deepEqual(FL.nickClash(cat, "xnew", ["leche", "kefir"]), [{ n: "leche", food: "Leche semidesnatada" }]);
  assert.deepEqual(FL.nickClash(cat, "x86341", ["avena"]), []);
});

test("a logged food keeps its own values, so editing the product later doesn't rewrite the past", () => {
  const it = FL.parse("100 avena", cat).items[0];
  assert.deepEqual(it, { k: "x86341", n: "Copos de avena", a: 100, u: "g", m: [14, 59, 7, 375] });
});

test("foods and day logs are checked before they are stored", () => {
  assert.equal(validFoods({ products: { x86341: oats }, nick: { milk: ["leche"] }, meals: [{ id: "a1", name: "Desayuno", slot: "breakfast", text: "400 leche" }], targets: { p: 140, c: 250, f: 65, k: 2200 } }), true);
  assert.equal(validFoods({ products: { milk: oats } }), false); // own products start with x
  assert.equal(validFoods({ products: { x1: { ...oats, nut: [1, 2, 3] } } }), false);
  assert.equal(validFoods({ products: { x1: { ...oats, nick: ["<b>"] } } }), false);
  assert.equal(validFoods({ targets: { p: -1 } }), false);
  assert.equal(validFoods({ other: 1 }), false);
  const entry = { id: "e1", slot: "breakfast", text: "400 leche", items: FL.parse("400 leche, 42 avena", cat).items, at: "2026-11-11T08:00:00.000Z" };
  assert.equal(validLog({ entries: [entry] }), true);
  assert.equal(validLog({ entries: [{ ...entry, slot: "brunch" }] }), false);
  assert.equal(validLog({ entries: [{ ...entry, items: [] }] }), false);
  assert.equal(validState("log:2026-11-11", { entries: [entry] }), true);
  assert.equal(isStateKey("log:2026-11-11"), true);
  assert.equal(isStateKey("log:../x"), false);
});

test("training days and activities are checked before they are stored", () => {
  assert.equal(validTrain({ weekly: { "1": "A", "3": "B", "6": "C" }, moves: { "2026-11-16": "A", "2026-11-17": "-" } }), true);
  assert.equal(validTrain({ weekly: { "7": "A" } }), false);
  assert.equal(validTrain({ moves: { "monday": "A" } }), false);
  assert.equal(validTrain({ moves: { "2026-11-16": "D" } }), false);
  assert.equal(validState("train", { moves: {} }), true);
  assert.equal(validLog({ entries: [], acts: [{ id: "a1", t: "walk", km: 4.2, min: 50 }] }), true);
  assert.equal(validLog({ entries: [], acts: [{ id: "a1", t: "walk" }] }), false); // needs time or distance
  assert.equal(validLog({ entries: [], acts: [{ id: "a1", t: "swim", min: 30 }] }), false);
  assert.equal(validLog({ entries: [], acts: [{ id: "a1", t: "walk", min: 2000 }] }), false);
});

test("only the last five weeks of the food log are sent", () => {
  const v = { entries: [] };
  putState(9, "log:2026-11-11", v, "2026-11-11T10:00:00.000Z");
  putState(9, "log:2026-09-01", v, "2026-09-01T10:00:00.000Z");
  const s = getState(9, new Date("2026-11-11T12:00:00Z"));
  assert.ok(s["log:2026-11-11"]);
  assert.equal(s["log:2026-09-01"], undefined);
});

/* ---------- product lookup against fake store and Open Food Facts servers ---------- */
let store: Server, off: Server;
const listen = (s: Server) => new Promise<number>((r) => s.listen(0, "127.0.0.1", () => r((s.address() as any).port)));

test("a store link gives the name, size and barcode, Open Food Facts the values", async () => {
  store = createServer((req, res) => {
    const id = req.url!.split("/").filter(Boolean).pop();
    const P: Record<string, any> = {
      "86341": { display_name: "Copos de avena Brüggen", brand: "Brüggen", ean: "4008713713411", price_instructions: { unit_size: 0.8, size_format: "kg" } },
      "10382": { display_name: "Leche semidesnatada Hacendado", ean: "8402001002106", price_instructions: { unit_size: 1, size_format: "l" } },
      "555": { display_name: "Pan sin datos", ean: "1111111111111", price_instructions: { unit_size: 0.4, size_format: "kg" } },
    };
    if (!P[id!]) { res.writeHead(404); res.end("{}"); return; }
    res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(P[id!]));
  });
  off = createServer((req, res) => {
    const ean = req.url!.match(/(\d+)\.json/)![1];
    const N: Record<string, any> = {
      "4008713713411": { "proteins_100g": 14, "carbohydrates_100g": 59, "fat_100g": 7, "energy-kcal_100g": 375 },
      "8402001002106": { "proteins_100g": 0.7, "carbohydrates_100g": 4.7, "fat_100g": 1.6, "energy-kcal_100g": 120 },
    };
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(N[ean] ? { status: 1, product: { nutriments: N[ean] } } : { status: 0 }));
  });
  process.env.STORE_API_URL = `http://127.0.0.1:${await listen(store)}/api/products/`;
  process.env.OFF_API_URL = `http://127.0.0.1:${await listen(off)}/api/v2/product/`;
  delete require.cache[require.resolve("../src/food")];
  const { lookupProduct, productId, LookupError } = require("../src/food");

  assert.equal(productId("https://tienda.mercadona.es/product/86341/copos-avena-bruggen-caja"), "86341");
  assert.equal(productId(" 3400.1 "), "3400.1");
  assert.equal(productId("https://example.com/x"), null);

  const a = await lookupProduct("86341");
  assert.deepEqual(a, { id: "86341", name: "Copos de avena Brüggen", brand: "Brüggen", unit: "g", size: 800, ean: "4008713713411",
    nut: { p: 14, c: 59, f: 7, k: 375 }, source: "off", check: "ok" });
  const m = await lookupProduct("10382");
  assert.equal(m.unit, "ml"); assert.equal(m.size, 1000); assert.equal(m.check, "doesnt_add_up");
  const n = await lookupProduct("555");
  assert.equal(n.nut, null); assert.equal(n.check, "missing");
  await assert.rejects(lookupProduct("999"), (e: any) => e instanceof LookupError && e.code === "not_found");
});

after(() => { store?.close(); off?.close(); });
