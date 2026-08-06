// Generates lib/status.generated.json — every filesystem-measurable fact the
// /status page prints. Pure node stdlib, no deps, one pass.
//
// Chained LAST in `npm run registry:build`, after build-posters.ts and
// build-mcp-snapshot.ts, because it measures their output. Running it before
// them measures a stale build and quietly reports the wrong numbers.
//
// Not committed — see .gitignore / .vercelignore — and consumed by a STATIC
// `import` in app/status/page.tsx, never an fs read at runtime: .vercelignore
// excludes registry.json, public/r/**, public/llms*.txt and lib/*.generated.json
// from the source upload, so those paths do not exist on Vercel until this
// chain has run. Same pattern as lib/autoplay.generated.json.
//
// Every field below is measured. Nothing here is hand-maintained, and nothing
// is read from prose — README.md's counts are themselves generated (see
// build-readme.ts), and AGENTS.md / package.json's description were fixed to
// carry no component count rather than a number that would drift again.
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FEATURED } from "../lib/featured.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_FILE = join(ROOT, "lib", "status.generated.json");

type RegistryItem = { name: string; meta?: { collection?: string } };

const registryPath = join(ROOT, "registry.json");
if (!existsSync(registryPath)) {
  throw new Error(
    "registry.json not found — run this after build-registry.ts, not standalone."
  );
}
const registry: { items: RegistryItem[] } = JSON.parse(
  readFileSync(registryPath, "utf8")
);
const items = registry.items;

