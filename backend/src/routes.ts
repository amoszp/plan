import { Router, type NextFunction, type Request, type Response } from "express";
import {
  AccountsUnavailable,
  clearSessionCookie,
  clientInfo,
  forgetToken,
  login,
  logout,
  readToken,
  requireUser,
  setSessionCookie,
  signup,
} from "./auth";
import { BridgeError, gymEnsureRoutines, gymLast, gymLog, listSend } from "./bridges";
import { getState, isStateKey, putState } from "./db";
import { LookupError, lookupProduct, productId } from "./food";
import { catalogueReady, photoUrl, refresh, search } from "./catalog";
import { validDate, validItems, validName, validRoutines, validSets, validState, validTime } from "./validate";

export const router = Router();

const wrap =
  (fn: (req: Request, res: Response) => Promise<void> | void) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res)).catch((err) => {
      if (err instanceof AccountsUnavailable) {
        res.status(503).json({ error: "accounts service unavailable" });
        return;
      }
      if (err instanceof BridgeError) {
        console.error(`[bridge] ${err.app}: ${err.message}`);
        res.status(502).json({ error: err.app === "gym" ? "gym log unavailable" : "shopping list unavailable" });
        return;
      }
      next(err);
    });

// ---------- session ----------

router.post(
  "/auth/login",
  wrap(async (req, res) => {
    const { username, password } = req.body ?? {};
    if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
      res.status(400).json({ error: "username and password are required" });
      return;
    }
    if (username.length > 64 || password.length > 256) {
      res.status(401).json({ error: "wrong username or password" });
      return;
    }
    const { status, data } = await login(username, password, clientInfo(req));
    if (status !== 200) {
      res.status(status === 429 ? 429 : 401).json({ error: status === 429 ? "too many attempts" : "wrong username or password" });
      return;
    }
    setSessionCookie(res, data.token);
    res.json({ user: data.user });
  })
);

router.post(
  "/auth/signup",
  wrap(async (req, res) => {
    const { username, password, displayName } = req.body ?? {};
    if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
      res.status(400).json({ error: "username and password are required" });
      return;
    }
    if (username.length > 64 || password.length > 256 || (typeof displayName === "string" && displayName.length > 80)) {
      res.status(400).json({ error: "too long" });
      return;
    }
    const { status, data } = await signup(username, password, typeof displayName === "string" ? displayName : "", clientInfo(req));
    if (status === 201) {
      setSessionCookie(res, data.token);
      res.status(201).json({ user: data.user });
      return;
    }
    const code = status === 429 ? 429 : status === 409 ? 409 : 400;
    res.status(code).json({ error: code === 429 ? "too many sign-ups" : code === 409 ? "username taken" : data?.message ?? "invalid" });
  })
);

router.post(
  "/auth/logout",
  wrap(async (req, res) => {
    const token = readToken(req);
    if (token) {
      forgetToken(token);
      await logout(token);
    }
    clearSessionCookie(res);
    res.status(204).send();
  })
);

router.use(requireUser());

router.get("/auth/me", (req, res) => {
  res.json({ user: req.user });
});

// ---------- state: settings, the edited menu, foods and the food log ----------

router.get("/state", (req, res) => {
  res.json(getState(req.user!.id));
});

router.put("/state/:key", (req, res) => {
  const key = req.params.key;
  const { value, updatedAt } = req.body ?? {};
  if (!isStateKey(key) || !validState(key, value) || !validTime(updatedAt)) {
    res.status(400).json({ error: "invalid state" });
    return;
  }
  res.json(putState(req.user!.id, key, value, new Date(updatedAt).toISOString()));
});

// ---------- gym log (the gym app owns workouts, sets and routines) ----------

/** The current sign-in token, passed on so the gym app and the list app act for this same user. */
const token = (req: Request) => readToken(req)!;

router.post(
  "/gym/last",
  wrap(async (req, res) => {
    const { names, date } = req.body ?? {};
    if (!Array.isArray(names) || names.length > 20 || !names.every(validName) || !validDate(date)) {
      res.status(400).json({ error: "invalid request" });
      return;
    }
    res.json(await gymLast(token(req), names, date));
  })
);

router.post(
  "/gym/log",
  wrap(async (req, res) => {
    const { date, name, sets } = req.body ?? {};
    if (!validDate(date) || !validName(name) || !validSets(sets)) {
      res.status(400).json({ error: "invalid sets" });
      return;
    }
    res.json(await gymLog(token(req), date, name.trim(), sets));
  })
);

router.post(
  "/gym/routines",
  wrap(async (req, res) => {
    const routines = req.body?.routines;
    if (!validRoutines(routines)) {
      res.status(400).json({ error: "invalid routines" });
      return;
    }
    res.json(await gymEnsureRoutines(token(req), routines));
  })
);

// ---------- shopping list (the list app owns what's still to buy) ----------

router.post(
  "/list/send",
  wrap(async (req, res) => {
    const { list, items } = req.body ?? {};
    if (!validName(list) || !validItems(items)) {
      res.status(400).json({ error: "invalid list" });
      return;
    }
    res.json(await listSend(token(req), list.trim(), items));
  })
);

// ---------- food log: a product from the store, with its values from Open Food Facts ----------

router.get(
  "/food/lookup",
  wrap(async (req, res) => {
    const q = typeof req.query.q === "string" && req.query.q.length <= 300 ? req.query.q : "";
    const id = productId(q);
    if (!id) {
      res.status(400).json({ error: "not a product link" });
      return;
    }
    try {
      res.json(await lookupProduct(id));
    } catch (err) {
      if (!(err instanceof LookupError)) throw err;
      if (err.code === "unavailable") console.error(`[lookup] ${err.message}`);
      res.status(err.code === "not_found" ? 404 : 502).json({ error: err.code });
    }
  })
);

// ---------- food log: search the store's catalogue (the server's own daily copy) ----------

router.get("/food/search", (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.slice(0, 80) : "";
  void refresh();
  if (!catalogueReady()) {
    res.status(503).json({ error: "catalogue loading" });
    return;
  }
  res.json({
    items: search(q).map((p) => ({ id: p.id, name: p.name, pack: p.pack, price: p.price, size: p.size, fmt: p.fmt, img: p.thumb ? `/api/food/img/${p.id}` : null })),
  });
});

/** A product photo, fetched by the server: the page only loads its own files. */
router.get(
  "/food/img/:id",
  wrap(async (req, res) => {
    const url = /^\d{1,8}(?:\.\d{1,2})?$/.test(req.params.id) ? photoUrl(req.params.id) : null;
    if (!url) {
      res.status(404).end();
      return;
    }
    let r: globalThis.Response;
    try {
      r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    } catch {
      res.status(502).end();
      return;
    }
    const type = r.headers.get("content-type") ?? "";
    if (!r.ok || !/^image\/(jpeg|png|webp)$/.test(type.split(";")[0])) {
      res.status(502).end();
      return;
    }
    const body = Buffer.from(await r.arrayBuffer());
    if (body.length > 400000) {
      res.status(502).end();
      return;
    }
    res.set("Cache-Control", "private, max-age=604800").type(type).send(body);
  })
);
