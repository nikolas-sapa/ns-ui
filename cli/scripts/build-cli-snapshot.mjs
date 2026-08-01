// Generates cli/data/registry-index.json — the offline fallback the CLI
// falls back to when it can't reach the network and has no usable cache
// (see loadIndex()/fetchAndCache() in bin/ns-ui.js). CLI-owned: reads
// registry.json and public/llms.txt at the repo root directly (the same
// public artifacts the CLI fetches live at runtime) and assembles them with
// cli/lib/build-index.js — this script does not read or depend on mcp/ in
// any way, so the CLI works whether or not that package exists.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildIndex } from "../lib/build-index.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "data");
const OUT_FILE = join(OUT_DIR, "registry-index.json");

const registryPath = join(ROOT, "registry.json");
const llmsPath = join(ROOT, "public", "llms.txt");

if (!existsSync(registryPath) || !existsSync(llmsPath)) {
  throw new Error(
    "cli snapshot: registry.json and/or public/llms.txt not found at the repo root. " +
      "Run `npm run registry:build` at the repo root first."
  );
}

const registry = JSON.parse(readFileSync(registryPath, "utf8"));
const llmsText = readFileSync(llmsPath, "utf8");
const registryOrigin =
  process.env.NEXT_PUBLIC_REGISTRY_ORIGIN ?? "https://design.helpmarq.com";

const index = buildIndex(registry, llmsText, registryOrigin);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, JSON.stringify(index, null, 2) + "\n");

console.log(
  `cli snapshot: ${index.components.length} component(s), ${index.categories.length} categories -> cli/data/registry-index.json`
);