/** `## ` block count in a generated llms file, or null when it is absent. */
function blockCount(file: string): number | null {
  const path = join(ROOT, "public", file);
  if (!existsSync(path)) return null;
  return (readFileSync(path, "utf8").match(/^## /gm) ?? []).length;
}

function componentDir(item: RegistryItem): string | null {
  const collection = item.meta?.collection;
  if (collection) {
    const dir = join(ROOT, "registry", collection, item.name);
    if (existsSync(dir)) return dir;
  }
  for (const c of ["core", "loud"]) {
    const dir = join(ROOT, "registry", c, item.name);
    if (existsSync(dir)) return dir;
  }
  return null;
}

// --- install payloads ----------------------------------------------------
// The check that discriminates "the URL resolves" from "the install would
// actually work": parse each payload and assert it carries real file bodies.
//
// Iterates registry.items and constructs the path, deliberately NOT readdir:
// public/r/ also holds the registry.json index plus local build residue from
// deleted components. That residue is git+vercel ignored, regenerated, and
// 404s in production — counting it would be a false alarm.
let payloadsOk = 0;
for (const item of items) {
  const path = join(ROOT, "public", "r", `${item.name}.json`);
  if (!existsSync(path)) continue;
  try {
    const payload: { files?: unknown } = JSON.parse(readFileSync(path, "utf8"));
    const files = payload.files;
    if (!Array.isArray(files) || files.length === 0) continue;
    const everyFileHasContent = files.every(
      (f: unknown) =>
        typeof (f as { content?: unknown })?.content === "string" &&
        (f as { content: string }).content.length > 0
    );
    if (everyFileHasContent) payloadsOk += 1;
  } catch {
    // A payload that does not parse is a failed payload. Counted by omission.
  }
}

// --- rename redirects ----------------------------------------------------
// docs/rename-map.tsv is 1 header row + N data rows. One data row is a
// self-pair (old_slug === new_slug), a loop that lib/rename-redirects.ts
// skips rather than emitting a redirect to itself. Two separate skips: fold
// them together and the pair count is off by one and the entry count by four.
const tsv = readFileSync(join(ROOT, "docs", "rename-map.tsv"), "utf8");
const rows = tsv
  .split("\n")
  .slice(1)
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => line.split("\t"));
const pairs = rows
  .map((cells) => ({ from: cells[0], to: cells[1] }))
  .filter((p) => p.from && p.to && p.from !== p.to);
// Each pair emits four URL shapes: /r/<s>.json, /components/<s>,
// /preview/<s>, /preview/<s>/play. See lib/rename-redirects.ts.
const REDIRECT_SHAPES_PER_PAIR = 4;
const names = new Set(items.map((i) => i.name));
const redirectBrokenTargets = pairs.filter((p) => !names.has(p.to)).length;

// --- posters and previews ------------------------------------------------
// Both are checked at the exact paths app/_components/featured-card.tsx
// requests, per featured slug per theme, so a pass here means the card
// resolves and a miss here means it silently falls back.
const THEMES = ["light", "dark"] as const;
const featuredPairs = FEATURED.flatMap((slug) =>
  THEMES.map((theme) => ({ slug, theme }))
);
const postersOk = featuredPairs.filter(({ slug, theme }) =>
  existsSync(join(ROOT, "public", "posters", `${slug}-${theme}.png`))
).length;
const previewsOk = featuredPairs.filter(({ slug, theme }) =>
  existsSync(join(ROOT, "public", "previews", `${slug}-${theme}.mp4`))
).length;
const previewsDir = join(ROOT, "public", "previews");
const previewFilesPresent = existsSync(previewsDir)
  ? readdirSync(previewsDir).filter((f) => f.endsWith(".mp4")).length
  : 0;

// --- screenshots and meta ------------------------------------------------
// The seven fields scripts/verify.ts enforces, and the two screenshots the
// build actually consumes (build-posters.ts and the OG card read exactly
// `<theme>-default.png`; every other state is gitignored churn).
const META_FIELDS = [
  "name",
  "title",
  "description",
  "collection",
  "tags",
  "instruction",
  "dependencies",
] as const;

let screenshotsOk = 0;
let metaOk = 0;
for (const item of items) {
  const dir = componentDir(item);
  if (!dir) continue;
  const hasBoth = THEMES.every((theme) =>
    existsSync(join(dir, "screenshots", `${theme}-default.png`))
  );
  if (hasBoth) screenshotsOk += 1;
  const metaPath = join(dir, "meta.json");
  if (!existsSync(metaPath)) continue;
  try {
    const meta: Record<string, unknown> = JSON.parse(
      readFileSync(metaPath, "utf8")
    );
    const complete = META_FIELDS.every(
      (f) => meta[f] !== undefined && meta[f] !== ""
    );
    if (complete) metaOk += 1;
  } catch {
    // Unparseable meta.json is incomplete meta.json. Counted by omission.
  }
}

// --- local package versions ---------------------------------------------
// The packages' own package.json, never lib/package-publish-status.ts: that
// file exports two hand-flipped booleans whose doc comments claim mcp-0.1.0 /
// cli-0.2.0, both one release stale.
function localVersion(pkgDir: string): string | null {
  const path = join(ROOT, pkgDir, "package.json");
  if (!existsSync(path)) return null;
  try {
    const v: unknown = JSON.parse(readFileSync(path, "utf8")).version;
    return typeof v === "string" ? v : null;
  } catch {
    return null;
  }
}

/** Components in the MCP server's offline snapshot, or null when it is absent
 *  or unreadable. Same idiom as every other read here: this script is chained
 *  last before `next build`, so a truncated snapshot must report "unknown"
 *  rather than throw the deploy. */
function snapshotCount(): number | null {
  const path = join(ROOT, "mcp", "data", "registry-snapshot.json");
  if (!existsSync(path)) return null;
  try {
    const components: unknown = JSON.parse(readFileSync(path, "utf8")).components;
    return Array.isArray(components) ? components.length : null;
  } catch {
    return null;
  }
}

const status = {
  builtAt: new Date().toISOString(),
  components: items.length,
  llmsBlocks: blockCount("llms.txt"),
  llmsFullBlocks: blockCount("llms-full.txt"),
  snapshotComponents: snapshotCount(),
  payloadsOk,
  payloadsTotal: items.length,
  redirectPairs: pairs.length,
  redirectEntries: pairs.length * REDIRECT_SHAPES_PER_PAIR,
  redirectBrokenTargets,
  postersOk,
  postersTotal: featuredPairs.length,
  previewsOk,
  previewsTotal: featuredPairs.length,
  previewFilesPresent,
  screenshotsOk,
  screenshotsTotal: items.length,
  metaOk,
  metaTotal: items.length,
  cliVersionLocal: localVersion("cli"),
  mcpVersionLocal: localVersion("mcp"),
};

writeFileSync(OUT_FILE, `${JSON.stringify(status, null, 2)}\n`);
console.log(
  `status: ${status.components} components · payloads ${payloadsOk}/${items.length} · ` +
    `screenshots ${screenshotsOk}/${items.length} · posters ${postersOk}/${featuredPairs.length} · ` +
    `previews ${previewsOk}/${featuredPairs.length} · redirects ${pairs.length} pairs`
);
