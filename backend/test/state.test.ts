import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), "homeblock-")), "test.db");

const { getState, putState } = require("../src/db");
const { validSettings, validMenu, validSets, validRoutines, validItems } = require("../src/validate");

const meal = (r = "R1", v = "pimenton") => ({ r, v, note: "", swaps: {} });
const menu = () => Array.from({ length: 14 }, () => [meal(), meal("R3", "oregano")]);

test("state is kept per user", () => {
  putState(1, "settings", { sets: 3 }, "2026-11-10T10:00:00.000Z");
  putState(2, "settings", { sets: 2 }, "2026-11-10T10:00:00.000Z");
  assert.deepEqual(getState(1).settings.value, { sets: 3 });
  assert.deepEqual(getState(2).settings.value, { sets: 2 });
});

test("an older change never overwrites a newer one", () => {
  const newer = menu();
  newer[0][0] = meal("R2", "mojo");
  putState(3, "menu", newer, "2026-11-10T12:00:00.000Z");
  // A phone that was offline sends an earlier edit after the newer one arrived.
  const kept = putState(3, "menu", menu(), "2026-11-10T11:00:00.000Z");
  assert.equal(kept.value[0][0].r, "R2");
  assert.equal(getState(3).menu.value[0][0].r, "R2");
});

test("settings and menus are checked", () => {
  assert.equal(validSettings({ sets: "auto" }), true);
  assert.equal(validSettings({ rest: 90 }), false);
  assert.equal(validMenu(menu()), true);
  assert.equal(validMenu(menu().slice(0, 7)), false);
  const bad = menu();
  bad[0][0] = { r: "<script>", v: "pimenton" } as any;
  assert.equal(validMenu(bad), false);
  const swapped = menu();
  swapped[2][0] = { ...meal("R2", "mojo"), swaps: { rice: "potato" } };
  assert.equal(validMenu(swapped), true);
});

test("sets, routines and list items are checked", () => {
  assert.equal(validSets([{ weight: 12, reps: 10 }, { weight: "", reps: 15 }]), true);
  assert.equal(validSets([{ weight: -1, reps: 10 }]), false);
  assert.equal(validRoutines([{ name: "Home A", exercises: [{ name: "Goblet squat", sets: 3, defaultWeight: 10 }] }]), true);
  assert.equal(validRoutines([{ name: "", exercises: [] }]), false);
  assert.equal(validItems([{ name: "Huevos", quantity: 1 }]), true);
  assert.equal(validItems([{ name: "Huevos", quantity: 0 }]), false);
});
