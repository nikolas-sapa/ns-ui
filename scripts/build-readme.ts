// Rewrites the generated numbers inside README.md, in place, from registry.json.
//
// README.md is committed and human-edited — it is the repo's front page — so
// this is NOT a full regenerate like registry/index.tsx or llms.txt. It only
// rewrites the text between paired markers:
//
//   <!-- generated:NAME start -->value<!-- generated:NAME end -->
//
// Everything outside a marker pair is left byte-untouched. A marker that is
// missing, unpaired, or out of order is a hard failure (exit 1) naming the
// file and the marker — this script never inserts a marker that isn't
// already there, and it never silently skips one.
//
// Run after build-registry.ts (registry.json must exist) as part of
// `npm run registry:build`.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const README_PATH = join(ROOT, "README.md");
const REGISTRY_PATH = join(ROOT, "registry.json");

if (!existsSync(REGISTRY_PATH)) {
  console.error(
    `build-readme: ${REGISTRY_PATH} does not exist. Run build-registry.ts first.`
  );
  process.exit(1);
}

const registry = JSON.parse(readFileSync(REGISTRY_PATH, "utf8"));
const items: { meta: { collection: string } }[] = registry.items;
const total = items.length;
const core = items.filter((i) => i.meta.collection === "core").length;
const loud = items.filter((i) => i.meta.collection === "loud").length;

const values: Record<string, string> = {
  count: String(total),
  core: String(core),
  loud: String(loud),
};

function applyMarker(text: string, name: string, value: string): string {
  const start = `<!-- generated:${name} start -->`;
  const end = `<!-- generated:${name} end -->`;
  const startIdx = text.indexOf(start);
  const endIdx = text.indexOf(end);
  if (startIdx === -1 || endIdx === -1) {
    console.error(
      `build-readme: ${README_PATH} is missing the "${name}" marker pair ` +
        `(expected both "${start}" and "${end}"). Add the markers by hand ` +
        `around the text they should govern — this script only rewrites ` +
        `content between existing markers, it never inserts them.`
    );
    process.exit(1);
  }
  if (endIdx < startIdx) {
    console.error(
      `build-readme: ${README_PATH} has the "${name}" marker pair out of ` +
        `order (end appears before start).`
    );
    process.exit(1);
  }
  const contentStart = startIdx + start.length;
  return text.slice(0, contentStart) + value + text.slice(endIdx);
}

let readme = readFileSync(README_PATH, "utf8");
for (const [name, value] of Object.entries(values)) {
  readme = applyMarker(readme, name, value);
}

const prev = readFileSync(README_PATH, "utf8");
if (prev !== readme) writeFileSync(README_PATH, readme);

console.log(
  `README.md: ${total} components (${core} core, ${loud} loud)`
);
