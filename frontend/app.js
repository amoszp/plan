"use strict";
/* Home training and food plan. One app for PC and phone: wide screens open on Train, phones on Today.
   EX and SESS come from exercises.js, the food maths from planmath.js (PM), the plan from data/plan.json.
   What this app keeps: settings, the edited menu and the food log (own products, saved meals, one log
   per day; the log maths is in foodlog.js, FL). All on the device first, then synced to the account.
   What it doesn't: sets and weights live in the gym log app, the shopping list in the list app;
   the server passes them on with the user's own sign-in. */

const CYCLE_START = new Date("2026-11-16T00:00:00");
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAYS_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SLOTS = ["Lunch", "Dinner"];
// Default training week (0 = Monday). Single dates can be changed on Today; the default in Settings.
const DEFAULT_WEEK = { 1: "A", 3: "B", 6: "C" };
const ACTS = [["walk", "Walk"], ["run", "Run"], ["bike", "Bike"], ["football", "Football"], ["padel", "Padel"], ["other", "Other"]];
const ACT_LABEL = Object.fromEntries(ACTS);
const SESS_DESC = { A: "Legs, push-ups, rows", B: "Legs, rows, shoulders, arms", C: "16-minute circuit" };
const ROUTINE_NAME = (k) => `Home ${k}`;
const LIST_NAME = { shop1: "Plan · Big shop", shop2: "Plan · Top-up", pantry: "Plan · Pantry" };
const AISLES = [
  ["Fruit and veg", ["banana", "pear", "grapes", "potato"]],
  ["Bakery", ["bread"]],
  ["Deli and cheese", ["lomo", "cheese"]],
  ["Dairy and eggs", ["milk", "burgos", "batido", "egg"]],
  ["Rice, pasta and tins", ["rice", "pasta", "tuna", "caballa", "tomato"]],
  ["Oil and sauces", ["oil", "mojo", "soy"]],
  ["Breakfast and snacks", ["cacao", "coffee", "peanuts"]],
  ["Frozen", ["chicken", "onion", "pepper", "beans"]],
];
const DEFAULT_SETTINGS = { sets: "auto" };

const eur = (n) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
const fmt = (s) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const wd = (d) => (d.getDay() + 6) % 7;
const addDays = (day, n) => { const d = new Date(day + "T12:00:00"); d.setDate(d.getDate() + n); return isoDay(d); };
const dayName = (day, opts = { weekday: "long", day: "numeric", month: "long" }) => new Date(day + "T12:00:00").toLocaleDateString("en-GB", opts);
const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const exImg = (name) => [`img/ex/${name}-0.jpg`, `img/ex/${name}-1.jpg`];
const num = (n) => n.toLocaleString("es-ES");
const firstInt = (s) => { const m = String(s).match(/\d+/); return m ? +m[0] : 10; };
const clone = (x) => JSON.parse(JSON.stringify(x));

const ICON = {
  today: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  menu: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  train: '<path d="M14.4 14.4 9.6 9.6"/><path d="M18.66 21.49a2 2 0 1 1-2.83-2.83l-1.77 1.77a2 2 0 1 1-2.83-2.83l6.37-6.36a2 2 0 1 1 2.82 2.83l-1.76 1.76a2 2 0 1 1 2.83 2.83z"/><path d="m21.5 21.5-1.4-1.4M3.9 3.9 2.5 2.5"/><path d="M6.4 12.77a2 2 0 1 1-2.83-2.83l1.77-1.77a2 2 0 1 1-2.83-2.83l2.83-2.82a2 2 0 1 1 2.83 2.82l1.76-1.76a2 2 0 1 1 2.83 2.83z"/>',
  cook: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
  buy: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
  settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  log: '<path d="M12 20h9"/><path d="M16.38 3.62a1 1 0 0 1 3 3L7.37 18.63a2 2 0 0 1-.86.5l-2.87.84a.5.5 0 0 1-.62-.62l.84-2.87a2 2 0 0 1 .5-.86z"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  edit: '<path d="M21.17 6.81a1 1 0 0 0-3.98-3.98L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  left: '<path d="m15 18-6-6 6-6"/>', right: '<path d="m9 18 6-6-6-6"/>', down: '<path d="m6 9 6 6 6-6"/>',
  plus: '<path d="M5 12h14M12 5v14"/>', minus: '<path d="M5 12h14"/>',
  timer: '<path d="M10 2h4M12 14l3-3"/><circle cx="12" cy="14" r="8"/>',
  copy: '<rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  swap: '<path d="M8 3 4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4"/>',
  grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
  reset: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  cloudOff: '<path d="m2 2 20 20"/><path d="M5.78 5.78A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.31-.2M21.53 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7 7 0 0 0 9.5 5.07"/>',
};
const ic = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;

