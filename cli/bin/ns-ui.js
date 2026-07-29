#!/usr/bin/env node

import { spawn } from "node:child_process";
import { parseArgs } from "node:util";
import { readFileSync } from "node:fs";

const REGISTRY_ORIGIN = process.env.NS_UI_REGISTRY || "https://design.helpmarq.com";
const REGISTRY_URL = `${REGISTRY_ORIGIN}/registry.json`;

const HELP = `ns-ui - CLI for the ns-ui component registry (${REGISTRY_ORIGIN})

Usage:
  npx @nikolas.sapa/ns-ui add <name> [...names]   Install one or more components via shadcn
  npx @nikolas.sapa/ns-ui list [--collection core|loud]   List all components
  npx @nikolas.sapa/ns-ui search <term>           Search components by name/title/description

Options:
  -h, --help       Show this help
  -v, --version    Show version

Examples:
  npx @nikolas.sapa/ns-ui add after-image
  npx @nikolas.sapa/ns-ui list --collection core
  npx @nikolas.sapa/ns-ui search toggle
`;

async function fetchRegistry() {
  let res;
  try {
    res = await fetch(REGISTRY_URL);
  } catch (err) {
    console.error(`Failed to reach the registry at ${REGISTRY_URL}`);
    console.error(err.message);
    process.exit(1);
  }
  if (!res.ok) {
    console.error(`Registry request failed: ${res.status} ${res.statusText}`);
    process.exit(1);
  }
  try {
    return await res.json();
  } catch (err) {
    console.error("Registry response was not valid JSON.");
    console.error(err.message);
    process.exit(1);
  }
}

function printVersion() {
  const pkg = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  console.log(pkg.version);
}

async function cmdAdd(names) {
  if (names.length === 0) {
    console.error("Usage: npx @nikolas.sapa/ns-ui add <name> [...names]");
    process.exit(1);
  }

  const registry = await fetchRegistry();
  const known = new Set(registry.items.map((item) => item.name));

  for (const name of names) {
    if (!known.has(name)) {
      console.error(`Unknown component "${name}".`);
      console.error(`Run \`npx @nikolas.sapa/ns-ui search ${name}\` to find the right name.`);
      process.exit(1);
    }
  }

  for (const name of names) {
    const url = `${REGISTRY_ORIGIN}/r/${name}.json`;
    console.log(`Installing ${name}...`);
    const code = await runShadcnAdd(url);
    if (code !== 0) {
      process.exit(code);
    }
  }
}

function runShadcnAdd(url) {
  return new Promise((resolve) => {
    const child = spawn("npx", ["shadcn@latest", "add", url], {
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("error", (err) => {
      console.error(`Failed to run shadcn: ${err.message}`);
      resolve(1);
    });
    child.on("close", (code) => resolve(code ?? 1));
  });
}

async function cmdList(collection) {
  const registry = await fetchRegistry();
  const items = collection
    ? registry.items.filter((item) => item.meta?.collection === collection)
    : registry.items;

  if (items.length === 0) {
    console.log(`No components found${collection ? ` in collection "${collection}"` : ""}.`);
    return;
  }

  for (const item of items) {
    console.log(`${item.name.padEnd(28)} ${item.title}`);
  }
  console.log(`\n${items.length} component${items.length === 1 ? "" : "s"}`);
}

async function cmdSearch(term) {
  if (!term) {
    console.error("Usage: npx @nikolas.sapa/ns-ui search <term>");
    process.exit(1);
  }

  const registry = await fetchRegistry();
  const needle = term.toLowerCase();
  const matches = registry.items.filter((item) => {
    return (
      item.name.toLowerCase().includes(needle) ||
      item.title?.toLowerCase().includes(needle) ||
      item.description?.toLowerCase().includes(needle)
    );
  });

  if (matches.length === 0) {
    console.log(`No components matched "${term}".`);
    return;
  }

  for (const item of matches) {
    console.log(`${item.name.padEnd(28)} ${item.title}`);
  }
  console.log(`\n${matches.length} match${matches.length === 1 ? "" : "es"}`);
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);

  if (!command || command === "-h" || command === "--help") {
    console.log(HELP);
    return;
  }

  if (command === "-v" || command === "--version") {
    printVersion();
    return;
  }

  if (command === "add") {
    await cmdAdd(rest);
    return;
  }

  if (command === "list") {
    const { values } = parseArgs({
      args: rest,
      options: { collection: { type: "string" } },
      strict: false,
    });
    await cmdList(values.collection);
    return;
  }

  if (command === "search") {
    await cmdSearch(rest[0]);
    return;
  }

  console.error(`Unknown command "${command}".\n`);
  console.log(HELP);
  process.exit(1);
}

main();
