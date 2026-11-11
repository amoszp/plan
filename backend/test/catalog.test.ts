import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// A saved copy of the catalogue, fresh, so the module uses it and never downloads.
const dir = mkdtempSync(join(tmpdir(), "homeblock-cat-"));
process.env.DB_PATH = join(dir, "test.db");
process.env.STORE_WH = "9999";
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ ]/g, " ").replace(/\s+/g, " ").trim();
const P = (id: string, name: string, thumb: string | null = `https://prod-mercadona.imgix.net/images/${id}.jpg?fit=crop&h=300&w=300`) =>
  ({ id, name, pack: "Paquete", price: 2.5, size: 0.2, fmt: "kg", thumb, words: norm(name).split(" ") });
writeFileSync(join(dir, "catalogue_9999.json"), JSON.stringify({ fetchedAt: Date.now(), products: [
  P("34024", "Nuez natural Hacendado pelada"),
  P("34025", "Nuez moscada molida Hacendado"),
  P("50001", "Pan de nueces 8,5%"),
  P("86341", "Copos de avena Brüggen"),
  P("10381", "Leche semidesnatada Hacendado"),
  P("666", "Producto con foto rara", "https://evil.example.com/x.jpg"),
] }));

const { refresh, search, catalogueReady, photoUrl } = require("../src/catalog");

test("the saved catalogue is used without downloading", async () => {
  await refresh();
  assert.equal(catalogueReady(), true);
});

test("search matches singular and plural, accents and word starts, best first", () => {
  assert.deepEqual(search("nueces").map((p: any) => p.id), ["34024", "34025", "50001"]);
  assert.deepEqual(search("nuez pelada").map((p: any) => p.id), ["34024"]);
  assert.deepEqual(search("bruggen").map((p: any) => p.id), ["86341"]);
  assert.deepEqual(search("semides").map((p: any) => p.id), ["10381"]);
  assert.deepEqual(search("x"), []);
  assert.deepEqual(search("pizza"), []);
});

test("photos only come from the store's image host", () => {
  assert.match(photoUrl("34024"), /^https:\/\/prod-mercadona\.imgix\.net\/images\/34024\.jpg\?.*w=160/);
  assert.equal(photoUrl("666"), null);
  assert.equal(photoUrl("nope"), null);
});
