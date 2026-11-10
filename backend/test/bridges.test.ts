import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

process.env.GYMAKER_URL = "http://gym.test";
process.env.MERCHECK_URL = "http://list.test";

// Fake gym and list servers: every request is recorded and answered from in-memory state.
let gym: any;
let lists: any;
let calls: { url: string; method: string; body: any; auth: string | null }[];

globalThis.fetch = (async (url: string, init: any = {}) => {
  const body = init.body ? JSON.parse(init.body) : undefined;
  calls.push({ url, method: init.method, body, auth: init.headers?.authorization ?? null });
  const ok = (data: unknown) => new Response(JSON.stringify(data), { status: 200 });
  if (url === "http://gym.test/api/state") return ok(gym);
  if (url === "http://gym.test/api/sync") {
    for (const c of body.changes) {
      if (c.kind === "workout") c.data === null ? delete gym.workouts[c.key] : (gym.workouts[c.key] = c.data);
      else gym[c.kind] = c.data;
    }
    return ok({ applied: body.changes.length });
  }
  if (url === "http://list.test/api/state") return ok(lists);
  if (url === "http://list.test/api/ops") {
    const l = lists.lists.find((x: any) => x.id === body.listId);
    if (body.type === "addList") lists.lists.push({ ...body.list, items: [] });
    if (body.type === "addItem") l.items.push(body.item);
    if (body.type === "setItemChecked") l.items.find((i: any) => i.id === body.itemId).checked = body.checked;
    if (body.type === "setQuantity") l.items.find((i: any) => i.id === body.itemId).quantity = body.quantity;
    return ok(lists);
  }
  return new Response("not found", { status: 404 });
}) as typeof fetch;

const { gymLast, gymLog, gymEnsureRoutines, listSend, BridgeError } = require("../src/bridges");

beforeEach(() => {
  calls = [];
  gym = {
    workouts: { "2026-11-12": { dateKey: "2026-11-12", exercises: [{ id: "x", name: "Press banca", tags: [], sets: [{ id: "s", weight: 50, reps: 8 }] }] } },
    routines: [{ id: "r1", name: "Push", exercises: [] }],
    library: { "goblet squat": { name: "Goblet squat", tags: [], lastUsed: { dateKey: "2026-11-05", tags: [], sets: [{ id: "a", weight: 12, reps: 12 }, { id: "b", weight: 14, reps: 10 }] } } },
    prefs: { weightIncrement: 2.5, weekStartsOn: 1 },
  };
  lists = { lists: [{ id: "L1", name: "Plan · Big shop", items: [{ id: "i1", name: "Huevos", checked: false, quantity: 1 }] }] };
});

test("last time's sets come back set by set, with the user's own token", async () => {
  const r = await gymLast("tok-1", ["Goblet squat", "Plank"], "2026-11-12");
  assert.deepEqual(r.exercises["Goblet squat"].last, [{ weight: 12, reps: 12 }, { weight: 14, reps: 10 }]);
  assert.equal(r.exercises["Plank"].last.length, 0);
  assert.deepEqual(r.routines, ["Push"]);
  assert.equal(calls[0].auth, "Bearer tok-1");
});

test("last time stays the earlier session after today's sets are logged", async () => {
  gym.workouts["2026-11-05"] = { dateKey: "2026-11-05", exercises: [{ id: "g", name: "Goblet squat", tags: [], sets: [{ id: "a", weight: 12, reps: 12 }, { id: "b", weight: 14, reps: 10 }] }] };
  await gymLog("t", "2026-11-12", "Goblet squat", [{ weight: 16, reps: 8 }]);
  const r = await gymLast("t", ["Goblet squat"], "2026-11-12");
  assert.equal(r.exercises["Goblet squat"].lastDate, "2026-11-05");
  assert.deepEqual(r.exercises["Goblet squat"].last.map((s: any) => s.weight), [12, 14]);
  assert.deepEqual(r.exercises["Goblet squat"].today, [{ weight: 16, reps: 8 }]);
});

test("logging adds the exercise to that day's workout, keeps the rest, and updates last used", async () => {
  await gymLog("t", "2026-11-12", "Goblet squat", [{ weight: 12, reps: 12 }, { weight: 14, reps: 10 }, { weight: 12, reps: 11 }]);
  const day = gym.workouts["2026-11-12"];
  assert.equal(day.exercises.length, 2);
  assert.equal(day.exercises[0].name, "Press banca");
  assert.deepEqual(day.exercises[1].sets.map((s: any) => s.weight), [12, 14, 12]);
  assert.ok(day.exercises[1].sets[1].e1RM > 0);
  assert.equal(gym.library["goblet squat"].lastUsed.dateKey, "2026-11-12");
  // Logging again replaces that exercise's sets instead of adding a second copy.
  await gymLog("t", "2026-11-12", "goblet squat", [{ weight: 16, reps: 8 }]);
  assert.equal(gym.workouts["2026-11-12"].exercises.length, 2);
  assert.deepEqual(gym.workouts["2026-11-12"].exercises[1].sets.map((s: any) => s.weight), [16]);
});

test("a new day gets its own workout document", async () => {
  await gymLog("t", "2026-11-14", "Plank", [{ weight: "", reps: 40 }]);
  assert.equal(gym.workouts["2026-11-14"].dateKey, "2026-11-14");
  // Removing the only exercise removes the day.
  await gymLog("t", "2026-11-14", "Plank", []);
  assert.equal(gym.workouts["2026-11-14"], undefined);
});

test("routines are only added when missing, and never before the gym app has its own", async () => {
  const seed = [{ name: "Home A", exercises: [{ name: "Goblet squat", sets: 3 }] }, { name: "Push", exercises: [] }];
  const r = await gymEnsureRoutines("t", seed);
  assert.deepEqual(r.added, ["Home A"]);
  assert.equal(gym.routines.length, 2);
  assert.deepEqual((await gymEnsureRoutines("t", seed)).added, []);
  gym.routines = null;
  assert.equal((await gymEnsureRoutines("t", seed)).waiting, true);
});

test("sending the shopping list adds new items and puts existing ones back to buy", async () => {
  const r = await listSend("t", "Plan · Big shop", [{ name: "Huevos", quantity: 1 }, { name: "Spaghetti", quantity: 2 }]);
  assert.deepEqual(r, { list: "Plan · Big shop", added: 1, updated: 1 });
  const items = lists.lists[0].items;
  assert.equal(items.find((i: any) => i.name === "Huevos").checked, true);
  assert.equal(items.find((i: any) => i.name === "Spaghetti").quantity, 2);
});

test("a missing list is created", async () => {
  await listSend("t", "Plan · Top-up", [{ name: "Panecillos", quantity: 1 }]);
  assert.equal(lists.lists.length, 2);
  assert.equal(lists.lists[1].items[0].name, "Panecillos");
});

test("an app that can't be reached is reported as that app", async () => {
  const saved = globalThis.fetch;
  globalThis.fetch = (async () => { throw new Error("ECONNREFUSED"); }) as typeof fetch;
  await assert.rejects(gymLast("t", ["x"], "2026-11-12"), (e: any) => e instanceof BridgeError && e.app === "gym");
  globalThis.fetch = saved;
});