/* ---------- local storage (can be unavailable: private mode) ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem("hb:" + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("hb:" + k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem("hb:" + k); } catch {} },
};

/* ---------- server ---------- */
async function api(method, path, body) {
  const res = await fetch("/api" + path, {
    method, credentials: "same-origin",
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch {}
  return { status: res.status, data };
}

/* ================================================================ */
class App {
  constructor(root, plan) {
    this.root = root; this.F = plan; this.P = plan.prod; this.R = plan.recipes; this.V = plan.variants;
    this.now = new Date();
    this.todayWd = wd(this.now);
    const dayIdx = Math.floor((new Date(this.now.getFullYear(), this.now.getMonth(), this.now.getDate()) - CYCLE_START) / 86400000);
    this.started = dayIdx >= 0;
    this.curWeek = this.started ? (Math.floor(dayIdx / 7) % 2) + 1 : 1;
    this.view = root.clientWidth >= 760 ? "train" : "today";
    this.back = this.view;
    this.week = this.curWeek; this.day = this.todayWd;
    this.menuWeek = this.curWeek; this.sel = null; this.mode = null; this.copyDays = new Set(); this.copySlot = 0; this.drop = null; this.confirmMenuReset = false;
    this.cook = null; this.ingTicks = new Set();
    this.shop = "shop1"; this.sending = false;
    // Items unticked in Buy (not sent to the list app), per list; everything is ticked by default.
    this.skip = store.get("skip", { shop1: [], shop2: [], pantry: [] });
    this.online = navigator.onLine;
    // Synced state: each entry {value, updatedAt, dirty}.
    this.sync = store.get("sync", {});
    this.settings = { ...DEFAULT_SETTINGS, ...(this.sync.settings?.value || {}) };
    this.menu = PM.cleanMenu(plan, this.sync.menu?.value);
    // Food log: days older than the server sends are dropped from this device too.
    const oldest = isoDay(new Date(this.now.getTime() - 35 * 86400000));
    for (const k of Object.keys(this.sync)) if (k.startsWith("log:") && k.slice(4) < oldest && !this.sync[k].dirty) delete this.sync[k];
    this.foods = this.sync.foods?.value || {};
    this.logDay = isoDay(this.now); this.logText = store.get("logdraft", ""); this.logSlot = FL.slotAt(this.now);
    this.logMacro = "p"; this.logMode = null; this.form = null; this.saveMeal = null; this.confirmDel = null; this.meal = null;
    this.navDepth = 0; this.skipPop = 0; this.menuFrom = null;
    // Training: what's typed on this device today, and sets waiting to reach the gym log.
    this.gym = { key: null, loading: false, error: false, data: {} };
    this.gymQueue = store.get("gymq", {});
    this.routineState = store.get("routines", null);
    this.trainPlan = this.sync.train?.value || {};
    this.moveFrom = null; this.addSess = null; this.actForm = null;
    this.sess = this.sessOn(isoDay(this.now)) || "A";
    this.loadTrain();
  }

  /* ---------- auth ---------- */
  async start() {
    let me;
    try { me = await api("GET", "/auth/me"); } catch { me = null; }
    if (me && me.status === 200) { this.user = me.data.user; store.set("user", this.user); }
    else if (me && me.status === 401) { store.del("user"); return this.showAuth("login"); }
    else {
      // Server unreachable: carry on offline if this device has signed in before.
      this.user = store.get("user", null); this.online = false;
      if (!this.user) return this.showAuth("login", "Can't reach the server. Check the connection and try again.");
    }
    this.mount();
    this.pull();
  }
  showAuth(mode, msg = "") {
    const signup = mode === "signup";
    this.$body = null;
    this.root.innerHTML = `<div class="auth"><form id="authForm" novalidate>
      <h1>${signup ? "Create an account" : "Sign in"}</h1>
      ${signup ? `<div class="field"><label for="fName">Your name</label><input id="fName" autocomplete="name" maxlength="80"></div>` : ""}
      <div class="field"><label for="fUser">Username</label><input id="fUser" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="64" required></div>
      <div class="field"><label for="fPass">Password</label><input id="fPass" type="password" autocomplete="${signup ? "new-password" : "current-password"}" maxlength="256" required></div>
      <p class="err" id="authErr" ${msg ? "" : "hidden"}>${esc(msg)}</p>
      <button class="btn big primary" type="submit" id="authGo">${signup ? "Create account" : "Sign in"}</button>
      <button class="btn quiet" type="button" id="authSwap">${signup ? "I already have an account" : "Create an account"}</button>
    </form></div>`;
    const $ = (id) => this.root.querySelector("#" + id);
    $("authSwap").onclick = () => this.showAuth(signup ? "login" : "signup");
    $("fUser").focus();
    $("authForm").onsubmit = async (e) => {
      e.preventDefault();
      const username = $("fUser").value.trim(), password = $("fPass").value;
      const err = $("authErr"), go = $("authGo");
      if (!username || !password) { err.hidden = false; err.textContent = "Enter your username and password."; return; }
      go.classList.add("busy"); go.textContent = signup ? "Creating account" : "Signing in";
      let r;
      try { r = await api("POST", signup ? "/auth/signup" : "/auth/login", signup ? { username, password, displayName: $("fName").value.trim() } : { username, password }); }
      catch { r = { status: 0 }; }
      if (r.status === 200 || r.status === 201) { this.user = r.data.user; store.set("user", this.user); this.online = true; this.mount(); this.pull(); return; }
      go.classList.remove("busy"); go.textContent = signup ? "Create account" : "Sign in";
      err.hidden = false;
      err.textContent = {
        0: "Can't reach the server. Check the connection and try again.",
        401: "Wrong username or password.",
        409: "That username is taken. Pick another one.",
        429: "Too many attempts. Wait 15 minutes and try again.",
        503: "Sign-in isn't available right now. Try again in a minute.",
      }[r.status] || "That didn't work. Check what you typed and try again.";
    };
  }

  /* ---------- shell ---------- */
  mount() {
    const NAV = { today: "Today", log: "Log", menu: "Menu", train: "Train", cook: "Cook", buy: "Buy" };
    this.root.innerHTML = `<div class="app">
      <header class="app-head"><button type="button" class="icon-btn head-back" data-act="headback" hidden>${ic("left")}</button><h1 data-r="title" tabindex="-1"></h1><button type="button" class="icon-btn head-set" data-go="settings" aria-label="Settings">${ic("settings")}</button></header>
      <main class="body" data-r="body"></main>
      <nav class="nav" aria-label="Pages">
        ${Object.entries(NAV).map(([v, l]) => `<button type="button" data-go="${v}"${v === "menu" ? ' class="wide-nav"' : ""}>${ic(v)}<span>${l}</span></button>`).join("")}
        <button type="button" class="set-btn" data-go="settings">${ic("settings")}<span>Settings</span></button>
      </nav></div>`;
    this.$title = this.root.querySelector('[data-r="title"]');
    this.$body = this.root.querySelector('[data-r="body"]');
    if (!this.wired) {
      this.wired = true;
      this.root.addEventListener("click", (e) => this.onClick(e));
      this.root.addEventListener("change", (e) => this.onChange(e));
      this.root.addEventListener("input", (e) => this.onInput(e));
      this.root.addEventListener("dragstart", (e) => this.onDrag(e));
      this.root.addEventListener("dragover", (e) => this.onDrag(e));
      this.root.addEventListener("dragleave", (e) => this.onDrag(e));
      this.root.addEventListener("drop", (e) => this.onDrag(e));
      this.root.addEventListener("dragend", (e) => this.onDrag(e));
      document.addEventListener("keydown", (e) => { if (this.key(e)) e.preventDefault(); });
      // The phone's Back (and the browser's) closes whatever was opened last, instead of leaving the app.
      window.addEventListener("popstate", () => {
        if (this.skipPop > 0) { this.skipPop--; return; }
        this.navDepth = Math.max(0, this.navDepth - 1);
        this.closeTop(true);
      });
      window.addEventListener("online", () => { this.online = true; this.pull(); });
      window.addEventListener("offline", () => { this.online = false; this.render(); });
      document.addEventListener("visibilitychange", () => { if (!document.hidden) this.pull(); });
      setInterval(() => this.tick(), 250);
      setInterval(() => { if (!document.hidden) this.pull(); }, 60000);
    }
    this.render();
  }
  go(v, fromNav = false) {
    this.popNav(this.navDepth);                                                 // a page from the menu starts a fresh path
    if (v === "settings" && this.view === "settings") v = this.back;           // the settings button closes Settings again
    // Pressing Cook in the menu while a recipe is open goes back to the recipe list.
    else if (fromNav && v === "cook" && this.view === "cook" && this.cook && this.cook.step < 0) this.cook = null;
    if (v !== "settings") this.back = v;
    if (v !== "menu") { this.sel = null; this.mode = null; this.drop = null; }
    if (v !== "log") { this.logMode = null; this.form = null; this.saveMeal = null; this.confirmDel = null; this.meal = null; }
    this.menuFrom = null;
    this.view = v; this.confirmMenuReset = false;
    if (v === "settings") this.pushNav();
    this.render({ top: true });
    this.$title.focus({ preventScroll: true });
  }
  render({ top = false } = {}) {
    if (!this.$body) return;
    // Re-drawing the same page must not move it: keep the scroll position and the focused control.
    const scroll = top ? 0 : this.$body.scrollTop;
    const a = document.activeElement;
    const focusKey = a && this.$body.contains(a) ? [...a.attributes].find((x) => x.name.startsWith("data-") && x.name !== "data-w") : null;
    this.root.querySelectorAll(".nav [data-go]").forEach((b) => b.removeAttribute("aria-current"));
    this.root.querySelector(`.nav [data-go="${this.view}"]`)?.setAttribute("aria-current", "page");
    this.root.querySelector(".head-set").setAttribute("aria-pressed", String(this.view === "settings"));
    const T = { today: "Today", log: "Food log", menu: "Menu", train: "Train", cook: "Cook", buy: "Buy", settings: "Settings" };
    this.$title.textContent = this.view === "cook" && this.cook ? this.R[this.cook.rid].name : this.view === "log" ? this.logTitle() : T[this.view];
    const nb = this.nested(), hb = this.root.querySelector(".head-back");
    hb.hidden = !nb;
    if (nb) hb.setAttribute("aria-label", nb.label);
    const off = this.online ? "" : `<div class="offline">${ic("cloudOff")}<span>Offline. Changes stay on this device and sync when you're back online.</span></div>`;
    this.$body.innerHTML = off + this["v_" + this.view]();
    // Widths set from script: the page allows no inline style attributes.
    this.$body.querySelectorAll("[data-w]").forEach((el) => (el.style.width = el.dataset.w + "%"));
    this.$body.scrollTop = scroll;
    const strip = this.$body.querySelector(".exstrip"), cur = strip?.querySelector('[aria-current="step"]');
    if (strip && cur && strip.offsetParent) strip.scrollLeft = cur.offsetLeft - (strip.clientWidth - cur.offsetWidth) / 2;
    if (focusKey) this.$body.querySelector(`[${focusKey.name}="${CSS.escape(focusKey.value)}"]`)?.focus({ preventScroll: true });
    if (this.view === "train") this.loadGym();
  }

  /* ---------- nested screens: one back path ---------- */
  /** What the header's back arrow (and the phone's Back, and Escape) closes right now, if anything. */
  nested() {
    const T = { today: "Today", log: "Food log", menu: "Menu", train: "Train", cook: "Cook", buy: "Buy" };
    if (this.view === "log") {
      if (this.form) return { label: `Back to ${this.logMode === "foods" ? "Foods and meals" : "Food log"}`, run: () => { this.form = null; this.confirmDel = null; } };
      if (this.meal) return { label: "Back to Food log", run: () => { this.meal = null; } };
      if (this.logMode === "foods") return { label: "Back to Food log", run: () => { this.logMode = null; } };
    }
    if (this.view === "cook" && this.cook) {
      if (this.cook.step >= 0) return { label: "Stop cooking", run: () => { this.cook.step = -1; this.cook.timer = null; this.wake(false); } };
      return { label: "Back to all recipes", run: () => { this.cook = null; } };
    }
    if (this.view === "menu" && this.menuFrom) return { label: "Back to Today", run: () => { this.view = "today"; this.back = "today"; this.menuFrom = null; this.sel = null; this.mode = null; this.drop = null; } };
    if (this.view === "settings") return { label: `Back to ${T[this.back] || "Today"}`, run: () => { this.view = this.back; } };
    return null;
  }
  closeTop(fromPop = false) {
    const n = this.nested();
    if (!n) return false;
    n.run();
    if (!fromPop) this.popNav(1);
    this.render({ top: true });
    this.$title.focus({ preventScroll: true });
    return true;
  }
  pushNav() { try { history.pushState({ hb: true }, ""); this.navDepth++; } catch {} }
  popNav(n) {
    n = Math.min(n, this.navDepth);
    if (!n) return;
    this.navDepth -= n; this.skipPop++;
    try { history.go(-n); } catch { this.skipPop--; }
  }

  /* ---------- sync ---------- */
  change(key, value) {
    this.sync[key] = { value, updatedAt: new Date().toISOString(), dirty: true };
    store.set("sync", this.sync);
    clearTimeout(this.pushT); this.pushT = setTimeout(() => this.push(), 600);
  }
  async push() {
    for (const [key, e] of Object.entries(this.sync)) {
      if (!e.dirty || !(["settings", "menu", "foods", "train"].includes(key) || key.startsWith("log:"))) continue;
      try {
        const r = await api("PUT", "/state/" + key, { value: e.value, updatedAt: e.updatedAt });
        if (r.status === 401) return this.signedOut();
        if (r.status === 200) { e.dirty = false; if (r.data.updatedAt > e.updatedAt) this.apply(key, r.data); }
        this.online = true;
      } catch { this.online = false; }
    }
    store.set("sync", this.sync);
    await this.flushGym();
  }
  async pull() {
    if (!this.$body) return;
    const was = this.online;
    try {
      const r = await api("GET", "/state");
      if (r.status === 401) return this.signedOut();
      this.online = r.status === 200;
      if (r.status === 200) {
        let changed = false;
        for (const [key, srv] of Object.entries(r.data)) {
          const loc = this.sync[key];
          if (!loc || (!loc.dirty && srv.updatedAt > loc.updatedAt)) { this.apply(key, srv); changed = true; }
        }
        store.set("sync", this.sync);
        await this.push();
        if (changed && !this.busy()) this.render();
      }
    } catch { this.online = false; }
    if (was !== this.online && !this.busy()) this.render();
  }
  apply(key, srv) {
    this.sync[key] = { value: srv.value, updatedAt: srv.updatedAt, dirty: false };
    if (key === "settings") this.settings = { ...DEFAULT_SETTINGS, ...srv.value };
    if (key === "menu") this.menu = PM.cleanMenu(this.F, srv.value);
    if (key === "foods") this.foods = srv.value || {};
    if (key === "train") this.trainPlan = srv.value || {};
  }
  busy() { return (this.cook && this.cook.step >= 0) || this.mode || this.drop || this.form || this.$body?.contains(document.activeElement) && document.activeElement.tagName === "INPUT"; }
  signedOut() { store.del("user"); this.showAuth("login", "You were signed out. Sign in again."); }

  /* ---------------- menu helpers ---------------- */
  dayIndex(week, day) { return (week - 1) * 7 + day; }
  todayIndex() { return this.dayIndex(this.curWeek, this.todayWd); }
  mealName(d, s) { return `${DAYS_LONG[d % 7]} ${SLOTS[s].toLowerCase()}, week ${d < 7 ? 1 : 2}`; }
  isDefault(d, s) {
    const a = this.menu[d][s], b = this.F.menu[d][s];
    return a.r === b.r && a.v === b.v && !Object.keys(a.swaps || {}).length;
  }
  menuEdited() { for (let d = 0; d < 14; d++) for (let s = 0; s < 2; s++) if (!this.isDefault(d, s)) return true; return false; }
  swapText(meal) {
    return Object.entries(meal.swaps || {}).map(([from, to]) => `${this.F.ing[to].n} instead of ${this.F.ing[from].n.toLowerCase()}`).join(" · ");
  }
  /** Saves a menu change and offers to undo it. */
  setMenu(next, msg) {
    const prev = clone(this.menu);
    this.menu = next;
    this.change("menu", this.menu);
    this.render();
    this.toast(msg, () => { this.menu = prev; this.change("menu", this.menu); this.render(); });
  }
  macroLine(m, { compact = false, targets = true } = {}) {
    const t = this.F.targets;
    const low = targets && m.p < t.lowP;
    return `<div class="macros${compact ? " compact" : ""}">
      <span class="mp${low ? " low" : ""}"><b class="num">${num(m.p)}</b> g protein</span><span><b class="num">${num(m.c)}</b> g carbs</span><span><b class="num">${num(m.f)}</b> g fat</span><span><b class="num">${num(m.k)}</b> kcal</span>
      ${low ? `<span class="tag warn">Low protein</span>` : ""}</div>`;
  }

  /* ---------------- training days: a default week, changed date by date ---------------- */
  weekly() { return { ...DEFAULT_WEEK, ...(this.trainPlan.weekly || {}) }; }
  sessOn(day) {
    const mv = (this.trainPlan.moves || {})[day];
    const v = mv !== undefined ? mv : this.weekly()[wd(new Date(day + "T12:00:00"))];
    return v && v !== "-" ? v : null;
  }
  /** The calendar date shown for a week and weekday on Today: this week, or the next one for the other cycle week. */
  dateFor(week, day) {
    const monday = addDays(isoDay(this.now), -this.todayWd);
    return addDays(monday, ((week - this.curWeek + 2) % 2) * 7 + day);
  }
  setTrain(moves, weekly, msg) {
    const prev = this.trainPlan, w = weekly || this.weekly();
    // A date set back to what the default week says needs no entry of its own.
    const clean = {};
    for (const [k, v] of Object.entries(moves)) { const def = w[wd(new Date(k + "T12:00:00"))] || "-"; if (v !== def) clean[k] = v; }
    for (const k of Object.keys(clean).sort().slice(0, -200)) delete clean[k];
    this.trainPlan = { ...(weekly ? { weekly } : this.trainPlan.weekly ? { weekly: this.trainPlan.weekly } : {}), moves: clean };
    this.change("train", this.trainPlan);
    this.moveFrom = null; this.addSess = null;
    if (this.sessOn(isoDay(new Date())) && this.tr && !Object.keys(this.tr.rows).length) { this.sess = this.sessOn(isoDay(new Date())); this.tr.sess = this.sess; this.saveTrain(); }
    this.render();
    this.toast(msg, () => { this.trainPlan = prev; this.change("train", prev); this.render(); });
  }
  moveSession(from, to) {
    const S = this.sessOn(from), T = this.sessOn(to), moves = { ...(this.trainPlan.moves || {}) };
    moves[to] = S; moves[from] = T || "-";
    const short = (x) => dayName(x, { weekday: "long" });
    this.setTrain(moves, null, T ? `Session ${S} on ${short(to)}, Session ${T} on ${short(from)}` : `Session ${S} moved to ${short(to)}`);
  }
  setSessionOn(day, v) {
    const moves = { ...(this.trainPlan.moves || {}), [day]: v };
    this.setTrain(moves, null, v === "-" ? `Session skipped on ${dayName(day, { weekday: "long" })}` : `Session ${v} added on ${dayName(day, { weekday: "long" })}`);
  }
  /** Default days in Settings: picking a day taken by another session swaps the two. */
  setWeekly(S, dayIdx) {
    const w = { ...this.weekly() };
    const old = Object.keys(w).find((k) => w[k] === S), other = w[dayIdx];
    // "-" (not a missing day): the default week would otherwise fill the old day back in.
    if (old !== undefined) w[old] = other && other !== "-" && other !== S ? other : "-";
    w[dayIdx] = S;
    this.setTrain({ ...(this.trainPlan.moves || {}) }, w, `Session ${S} on ${DAYS_LONG[dayIdx]}s`);
  }
  trainBlock(day) {
    const sess = this.sessOn(day);
    const close = (act) => `<button type="button" class="icon-btn" data-act="${act}" aria-label="Close">${ic("close")}</button>`;
    if (sess) {
      const monday = addDays(day, -wd(new Date(day + "T12:00:00")));
      const panel = this.moveFrom === day ? `<div class="panel"><div class="panel-top"><div class="panel-h"><span class="t">Move Session ${sess} to</span><span class="s">If that day has a session, the two swap.</span></div>${close("tclose")}</div>
        <div class="chips">${[0, 1, 2, 3, 4, 5, 6].map((i) => addDays(monday, i)).filter((x) => x !== day).map((x) => `<button type="button" class="chip" data-tmove-to="${x}">${dayName(x, { weekday: "short", day: "numeric" })}${this.sessOn(x) ? ` <span class="s">· ${this.sessOn(x)}</span>` : ""}</button>`).join("")}</div></div>` : "";
      return `<button type="button" class="train-line" data-go="train" data-sess="${sess}">${ic("train")}<span class="grow"><span class="t">Session ${sess}</span><br><span class="s">${SESS_DESC[sess]}</span></span><span class="s">Open</span>${ic("right")}</button>
        ${panel || `<div class="actions"><button type="button" class="btn quiet" data-act="tmove" data-date="${day}">${ic("swap")} Move to another day</button><button type="button" class="btn quiet" data-act="tskip" data-date="${day}">${ic("close")} Skip this session</button></div>`}`;
    }
    let next = null;
    for (let k = 1; k <= 14 && !next; k++) { const x = addDays(day, k); if (this.sessOn(x)) next = x; }
    const panel = this.addSess === day ? `<div class="panel"><div class="panel-top"><div class="panel-h"><span class="t">Train on ${dayName(day, { weekday: "long" })}</span></div>${close("tclose")}</div>
      <div class="rows">${["A", "B", "C"].map((k) => `<button type="button" class="row" data-tsess="${k}" data-date="${day}"><span class="grow"><span class="t">Session ${k}</span><br><span class="s">${SESS_DESC[k]}</span></span>${ic("plus")}</button>`).join("")}</div></div>` : "";
    return `<div class="train-line rest">${ic("train")}<span class="grow"><span class="t">Rest day</span><br><span class="s">${next ? `Next: Session ${this.sessOn(next)} on ${dayName(next, { weekday: "long" })}` : "No session in the next two weeks"}</span></span></div>
      ${panel || `<div class="actions"><button type="button" class="btn quiet" data-act="taddsess" data-date="${day}">${ic("plus")} Add a session</button></div>`}`;
  }
  /* ---------------- activities (walks and the like), per date ---------------- */
  dayDoc(day) { return this.sync["log:" + day]?.value || {}; }
  actsFor(day) { return (this.dayDoc(day).acts || []).slice(); }
  setActs(day, list) { this.change("log:" + day, { ...this.dayDoc(day), entries: this.dayDoc(day).entries || [], acts: list }); }
  actText(a) { return [ACT_LABEL[a.t], a.km ? `${num(a.km)} km` : "", a.min ? `${num(a.min)} min` : ""].filter(Boolean).join(" · "); }
  actBlock(day) {
    const acts = this.actsFor(day), f = this.actForm && this.actForm.day === day ? this.actForm : null;
    const list = acts.length ? `<div class="rows">${acts.map((a) => `<div class="row"><span class="grow t">${esc(this.actText(a))}</span><button type="button" class="icon-btn" data-del-act="${a.id}" data-date="${day}" aria-label="Delete ${esc(this.actText(a))}">${ic("trash")}</button></div>`).join("")}</div>` : "";
    const form = f ? `<div class="panel"><div class="panel-top"><div class="panel-h"><span class="t">Add an activity</span><span class="s">${esc(dayName(day))}</span></div><button type="button" class="icon-btn" data-act="actclose" aria-label="Close">${ic("close")}</button></div>
      <div class="chips" role="group" aria-label="Activity">${ACTS.map(([k, l]) => `<button type="button" class="chip" data-act-type="${k}" aria-pressed="${f.t === k}">${l}</button>`).join("")}</div>
      <div class="fgrid"><label class="ffield"><span class="eyebrow">Distance (optional)</span><span class="tin"><input class="num" type="number" inputmode="decimal" min="0" max="300" step="0.1" data-actf="km" value="${esc(f.km)}" aria-label="Distance in km"><span class="unit">km</span></span></label>
        <label class="ffield"><span class="eyebrow">Time</span><span class="tin"><input class="num" type="number" inputmode="numeric" min="0" max="1440" step="1" data-actf="min" value="${esc(f.min)}" aria-label="Time in minutes"><span class="unit">min</span></span></label></div>
      <p class="err-line" data-r="acterr" ${f.err ? "" : "hidden"}>${esc(f.err || "")}</p>
      <div class="actions"><button type="button" class="btn primary" data-act="actgo">${ic("plus")} Add ${esc(ACT_LABEL[f.t].toLowerCase())}</button><button type="button" class="btn quiet" data-act="actclose">Cancel</button></div></div>` : "";
    return `<div class="section"><div class="aisle-h"><span class="eyebrow">Activity</span>${f ? "" : `<button type="button" class="btn quiet" data-act="actadd" data-date="${day}">${ic("plus")} Add activity</button>`}</div>
      ${list}${form}${!acts.length && !f ? `<p class="s m0">Walks, runs, football or anything else you did this day.</p>` : ""}</div>`;
  }
  addAct() {
    const f = this.actForm, km = f.km === "" ? 0 : Number(f.km), min = f.min === "" ? 0 : Number(f.min);
    const bad = (t) => { f.err = t; this.render(); };
    if (!Number.isFinite(km) || km < 0 || km > 300) return bad("Distance goes from 0 to 300 km.");
    if (!Number.isFinite(min) || min < 0 || min > 1440) return bad("Time goes from 0 to 1440 minutes.");
    if (!km && !min) return bad("Enter the time, the distance, or both.");
    const day = f.day, prev = this.actsFor(day);
    const a = { id: Date.now().toString(36), t: f.t, ...(km ? { km: Math.round(km * 100) / 100 } : {}), ...(min ? { min: Math.round(min) } : {}), at: new Date().toISOString() };
    this.setActs(day, prev.concat(a));
    this.actForm = null; this.render();
    this.toast(`${this.actText(a)} added`, () => { this.setActs(day, prev); this.render(); });
  }
  deleteAct(day, id) {
    const prev = this.actsFor(day), a = prev.find((x) => x.id === id);
    this.setActs(day, prev.filter((x) => x.id !== id)); this.render();
    this.toast(`Deleted ${this.actText(a).toLowerCase()}`, () => { this.setActs(day, prev); this.render(); });
  }

  /* ---------------- Today ---------------- */
  v_today() {
    const F = this.F, d = this.dayIndex(this.week, this.day);
    const isToday = d === this.todayIndex();
    const date = this.dateFor(this.week, this.day);
    const fixed = PM.fixedFor(F, d);
    const recipeRow = (s) => {
      const m = this.menu[d][s], r = this.R[m.r], mac = PM.macros(F, PM.mealIngredients(F, m, d, s));
      const sw = this.swapText(m);
      return `<button type="button" class="row meal meal-main" data-open-meal="${d}:${s}">
        <span class="meal-when">${SLOTS[s]}</span><img class="thumb" src="${this.P[r.main].img}" alt="">
        <span class="grow"><span class="t">${esc(r.name)}</span><br><span class="tag">${esc(this.V[m.v].label)}</span>${sw ? ` <span class="s">${esc(sw)}</span>` : ""}${m.note && this.isDefault(d, s) ? ` <span class="s">${esc(m.note)}</span>` : ""}</span>
        <span class="s num">${mac.p} g</span>${ic("right")}</button>`;
    };
    const fixedRow = (f) => `<div class="row meal"><span class="meal-when">${f.name}</span><span class="fixed">${esc(f.text)}</span></div>`;
    const heading = dayName(date);
    const eyebrow = this.started ? `Week ${this.week}${isToday ? " · today" : ""}` : `Week ${this.week}${isToday ? " · today" : ""} · the plan starts Mon 16 Nov`;
    const football = this.day === F.football.day;
    return `<div class="today-grid">
      <div class="section">
        <div><div class="eyebrow">${eyebrow}</div><div class="h3 h-day">${heading}</div></div>
        ${this.trainBlock(date)}
        ${this.actBlock(date)}
        ${football ? `<p class="s m0">Football day: lunch has a bigger portion of carbs.</p>` : ""}
        <div class="rows">
          ${fixedRow(fixed[0])}${fixedRow(fixed[1])}${recipeRow(0)}${fixedRow(fixed[2])}${recipeRow(1)}${fixedRow(fixed[3])}
        </div>
        ${this.macroLine(PM.dayMacros(F, this.menu, d))}
        ${isToday ? this.eatenLine() : ""}
        <button type="button" class="btn self-start" data-act="editday" data-day-index="${d}">${ic("menu")} Change this day's meals</button>
      </div>
      <div class="section">
        <div class="eyebrow">Other days</div>
        <div class="seg" role="group" aria-label="Week">${[1, 2].map((w) => `<button type="button" data-week="${w}" aria-pressed="${this.week === w}">Week ${w}</button>`).join("")}</div>
        <div class="days">${DAYS.map((n, i) => { const x = this.dateFor(this.week, i), S = this.sessOn(x); return `<button type="button" data-day="${i}" aria-pressed="${this.day === i}" aria-label="${dayName(x)}${S ? ", Session " + S : ""}">${n}<b>${S || ""}</b><span class="dot ${this.dayIndex(this.week, i) === this.todayIndex() ? "" : "off"}"></span></button>`; }).join("")}</div>
        <p class="s m0">Letters are the training sessions. The dot marks today.</p>
      </div></div>`;
  }

  /* ---------------- Menu (move, copy, swap meals) ---------------- */
  v_menu() {
    const F = this.F, w = this.menuWeek;
    const avg = PM.weekAverage(F, this.menu, w);
    const tile = (d, s) => {
      const m = this.menu[d][s], r = this.R[m.r], sel = this.sel && this.sel.d === d && this.sel.s === s;
      const sw = this.swapText(m);
      return `<button type="button" class="meal-tile${sel ? " sel" : ""}${this.isDefault(d, s) ? "" : " edited"}" data-pick-meal="${d}:${s}" draggable="true" aria-expanded="${sel}" aria-label="${esc(this.mealName(d, s))}: ${esc(r.name)}">
        <span class="slot">${SLOTS[s]}</span>
        <span class="tile-body"><img class="thumb" src="${this.P[r.main].img}" alt=""><span class="grow"><span class="t">${esc(r.name)}</span>
          <span class="s">${esc(this.V[m.v].label)}${sw ? ` · ${esc(sw)}` : ""}</span></span><span class="grip">${ic("grip")}</span></span></button>`;
    };
    const days = [0, 1, 2, 3, 4, 5, 6].map((i) => {
      const d = this.dayIndex(w, i), mac = avg.days[i];
      const panel = this.sel && this.sel.d === d ? this.actionPanel() : "";
      return `<div class="daycard${d === this.todayIndex() ? " today" : ""}">
        <div class="day-h"><span class="t">${DAYS_LONG[i]}</span>${d === this.todayIndex() ? '<span class="tag">Today</span>' : ""}${i === F.football.day ? '<span class="tag olive">Football</span>' : ""}
          <span class="grow"></span><span class="s num">${mac.p} g · ${num(mac.k)} kcal</span>${mac.p < F.targets.lowP ? '<span class="tag warn">Low protein</span>' : ""}</div>
        <div class="tiles">${tile(d, 0)}${tile(d, 1)}</div>${panel}</div>`;
    }).join("");
    const dropBar = this.drop ? (() => {
      const [fd, fs] = this.drop.from, [td, ts] = this.drop.to, a = this.R[this.menu[fd][fs].r].name;
      return `<div class="dropbar" role="alert"><span>${esc(a)} → ${esc(this.mealName(td, ts))}</span>
        <button type="button" class="btn primary" data-act="dropcopy">${ic("copy")} Copy here</button>
        <button type="button" class="btn" data-act="dropswap">${ic("swap")} Swap the two meals</button>
        <button type="button" class="btn quiet" data-act="dropcancel">Cancel</button></div>`;
    })() : "";
    return `<div class="section">
        <div class="menu-top">
          <div class="seg" role="group" aria-label="Week">${[1, 2].map((k) => `<button type="button" data-menu-week="${k}" aria-pressed="${w === k}">Week ${k}</button>`).join("")}</div>
          <p class="s m0">Tap a meal to copy it, swap it or change the recipe.<span class="wide-only"> On a computer you can also drag it onto another meal.</span></p>
        </div>
        <div class="weekavg"><span class="eyebrow">Week ${w} daily average</span>${this.macroLine(avg)}<span class="s">Target: ${F.targets.p} g protein, ${num(F.targets.k)} kcal a day.</span></div>
        ${dropBar}
      </div>
      <div class="week-days">${days}</div>
      ${this.menuEdited() ? `<div class="danger-zone">${this.confirmMenuReset
        ? `<div class="confirm"><span>Put every meal back as the plan had it? Your changes to both weeks are lost.</span><button type="button" class="btn danger" data-act="menuresetgo">Reset the menu</button><button type="button" class="btn quiet" data-act="menuresetno">Keep my changes</button></div>`
        : `<button type="button" class="btn danger" data-act="menureset">${ic("reset")} Reset the menu to the plan</button>`}</div>` : ""}`;
  }
  actionPanel() {
    const { d, s } = this.sel, m = this.menu[d][s];
    const head = `<div class="panel-top"><div class="panel-h"><span class="t">${esc(this.R[m.r].name)}</span><span class="s">${esc(this.mealName(d, s))}</span></div>
      <button type="button" class="icon-btn" data-act="mclose" aria-label="Close">${ic("close")}</button></div>`;
    const chipDays = (attr, pressed, skip) => [1, 2].map((wk) => `<div class="chiprow"><span class="eyebrow">Week ${wk}</span><div class="chips">${DAYS.map((n, i) => {
      const dd = this.dayIndex(wk, i);
      if (skip && skip(dd)) return "";
      return `<button type="button" class="chip" ${attr}="${dd}" aria-pressed="${pressed(dd)}">${n}</button>`;
    }).join("")}</div></div>`).join("");
    if (this.mode === "copy") {
      return `<div class="panel">${head}<p class="s m0">Copy it to these days:</p>${chipDays("data-copy-day", (dd) => this.copyDays.has(dd))}
        <div class="seg" role="group" aria-label="Meal">${SLOTS.map((l, k) => `<button type="button" data-copy-slot="${k}" aria-pressed="${this.copySlot === k}">As ${l.toLowerCase()}</button>`).join("")}</div>
        <div class="actions"><button type="button" class="btn primary" data-act="copygo" ${this.copyDays.size ? "" : "disabled"}>${ic("copy")} Copy to ${this.copyDays.size || ""} ${this.copyDays.size === 1 ? "day" : "days"}</button><button type="button" class="btn quiet" data-act="mcancel">Cancel</button></div></div>`;
    }
    if (this.mode === "swap") {
      return `<div class="panel">${head}<p class="s m0">Swap it with:</p>
        ${[1, 2].map((wk) => `<div class="chiprow"><span class="eyebrow">Week ${wk}</span><div class="chips">${DAYS.map((n, i) => SLOTS.map((l, k) => {
          const dd = this.dayIndex(wk, i);
          if (dd === d && k === s) return "";
          return `<button type="button" class="chip" data-swap-to="${dd}:${k}" title="${esc(this.R[this.menu[dd][k].r].name)}">${n} ${l[0]}</button>`;
        }).join("")).join("")}</div></div>`).join("")}
        <p class="s m0">L is lunch, D is dinner.</p>
        <div class="actions"><button type="button" class="btn quiet" data-act="mcancel">Cancel</button></div></div>`;
    }
    if (this.mode === "recipe") {
      return `<div class="panel">${head}<p class="s m0">Cook this instead:</p>
        <div class="chips">${Object.entries(this.R).map(([id, r]) => `<button type="button" class="chip" data-set-recipe="${id}" aria-pressed="${m.r === id}">${esc(r.name)}</button>`).join("")}</div>
        <div class="actions"><button type="button" class="btn quiet" data-act="mcancel">Cancel</button></div></div>`;
    }
    return `<div class="panel">${head}
      <div class="actions">
        <button type="button" class="btn" data-act="mopen">${ic("book")} Open recipe</button>
        <button type="button" class="btn" data-act="mcopy">${ic("copy")} Copy to other days</button>
        <button type="button" class="btn" data-act="mswap">${ic("swap")} Swap with another meal</button>
        <button type="button" class="btn" data-act="mrecipe">${ic("cook")} Change recipe</button>
        ${this.isDefault(d, s) ? "" : `<button type="button" class="btn quiet" data-act="mreset">${ic("reset")} Back to the plan's meal</button>`}
      </div></div>`;
  }

  /* ---------------- Cook ---------------- */
  amount(k, a) {
    const ii = this.F.ing[k];
    if (ii.piece) return `${Math.round(a / ii.piece)}`;
    return ii.u === "ud" ? `${a}` : `${a} ${ii.u}`;
  }
  cookMeal() {
    const c = this.cook;
    if (c.ctx) return this.menu[c.ctx.d][c.ctx.s];
    return { r: c.rid, v: c.v, swaps: c.swaps };
  }
  v_cook() {
    const F = this.F, R = this.R, P = this.P, V = this.V;
    if (!this.cook) {
      const uses = {}; this.menu.forEach((day) => day.forEach((m) => (uses[m.r] = (uses[m.r] || 0) + 1)));
      return `<div class="section"><p class="muted m0">Each recipe is one serving. Open a meal from Today or Menu to change its ingredients for that day.</p>
        <div class="rgrid">${Object.entries(R).map(([id, r]) => {
          const mac = PM.macros(F, r.ing);
          return `<button type="button" class="rcard" data-recipe="${id}">
          <img src="${P[r.main].img}" alt=""><span class="grow"><span class="t">${esc(r.name)}</span><br>
          <span class="s">${esc(r.time)} · <span class="num">${mac.p} g</span> protein · ${uses[id] || 0} ${uses[id] === 1 ? "meal" : "meals"} in your menu</span></span>${ic("right")}</button>`;
        }).join("")}</div></div>`;
    }
    const r = R[this.cook.rid], c = this.cook, meal = this.cookMeal();
    const d = c.ctx ? c.ctx.d : -1, s = c.ctx ? c.ctx.s : 1;
    const ingMap = PM.mealIngredients(F, meal, d, s);
    const swaps = meal.swaps || {};
    if (c.step >= 0) {
      const steps = this.cookSteps(r);
      const text = steps[c.step], m = text.match(/(\d+)(?:–(\d+))?\s*min/);
      const mins = m ? +(m[2] || m[1]) : 0;
      const last = c.step === steps.length - 1;
      return `<div class="cookmode">
        <div class="pips">${steps.map((_, i) => `<i class="${i <= c.step ? "on" : ""}"></i>`).join("")}</div>
        <div class="stepnum">Step ${c.step + 1} of ${steps.length}</div>
        <div class="steptext">${esc(text)}</div>
        ${last && meal.v ? `<div class="flav">Flavour: ${esc(V[meal.v].how)}</div>` : ""}
        ${mins ? (c.timer ? `<div class="ctimer">${ic("timer")}<span class="num" data-r="ctime">${fmt((c.timer.end - Date.now()) / 1000)}</span><span class="grow"></span><button type="button" class="btn quiet" data-act="ctstop">Stop timer</button></div>`
          : `<button type="button" class="btn self-start" data-act="ctstart" data-min="${mins}">${ic("timer")} Start ${mins} min timer</button>`) : ""}
        <div class="cooknav">
          <button type="button" class="btn big" data-act="cprev">${c.step === 0 ? "Ingredients" : "Back"}</button>
          <button type="button" class="btn big primary" data-act="cnext">${last ? "Finish" : "Next step"}</button>
        </div></div>`;
    }
    const ingRows = Object.entries(ingMap).map(([k, a]) => {
      const pid = Object.keys(P).find((id) => P[id].ing === k), ii = F.ing[k];
      return `<button type="button" class="ing" data-ing="${k}" aria-pressed="${this.ingTicks.has(k)}"><span class="box">${ic("check")}</span>
        <img class="thumb" src="${pid ? P[pid].img : ""}" alt=""><span class="amt">${this.amount(k, a)}</span><span class="name grow">${esc(ii.n)}</span></button>`;
    }).join("");
    // Swaps: one row per swappable ingredient of the recipe (carb or protein).
    const swapRows = Object.keys(r.ing).filter((k) => F.ing[k].group).map((from) => {
      const cur = swaps[from] || from, g = F.ing[from].group;
      return `<div class="swaprow"><span class="eyebrow">${g === "carb" ? "Carbs" : "Protein"} · instead of ${esc(F.ing[from].n.toLowerCase())}</span>
        <div class="chips">${F.groups[g].map((to) => `<button type="button" class="chip" data-swap-from="${from}" data-swap-ing="${to}" aria-pressed="${cur === to}">${esc(F.ing[to].n)}${to !== from && cur !== to ? ` <span class="s num">${this.amount(to, PM.swapAmount(F, from, to, r.ing[from]))}</span>` : ""}</button>`).join("")}</div></div>`;
    }).join("");
    const usedV = [...new Set(this.menu.flatMap((day) => day.filter((m) => m.r === c.rid).map((m) => m.v)))];
    const vOptions = usedV.length ? usedV : Object.keys(V);
    return `<div class="section">
      <div class="s">${esc(r.time)} · 1 serving${c.ctx ? ` · for ${esc(this.mealName(d, s))}` : ""}</div>
      ${this.macroLine(PM.macros(F, ingMap), { targets: false })}
      <div class="two">
        <div class="section"><div class="eyebrow">Ingredients</div><p class="s m0">Tick each one as you get it out.</p><div class="rows">${ingRows}</div>
          ${swapRows ? `<div class="eyebrow">Swap an ingredient</div><p class="s m0">${c.ctx ? "Saved for this meal only. The amount keeps the same carbs or protein." : "Only a preview here. Open the meal from Today or Menu to keep a swap."}</p>${swapRows}` : ""}
          <div class="eyebrow">Flavour</div>
          <div class="chips">${vOptions.map((v) => `<button type="button" class="chip" data-flav="${v}" aria-pressed="${meal.v === v}">${esc(V[v].label)}</button>`).join("")}</div>
          ${meal.v ? `<p class="m0">${esc(V[meal.v].how)}</p>` : ""}
        </div>
        <div class="section"><div class="eyebrow">How to cook it</div>
          ${Object.keys(swaps).length ? `<div class="callout">${Object.entries(swaps).map(([from, to]) => `<p class="m0"><b>${esc(F.ing[to].n)} instead of ${esc(F.ing[from].n.toLowerCase())}.</b> Where the steps say ${esc(F.ing[from].n.toLowerCase())}, use ${esc(this.amount(to, ingMap[to] || 0))} of ${esc(F.ing[to].n.toLowerCase())}. ${esc(F.ing[to].cook || "")}</p>`).join("")}</div>` : ""}
          <ol class="steps">${this.cookSteps(r).map((st) => `<li>${esc(st)}</li>`).join("")}</ol>
          <button type="button" class="btn big primary" data-act="cstart">Start cooking</button></div>
      </div></div>`;
  }
  /** The recipe's own steps. A swap doesn't rewrite them: rewriting can drop a step's other instructions
      (an oven tray, a pan), so the swap is explained above the steps instead. */
  cookSteps(r) { return r.steps.slice(); }

  /* ---------------- Buy ---------------- */
  shopping() {
    const key = JSON.stringify(this.menu);
    if (this._shopKey !== key) { this._shopKey = key; this._shop = PM.shopping(this.F, this.menu); }
    return this._shop;
  }
  itemName(x) {
    if (!x.ing) return (this.F.spices.find((s) => s.id === x.id) || {}).label || this.P[x.id].name;
    const ii = this.F.ing[x.ing];
    return ii.packs.length > 1 ? `${ii.n} (${this.sizeTxt(this.P[x.id])})` : ii.n;
  }
  sizeTxt(p) { return p.size ? `${String(p.size).replace(".", ",")} ${p.fmt}` : p.fmt || ""; }
  shopItems(k) {
    const sh = this.shopping();
    const list = k === "pantry" ? sh.pantry.concat(this.F.spices.map((s) => ({ id: s.id, ing: null, qty: 1 }))) : sh[k];
    return list.map((x) => ({ ...x, p: this.P[x.id], name: this.itemName(x) }));
  }
  v_buy() {
    const SH = { shop1: ["Big shop", "Every 2 weeks: everything for 14 days, plus week 1's fresh food."], shop2: ["Top-up", "Start of week 2: bread, fruit and fresh dairy."], pantry: ["Pantry", "Lasts longer than 2 weeks. Buy when it runs low."] };
    const items = this.shopItems(this.shop), sh = this.shopping();
    const total = items.reduce((a, x) => a + x.p.price * x.qty, 0);
    const skip = new Set(this.skip[this.shop] || []);
    const picked = items.filter((x) => !skip.has(x.id));
    const row = (x) => `<button type="button" class="item" data-pick-item="${x.id}" aria-pressed="${!skip.has(x.id)}"><span class="box">${ic("check")}</span><img class="thumb" src="${x.p.img}" alt=""><span class="grow"><span class="t">${esc(x.p.name)}</span><br><span class="s">${x.qty > 1 ? `<span class="num">${x.qty}</span> × ` : ""}${esc(this.sizeTxt(x.p))} · ${eur(x.p.price)}</span></span>
      <span class="price">${eur(x.p.price * x.qty)}</span></button>`;
    const groupOf = (x) => (x.p.store ? `At ${x.p.store}` : (AISLES.find(([, l]) => l.includes(x.ing)) || ["Spices"])[0]);
    const groups = {}; items.forEach((x) => (groups[groupOf(x)] = groups[groupOf(x)] || []).push(x));
    const others = Object.keys(groups).filter((g) => g.startsWith("At "));
    const order = AISLES.map((a) => a[0]).concat(["Spices"], others).filter((a) => groups[a]);
    return `<div class="section">
        <div class="seg" role="group" aria-label="List">${Object.entries(SH).map(([k, s]) => `<button type="button" data-shop="${k}" aria-pressed="${this.shop === k}">${s[0]}</button>`).join("")}</div>
        <div class="buy-sum"><span><span class="big num">${eur(total)}</span> <span class="muted">${items.length} items</span></span><span class="muted">About ${eur(sh.totals.month)} a month</span></div>
        <p class="s m0">${SH[this.shop][1]} Worked out from your menu, so it changes when you change a meal. In the store's walking order, frozen last so it stays cold.</p>
        <div class="send">
          <button type="button" class="btn primary${this.sending ? " busy" : ""}" data-act="sendlist" ${this.online && picked.length ? "" : "disabled"}>${ic("send")} ${this.sending ? "Sending" : `Send ${picked.length} ${picked.length === 1 ? "item" : "items"} to Mercheck`}</button>
          <button type="button" class="btn quiet" data-act="pickall">Tick all</button><button type="button" class="btn quiet" data-act="picknone">Untick all</button>
          <span class="s">${this.online ? `Untick what you already have. Ticked items go to the "${esc(LIST_NAME[this.shop])}" list as to buy.` : "Connect to the internet to send the list."}</span>
        </div>
      </div>
      <div class="aisles">
        ${order.map((a) => `<div class="section"><div class="aisle-h"><span class="eyebrow">${a}</span><span class="s num">${groups[a].length}</span></div><div class="rows">${groups[a].map(row).join("")}</div></div>`).join("")}
      </div>`;
  }
  async sendList() {
    if (this.sending) return;
    const skip = new Set(this.skip[this.shop] || []);
    const items = this.shopItems(this.shop).filter((x) => !skip.has(x.id));
    if (!items.length) return;
    // Same name twice (two pack sizes of one thing) becomes one line with both counted.
    const merged = {};
    for (const x of items) merged[x.name] = (merged[x.name] || 0) + x.qty;
    this.sending = true; this.render();
    let r;
    try { r = await api("POST", "/list/send", { list: LIST_NAME[this.shop], items: Object.entries(merged).map(([name, quantity]) => ({ name, quantity })) }); }
    catch { r = { status: 0 }; }
    this.sending = false; this.render();
    if (r.status === 401) return this.signedOut();
    if (r.status === 200) this.toast(`Sent to Mercheck: ${r.data.added} new, ${r.data.updated} back on the list`);
    else this.toast(r.status === 0 ? "Can't reach the server. Try again when you're online." : "Mercheck isn't answering. Try again in a minute.");
  }

  /* ---------------- Train ---------------- */
  setsDefault() { return this.settings.sets === "auto" ? (this.started ? 3 : 2) : +this.settings.sets; }
  setsFor(item) { const e = EX[item[0]]; return e.kind ? 1 : item[1] ? Math.min(item[1], this.setsDefault()) : this.setsDefault(); }
  loadTrain() {
    // What's being done today stays on this device until the day changes.
    const t = store.get("train", null);
    const date = isoDay(new Date());
    this.tr = t && t.date === date && t.v === 2 ? t : { v: 2, date, sess: this.sess, i: 0, rows: {}, warm: {} };
    this.sess = this.tr.sess;
  }
  saveTrain() { store.set("train", this.tr); }
  /** The gym log's sets for this session's exercises: last time and today. Loaded once per session and day. */
  async loadGym(force = false) {
    const key = `${this.tr.date}|${this.sess}`;
    if (!force && (this.gym.key === key || this.gym.loading)) return;
    if (!this.online) return;
    this.gym.loading = true; this.gym.key = key;
    const names = SESS[this.sess].map((it) => EX[it[0]]).filter((e) => e.kind !== "warm").map((e) => e.name);
    let r;
    try { r = await api("POST", "/gym/last", { names, date: this.tr.date }); } catch { r = { status: 0 }; }
    this.gym.loading = false;
    if (r.status === 401) return this.signedOut();
    this.gym.error = r.status !== 200;
    if (r.status === 200) {
      this.gym.data = r.data.exercises;
      this.ensureRoutines(r.data.routines);
    }
    if (this.view === "train" && !this.busy()) this.render();
  }
  /** Sessions A, B and C as routines in the gym app, once. */
  async ensureRoutines(existing) {
    if (this.routineState === "added" || this.routineBusy) return;
    const want = ["A", "B", "C"].map(ROUTINE_NAME);
    if (existing && want.every((n) => existing.some((x) => String(x).toLowerCase() === n.toLowerCase()))) { this.routineState = "added"; store.set("routines", "added"); return; }
    this.routineBusy = true;
    const routines = ["A", "B", "C"].map((k) => ({
      name: ROUTINE_NAME(k),
      exercises: SESS[k].map((it) => EX[it[0]]).filter((e) => e.kind !== "warm").map((e, j) => ({
        name: e.name, sets: e.kind ? 1 : this.setsFor(SESS[k].filter((it) => EX[it[0]].kind !== "warm")[j]),
        ...(e.kg != null ? { defaultWeight: e.kg } : {}), defaultReps: e.kind === "amrap" ? 1 : firstInt(e.reps),
      })),
    }));
    let r;
    try { r = await api("POST", "/gym/routines", { routines }); } catch { r = { status: 0 }; }
    this.routineBusy = false;
    if (r.status === 200) { this.routineState = r.data.waiting ? "waiting" : "added"; store.set("routines", this.routineState); }
  }
  /** The set rows for an exercise: typed today on this device, else logged today in the gym app, else last time, else the plan's start. */
  rowsFor(key) {
    if (this.tr.rows[key]) return this.tr.rows[key];
    const e = EX[key], it = SESS[this.sess].find((x) => x[0] === key), n = this.setsFor(it);
    const g = this.gym.data[e.name] || { last: [], today: null };
    let rows;
    if (e.kind === "amrap") rows = [{ weight: "", reps: g.today?.[0]?.reps ?? 0, logged: !!g.today }];
    else if (g.today) rows = Array.from({ length: Math.max(n, g.today.length) }, (_, i) => g.today[i] ? { ...g.today[i], logged: true } : this.blankRow(e, g, i));
    else rows = Array.from({ length: n }, (_, i) => this.blankRow(e, g, i));
    return rows;
  }
  blankRow(e, g, i) {
    const last = g.last[i] || g.last[g.last.length - 1];
    return { weight: e.kg == null ? "" : last && last.weight !== "" ? last.weight : e.kg, reps: last && last.reps !== "" ? last.reps : firstInt(e.reps), logged: false };
  }
  editRows(key, fn) {
    const rows = clone(this.rowsFor(key));
    fn(rows);
    this.tr.rows[key] = rows;
    this.saveTrain();
  }
  async logRows(key) {
    const e = EX[key], rows = this.rowsFor(key);
    const sets = rows.filter((r) => r.logged).map((r) => ({ weight: r.weight, reps: r.reps }));
    const qkey = `${this.tr.date}|${e.name}`;
    this.gymQueue[qkey] = sets; store.set("gymq", this.gymQueue);
    await this.flushGym();
    if (this.gymQueue[qkey]) this.toast("Saved on this device. It goes to Gymaker when it can be reached.");
  }
  async flushGym() {
    for (const [qkey, sets] of Object.entries(this.gymQueue)) {
      const [date, name] = [qkey.slice(0, 10), qkey.slice(11)];
      let r;
      try { r = await api("POST", "/gym/log", { date, name, sets }); } catch { r = { status: 0 }; }
      if (r.status === 401) return this.signedOut();
      if (r.status === 200 || r.status === 400) { delete this.gymQueue[qkey]; store.set("gymq", this.gymQueue); }
      else break;
    }
  }
  v_train() {
    const T = this.tr, list = SESS[this.sess], x = list[T.i], e = EX[x[0]];
    const done = (it) => (EX[it[0]].kind === "warm" ? !!T.warm[this.sess] : this.rowsFor(it[0]).every((r) => r.logged));
    const doneCount = (it) => (EX[it[0]].kind === "warm" ? (T.warm[this.sess] ? 1 : 0) : this.rowsFor(it[0]).filter((r) => r.logged).length);
    const total = (it) => (EX[it[0]].kind === "warm" ? 1 : this.rowsFor(it[0]).length);
    const dots = (it) => `<span class="setdots" aria-label="${doneCount(it)} of ${total(it)} done">${Array.from({ length: total(it) }, (_, k) => `<i class="${k < doneCount(it) ? "on" : ""}"></i>`).join("")}</span>`;
    const sub = (it) => {
      const E = EX[it[0]];
      if (E.kind === "warm") return "3 min · 6 moves";
      if (E.kind === "amrap") return "16 min · as many rounds as you can";
      return `${total(it)} × ${E.reps}`;
    };
    const bar = `<div class="sess-bar">
      <div class="seg" role="group" aria-label="Session">${["A", "B", "C"].map((k) => `<button type="button" data-pick="${k}" aria-pressed="${k === this.sess}">Session ${k}</button>`).join("")}</div>
      <span class="s">${SESS_DESC[this.sess]}${this.sessOn(isoDay(new Date())) === this.sess ? " · today's session" : ""}</span>
    </div>`;
    const rowsList = `<div class="list section"><div class="rows">${list.map((it, i) => `<button type="button" class="row" data-ex="${i}" ${i === T.i ? 'aria-current="step"' : ""}>
        <span class="grow"><span class="t">${esc(EX[it[0]].name)}</span><br><span class="s">${esc(sub(it))}</span></span>${dots(it)}</button>`).join("")}</div>
      <p class="s m0">${this.gym.error ? "Gymaker can't be reached right now. Sets you log are kept on this device and sent later." : "Every set you log is saved in Gymaker, under today's date."}</p></div>`;
    const strip = `<div class="exstrip" aria-label="Exercises">${list.map((it, i) => `<button type="button" class="pill" data-ex="${i}" ${i === T.i ? 'aria-current="step"' : ""}>
        <span class="n num">${i + 1}</span><span class="pn">${esc(EX[it[0]].name)}</span>${dots(it)}</button>`).join("")}</div>`;
    if (list.every(done)) {
      return `<div class="train">${bar}${rowsList}${strip}<div class="stage"><div class="stg"><div class="eyebrow">Session ${this.sess} done</div><h2 class="name">Good work</h2>
        <div class="rows">${list.filter((it) => EX[it[0]].kind !== "warm").map((it) => `<div class="row"><span class="grow t">${esc(EX[it[0]].name)}</span><span class="s num">${this.rowsFor(it[0]).map((r) => EX[it[0]].kind === "amrap" ? `${r.reps} rounds` : r.weight === "" ? `${r.reps}` : `${r.weight} kg × ${r.reps}`).join(" · ")}</span></div>`).join("")}</div>
        <p class="tip">Saved in Gymaker. Next time each set starts from today's numbers.</p></div></div></div>`;
    }
    const allDone = done(x);
    let visual, work, setsBlock = "";
    if (e.kind === "amrap") {
      visual = `<ol class="cmoves">${e.list.map((w) => { const p = exImg(w[1]); return `<li class="cmv"><span class="cimgs"><img src="${p[0]}" alt=""><img src="${p[1]}" alt=""></span><span class="t">${esc(w[0])}</span></li>`; }).join("")}</ol>`;
      const r0 = this.rowsFor(x[0])[0];
      work = `<div class="setrows"><div class="setrow bw${r0.logged ? " logged" : ""}"><span class="setn">Rounds</span>
        ${this.stepper(x[0], 0, "reps", r0.reps, "rounds")}
        <button type="button" class="btn ${r0.logged ? "" : "primary"}" data-log="${x[0]}:0">${r0.logged ? (r0.dirty ? "Save rounds" : `${ic("check")} Logged`) : "Log rounds"}</button></div></div>`;
    } else if (e.kind === "warm") {
      visual = `<div class="moves">${e.list.map((w) => `<div class="mv${T.warm[this.sess] ? " done" : ""}"><img src="${exImg(w[1])[0]}" alt=""><span class="grow">${esc(w[0])}</span><span class="num">0:30</span></div>`).join("")}</div>`;
      work = `<p class="tip m0">${esc(e.tip)} Not logged in Gymaker.</p>
        <button type="button" class="btn big ${T.warm[this.sess] ? "" : "primary"}" data-act="warmdone">${T.warm[this.sess] ? `${ic("check")} Warm-up done` : "Mark warm-up done"}</button>`;
    } else {
      const p = exImg(e.img), rows = this.rowsFor(x[0]), g = this.gym.data[e.name];
      visual = `<div class="photos"><img src="${p[0]}" alt="Start position"><img src="${p[1]}" alt="End position"></div>`;
      const unit = e.log === "40seg" ? "seconds" : "reps";
      const lastTxt = g && g.last.length ? `Last time (${g.lastDate}): ${g.last.map((s) => s.weight === "" ? `${s.reps}` : `${s.weight} kg × ${s.reps}`).join(" · ")}` : this.gym.loading ? "Loading last time from Gymaker" : "No earlier sets in Gymaker yet.";
      work = `<div class="target"><span class="reps">${esc(e.reps)}</span>${e.kg != null ? `<span class="s">${e.perHand ? "Weight is per dumbbell" : "Weight in kg"}</span>` : `<span class="s">Bodyweight</span>`}</div>
        <p class="s m0">${esc(lastTxt)}</p>`;
      // The sets get the stage's full width, so weight, reps and the button sit on one line on a computer.
      setsBlock = `<div class="setrows">${rows.map((r, i) => `<div class="setrow${r.logged ? " logged" : ""}${e.kg == null ? " bw" : ""}"><span class="setn">Set ${i + 1}</span>
          ${e.kg != null ? this.stepper(x[0], i, "weight", r.weight, "kg") : ""}
          ${this.stepper(x[0], i, "reps", r.reps, unit)}
          <button type="button" class="btn ${r.logged && !r.dirty ? "" : "primary"}" data-log="${x[0]}:${i}">${r.logged ? (r.dirty ? "Save set" : `${ic("check")} Logged`) : "Log set"}</button></div>`).join("")}</div>
        <div class="actions"><button type="button" class="btn quiet" data-act="addset">${ic("plus")} Add a set</button>
          ${allDone && T.i < list.length - 1 ? `<button type="button" class="btn big primary grow" data-act="next">Next exercise</button>` : ""}</div></div>`;
    }
    const stage = `<div class="stg">
      <div class="stage-top">
        <div class="section"><div class="eyebrow">Exercise ${T.i + 1} of ${list.length}</div>
          <h2 class="name">${esc(e.name)}</h2>${visual}
          ${e.kind === "warm" ? "" : `<p class="tip">${esc(e.tip)}</p>`}</div>
        <div class="side">${work}
          ${allDone && T.i < list.length - 1 && e.kind ? `<button type="button" class="btn big primary" data-act="next">Next exercise</button>` : ""}
          <div class="actions split"><button type="button" class="btn quiet" data-act="prev" ${T.i === 0 ? "disabled" : ""}>${ic("left")} Previous exercise</button>
            <button type="button" class="btn quiet" data-act="next" ${T.i === list.length - 1 ? "disabled" : ""}>Next exercise ${ic("right")}</button></div>
          <div class="kbd"><span><kbd>→</kbd> next exercise</span><span><kbd>←</kbd> previous</span></div>
        </div></div>${setsBlock}</div>`;
    return `<div class="train">${bar}${rowsList}${strip}<div class="stage">${stage}</div></div>`;
  }
  stepper(key, i, field, value, unit) {
    const label = field === "weight" ? `Set ${i + 1} weight in kg` : `Set ${i + 1} ${unit}`;
    return `<span class="stepper st-${field}"><button type="button" data-step="${key}:${i}:${field}:-1" aria-label="Less, ${label}">${ic("minus")}</button>
      <input class="num" type="number" inputmode="decimal" min="0" step="${field === "weight" ? 0.5 : 1}" value="${value}" data-field="${key}:${i}:${field}" aria-label="${label}">
      <span class="unit">${unit}</span><button type="button" data-step="${key}:${i}:${field}:1" aria-label="More, ${label}">${ic("plus")}</button></span>`;
  }

  /* ---------------- Food log ---------------- */
  logTitle() {
    if (this.form) return this.form.plan ? this.form.n : this.form.key ? "Change product" : "Add a product";
    if (this.meal) return this.meal.entryId ? FL.SLOT_LABEL[this.meal.slot] : this.meal.name;
    return this.logMode === "foods" ? "Foods and meals" : "Food log";
  }
  targets() { return { ...FL.DEFAULT_TARGETS, ...(this.foods.targets || {}) }; }
  cat() {
    const key = JSON.stringify([this.foods.products, this.foods.nick]);
    if (this._catKey !== key) { this._catKey = key; this._cat = FL.catalog(this.F, this.foods); }
    return this._cat;
  }
  setFoods(next) { this.foods = next; this.change("foods", next); }
  entries(day) { return (this.sync["log:" + day]?.value?.entries || []).slice(); }
  setEntries(day, list) { this.change("log:" + day, { ...(this.sync["log:" + day]?.value || {}), entries: list }); }
  dayLabel(day) {
    const today = isoDay(new Date()), y = isoDay(new Date(Date.now() - 86400000));
    const d = new Date(day + "T12:00:00");
    const long = d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
    return day === today ? `Today, ${long}` : day === y ? `Yesterday, ${long}` : long;
  }
  shiftLogDay(n) {
    const d = new Date(this.logDay + "T12:00:00"); d.setDate(d.getDate() + n);
    const day = isoDay(d), today = isoDay(new Date()), oldest = isoDay(new Date(Date.now() - 34 * 86400000));
    if (day > today || day < oldest) return;
    this.logDay = day; this.saveMeal = null; this.render();
  }
  /** The plan's six meals for a date, with their ingredients, to log in one go. */
  planMeals(day) {
    const F = this.F, date = new Date(day + "T00:00:00");
    const idx = Math.floor((date - CYCLE_START) / 86400000);
    const week = idx >= 0 ? (Math.floor(idx / 7) % 2) + 1 : 1;
    const d = this.dayIndex(week, wd(date)), fixed = PM.fixedFor(F, d);
    const meal = (s) => ({ ing: PM.mealIngredients(F, this.menu[d][s], d, s), name: this.R[this.menu[d][s].r].name });
    return [
      { slot: "breakfast", name: "Breakfast", ing: fixed[0].ing },
      { slot: "midmorning", name: "Mid-morning", ing: fixed[1].ing },
      { slot: "lunch", ...meal(0) },
      { slot: "afternoon", name: fixed[2].ing.grapes ? "Grapes" : "Pear", ing: fixed[2].ing },
      { slot: "dinner", ...meal(1) },
      { slot: "late", name: "Late snack", ing: fixed[3].ing },
    ];
  }
  /** One line on Today: what's eaten so far against the targets. */
  eatenLine() {
    const es = this.entries(isoDay(new Date()));
    const tot = FL.dayTotals(es), t = this.targets();
    const st = FL.status(tot, t);
    return `<button type="button" class="eaten" data-go="log">${ic("log")}<span class="grow"><span class="t">${es.length ? `Eaten so far: <span class="num">${num(tot.k)}</span> of <span class="num">${num(t.k)}</span> kcal` : "Nothing logged today"}</span><br>
      <span class="s">${es.length ? esc(st.slice(0, 2).map((x) => x.text).join(" · ")) : "Log what you eat to see where the day stands."}</span></span><span class="s">Log food</span>${ic("right")}</button>`;
  }
  /** The live check under the entry box: what each part matched, and what it didn't. */
  previewHtml() {
    const text = this.logText.trim();
    if (!text) return `<p class="s m0">Amount, then food. Grams by default; ml, kg, l and units work too ("2 huevos", "1 platano"). Separate foods with commas.</p>`;
    const { items, problems } = FL.parse(text, this.cat());
    const unitTxt = (i) => (i.u === "ud" ? `${num(i.a)}` : `${num(i.a)} ${i.u}`);
    const nick = (f) => f.nick[0] || f.n.toLowerCase();
    const msg = (p) => {
      if (p.error === "unknown") return `<span class="grow"><b>"${esc(p.name || p.text)}"</b> isn't one of your foods.</span>
        <button type="button" class="btn" data-add-nick="${esc(p.name || "")}">${ic("plus")} Add ${esc(p.name || "product")}</button>`;
      if (p.error === "amount") return `<span class="grow">How much <b>${esc(nick(p.food))}</b>? Add a number, like "${p.food.perunit ? "1" : "100"} ${esc(nick(p.food))}".</span>`;
      if (p.error === "unit") return `<span class="grow"><b>${esc(p.food.n)}</b> is counted in units: write "1 ${esc(nick(p.food))}".</span>`;
      if (p.error === "piece") return `<span class="grow">How much does one <b>${esc(nick(p.food))}</b> weigh? Write it in grams, or set a piece weight in Foods.</span>`;
      return `<span class="grow"><b>${esc(String(p.qty))} g of ${esc(nick(p.food))}</b>? Write "${esc(String(p.qty))} g ${esc(nick(p.food))}" if that's right.</span>`;
    };
    const sum = FL.sum(items);
    return `<div class="pv">
      ${items.map((i) => `<div class="pv-row"><span class="amt num">${unitTxt(i)}</span><span class="grow">${esc(i.n)}</span><span class="s nowrap">${num(i.m[0])} g protein · ${num(i.m[3])} kcal</span></div>`).join("")}
      ${problems.map((p) => `<div class="pv-row bad">${msg(p)}</div>`).join("")}
      ${items.length > 1 ? `<div class="pv-row sum"><span class="grow">Together</span>${this.macroLine(sum, { compact: true, targets: false })}</div>` : ""}
    </div>`;
  }
  logReady() { const r = FL.parse(this.logText, this.cat()); return r.items.length > 0 && !r.problems.length; }
  focusLog() { const el = this.$body?.querySelector('[data-r="logtext"]'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }

  v_log() {
    if (this.form) return this.v_form();
    if (this.meal) return this.v_meal();
    if (this.logMode === "foods") return this.v_foods();
    const t = this.targets(), es = this.entries(this.logDay), tot = FL.dayTotals(es), st = FL.status(tot, t);
    const isToday = this.logDay === isoDay(new Date());
    const meals = this.foods.meals || [];
    const plan = this.planMeals(this.logDay);
    const logged = new Set(es.map((e) => e.slot));
    const recent = this.recent();
    const bar = (m, label, unit) => {
      const v = tot[m], goal = t[m], pct = goal ? Math.min(100, Math.round((v / goal) * 100)) : 0;
      const over = v > goal && m !== "p";
      return `<div class="gl"><div class="gl-h"><span class="t">${label}</span><span class="num"><b>${num(m === "k" ? Math.round(v) : Math.round(v))}</b> / ${num(goal)} ${unit}</span></div>
        <div class="bar${over ? " over" : v >= goal ? " done" : ""}"><i data-w="${pct}"></i></div></div>`;
    };
    const sentences = `<ul class="verdict">${st.map((x) => `<li class="${x.tone}">${esc(x.text)}</li>`).join("")}</ul>`;
    const entryRow = (e) => {
      const m = FL.sum(e.items);
      return `<div class="entry"><div class="grow"><div class="t">${esc(e.items.map((i) => `${i.u === "ud" ? num(i.a) : num(i.a) + " " + i.u} ${i.n}`).join(", "))}</div>
        ${this.macroLine(m, { compact: true, targets: false })}</div>
        <div class="entry-act"><button type="button" class="icon-btn" data-edit-entry="${e.id}" aria-label="Change this entry">${ic("edit")}</button>
        <button type="button" class="icon-btn" data-del-entry="${e.id}" aria-label="Delete this entry">${ic("trash")}</button></div></div>`;
    };
    const bySlot = FL.SLOTS.map(([k, l]) => [k, l, es.filter((e) => e.slot === k)]).filter(([, , x]) => x.length);
    const bd = FL.breakdown(es, this.logMacro), mu = this.logMacro === "k" ? "kcal" : "g";
    const MN = { p: "Protein", c: "Carbs", f: "Fat", k: "Calories" };
    const breakdown = es.length ? `<div class="section">
        <div class="eyebrow">Where it came from</div>
        <div class="seg" role="group" aria-label="Show">${Object.entries(MN).map(([k, l]) => `<button type="button" data-log-macro="${k}" aria-pressed="${this.logMacro === k}">${l}</button>`).join("")}</div>
        ${bd.total > 0 ? `<div class="rows bd">${bd.slots.map((s) => `<div class="bd-slot">
          <div class="bd-h"><span class="t">${esc(s.label)}</span><span class="num">${num(s.v)} ${mu}</span><span class="pct num">${s.pct}%</span></div>
          <div class="bar"><i data-w="${s.pct}"></i></div>
          ${s.foods.map((f) => `<div class="bd-f"><span class="grow">${esc(f.n)} <span class="s num">${f.u === "ud" ? num(f.a) : num(f.a) + " " + f.u}</span></span><span class="num s">${num(f.v)} ${mu}</span><span class="pct num">${f.pct}%</span></div>`).join("")}
        </div>`).join("")}</div>
        <p class="s m0">Percent of the day's ${MN[this.logMacro].toLowerCase()}: ${num(bd.total)} ${mu}.</p>` : `<p class="s m0">No ${MN[this.logMacro].toLowerCase()} logged on this day.</p>`}
      </div>` : "";
    return `<div class="log-grid">
      <div class="log-main">
        <div class="section">
          <div class="daynav"><button type="button" class="icon-btn" data-log-shift="-1" aria-label="Previous day">${ic("left")}</button>
            <span class="t grow">${esc(this.dayLabel(this.logDay))}</span>
            <button type="button" class="icon-btn" data-log-shift="1" aria-label="Next day" ${isToday ? "disabled" : ""}>${ic("right")}</button></div>
          <div class="verdict-top">${es.length ? sentences : `<p class="s m0">Nothing logged yet. Target: ${num(t.k)} kcal, ${num(t.p)} g protein.</p>`}</div>
        </div>
        <div class="section">
          <label class="eyebrow" for="logText">What did you eat?</label>
          <div class="logbox"><input id="logText" class="login" data-r="logtext" type="text" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="done" maxlength="300" placeholder="400 leche, 8 cacao, 42 avena" value="${esc(this.logText)}">
            ${this.logText ? `<button type="button" class="icon-btn" data-act="logclear" aria-label="Clear the box">${ic("close")}</button>` : ""}</div>
          <div data-r="preview" aria-live="polite">${this.previewHtml()}</div>
          <div class="chips" role="group" aria-label="Meal">${FL.SLOTS.map(([k, l]) => `<button type="button" class="chip" data-log-slot="${k}" aria-pressed="${this.logSlot === k}">${l}</button>`).join("")}</div>
          <div class="actions logacts">
            <button type="button" class="btn big primary" data-act="logit" data-r="logit" ${this.logReady() ? "" : "disabled"}>${ic("check")} Log ${esc(FL.SLOT_LABEL[this.logSlot].toLowerCase())}</button>
            <button type="button" class="btn quiet" data-act="savemeal" data-r="savemeal" ${this.logReady() ? "" : "disabled"}>${ic("save")} Save as a meal</button>
          </div>
          ${this.saveMeal ? `<div class="panel"><label class="eyebrow" for="mealName">Name this meal</label>
            <input id="mealName" class="login" data-r="mealname" maxlength="60" placeholder="Desayuno avena" value="${esc(this.saveMeal.name)}">
            <div class="actions"><button type="button" class="btn primary" data-act="savemealgo">${ic("save")} Save meal</button><button type="button" class="btn quiet" data-act="savemealno">Cancel</button></div></div>` : ""}
          ${meals.length ? `<div class="chiprow"><span class="eyebrow">Your meals</span><div class="chips">${meals.map((m) => `<button type="button" class="chip" data-use-meal="${m.id}">${esc(m.name)}</button>`).join("")}</div></div>` : ""}
          <div class="chiprow"><span class="eyebrow">From the plan${isToday ? ", today" : ""}</span><div class="chips">${plan.map((m, i) => `<button type="button" class="chip${logged.has(m.slot) ? " done" : ""}" data-plan-meal="${i}">${logged.has(m.slot) ? ic("check") : ""}${esc(m.name)}</button>`).join("")}</div></div>
          ${recent.length ? `<div class="chiprow"><span class="eyebrow">Recent</span><div class="chips">${recent.map((r, i) => `<button type="button" class="chip clip" data-recent="${i}">${ic("history")}<span>${esc(r.label)}</span></button>`).join("")}</div></div>` : ""}
        </div>
        <div class="section">
          <div class="aisle-h"><span class="eyebrow">Logged</span><button type="button" class="btn quiet" data-act="foods">${ic("book")} Foods and meals</button></div>
          ${bySlot.length ? bySlot.map(([k, l, x]) => `<div class="slotgroup"><div class="slot-h"><span class="eyebrow">${l}</span><span class="s num grow">${num(FL.sum(x.flatMap((e) => e.items)).k)} kcal</span><button type="button" class="btn quiet" data-add-slot="${k}">${ic("plus")} Add to ${l.toLowerCase()}</button></div><div class="rows">${x.map(entryRow).join("")}</div></div>`).join("")
            : `<p class="muted m0">Nothing logged ${isToday ? "yet today" : "on this day"}.</p>`}
        </div>
      </div>
      <div class="log-side">
        <div class="section goals">
          <div class="eyebrow">The day so far</div>
          ${sentences}
          ${bar("k", "Calories", "kcal")}${bar("p", "Protein", "g")}${bar("c", "Carbs", "g")}${bar("f", "Fat", "g")}
          <button type="button" class="btn quiet self-start" data-go="settings">${ic("settings")} Change targets</button>
        </div>
        ${breakdown}
      </div></div>`;
  }
  logIt() {
    const { items, problems } = FL.parse(this.logText, this.cat());
    if (!items.length || problems.length) return;
    const list = this.entries(this.logDay);
    list.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), slot: this.logSlot, text: this.logText.trim().slice(0, 300), items, at: new Date().toISOString() });
    this.setEntries(this.logDay, list);
    const label = FL.SLOT_LABEL[this.logSlot];
    this.logText = ""; store.set("logdraft", ""); this.saveMeal = null;
    this.render();
    this.toastLogged(label, list);
  }
  toastLogged(label, list) {
    const day = this.logDay, id = list[list.length - 1].id;
    const st = FL.status(FL.dayTotals(list), this.targets());
    this.toast(`${label} logged. ${st[0].text}.`, () => { this.setEntries(day, this.entries(day).filter((e) => e.id !== id)); this.render(); });
  }
  /** The last distinct things logged, newest first, to log again in two taps. */
  recent() {
    const days = Object.keys(this.sync).filter((k) => k.startsWith("log:")).sort().reverse().slice(0, 14);
    const seen = new Set(), out = [];
    for (const k of days) {
      const es = (this.sync[k].value?.entries || []).slice().sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
      for (const e of es) {
        const sig = e.items.map((i) => `${i.k}:${i.a}`).sort().join("|");
        if (seen.has(sig)) continue;
        seen.add(sig);
        out.push({ label: e.items.map((i) => i.n.split(" ")[0]).join(", "), entry: e });
        if (out.length === 5) return out;
      }
    }
    return out;
  }
  /** A meal opened from a chip: its foods with amounts to change, then logged in one tap. */
  openMeal(src, ref) {
    const cat = this.cat();
    let m;
    if (src === "saved") {
      const sm = (this.foods.meals || []).find((x) => x.id === ref);
      if (!sm) return;
      const r = FL.parse(sm.text, cat);
      m = { name: sm.name, slot: sm.slot || this.logSlot, id: sm.id, rows: r.items.map((i) => ({ k: i.k, a: i.a })), missing: r.problems.length };
    } else if (src === "plan") {
      const pm = this.planMeals(this.logDay)[ref];
      m = { name: pm.name, slot: pm.slot, id: null, rows: Object.entries(pm.ing).map(([k, a]) => ({ k, a })), missing: 0 };
    } else if (src === "entry") {
      const e = this.entries(this.logDay).find((x) => x.id === ref);
      if (!e) return;
      // Foods deleted from the list since keep their logged values.
      m = { name: "", slot: e.slot, id: null, entryId: e.id, rows: e.items.map((i) => (cat[i.k] ? { k: i.k, a: i.a } : { k: i.k, a: i.a, snap: i })), missing: 0 };
    } else {
      const r = this.recent()[ref];
      if (!r) return;
      const rows = r.entry.items.filter((i) => cat[i.k]).map((i) => ({ k: i.k, a: i.a }));
      m = { name: r.label, slot: r.entry.slot, id: null, rows, missing: r.entry.items.length - rows.length };
    }
    m.orig = JSON.stringify(m.rows); m.more = ""; m.moreErr = "";
    this.meal = m; this.saveMeal = null;
    this.pushNav();
    this.render({ top: true });
    this.$title.focus({ preventScroll: true });
  }
  mealItems() { const cat = this.cat(); return this.meal.rows.filter((r) => r.a > 0 && (cat[r.k] || r.snap)).map((r) => (cat[r.k] ? FL.item(cat[r.k], r.a) : r.snap)); }
  addMore() {
    const m = this.meal, { items, problems } = FL.parse(m.more, this.cat());
    if (!m.more.trim()) return;
    if (problems.length) {
      const p = problems[0];
      m.moreErr = p.error === "unknown" ? `"${p.name || p.text}" isn't one of your foods. Add it in Foods and meals first.` : `Check "${p.text}": write the amount, then the food, like "20 cacahuetes".`;
      return this.render();
    }
    for (const i of items) m.rows.push({ k: i.k, a: i.a });
    m.more = ""; m.moreErr = "";
    this.render();
    this.$body.querySelector('[data-r="mealmore"]')?.focus();
  }
  saveEntry() {
    const m = this.meal, items = this.mealItems(), day = this.logDay, prev = this.entries(day);
    if (!items.length) return;
    const list = prev.map((e) => (e.id === m.entryId ? { ...e, slot: m.slot, items, text: FL.textFor(Object.fromEntries(m.rows.filter((r) => !r.snap).map((r) => [r.k, r.a])), this.cat()).slice(0, 300) } : e));
    this.setEntries(day, list);
    this.closeTop();
    this.toast(`${FL.SLOT_LABEL[m.slot]} saved. ${FL.status(FL.dayTotals(list), this.targets())[0].text}.`, () => { this.setEntries(day, prev); this.render(); });
  }
  v_meal() {
    const m = this.meal, cat = this.cat(), items = this.mealItems();
    const changed = m.id && JSON.stringify(m.rows) !== m.orig;
    const rows = m.rows.map((r, i) => {
      const f = cat[r.k];
      if (!f && r.snap) return `<div class="mrow"><span class="grow"><span class="t">${esc(r.snap.n)}</span><br><span class="s">${num(r.snap.m[0])} g protein · ${num(r.snap.m[3])} kcal · no longer in your foods</span></span>
        <span class="s nowrap">${num(r.a)} ${r.snap.u === "ud" ? "units" : r.snap.u}</span><button type="button" class="icon-btn" data-mdel="${i}" aria-label="Remove ${esc(r.snap.n)}">${ic("close")}</button></div>`;
      if (!f) return "";
      const it = r.a > 0 ? FL.item(f, r.a) : null;
      return `<div class="mrow"><span class="grow"><span class="t">${esc(f.n)}</span><br><span class="s">${it ? `${num(it.m[0])} g protein · ${num(it.m[3])} kcal` : "Enter an amount"}</span></span>
        <span class="tin amt-in"><input class="num" type="number" inputmode="decimal" min="0" max="10000" step="any" value="${r.a}" data-mamt="${i}" aria-label="${esc(f.n)}, amount in ${f.u === "ud" ? "units" : f.u}"><span class="unit">${f.u === "ud" ? "units" : f.u}</span></span>
        <button type="button" class="icon-btn" data-mdel="${i}" aria-label="Remove ${esc(f.n)}">${ic("close")}</button></div>`;
    }).join("");
    return `<div class="section form">
      <div class="chips" role="group" aria-label="Meal">${FL.SLOTS.map(([k, l]) => `<button type="button" class="chip" data-log-slot="${k}" aria-pressed="${m.slot === k}">${l}</button>`).join("")}</div>
      ${m.rows.length ? `<div class="rows">${rows}</div>` : `<p class="muted m0">No foods in this meal yet. Add some below.</p>`}
      <div class="ffield"><label class="eyebrow" for="mealMore">Add more to this meal</label>
        <div class="logbox"><input id="mealMore" class="login" data-r="mealmore" type="text" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="done" maxlength="300" placeholder="20 cacahuetes, 1 platano" value="${esc(m.more)}">
          <button type="button" class="btn" data-act="mmore">${ic("plus")} Add</button></div>
        <p class="err-line" ${m.moreErr ? "" : "hidden"}>${esc(m.moreErr)}</p></div>
      ${m.missing ? `<p class="s m0">${m.missing === 1 ? "One food in it is" : `${m.missing} foods in it are`} no longer in your foods and ${m.missing === 1 ? "was" : "were"} left out.</p>` : ""}
      ${items.length ? `<div class="weekavg"><span class="eyebrow">This meal</span>${this.macroLine(FL.sum(items), { targets: false })}</div>` : ""}
      <div class="actions logacts">
        ${m.entryId ? `<button type="button" class="btn big primary" data-act="mentry" ${items.length ? "" : "disabled"}>${ic("check")} Save ${esc(FL.SLOT_LABEL[m.slot].toLowerCase())}</button>`
          : `<button type="button" class="btn big primary" data-act="mlog" ${items.length ? "" : "disabled"}>${ic("check")} Log ${esc(FL.SLOT_LABEL[m.slot].toLowerCase())}</button>
        <button type="button" class="btn quiet" data-act="mtext" ${items.length ? "" : "disabled"}>${ic("edit")} Edit as text</button>`}
        ${changed ? `<button type="button" class="btn quiet" data-act="msave">${ic("save")} Save amounts to ${esc(m.name)}</button>` : ""}
      </div>
      ${m.id ? `<div class="danger-zone"><button type="button" class="btn danger" data-del-meal="${m.id}">${ic("trash")} Delete ${esc(m.name)}</button></div>` : ""}
      ${m.entryId ? `<div class="danger-zone"><button type="button" class="btn danger" data-act="mentrydel">${ic("trash")} Delete from the log</button></div>` : ""}
    </div>`;
  }
  logMeal() {
    const items = this.mealItems();
    if (!items.length) return;
    const list = this.entries(this.logDay);
    list.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), slot: this.meal.slot, text: FL.textFor(Object.fromEntries(this.meal.rows.map((r) => [r.k, r.a])), this.cat()).slice(0, 300), items, at: new Date().toISOString() });
    this.setEntries(this.logDay, list);
    const label = FL.SLOT_LABEL[this.meal.slot];
    this.closeTop();
    this.toastLogged(label, list);
  }
  mealToText() {
    const sum = {}; for (const r of this.meal.rows) if (r.a > 0) sum[r.k] = (sum[r.k] || 0) + r.a;
    this.logText = FL.textFor(sum, this.cat()); this.logSlot = this.meal.slot; store.set("logdraft", this.logText);
    this.closeTop();
    this.focusLog();
  }
  saveMealAmounts() {
    const m = this.meal, sum = {};
    for (const r of m.rows) if (r.a > 0) sum[r.k] = (sum[r.k] || 0) + r.a;
    const meals = (this.foods.meals || []).map((x) => (x.id === m.id ? { ...x, slot: m.slot, text: FL.textFor(sum, this.cat()).slice(0, 300) } : x));
    this.setFoods({ ...this.foods, meals });
    m.orig = JSON.stringify(m.rows);
    this.render();
    this.toast(`Saved ${m.name}`);
  }
  deleteEntry(id) {
    const day = this.logDay, prev = this.entries(day);
    const e = prev.find((x) => x.id === id);
    this.setEntries(day, prev.filter((x) => x.id !== id));
    if (this.meal && this.meal.entryId === id) this.closeTop(); else this.render();
    this.toast(`Deleted from ${FL.SLOT_LABEL[e.slot].toLowerCase()}`, () => { this.setEntries(day, prev); this.render(); });
  }
  saveMealGo() {
    const name = (this.saveMeal?.name || "").trim();
    if (!name) { this.toast("Give the meal a name first"); return this.$body.querySelector('[data-r="mealname"]')?.focus(); }
    const meals = (this.foods.meals || []).filter((m) => m.name.toLowerCase() !== name.toLowerCase());
    if (meals.length >= 100) return this.toast("You have 100 saved meals. Delete one in Foods and meals first.");
    meals.push({ id: Date.now().toString(36), name: name.slice(0, 60), slot: this.logSlot, text: this.logText.trim().slice(0, 300) });
    this.setFoods({ ...this.foods, meals });
    this.saveMeal = null; this.render();
    this.toast(`Saved "${name}". Tap it under Your meals next time.`);
  }
  deleteMeal(id) {
    const prev = this.foods;
    const m = (prev.meals || []).find((x) => x.id === id);
    this.setFoods({ ...prev, meals: (prev.meals || []).filter((x) => x.id !== id) });
    if (this.meal && this.meal.id === id) this.closeTop(); else this.render();
    this.toast(`Deleted "${m.name}"`, () => { this.setFoods(prev); this.render(); });
  }

  /* ----- foods: own products, nicknames, saved meals ----- */
  v_foods() {
    const cat = this.cat(), own = Object.values(cat).filter((f) => f.own), planF = Object.values(cat).filter((f) => !f.own);
    const per = (f) => (f.perunit ? "per unit" : `per 100 ${f.u}`);
    const vals = (f) => `${num(f.nut[0])} P · ${num(f.nut[1])} C · ${num(f.nut[2])} F · ${num(f.nut[3])} kcal ${per(f)}`;
    const row = (f) => `<button type="button" class="row" data-edit-food="${f.k}"><span class="grow"><span class="t">${esc(f.n)}</span><br>
      <span class="s">Type: ${f.nick.map((n) => `<b class="nick">${esc(n)}</b>`).join(" ")}</span><br><span class="s num">${vals(f)}</span></span>${ic("edit")}</button>`;
    const meals = this.foods.meals || [];
    return `<div class="section">
        <p class="muted m0">The log knows a food by the words you type for it. Change them to whatever you say at home.</p>
        <button type="button" class="btn primary self-start" data-act="addprod">${ic("plus")} Add a product</button>
      </div>
      <div class="section"><div class="eyebrow">Your products</div>
        ${own.length ? `<div class="rows">${own.map(row).join("")}</div>` : `<p class="s m0">None yet. Add one from a Mercadona link, or type its label.</p>`}</div>
      <div class="section"><div class="eyebrow">Your meals</div>
        ${meals.length ? `<div class="rows">${meals.map((m) => `<div class="row"><span class="grow"><span class="t">${esc(m.name)}</span><br><span class="s">${esc(m.text)}</span></span>
          <button type="button" class="icon-btn" data-del-meal="${m.id}" aria-label="Delete ${esc(m.name)}">${ic("trash")}</button></div>`).join("")}</div>` : `<p class="s m0">None yet. Type a meal in the log and press Save as a meal.</p>`}</div>
      <div class="section"><div class="eyebrow">Foods from the plan</div><div class="rows">${planF.map(row).join("")}</div></div>`;
  }
  openForm({ key = null, nick = "" }) {
    const cat = this.cat(), f = key ? cat[key] : null;
    this.confirmDel = null;
    this.form = f
      ? { key, plan: !f.own, link: "", n: f.n, nick: f.nick.join(", "), u: f.u, p: f.nut[0], c: f.nut[1], f: f.nut[2], k: f.nut[3], piece: f.piece || "", src: f.src, mid: f.mid, ean: f.ean, msg: null }
      : { key: null, plan: false, link: "", n: "", nick: FL.norm(nick), u: "g", p: "", c: "", f: "", k: "", piece: "", msg: null };
    this.pushNav();
    this.render({ top: true });
    this.$body.querySelector(f ? '[data-af="nick"]' : '[data-af="link"]')?.focus();
  }
  formCheck() {
    const x = this.form, nut = [x.p, x.c, x.f, x.k].map(Number);
    if ([x.p, x.c, x.f, x.k].some((v) => v === "" || v === null) || nut.some((v) => !Number.isFinite(v) || v < 0)) return "";
    return FL.addsUp(nut) ? `<span class="ok">${ic("check")} The numbers add up.</span>`
      : `<span class="warn">Calories don't match protein, carbs and fat (${num(Math.round(4 * nut[0] + 4 * nut[1] + 9 * nut[2]))} kcal from them). Check the label.</span>`;
  }
  v_form() {
    const x = this.form, editing = !!x.key;
    const field = (k, label, extra = "") => `<label class="ffield"><span class="eyebrow">${label}</span><input class="login${k === "n" || k === "nick" ? "" : " num"}" data-af="${k}" value="${esc(x[k] ?? "")}" ${extra}></label>`;
    const numF = (k, label) => field(k, label, `type="number" inputmode="decimal" min="0" max="10000" step="0.1"`);
    const per = x.u === "ud" ? "per unit" : `per 100 ${x.u}`;
    const msg = x.msg ? `<div class="callout ${x.msg.tone}"><p class="m0">${x.msg.text}</p></div>` : "";
    if (x.plan) {
      return `<div class="section form">
        <p class="s m0">From the plan: its values come from the plan (${num(x.p)} P · ${num(x.c)} C · ${num(x.f)} F · ${num(x.k)} kcal ${per}). You can change the words you type for it.</p>
        ${field("nick", "Words you type for it, separated by commas", `autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="200"`)}
        <div class="actions"><button type="button" class="btn primary" data-act="formsave">${ic("save")} Save</button><button type="button" class="btn quiet" data-act="formcancel">Cancel</button></div></div>`;
    }
    return `<div class="section form">
      ${editing ? "" : `<div class="lookup"><label class="ffield grow"><span class="eyebrow">Mercadona link or product number</span>
        <input class="login" data-af="link" inputmode="url" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="300" placeholder="https://tienda.mercadona.es/product/86341/…" value="${esc(x.link)}"></label>
        <button type="button" class="btn${x.busy ? " busy" : ""}" data-act="lookup" ${this.online ? "" : "disabled"}>${ic("search")} ${x.busy ? "Finding product" : "Find product"}</button></div>
        <p class="s m0">${this.online ? "Fills in the name and, when Open Food Facts has it, the values. Or fill everything in by hand from the label." : "Offline: fill it in by hand from the label."}</p>`}
      ${msg}
      ${field("n", "Name", `maxlength="80"`)}
      ${field("nick", "Words you type for it, separated by commas", `autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="200" placeholder="avena, copos"`)}
      <div class="chiprow"><span class="eyebrow">Measured in</span><div class="seg" role="group" aria-label="Measured in">${[["g", "Grams"], ["ml", "Millilitres"], ["ud", "Units"]].map(([u, l]) => `<button type="button" data-form-unit="${u}" aria-pressed="${x.u === u}">${l}</button>`).join("")}</div></div>
      <div class="eyebrow">Values ${per}</div>
      <div class="fgrid">${numF("p", "Protein g")}${numF("c", "Carbs g")}${numF("f", "Fat g")}${numF("k", "Calories kcal")}</div>
      <div data-r="addsup" class="addsup">${this.formCheck()}</div>
      ${x.u === "ud" ? "" : numF("piece", `One piece weighs (${x.u}, optional, so "2 ${esc(FL.nicks(x.nick)[0] || "pieces")}" works)`)}
      <div class="actions"><button type="button" class="btn primary" data-act="formsave">${ic("save")} ${editing ? "Save changes" : "Add product"}</button><button type="button" class="btn quiet" data-act="formcancel">Cancel</button></div>
      ${editing ? `<div class="danger-zone">${this.confirmDel ? `<div class="confirm"><span>Delete ${esc(x.n)}? Days you already logged keep it.</span><button type="button" class="btn danger" data-act="delfoodgo">Delete product</button><button type="button" class="btn quiet" data-act="delfoodno">Keep it</button></div>`
        : `<button type="button" class="btn danger" data-act="delfood">${ic("trash")} Delete product</button>`}</div>` : ""}
    </div>`;
  }
  async lookup() {
    const x = this.form;
    if (x.busy) return;
    if (!/\/product\/\d|^\s*\d{1,8}(\.\d{1,2})?\s*$/.test(x.link)) { x.msg = { tone: "bad", text: "Paste a Mercadona product link (tienda.mercadona.es/product/…) or its number." }; return this.render(); }
    x.busy = true; x.msg = null; this.render();
    let r;
    try { r = await api("GET", "/food/lookup?q=" + encodeURIComponent(x.link.trim())); } catch { r = { status: 0 }; }
    x.busy = false;
    if (this.form !== x) return;
    if (r.status === 401) return this.signedOut();
    if (r.status !== 200) {
      x.msg = { tone: "bad", text: { 0: "Can't reach the server. Fill it in by hand, or try again when you're online.", 400: "That doesn't look like a Mercadona product link.", 404: "Mercadona has no product with that number." }[r.status] || "Mercadona isn't answering right now. Fill it in by hand, or try again in a minute." };
      return this.render();
    }
    const L = r.data;
    x.n = L.name; x.u = L.unit; x.mid = L.id; x.ean = L.ean || undefined;
    if (!FL.nicks(x.nick).length) x.nick = FL.norm(L.name).split(" ").filter((w) => w.length > 2)[0] || "";
    if (L.nut) { x.p = L.nut.p; x.c = L.nut.c; x.f = L.nut.f; x.k = L.nut.k; x.src = "off"; }
    x.msg = {
      ok: { tone: "good", text: "Values from Open Food Facts (per 100 " + L.unit + "). They add up; still worth a glance at the label." },
      doesnt_add_up: { tone: "bad", text: "Open Food Facts has values, but they don't add up. Check them against the label before saving." },
      missing: { tone: "bad", text: "Open Food Facts doesn't have this product. Type the four values from the label (per 100 " + L.unit + ")." },
    }[L.check];
    this.render();
    this.$body.querySelector(L.check === "missing" ? '[data-af="p"]' : '[data-af="nick"]')?.focus();
  }
  saveForm() {
    const x = this.form, cat = this.cat();
    const list = FL.nicks(x.nick);
    const fail = (t) => { x.msg = { tone: "bad", text: t }; this.render(); };
    if (!list.length) return fail("Add at least one word you'll type for it, like \"avena\".");
    const clash = FL.nickClash(cat, x.key, list);
    if (clash.length) return fail(`"${esc(clash[0].n)}" is already the word for ${esc(clash[0].food)}. Use another one.`);
    if (x.plan) {
      this.setFoods({ ...this.foods, nick: { ...(this.foods.nick || {}), [x.key]: list } });
      this.closeTop();
      return this.toast("Saved");
    }
    const name = String(x.n || "").trim();
    if (!name) return fail("Give it a name.");
    const nut = [x.p, x.c, x.f, x.k].map(Number);
    if ([x.p, x.c, x.f, x.k].some((v) => v === "") || nut.some((v) => !Number.isFinite(v) || v < 0 || v > 10000)) return fail("Fill in protein, carbs, fat and calories (0 is fine).");
    const piece = x.u !== "ud" && x.piece !== "" && Number(x.piece) > 0 ? Math.min(5000, Number(x.piece)) : null;
    const key = x.key || (x.mid ? "x" + String(x.mid).replace(/\D/g, "").slice(0, 12) : "x" + Date.now().toString(36).slice(-8));
    if (!x.key && (this.foods.products || {})[key]) return fail("That product is already in your list. Open it under Your products to change it.");
    const prod = { n: name.slice(0, 80), nick: list, u: x.u, nut: nut.map((v, i) => (i === 3 ? Math.round(v) : Math.round(v * 10) / 10)),
                   ...(piece ? { piece } : {}), src: x.src === "off" ? "off" : "label", ...(x.mid ? { mid: String(x.mid) } : {}), ...(x.ean ? { ean: x.ean } : {}) };
    this.setFoods({ ...this.foods, products: { ...(this.foods.products || {}), [key]: prod } });
    const added = !x.key;
    this.closeTop();
    this.toast(added ? `Added. Type "${list[0]}" in the log.` : "Saved");
    if (added && this.logMode !== "foods") this.focusLog();
  }
  deleteFood(key) {
    const prev = this.foods, products = { ...(prev.products || {}) }, n = products[key]?.n;
    delete products[key];
    this.setFoods({ ...prev, products });
    this.closeTop();
    this.toast(`Deleted ${n}`, () => { this.setFoods(prev); this.render(); });
  }
  /** Typing: the entry box and the product form update in place, without re-drawing the page. */
  onInput(e) {
    const t = e.target;
    if (!(t instanceof HTMLInputElement)) return;
    if (t.dataset.r === "logtext") {
      this.logText = t.value; store.set("logdraft", t.value);
      const pv = this.$body.querySelector('[data-r="preview"]'); if (pv) pv.innerHTML = this.previewHtml();
      const ok = this.logReady();
      this.$body.querySelectorAll('[data-r="logit"],[data-r="savemeal"]').forEach((b) => (b.disabled = !ok));
    } else if (t.dataset.r === "mealname" && this.saveMeal) this.saveMeal.name = t.value;
    else if (t.dataset.r === "mealmore" && this.meal) this.meal.more = t.value;
    else if (t.dataset.actf && this.actForm) this.actForm[t.dataset.actf] = t.value;
    else if (t.dataset.af && this.form) {
      this.form[t.dataset.af] = t.value;
      const a = this.$body.querySelector('[data-r="addsup"]'); if (a) a.innerHTML = this.formCheck();
    }
  }

  /* ---------------- Settings ---------------- */
  v_settings() {
    const s = this.settings, segb = (k, v, lbl) => `<button type="button" data-set="${k}" data-val="${v}" aria-pressed="${String(s[k]) === String(v)}">${lbl}</button>`;
    const gymTxt = { added: "Sessions A, B and C are in Gymaker as Home A, Home B and Home C.", waiting: "Open Gymaker once on this account, then come back: the sessions are added after that." }[this.routineState] || "Sessions A, B and C are added to Gymaker the first time you open Train.";
    return `<div class="section"><div class="eyebrow">Training</div><div class="rows">
      <div class="set-row"><span><span class="t">Sets per exercise</span><br><span class="s">Auto is 2 until Sun 15 Nov, then 3.</span></span><div class="seg">${segb("sets", "auto", "Auto")}${segb("sets", 2, "2")}${segb("sets", 3, "3")}</div></div>
      <div class="set-row"><span><span class="t">Training days</span><br><span class="s">Your usual week. To change one week only, use Move or Skip on Today.</span></span>
        <div class="wkgrid">${["A", "B", "C"].map((S) => { const w = this.weekly(); return `<div class="wkrow"><span class="t">Session ${S}</span><div class="chips">${DAYS.map((n, i) => `<button type="button" class="chip" data-wk="${S}:${i}" aria-pressed="${w[i] === S}" aria-label="Session ${S} on ${DAYS_LONG[i]}s">${n}</button>`).join("")}</div></div>`; }).join("")}</div></div>
      <div class="set-row"><span><span class="t">Gymaker</span><br><span class="s">${gymTxt}</span></span></div>
    </div></div>
    <div class="section"><div class="eyebrow">Food</div><div class="rows">
      <div class="set-row"><span><span class="t">Daily targets</span><br><span class="s">Used by the food log. The plan's menu averages about 154 g protein, 250 g carbs, 60 g fat and 2,200 kcal.</span></span>
        <div class="targets">${[["p", "Protein", "g"], ["c", "Carbs", "g"], ["f", "Fat", "g"], ["k", "Calories", "kcal"]].map(([k, l, u]) => `<label class="tfield"><span>${l}</span><span class="tin"><input class="num" type="number" inputmode="numeric" min="0" max="10000" step="1" value="${this.targets()[k]}" data-target="${k}"><span class="unit">${u}</span></span></label>`).join("")}</div></div>
      <div class="set-row"><span class="t">Store</span><span>${esc(this.F.store)}</span></div>
      <div class="set-row"><span class="t">Prices from</span><span class="num">${esc(this.F.prices)}</span></div>
      <div class="set-row"><span class="t">About a month</span><span class="num">${eur(this.shopping().totals.month)}</span></div>
    </div></div>
    <div class="section"><div class="eyebrow">Account</div><div class="rows">
      <div class="set-row"><span><span class="t">Signed in as ${esc(this.user.displayName || this.user.username)}</span><br><span class="s">${this.online ? "Settings and menu changes sync to your account." : "Offline. Changes sync when you're back online."}</span></span><button type="button" class="btn" data-act="signout">Sign out</button></div>
    </div></div>`;
  }

  /* ---------------- events ---------------- */
  onClick(e) {
    const b = e.target.closest("button");
    if (!b || !this.root.contains(b) || b.disabled) return;
    const d = b.dataset;
    if (d.go) {
      if (d.sess && d.sess !== this.sess) this.switchSession(d.sess);
      return this.go(d.go, true);
    }
    if (d.week) { this.week = +d.week; this.moveFrom = null; this.addSess = null; this.actForm = null; return this.render(); }
    if (d.day) { this.day = +d.day; this.moveFrom = null; this.addSess = null; this.actForm = null; return this.render(); }
    if (d.tmoveTo) return this.moveSession(this.moveFrom, d.tmoveTo);
    if (d.tsess) return this.setSessionOn(d.date, d.tsess);
    if (d.wk) { const [S, i] = d.wk.split(":"); return this.setWeekly(S, +i); }
    if (d.actType) { this.actForm.t = d.actType; return this.render(); }
    if (d.delAct) return this.deleteAct(d.date, d.delAct);
    if (d.addSlot) { this.logSlot = d.addSlot; this.render({ top: true }); return this.focusLog(); }
    if (d.menuWeek) { this.menuWeek = +d.menuWeek; this.sel = null; this.mode = null; return this.render(); }
    if (d.openMeal) { const [dd, ss] = d.openMeal.split(":").map(Number); return this.openRecipe(this.menu[dd][ss].r, { d: dd, s: ss }); }
    if (d.recipe) return this.openRecipe(d.recipe, null);
    if (d.pickMeal) {
      const [dd, ss] = d.pickMeal.split(":").map(Number);
      const same = this.sel && this.sel.d === dd && this.sel.s === ss;
      this.sel = same ? null : { d: dd, s: ss }; this.mode = null; this.drop = null;
      return this.render();
    }
    if (d.copyDay) { const v = +d.copyDay; this.copyDays.has(v) ? this.copyDays.delete(v) : this.copyDays.add(v); return this.render(); }
    if (d.copySlot) { this.copySlot = +d.copySlot; return this.render(); }
    if (d.swapTo) { const [td, ts] = d.swapTo.split(":").map(Number); return this.swapMeals([this.sel.d, this.sel.s], [td, ts]); }
    if (d.setRecipe) {
      const { d: dd, s: ss } = this.sel, next = clone(this.menu);
      next[dd][ss] = { ...next[dd][ss], r: d.setRecipe, note: "", swaps: {} };
      this.mode = null;
      return this.setMenu(next, `${this.mealName(dd, ss)}: ${this.R[d.setRecipe].name}`);
    }
    if (d.swapFrom) return this.setSwap(d.swapFrom, d.swapIng);
    if (d.flav) return this.setFlavour(d.flav);
    if (d.ing) { this.ingTicks.has(d.ing) ? this.ingTicks.delete(d.ing) : this.ingTicks.add(d.ing); return this.render(); }
    if (d.shop) { this.shop = d.shop; return this.render(); }
    if (d.pickItem) {
      const list = new Set(this.skip[this.shop] || []);
      list.has(d.pickItem) ? list.delete(d.pickItem) : list.add(d.pickItem);
      this.skip[this.shop] = [...list]; store.set("skip", this.skip);
      return this.render();
    }
    if (d.ex) { this.tr.i = +d.ex; this.saveTrain(); return this.render(); }
    if (d.pick) { if (d.pick !== this.sess) this.switchSession(d.pick); return this.render(); }
    if (d.step) {
      const [key, i, field, dir] = d.step.split(":");
      return this.bump(key, +i, field, +dir);
    }
    if (d.log) {
      const [key, i] = d.log.split(":");
      this.editRows(key, (rows) => { rows[+i].logged = true; rows[+i].dirty = false; });
      this.render();
      return this.logRows(key);
    }
    if (d.set && d.val !== undefined) {
      this.settings[d.set] = d.val === "auto" ? "auto" : +d.val;
      this.change("settings", this.settings);
      return this.render();
    }
    if (d.logSlot) { if (this.meal) this.meal.slot = d.logSlot; else this.logSlot = d.logSlot; return this.render(); }
    if (d.logShift) return this.shiftLogDay(+d.logShift);
    if (d.logMacro) { this.logMacro = d.logMacro; return this.render(); }
    if (d.useMeal) return this.openMeal("saved", d.useMeal);
    if (d.planMeal !== undefined) return this.openMeal("plan", +d.planMeal);
    if (d.recent !== undefined) return this.openMeal("recent", +d.recent);
    if (d.mdel !== undefined) { this.meal.rows.splice(+d.mdel, 1); return this.render(); }
    if (d.delEntry) return this.deleteEntry(d.delEntry);
    if (d.editEntry) return this.openMeal("entry", d.editEntry);
    if (d.delMeal) return this.deleteMeal(d.delMeal);
    if (d.addNick !== undefined) return this.openForm({ nick: d.addNick });
    if (d.editFood) return this.openForm({ key: d.editFood });
    if (d.formUnit) { this.form.u = d.formUnit; return this.render(); }
    if (d.act) return this.act(d.act, b);
  }
  onChange(e) {
    const t = e.target;
    if (t instanceof HTMLInputElement && t.dataset.mamt !== undefined && this.meal) {
      const v = Number(t.value), r = this.meal.rows[+t.dataset.mamt];
      if (r) r.a = t.value === "" || !Number.isFinite(v) || v < 0 ? 0 : Math.min(10000, Math.round(v * 10) / 10);
      return this.render();
    }
    if (t instanceof HTMLInputElement && t.dataset.target) {
      const v = Math.round(Number(t.value));
      if (t.value === "" || !Number.isFinite(v) || v < 0 || v > 10000) { t.value = this.targets()[t.dataset.target]; return; }
      this.setFoods({ ...this.foods, targets: { ...this.targets(), [t.dataset.target]: v } });
      return this.toast("Target saved");
    }
    if (!(t instanceof HTMLInputElement) || !t.dataset.field) return;
    const [key, i, field] = t.dataset.field.split(":");
    const v = t.value === "" ? "" : Math.max(0, Math.min(field === "weight" ? 500 : 1000, Number(t.value)));
    this.editRows(key, (rows) => { rows[+i][field] = Number.isNaN(v) ? rows[+i][field] : v; if (rows[+i].logged) rows[+i].dirty = true; });
    this.render();
  }
  bump(key, i, field, dir) {
    this.editRows(key, (rows) => {
      const cur = rows[i][field] === "" ? 0 : Number(rows[i][field]);
      rows[i][field] = Math.max(0, Math.round((cur + dir * 1) * 10) / 10);
      if (rows[i].logged) rows[i].dirty = true;
    });
    this.render();
  }
  switchSession(k) {
    this.sess = k;
    this.tr = { v: 2, date: isoDay(new Date()), sess: k, i: 0, rows: {}, warm: this.tr.warm || {} };
    this.saveTrain();
  }
  openRecipe(rid, ctx) {
    const v = ctx ? null : (this.menu.flat().find((m) => m.r === rid) || {}).v || Object.keys(this.V)[0];
    this.cook = { rid, ctx, v, swaps: {}, step: -1, timer: null };
    this.ingTicks.clear();
    this.go("cook");
    this.pushNav();
  }
  setSwap(from, to) {
    const c = this.cook;
    if (!c.ctx) { c.swaps = { ...c.swaps }; if (to === from) delete c.swaps[from]; else c.swaps[from] = to; return this.render(); }
    const { d, s } = c.ctx, next = clone(this.menu);
    const sw = { ...(next[d][s].swaps || {}) };
    if (to === from) delete sw[from]; else sw[from] = to;
    next[d][s].swaps = sw;
    this.setMenu(next, to === from ? `${this.mealName(d, s)}: back to ${this.F.ing[from].n.toLowerCase()}` : `${this.mealName(d, s)}: ${this.F.ing[to].n} instead of ${this.F.ing[from].n.toLowerCase()}`);
  }
  setFlavour(v) {
    const c = this.cook;
    if (!c.ctx) { c.v = v; return this.render(); }
    const { d, s } = c.ctx, next = clone(this.menu);
    next[d][s].v = v;
    this.setMenu(next, `${this.mealName(d, s)}: ${this.V[v].label}`);
  }
  swapMeals(a, b) {
    const next = clone(this.menu);
    const t = next[a[0]][a[1]]; next[a[0]][a[1]] = next[b[0]][b[1]]; next[b[0]][b[1]] = t;
    next[a[0]][a[1]].note = ""; next[b[0]][b[1]].note = "";
    this.sel = null; this.mode = null; this.drop = null;
    this.setMenu(next, `Swapped ${this.mealName(a[0], a[1])} and ${this.mealName(b[0], b[1])}`);
  }
  copyMeal(from, targets) {
    const next = clone(this.menu), src = next[from[0]][from[1]];
    for (const [d, s] of targets) next[d][s] = { ...clone(src), note: "" };
    this.sel = null; this.mode = null; this.drop = null; this.copyDays.clear();
    this.setMenu(next, `${this.R[src.r].name} copied to ${targets.length} ${targets.length === 1 ? "meal" : "meals"}`);
  }
  act(a, b) {
    const T = this.tr, list = SESS[this.sess], c = this.cook;
    switch (a) {
      case "next": if (T.i < list.length - 1) T.i++; this.saveTrain(); break;
      case "prev": if (T.i > 0) T.i--; this.saveTrain(); break;
      case "addset": this.editRows(list[T.i][0], (rows) => rows.push({ ...rows[rows.length - 1], logged: false, dirty: false })); break;
      case "warmdone": T.warm[this.sess] = !T.warm[this.sess]; if (T.warm[this.sess] && T.i < list.length - 1) T.i++; this.saveTrain(); break;
      case "editday": { const dd = +b.dataset.dayIndex; this.menuWeek = dd < 7 ? 1 : 2; this.view = "menu"; this.back = "menu"; this.menuFrom = "today"; this.sel = { d: dd, s: 0 }; this.mode = null; this.pushNav(); this.render({ top: true }); this.$title.focus({ preventScroll: true }); return; }
      case "mopen": { const { d, s } = this.sel; return this.openRecipe(this.menu[d][s].r, { d, s }); }
      case "mcopy": this.mode = "copy"; this.copyDays.clear(); this.copySlot = this.sel.s; break;
      case "mswap": this.mode = "swap"; break;
      case "mrecipe": this.mode = "recipe"; break;
      case "mcancel": this.mode = null; break;
      case "mclose": { const back = `[data-pick-meal="${this.sel.d}:${this.sel.s}"]`; this.sel = null; this.mode = null; this.render(); this.$body.querySelector(back)?.focus(); return; }
      case "mreset": {
        const { d, s } = this.sel, next = clone(this.menu);
        next[d][s] = clone(PM.defaultMenu(this.F)[d][s]);
        this.mode = null;
        return this.setMenu(next, `${this.mealName(d, s)} is back to the plan's meal`);
      }
      case "copygo": return this.copyMeal([this.sel.d, this.sel.s], [...this.copyDays].sort((x, y) => x - y).map((d) => [d, this.copySlot]));
      case "dropcopy": return this.copyMeal(this.drop.from, [this.drop.to]);
      case "dropswap": return this.swapMeals(this.drop.from, this.drop.to);
      case "dropcancel": this.drop = null; break;
      case "menureset": this.confirmMenuReset = true; break;
      case "menuresetno": this.confirmMenuReset = false; break;
      case "menuresetgo": this.confirmMenuReset = false; this.sel = null; return this.setMenu(PM.defaultMenu(this.F), "Menu reset to the plan");
      case "cstart": c.step = 0; this.wake(true); this.pushNav(); break;
      case "cnext": {
        const n = this.cookSteps(this.R[c.rid]).length;
        if (c.step < n - 1) { c.step++; c.timer = null; } else { c.step = -1; c.timer = null; this.wake(false); this.popNav(1); this.toast("Done. Enjoy it."); }
        break;
      }
      case "cprev": c.step--; c.timer = null; if (c.step < 0) { this.wake(false); this.popNav(1); } break;
      case "ctstart": c.timer = { end: Date.now() + +b.dataset.min * 60000 }; break;
      case "ctstop": c.timer = null; break;
      case "sendlist": return this.sendList();
      case "pickall": this.skip[this.shop] = []; store.set("skip", this.skip); break;
      case "picknone": this.skip[this.shop] = this.shopItems(this.shop).map((x) => x.id); store.set("skip", this.skip); break;
      case "signout": return this.signOut();
      case "headback": return this.closeTop();
      case "tmove": this.moveFrom = b.dataset.date; this.addSess = null; break;
      case "tskip": return this.setSessionOn(b.dataset.date, "-");
      case "taddsess": this.addSess = b.dataset.date; this.moveFrom = null; break;
      case "tclose": this.moveFrom = null; this.addSess = null; break;
      case "actadd": this.actForm = { day: b.dataset.date, t: "walk", km: "", min: "", err: "" }; this.render(); this.$body.querySelector('[data-actf="min"]')?.focus(); return;
      case "actgo": return this.addAct();
      case "actclose": this.actForm = null; break;
      case "mmore": return this.addMore();
      case "mentry": return this.saveEntry();
      case "mentrydel": return this.deleteEntry(this.meal.entryId);
      case "mlog": return this.logMeal();
      case "mtext": return this.mealToText();
      case "msave": return this.saveMealAmounts();
      case "logit": return this.logIt();
      case "logclear": this.logText = ""; store.set("logdraft", ""); this.render(); return this.focusLog();
      case "savemeal": this.saveMeal = { name: "" }; this.render(); this.$body.querySelector('[data-r="mealname"]')?.focus(); return;
      case "savemealgo": return this.saveMealGo();
      case "savemealno": this.saveMeal = null; break;
      case "foods": this.logMode = "foods"; this.form = null; this.pushNav(); this.render({ top: true }); this.$title.focus({ preventScroll: true }); return;
      case "addprod": return this.openForm({});
      case "lookup": return this.lookup();
      case "formsave": return this.saveForm();
      case "formcancel": return this.closeTop();
      case "delfood": this.confirmDel = this.form.key; break;
      case "delfoodno": this.confirmDel = null; break;
      case "delfoodgo": return this.deleteFood(this.form.key);
    }
    this.render();
  }
  onDrag(e) {
    const tile = e.target instanceof Element ? e.target.closest(".meal-tile") : null;
    if (e.type === "dragstart") {
      if (!tile) return;
      this.dragFrom = tile.dataset.pickMeal.split(":").map(Number);
      e.dataTransfer.effectAllowed = "copyMove";
      e.dataTransfer.setData("text/plain", tile.dataset.pickMeal);
      tile.classList.add("dragging");
    } else if (e.type === "dragover") {
      if (!tile || !this.dragFrom) return;
      e.preventDefault();
      this.root.querySelectorAll(".drop-over").forEach((x) => x !== tile && x.classList.remove("drop-over"));
      tile.classList.add("drop-over");
    } else if (e.type === "dragleave") {
      tile?.classList.remove("drop-over");
    } else if (e.type === "drop") {
      if (!tile || !this.dragFrom) return;
      e.preventDefault();
      const to = tile.dataset.pickMeal.split(":").map(Number);
      if (to[0] !== this.dragFrom[0] || to[1] !== this.dragFrom[1]) { this.drop = { from: this.dragFrom, to }; this.sel = null; this.mode = null; }
      this.dragFrom = null;
      this.render();
    } else if (e.type === "dragend") {
      this.dragFrom = null;
      this.root.querySelectorAll(".dragging,.drop-over").forEach((x) => x.classList.remove("dragging", "drop-over"));
    }
  }
  async signOut() {
    await this.push();
    try { await api("POST", "/auth/logout"); } catch {}
    ["user", "sync", "train", "gymq", "routines", "skip", "logdraft"].forEach((k) => store.del(k));
    location.reload();
  }
  async wake(on) {
    try {
      if (on && "wakeLock" in navigator && !this.lock) { this.lock = await navigator.wakeLock.request("screen"); this.lock.addEventListener("release", () => (this.lock = null)); }
      if (!on && this.lock) { await this.lock.release(); this.lock = null; }
    } catch {}
  }
  tick() {
    const c = this.cook;
    if (!this.$body || !c || !c.timer) return;
    const left = (c.timer.end - Date.now()) / 1000;
    if (left <= 0) { c.timer = null; this.toast("Timer done"); if (this.view === "cook") this.render(); }
    else if (this.view === "cook") { const el = this.root.querySelector('[data-r="ctime"]'); if (el) el.textContent = fmt(left); }
  }
  toast(msg, undo) {
    clearTimeout(this.tt); this.root.querySelector(".toast")?.remove();
    const t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status");
    t.innerHTML = `<span>${esc(msg)}</span>${undo ? `<button type="button">Undo</button>` : ""}`;
    if (undo) t.querySelector("button").onclick = () => { undo(); t.remove(); };
    this.root.appendChild(t); this.tt = setTimeout(() => t.remove(), 5000);
  }
  key(e) {
    if (!this.$body) return false;
    const t = e.target instanceof Element ? e.target : null;
    if (t && e.key === "Enter" && t.dataset.r === "logtext") { this.logIt(); return true; }
    if (t && e.key === "Enter" && t.dataset.r === "mealname") { this.saveMealGo(); return true; }
    if (t && e.key === "Enter" && t.dataset.r === "mealmore") { this.addMore(); return true; }
    if (t && e.key === "Enter" && t.dataset.actf) { this.addAct(); return true; }
    if (t && e.key === "Enter" && t.dataset.af === "link") { this.lookup(); return true; }
    if (t && t.closest("input,textarea")) return false;
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    if (e.key === "Escape" && this.view === "menu" && (this.sel || this.drop)) {
      const back = this.sel ? `[data-pick-meal="${this.sel.d}:${this.sel.s}"]` : null;
      this.sel = null; this.mode = null; this.drop = null; this.render();
      if (back) this.$body.querySelector(back)?.focus();
      return true;
    }
    if (e.key === "Escape" && this.nested()) { this.closeTop(); return true; }
    if (this.view !== "train") return false;
    if (e.key === "ArrowRight") this.act("next");
    else if (e.key === "ArrowLeft") this.act("prev");
    else return false;
    return true;
  }
}

/* ---------- boot ---------- */
(async () => {
  const root = document.getElementById("app");
  let plan;
  try { plan = await (await fetch(document.querySelector('link[rel="preload"][as="fetch"]')?.href || "data/plan.json")).json(); }
  catch { root.innerHTML = `<div class="boot">Can't load the plan. Check the connection and reload.</div>`; return; }
  window.hb = new App(root, plan);
  window.hb.start();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
