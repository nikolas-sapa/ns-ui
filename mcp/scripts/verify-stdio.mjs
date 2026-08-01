#!/usr/bin/env node
// Spawns the MCP server over stdio, hand-rolls a real JSON-RPC handshake
// (initialize -> notifications/initialized -> tools/list -> tools/call per
// tool), and asserts every tool returns a non-empty result. Framing is
// newline-delimited JSON, not LSP Content-Length headers.
import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENTRY = join(ROOT, "src", "index.ts");

const child = spawn(process.execPath, [ENTRY], {
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
    let msg;
    try {
      msg = JSON.parse(line);
    } catch (err) {
      console.error("FAIL: non-JSON line on stdout (would corrupt a real client):", line);
      process.exit(1);
    }
    if (msg.id !== undefined && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});

child.stderr.on("data", (chunk) => {
  process.stderr.write(`[server stderr] ${chunk}`);
});

child.on("exit", (code, signal) => {
  if (code !== null && code !== 0) {
    console.error(`server exited early with code ${code}`);
  }
});

function send(msg) {
  child.stdin.write(JSON.stringify(msg) + "\n");
}

function request(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`timed out waiting for response to ${method}`));
    }, 15000);
    pending.set(id, (msg) => {
      clearTimeout(timer);
      if (msg.error) reject(new Error(`${method} -> error: ${JSON.stringify(msg.error)}`));
      else resolve(msg.result);
    });
    send({ jsonrpc: "2.0", id, method, params });
  });
}

function notify(method, params) {
  send({ jsonrpc: "2.0", method, params });
}

async function main() {
  const init = await request("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "verify-stdio", version: "0.0.0" },
  });
  console.log("initialize ->", JSON.stringify(init.serverInfo));
  notify("notifications/initialized", {});

  const { tools } = await request("tools/list", {});
  console.log(`tools/list -> ${tools.length} tool(s): ${tools.map((t) => t.name).join(", ")}`);
  if (tools.length === 0) throw new Error("tools/list returned zero tools");

  const calls = [
    ["search_components", { query: "cursor reactive hero" }],
    ["search_components", { query: "otp", limit: 3 }],
    ["get_component", { name: "undo-ghost-row" }],
    ["list_categories", {}],
    ["install_command", { name: "undo-ghost-row" }],
    ["get_conventions", {}],
  ];

  for (const [name, args] of calls) {
    const result = await request("tools/call", { name, arguments: args });
    const t = result.content?.[0]?.text ?? "";
    if (result.isError) throw new Error(`${name} returned isError: ${t}`);
    if (!t || t.length === 0) throw new Error(`${name} returned empty content`);
    console.log(`tools/call ${name}(${JSON.stringify(args)}) -> ${t.length} chars, e.g.:`);
    console.log("  " + t.slice(0, 160).replace(/\n/g, "\n  "));
  }

  console.log("\nALL CHECKS PASSED");
  child.kill();
  process.exit(0);
}

main().catch((err) => {
  console.error("FAIL:", err.message);
  child.kill();
  process.exit(1);
});
