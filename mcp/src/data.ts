// Loads the offline registry snapshot baked into this package by
// scripts/build-mcp-snapshot.ts (repo root) at publish time — see
// mcp/README.md for how that snapshot is produced and refreshed.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export type ComponentEntry = {
  name: string;
  title: string;
  description: string;
  collection: "core" | "loud";
  tags: string[];
  kind: string | null;
  categories: string[];
  useWhen: string;
  props: string;
  instruction: string;
  dependencies: string[];
  installCommand: string;
  sourcePath: string;
  source: string;
};

export type CategoryEntry = { id: string; label: string; count: number };

export type Snapshot = {
  generatedAt: string;
  registryOrigin: string;
  registryName: string;
  collections: string[];
  categories: CategoryEntry[];
  components: ComponentEntry[];
};

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SNAPSHOT_PATH = join(PKG_ROOT, "data", "registry-snapshot.json");

let cached: Snapshot | null = null;

export function loadSnapshot(): Snapshot {
  if (cached) return cached;
  if (!existsSync(SNAPSHOT_PATH)) {
    // All diagnostics go to stderr, never stdout — stdout is the JSON-RPC
    // transport and a stray line here corrupts it for the client.
    console.error(
      `[ns-ui-mcp] missing ${SNAPSHOT_PATH}. This package ships a generated ` +
        `snapshot of the registry; if you're running from a source checkout ` +
        `instead of an npm install, run \`npm run registry:build\` at the repo ` +
        `root (or \`npm run prepack\` inside mcp/) to generate it.`
    );
    throw new Error(`ns-ui-mcp: registry snapshot not found at ${SNAPSHOT_PATH}`);
  }
  cached = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"));
  return cached!;
}

export function findComponent(name: string): ComponentEntry | undefined {
  return loadSnapshot().components.find((c) => c.name === name);
}
