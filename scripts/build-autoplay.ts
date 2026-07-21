// Collects the optional site-only presentation keys from every meta.json
// sidecar into two maps: `autoplay` -> lib/autoplay.generated.json (what
// synthetic input demonstrates the component in a card) and `card` ->
// lib/card-frame.generated.json (which element the card should frame on).
//
// Deliberately NOT part of registry.json / public/r/*.json / llms.txt. Neither
// key says anything about a component's API — they only tell the landing page
// how to demonstrate and how to crop it. Leaking either into the published
// registry would advertise props that do not exist. `build-registry.ts`
// picks meta fields explicitly and `build-llms.ts` reads `meta.instruction`
// specifically, so the keys stay out of both on their own; this script is the
// only consumer.
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { AUTOPLAY_MODES, AUTOPLAY_PATHS, type AutoplayMap } from "../lib/autoplay.ts";
import type { CardFrameMap } from "../lib/card-frame.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const map: AutoplayMap = {};
const frames: CardFrameMap = {};
let bad = 0;

for (const collection of ["core", "loud"]) {
  const dir = join(ROOT, "registry", collection);
  if (!existsSync(dir)) continue;
  for (const name of readdirSync(dir).sort()) {
    const metaPath = join(dir, name, "meta.json");
    if (!existsSync(metaPath)) continue;
    const meta = JSON.parse(readFileSync(metaPath, "utf8"));

    const card = meta.card;
    if (card !== undefined) {
      if (!card || typeof card !== "object" || typeof card.focus !== "string" || !card.focus.trim()) {
        console.error(`  ! ${name}: meta.json card.focus must be a non-empty CSS selector`);
        bad++;
      } else if (card.padding !== undefined && !(typeof card.padding === "number" && card.padding >= 0)) {
        console.error(`  ! ${name}: meta.json card.padding must be a number >= 0`);
        bad++;
      } else if (card.maxZoom !== undefined && !(typeof card.maxZoom === "number" && card.maxZoom >= 1)) {
        console.error(`  ! ${name}: meta.json card.maxZoom must be a number >= 1`);
        bad++;
      } else {
        frames[meta.name] = card;
      }
    }

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

writeFileSync(join(ROOT, "lib", "card-frame.generated.json"), JSON.stringify(frames, null, 2) + "\n");
console.log(`card-frame.generated.json: ${Object.keys(frames).length} framing hint(s)`);

if (bad) {
  console.error(`autoplay: ${bad} malformed descriptor(s) skipped`);
  process.exit(1);
}
