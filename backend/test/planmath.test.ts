import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The app's food maths must give the same numbers as the plan builder for the unedited menu.
const PM = require("../../frontend/planmath.js");
const plan = JSON.parse(readFileSync(join(__dirname, "../../frontend/data/plan.json"), "utf8"));

test("every day's macros match the plan builder", () => {
  const menu = PM.defaultMenu(plan);
  for (let d = 0; d < 14; d++) assert.deepEqual(PM.dayMacros(plan, menu, d), plan.expected.days[d], `day ${d}`);
});

test("the shopping lists match the plan builder", () => {
  const s = PM.shopping(plan, PM.defaultMenu(plan));
  const merged = { ...s.raw.shop1, ...s.raw.pantry };
  assert.deepEqual(merged, plan.expected.shop1);
  assert.deepEqual(s.raw.shop2, plan.expected.shop2);
});

test("swapping rice for papas keeps the carbs and changes the day's numbers", () => {
  const menu = PM.defaultMenu(plan);
  const d = 2; // Wednesday week 1: lunch R2 (chicken, rice, judías)
  assert.equal(menu[d][0].r, "R2");
  const before = PM.dayMacros(plan, menu, d);
  menu[d][0].swaps = { rice: "potato" };
  const ing = PM.mealIngredients(plan, menu[d][0], d, 0);
  assert.equal(ing.rice, undefined);
  assert.equal(ing.potato, 275); // 60 g rice ≈ 47 g carbs ≈ 275 g papas
  const after = PM.dayMacros(plan, menu, d);
  assert.ok(Math.abs(after.c - before.c) <= 2, "carbs about the same");
  assert.notDeepEqual(after, before);
});

test("protein swaps keep the protein and use whole tins and eggs", () => {
  assert.equal(PM.swapAmount(plan, "chicken", "tuna", 160), 3); // 36 g protein ≈ 3 tins
  assert.equal(PM.swapAmount(plan, "tuna", "egg", 2), 3);
  assert.equal(PM.swapAmount(plan, "chicken", "caballa", 150), 2);
});

test("copying a meal to other days changes the shopping list", () => {
  const menu = PM.defaultMenu(plan);
  for (const d of [0, 1, 2]) menu[d][0] = { r: "R2", v: "mojo", note: "", swaps: {} };
  const s = PM.shopping(plan, menu);
  assert.notDeepEqual(s.raw.shop1, plan.expected.shop1);
  assert.ok(s.totals.shop1 > 0);
});

test("the football Saturday adds carbs to lunch whatever the carb is", () => {
  const menu = PM.defaultMenu(plan);
  const sat = 5;
  const plain = PM.mealIngredients(plan, menu[sat][0], 4, 0); // same meal on a Friday
  const football = PM.mealIngredients(plan, menu[sat][0], sat, 0);
  assert.equal(football.pasta - plain.pasta, 30);
});

test("a stored menu with unknown recipes or wrong swaps falls back safely", () => {
  const menu = PM.defaultMenu(plan);
  menu[0][0] = { r: "R99", v: "pimenton", swaps: {} };
  menu[0][1] = { r: "R3", v: "oregano", swaps: { pasta: "chicken", tuna: "egg" } };
  const clean = PM.cleanMenu(plan, menu);
  assert.equal(clean[0][0].r, plan.menu[0][0].r);
  assert.deepEqual(clean[0][1].swaps, { tuna: "egg" });
  assert.equal(PM.cleanMenu(plan, "nope").length, 14);
});
