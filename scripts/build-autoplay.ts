// Collects the optional `autoplay` key from every meta.json sidecar into one
// site-only map: lib/autoplay.generated.json.
//
// Deliberately NOT part of registry.json / public/r/*.json / llms.txt. Autoplay
// says nothing about a component's API — it only tells the landing page what
// synthetic input demonstrates it inside a card. Leaking it into the published
// registry would advertise a prop that does not exist. `build-registry.ts`
// picks meta fields explicitly and `build-llms.ts` reads `meta.instruction`
// specifically, so the key stays out of both on its own; this script is the
// only consumer.
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { AUTOPLAY_MODES, AUTOPLAY_PATHS, type AutoplayMap } from "../lib/autoplay.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const map: AutoplayMap = {};
let bad = 0;

for (const collection of ["core", "loud"]) {
  const dir = join(ROOT, "registry", collection);
  if (!existsSync(dir)) continue;
  for (const name of readdirSync(dir).sort()) {
    const metaPath = join(dir, name, "meta.json");
    if (!existsSync(metaPath)) continue;
    const meta = JSON.parse(readFileSync(metaPath, "utf8"));
    const spec = meta.autoplay;
    if (spec === undefined) continue;
    if (!spec || typeof spec !== "object" || !AUTOPLAY_MODES.includes(spec.mode)) {
      console.error(`  ! ${name}: meta.json autoplay.mode must be one of ${AUTOPLAY_MODES.join(", ")}`);
      bad++;
      continue;
    }
    if (spec.path && !AUTOPLAY_PATHS.includes(spec.path)) {
      console.error(`  ! ${name}: meta.json autoplay.path must be one of ${AUTOPLAY_PATHS.join(", ")}`);
      bad++;
      continue;
    }
    if (spec.mode === "none") continue; // explicit "ambient, needs nothing"
    map[meta.name] = spec;
  }
}

writeFileSync(join(ROOT, "lib", "autoplay.generated.json"), JSON.stringify(map, null, 2) + "\n");
console.log(`autoplay.generated.json: ${Object.keys(map).length} descriptor(s)`);
if (bad) {
  console.error(`autoplay: ${bad} malformed descriptor(s) skipped`);
  process.exit(1);
}
