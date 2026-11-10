"use strict";
/* The food maths, shared by the app and the tests (no DOM, no network).
   A menu is 14 days × [lunch, dinner]; each meal is { r: recipe id, v: flavour id, note?, swaps?: { from: to } }.
   Everything else (macros, shopping lists, costs) is worked out from the plan data and that menu. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PM = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const round5 = (g) => Math.max(5, Math.round(g / 5) * 5);

  /** The default two-week menu from the plan, as an editable copy. */
  function defaultMenu(plan) {
    return plan.menu.map((day) => day.map((m) => ({ r: m.r, v: m.v, note: m.note || "", swaps: {} })));
  }

  /** How much of `to` gives the same carbs (carb group) or protein (protein group) as `amount` of `from`. */
  function swapAmount(plan, from, to, amount) {
    const a = plan.ing[from], b = plan.ing[to];
    const k = a.group === "carb" ? 1 : 0; // index in nut: protein 0, carbs 1
    const per = (x) => (x.perunit ? x.nut[k] : x.nut[k] / 100);
    const want = amount * per(a);
    const raw = want / per(b);
    return b.perunit ? Math.max(1, Math.round(raw)) : round5(raw);
  }

  /** The ingredients of one meal on a day: recipe, flavour extras, swaps, and the football-day extra. */
  function mealIngredients(plan, meal, dayIndex, slot) {
    const rec = plan.recipes[meal.r];
    const out = {};
    for (const [i, a] of Object.entries(rec.ing)) {
      const to = meal.swaps && meal.swaps[i];
      if (to && to !== i) out[to] = (out[to] || 0) + swapAmount(plan, i, to, a);
      else out[i] = (out[i] || 0) + a;
    }
    const add = (plan.variants[meal.v] && plan.variants[meal.v].add) || {};
    for (const [i, a] of Object.entries(add)) out[i] = (out[i] || 0) + a;
    if (dayIndex % 7 === plan.football.day && slot === 0) {
      const carb = Object.keys(out).find((i) => plan.ing[i].group === "carb");
      if (carb) out[carb] += plan.football.extra[carb];
    }
    return out;
  }

  function fixedFor(plan, dayIndex) {
    const g = plan.afterLunchGrapes;
    return plan.fixed.map((f) =>
      f.name === "After lunch" && g.days.includes(dayIndex % 7) ? { name: f.name, ing: g.ing, text: g.text } : f
    );
  }

  function dayIngredients(plan, menu, dayIndex) {
    const out = {};
    const addAll = (ing) => { for (const [i, a] of Object.entries(ing)) out[i] = (out[i] || 0) + a; };
    fixedFor(plan, dayIndex).forEach((f) => addAll(f.ing));
    menu[dayIndex].forEach((m, slot) => addAll(mealIngredients(plan, m, dayIndex, slot)));
    return out;
  }

  /** Protein, carbs, fat (g) and kcal for a set of ingredients. */
  function macros(plan, ing) {
    const t = [0, 0, 0, 0];
    for (const [i, a] of Object.entries(ing)) {
      const x = plan.ing[i];
      const f = x.perunit ? a : a / 100;
      for (let k = 0; k < 4; k++) t[k] += x.nut[k] * f;
    }
    return { p: Math.round(t[0]), c: Math.round(t[1]), f: Math.round(t[2]), k: Math.round(t[3] / 10) * 10 };
  }

  function dayMacros(plan, menu, dayIndex) { return macros(plan, dayIngredients(plan, menu, dayIndex)); }

  function weekAverage(plan, menu, week) {
    const days = [0, 1, 2, 3, 4, 5, 6].map((d) => dayMacros(plan, menu, (week - 1) * 7 + d));
    const avg = (k) => Math.round(days.reduce((a, d) => a + d[k], 0) / 7);
    return { p: avg("p"), c: avg("c"), f: avg("f"), k: Math.round(days.reduce((a, d) => a + d.k, 0) / 70) * 10, days };
  }

  /** Cheapest mix of packs covering `amount`; ties go to less left over, then fewer packs. */
  function best(plan, packs, amount) {
    let bestc = null;
    const ranges = packs.map((p) => Math.ceil(amount / p.amount) + 2);
    const counts = packs.map(() => 0);
    (function walk(k) {
      if (k === packs.length) {
        const cov = counts.reduce((a, c, j) => a + c * packs[j].amount, 0);
        if (cov + 1e-9 < amount) return;
        const cost = counts.reduce((a, c, j) => a + c * packs[j].price, 0);
        const n = counts.reduce((a, c) => a + c, 0);
        if (!bestc || cost < bestc.cost - 1e-9 || (Math.abs(cost - bestc.cost) < 1e-9 && (cov < bestc.cov || (cov === bestc.cov && n < bestc.n))))
          bestc = { cost, cov, n, counts: counts.slice() };
        return;
      }
      for (let c = 0; c <= ranges[k]; c++) { counts[k] = c; walk(k + 1); }
    })(0);
    return bestc;
  }

  /** What to buy for the menu: big shop (week 1 fresh + everything else for 2 weeks), top-up (week 2 fresh), pantry. */
  function shopping(plan, menu) {
    const need = [{}, {}];
    for (let d = 0; d < 14; d++) {
      const w = d < 7 ? 0 : 1;
      for (const [i, a] of Object.entries(dayIngredients(plan, menu, d))) need[w][i] = (need[w][i] || 0) + a;
    }
    const shop1 = {}, shop2 = {}, pantry = {};
    for (const [i, x] of Object.entries(plan.ing)) {
      const n1 = need[0][i] || 0, n2 = need[1][i] || 0;
      if (!(n1 + n2)) continue;
      const packs = x.packs.map((id) => ({ id, amount: plan.prod[id].amount, price: plan.prod[id].price }));
      const put = (target, b) => b.counts.forEach((c, j) => { if (c) target[packs[j].id] = (target[packs[j].id] || 0) + c; });
      if (x.weekly) {
        const b1 = best(plan, packs, n1);
        put(shop1, b1);
        const left = b1.cov - n1;
        if (n2 - left > 0) put(shop2, best(plan, packs, n2 - left));
      } else put(x.pantry ? pantry : shop1, best(plan, packs, n1 + n2));
    }
    const list = (o) => Object.entries(o).map(([id, qty]) => ({ id, qty, ing: plan.prod[id].ing }));
    const cost = (o) => Math.round(Object.entries(o).reduce((a, [id, q]) => a + plan.prod[id].price * q, 0) * 100) / 100;
    // What two weeks of food actually costs (packs used up, not packs bought), for the monthly estimate.
    let usage = 0;
    for (const [i, x] of Object.entries(plan.ing)) {
      const n = (need[0][i] || 0) + (need[1][i] || 0);
      if (n) usage += n * Math.min(...x.packs.map((id) => plan.prod[id].price / plan.prod[id].amount));
    }
    return { shop1: list(shop1), shop2: list(shop2), pantry: list(pantry), raw: { shop1, shop2, pantry },
             totals: { shop1: cost(shop1), shop2: cost(shop2), pantry: cost(pantry), month: Math.round(usage * 4.33 / 2 * 100) / 100 } };
  }

  /** Validates a stored menu against the plan; anything unknown falls back to the default for that meal. */
  function cleanMenu(plan, menu) {
    const def = defaultMenu(plan);
    if (!Array.isArray(menu) || menu.length !== 14) return def;
    return def.map((day, d) => day.map((m, s) => {
      const x = menu[d] && menu[d][s];
      if (!x || !plan.recipes[x.r] || !plan.variants[x.v]) return m;
      const swaps = {};
      for (const [from, to] of Object.entries(x.swaps || {})) {
        const g = plan.ing[from] && plan.ing[from].group;
        if (g && plan.ing[to] && plan.ing[to].group === g && plan.recipes[x.r].ing[from] !== undefined) swaps[from] = to;
      }
      return { r: x.r, v: x.v, note: typeof x.note === "string" ? x.note.slice(0, 120) : "", swaps };
    }));
  }

  return { defaultMenu, swapAmount, mealIngredients, fixedFor, dayIngredients, macros, dayMacros, weekAverage, shopping, cleanMenu };
});
