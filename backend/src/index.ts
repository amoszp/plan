import "dotenv/config";
import express from "express";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { router } from "./routes";
import { refresh } from "./catalog";

const app = express();
const PORT = Number(process.env.PORT ?? 4480);
const FRONTEND_DIR = process.env.FRONTEND_DIR ?? join(__dirname, "../../frontend");

app.disable("x-powered-by");
// The PWA only loads its own files: no inline scripts, no third-party content, no framing.
app.use((_req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; " +
      "media-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'"
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});
app.use(express.json({ limit: "32kb" }));
app.use("/api", router);
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "not found" });
});

// A CDN in front may keep .js, .css and .json for hours whatever this server says, so the page
// references them with a fingerprint of their contents: a new build is a new address.
const VERSIONED = ["styles.css", "exercises.js", "planmath.js", "foodlog.js", "app.js", "data/plan.json"];
const fingerprint = (name: string) =>
  createHash("sha256").update(readFileSync(join(FRONTEND_DIR, name))).digest("hex").slice(0, 12);
function versionedIndex(): string {
  let html = readFileSync(join(FRONTEND_DIR, "index.html"), "utf8");
  for (const name of VERSIONED) html = html.split(`"${name}"`).join(`"${name}?v=${fingerprint(name)}"`);
  return html;
}
const INDEX_HTML = versionedIndex();
app.get(["/", "/index.html"], (_req, res) => {
  res.set("Cache-Control", "no-cache").type("html").send(INDEX_HTML);
});
app.get("/sw.js", (_req, res) => {
  // The service worker names its cache after the build, so a deploy replaces the offline copy.
  const build = createHash("sha256").update(VERSIONED.map(fingerprint).join("")).digest("hex").slice(0, 12);
  const sw = readFileSync(join(FRONTEND_DIR, "sw.js"), "utf8").replace("__BUILD__", build);
  res.set("Cache-Control", "no-cache").type("application/javascript").send(sw);
});
app.use(express.static(FRONTEND_DIR, { index: false }));

app.listen(PORT, () => {
  console.log(`[homeblock] listening on port ${PORT}`);
  // The store catalogue for product search: the saved copy at once, a fresh one in the background.
  void refresh();
  setInterval(() => void refresh(), 6 * 3600000);
});
