#!/usr/bin/env node
// Smallest thing that fails if the catalog-enumeration logic breaks: real
// stdio handshake against dist/index.js, asserting (a) initialize reports the
// package.json version, (b) tools/list exposes list_components, and (c) an
// unfiltered list_components returns exactly as many entries as the bundled
// snapshot has components. Same newline-JSON framing as scripts/verify-stdio.mjs.
// ponytail: lives beside the package rather than inside scripts/verify-stdio.mjs
// (owned elsewhere); ceiling is a second spawn per run — fold these three
// asserts into verify-stdio.mjs's call table when that file is free to edit.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const expectedVersion = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;
const expectedTotal = JSON.parse(
  readFileSync(join(ROOT, "data", "registry-snapshot.json"), "utf8")
).components.length;

const child = spawn(process.execPath, [join(ROOT, "dist", "index.js")], {
  stdio: ["pipe", "pipe", "pipe"],
});

let buf = "";
const pending = new Map();
let nextId = 1;

child.stdout.on("data", (chunk) => {
  buf += chunk.toString("utf8");
  let idx;
  while ((idx = buf.indexOf("\n")) !== -1) {
    const line = buf.slice(0, idx);
    buf = buf.slice(idx + 1);
    if (!line.trim()) continue;
    const msg = JSON.parse(line);
    if (msg.id !== undefined && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});
child.stderr.on("data", (chunk) => process.stderr.write(`[server stderr] ${chunk}`));

function request(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out on ${method}`)), 15000);
    pending.set(id, (msg) => {
      clearTimeout(timer);
      if (msg.error) reject(new Error(`${method} -> ${JSON.stringify(msg.error)}`));
      else resolve(msg.result);
    });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}

function assert(ok, message) {
  if (!ok) throw new Error(message);
  console.log(`ok: ${message}`);
}

async function main() {
  const init = await request("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "verify-list-components", version: "0.0.0" },
  });
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }) + "\n");
  assert(
    init.serverInfo.version === expectedVersion,
    `initialize reports ${init.serverInfo.version} (package.json ${expectedVersion})`
  );

  const { tools } = await request("tools/list", {});
  const names = tools.map((t) => t.name);
  assert(names.includes("list_components"), `tools/list exposes list_components (${names.join(", ")})`);

  const listed = tools.find((t) => t.name === "list_components");
  assert(
    !listed.inputSchema.required || listed.inputSchema.required.length === 0,
    "list_components has no required params"
  );

  const result = await request("tools/call", { name: "list_components", arguments: {} });
  const payload = JSON.parse(result.content[0].text);
  assert(
    payload.components.length === expectedTotal,
    `list_components returned ${payload.components.length} entries (snapshot has ${expectedTotal})`
  );
  assert(
    payload.components.every(
      (c) => Object.keys(c).sort().join(",") === "categories,collection,name,title"
    ),
    "every entry is exactly { name, title, collection, categories }"
  );

  const categories = JSON.parse(
    (await request("tools/call", { name: "list_categories", arguments: {} })).content[0].text
  );
  assert(
    typeof categories.generatedAt === "string" && categories.total === expectedTotal,
    `list_categories reports generatedAt=${categories.generatedAt} total=${categories.total}`
  );

  console.log("\nALL CHECKS PASSED");
  child.kill();
  process.exit(0);
}

main().catch((err) => {
  console.error("FAIL:", err.message);
  child.kill();
  process.exit(1);
});
