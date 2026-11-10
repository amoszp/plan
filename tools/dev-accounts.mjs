// Stand-ins for local development, all in memory. Never used in production.
//   accounts service  :4699  one user, demo / demo
//   gym log app API   :4698  GET /api/state, POST /api/sync (documents per user, like the real one)
//   list app API      :4697  GET /api/state, POST /api/ops (lists and items)
// Run: node tools/dev-accounts.mjs, then start the server with
//   ACCOUNTS_URL=http://127.0.0.1:4699 GYMAKER_URL=http://127.0.0.1:4698 MERCHECK_URL=http://127.0.0.1:4697
import { createServer } from "node:http";

const user = { id: 1, username: "demo", displayName: "Demo", isAdmin: false };
const tokens = new Set();
const authed = (req) => tokens.has((req.headers.authorization || "").replace(/^Bearer /, ""));

function serve(port, name, handle) {
  createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const send = (status, json) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(json)); };
      try { handle(req, body ? JSON.parse(body) : {}, send); } catch (e) { send(400, { error: String(e) }); }
    });
  }).listen(port, () => console.log(`dev ${name} on ${port}`));
}

serve(4699, "accounts", (req, data, send) => {
  if (req.url === "/v1/login") {
    if (data.username === "demo" && data.password === "demo") { const t = "t" + Math.random().toString(36).slice(2); tokens.add(t); return send(200, { token: t, user }); }
    return send(401, { error: "wrong" });
  }
  if (req.url === "/v1/verify") return tokens.has(data.token) ? send(200, { user }) : send(401, {});
  if (req.url === "/v1/logout") { tokens.delete(data.token); return send(200, {}); }
  if (req.url === "/v1/signup") return send(409, { message: "taken" });
  send(404, {});
});

// The gym app has its own default routines and one earlier workout, like a real account.
const gym = {
  workouts: { "2026-11-05": { dateKey: "2026-11-05", exercises: [{ id: "g1", name: "Goblet squat", tags: [], sets: [{ id: "a", weight: 12, reps: 12 }, { id: "b", weight: 14, reps: 10 }, { id: "c", weight: 12, reps: 11 }] }] } },
  routines: [{ id: "r1", name: "Push", exercises: [] }],
  library: { "goblet squat": { name: "Goblet squat", tags: [], lastUsed: { dateKey: "2026-11-05", tags: [], sets: [{ id: "a", weight: 12, reps: 12 }, { id: "b", weight: 14, reps: 10 }, { id: "c", weight: 12, reps: 11 }] } } },
  prefs: { weightIncrement: 2.5, weekStartsOn: 1 },
};
serve(4698, "gym", (req, data, send) => {
  // Read-only view for local testing: open http://127.0.0.1:4698/ in a browser.
  if (req.method === "GET" && req.url === "/") return send(200, { routines: gym.routines.map((r) => r.name), workouts: gym.workouts });
  if (!authed(req)) return send(401, { error: "login required" });
  if (req.url === "/api/state") return send(200, gym);
  if (req.url === "/api/sync") {
    for (const c of data.changes) {
      if (c.kind === "workout") { if (c.data === null) delete gym.workouts[c.key]; else gym.workouts[c.key] = c.data; }
      else gym[c.kind] = c.data;
    }
    return send(200, { applied: data.changes.length });
  }
  send(404, {});
});

const lists = { lists: [{ id: "L0", name: "Casa", items: [{ id: "i0", name: "Arena Anodesin", checked: false, quantity: 1 }] }] };
serve(4697, "list", (req, data, send) => {
  // Read-only view for local testing: open http://127.0.0.1:4697/ in a browser.
  if (req.method === "GET" && req.url === "/") return send(200, lists);
  if (!authed(req)) return send(401, { error: "login required" });
  if (req.url === "/api/state") return send(200, lists);
  if (req.url === "/api/ops") {
    const l = lists.lists.find((x) => x.id === data.listId);
    if (data.type === "addList") lists.lists.push({ ...data.list, items: [] });
    else if (data.type === "addItem") l.items.push(data.item);
    else if (data.type === "setItemChecked") l.items.find((i) => i.id === data.itemId).checked = data.checked;
    else if (data.type === "setQuantity") l.items.find((i) => i.id === data.itemId).quantity = data.quantity;
    else return send(400, { error: "unknown operation" });
    return send(200, lists);
  }
  send(404, {});
});
