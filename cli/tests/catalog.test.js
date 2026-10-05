import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, cpSync, mkdirSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { buildIndex } from "../lib/build-index.js";

const CLI = fileURLToPath(new URL("../", import.meta.url));
const registry = (name) => ({ name, items: [{ name, title: name, description: name,
  meta: { collection: "core", tags: ["button"] }, dependencies: [] }] });

test("list total counts unique components across overlapping categories", async (t) => {
  const f = fixture(t);
  const data = registry("multi-category");
  data.items[0].meta.tags = ["hero", "button"];
  assert.ok(buildIndex(data, "", "http://localhost").components[0].categories.length > 1);
  const origin = await server(t, (req, res) => res.end(req.url === "/registry.json" ? JSON.stringify(data) : ""));
  const result = await run(f, origin);
  assert.equal(result.code, 0);
  assert.match(result.out, /\n1 component total\n$/);
});

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "ns-ui-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const pkg = join(root, "cli");
  mkdirSync(pkg);
  for (const entry of ["bin", "lib", "package.json"]) cpSync(join(CLI, entry), join(pkg, entry), { recursive: true });
  mkdirSync(join(pkg, "data"));
  writeFileSync(join(pkg, "data", "registry-index.json"), JSON.stringify(buildIndex(registry("bundled-only"), "", "https://design.helpmarq.com")));
  return { root, pkg };
}

async function server(t, handler) {
  const http = createServer(handler);
  await new Promise((resolve) => http.listen(0, "127.0.0.1", resolve));
  t.after(() => { http.closeAllConnections(); http.close(); });
  return `http://127.0.0.1:${http.address().port}`;
}

function run(f, origin) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(f.pkg, "bin", "ns-ui.js"), "list"], {
      env: { ...process.env, TMPDIR: f.root, NS_UI_REGISTRY: origin, NS_UI_FETCH_TIMEOUT_MS: "100", NO_COLOR: "1" },
    });
    let out = "", err = "";
    child.stdout.on("data", (data) => { out += data; });
    child.stderr.on("data", (data) => { err += data; });
    const deadline = setTimeout(() => { child.kill(); reject(new Error("CLI exceeded 2s deadline")); }, 2000);
    child.on("error", reject);
    child.on("close", (code) => { clearTimeout(deadline); resolve({ code, out, err }); });
  });
}

test("catalog cache stays isolated between registry origins", async (t) => {
  const f = fixture(t);
  const a = await server(t, (req, res) => res.end(req.url === "/registry.json" ? JSON.stringify(registry("origin-a-only")) : ""));
  let hits = 0;
  const b = await server(t, (req, res) => { hits++; res.end(req.url === "/registry.json" ? JSON.stringify(registry("origin-b-only")) : ""); });
  assert.equal((await run(f, a)).code, 0);
  const result = await run(f, b);
  assert.equal(result.code, 0);
  assert.match(result.out, /origin-b-only/);
  assert.doesNotMatch(result.out, /origin-a-only/);
  assert.equal(hits, 2);
});

test("stalled response body reaches bundled fallback within 2s", async (t) => {
  const f = fixture(t);
  const origin = await server(t, (_req, res) => { res.writeHead(200); res.write(" "); });
  const result = await run(f, origin);
  assert.equal(result.code, 0);
  assert.match(result.out, /bundled-only/);
});

test("malformed cache is ignored and refreshed from live data", async (t) => {
  const f = fixture(t);
  let hits = 0;
  const origin = await server(t, (req, res) => { hits++; res.end(req.url === "/registry.json" ? JSON.stringify(registry("live-only")) : ""); });
  await run(f, origin);
  const cache = readdirSync(f.root).find((name) => name.startsWith("ns-ui-cli-cache-"));
  assert.ok(cache);
  writeFileSync(join(f.root, cache), "{}");
  const result = await run(f, origin);
  assert.equal(result.code, 0);
  assert.match(result.out, /live-only/);
  assert.equal(hits, 4);
});

test("malformed live payload falls back without caching bad data", async (t) => {
  const f = fixture(t);
  const origin = await server(t, (req, res) => res.end(req.url === "/registry.json" ? "{}" : ""));
  const result = await run(f, origin);
  assert.equal(result.code, 0);
  assert.match(result.out, /bundled-only/);
  assert.equal(readdirSync(f.root).filter((name) => name.startsWith("ns-ui-cli-cache-")).length, 0);
});
