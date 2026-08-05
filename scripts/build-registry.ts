// Single-source registry build: meta.json sidecars are the only authority.
// Generates registry.json from them, then runs `shadcn build` → public/r/.
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { REGISTRY_ORIGIN } from "../lib/registry-origin.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// --- cssVars ------------------------------------------------------------
// A component installed into someone else's shadcn project only renders
// correctly if the tokens it references exist there. Two of ours are named
// after shadcn's own and mean the opposite thing (shadcn's --muted is a light
// BACKGROUND, ours is a TEXT colour; shadcn's --accent is a grey surface, ours
// is electric blue), so those two carry an ns- prefix and are shipped here.
// --background/--foreground/--border are deliberately NOT emitted: a component
// that brings its own page colours looks foreign in every host project, so
// those inherit from the consumer's theme.
const GLOBALS = readFileSync(join(ROOT, "app/globals.css"), "utf8");

// Values are read out of app/globals.css rather than restated here — a second
// copy of the hexes is a colour drift waiting to happen.
function tokenBlock(selector: RegExp): Record<string, string> {
  const open = GLOBALS.match(selector);
  if (!open) throw new Error(`globals.css: no ${selector} block`);
  const start = open.index! + open[0].length;
  const body = GLOBALS.slice(start, GLOBALS.indexOf("\n}", start));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}
const LIGHT = tokenBlock(/(^|\n):root\s*\{/);
const DARK = tokenBlock(/(^|\n)\.dark\s*\{/);

// Detection is on the installed file's own text: `--ns-muted` in a var(), or
// the Tailwind utility that the @theme mapping lifts it into (text-ns-muted).
// The lookahead is what keeps --ns-accent from matching --ns-accent-hover.
const TOKEN_TESTS: Record<string, RegExp> = {
  "ns-muted": /ns-muted(?![\w-])/,
  "ns-accent": /ns-accent(?![\w-])/,
  "ns-accent-hover": /ns-accent-hover(?![\w-])/,
  // --surface has no shadcn equivalent, so it keeps its plain name. Matched
  // only as a var() or a real utility prefix, so a component's own local
  // --ns-*-surface variable can't be mistaken for it.
  surface:
    /(?:--|(?:bg|text|border|ring-offset|ring|fill|stroke|outline|decoration|from|via|to)-)surface(?![\w-])/,
  error: /--error(?![\w-])/,
  warning: /--warning(?![\w-])/,
  success: /--success(?![\w-])/,
};
// Only these four are lifted into Tailwind's colour namespace by @theme, so
// only these need a --color-* alias in the consumer's theme layer.
const THEME_MAPPED = new Set([
  "ns-muted",
  "ns-accent",
  "ns-accent-hover",
  "surface",
]);

function cssVarsFor(source: string) {
  const used = Object.keys(TOKEN_TESTS).filter((t) => TOKEN_TESTS[t].test(source));
  if (used.length === 0) return undefined;
  const vars: {
    theme?: Record<string, string>;
    light?: Record<string, string>;
    dark?: Record<string, string>;
  } = {};
  const theme: Record<string, string> = {};
  const light: Record<string, string> = {};
  const dark: Record<string, string> = {};
  for (const t of used) {
    if (THEME_MAPPED.has(t)) theme[`color-${t}`] = `var(--${t})`;
    if (!LIGHT[t]) throw new Error(`globals.css: :root does not define --${t}`);
    light[t] = LIGHT[t];
    // Only tokens the dark block actually overrides — repeating an identical
    // value under .dark is noise in the consumer's stylesheet.
    if (DARK[t]) dark[t] = DARK[t];
  }
  if (Object.keys(theme).length) vars.theme = theme;
  vars.light = light;
  if (Object.keys(dark).length) vars.dark = dark;
  return vars;
}

const items = [];
const mismatched: { folder: string; metaName: string }[] = [];
for (const collection of ["core", "loud"]) {
  const dir = join(ROOT, "registry", collection);
  if (!existsSync(dir)) continue;
  for (const name of readdirSync(dir).sort()) {
    const metaPath = join(dir, name, "meta.json");
    if (!existsSync(metaPath)) continue;
    // Hard failure, but name the file: a bare JSON.parse here reports only
    // "Unexpected token" across 285+ sidecars, so one trailing comma takes
    // down the build with no way to tell which folder did it.
    let meta;
    try {
      meta = JSON.parse(readFileSync(metaPath, "utf8"));
    } catch (e) {
      throw new Error(
        `${metaPath}: ${e instanceof Error ? e.message : String(e)}`
      );
    }
    if (meta.name !== name) mismatched.push({ folder: name, metaName: meta.name });
    const componentPath = join(ROOT, "registry", collection, name, "component.tsx");
    const cssVars = existsSync(componentPath)
      ? cssVarsFor(readFileSync(componentPath, "utf8"))
      : undefined;
    items.push({
      name: meta.name,
      type: "registry:ui",
      title: meta.title,
      description: meta.description,
      files: [
        {
          path: `registry/${collection}/${name}/component.tsx`,
          type: "registry:ui",
          target: `components/ui/${name}.tsx`,
        },
      ],
      dependencies: meta.dependencies,
      cssVars,
      meta: {
        collection: meta.collection,
        tags: meta.tags,
        instruction: meta.instruction,
      },
    });
  }
}

// Loud guard: build-registry keys items by meta.name while build-index keys
// demos by folder name, so a mismatch ships an installable /r/<name>.json
// whose preview has no demo — installable but unpreviewable.
//
// Warning rather than a build failure on purpose, following the order guard
// below: the in-flight registry batch must not be blocked by a hard gate.
// ponytail: ceiling — a warning can be scrolled past in CI, so a mismatch can
// still ship. Upgrade path: flip to `throw` once the batch lands and the tree
// is known-clean.
if (mismatched.length > 0) {
  console.warn(
    `\n  WARNING: ${mismatched.length} meta.json name(s) do not match their folder.\n` +
      `  The demo is keyed by folder, so /r/<name>.json installs with no preview.\n` +
      `  Fix: set "name" in meta.json to the folder name (or rename the folder)\n` +
      `  Mismatched: ${mismatched
        .slice(0, 12)
        .map((m) => `${m.folder} (name: ${m.metaName})`)
        .join(", ")}${mismatched.length > 12 ? `, +${mismatched.length - 12} more` : ""}\n`
  );
}

writeFileSync(
  join(ROOT, "registry.json"),
  JSON.stringify(
    {
      $schema: "https://ui.shadcn.com/schema/registry.json",
      name: "ns-ui",
      // Single source of truth (lib/registry-origin.ts) — same origin the
      // showcase and llms.txt install commands use, so this can't drift.
      homepage: REGISTRY_ORIGIN,
      items,
    },
    null,
    2
  ) + "\n"
);
console.log(`registry.json: ${items.length} item(s) from meta sidecars`);

// Loud guard: every component must have a recency rank in
// lib/component-order.json, or it sorts LAST in the catalog's "Newest" view
// instead of first — so a freshly built component is the hardest one to find,
// which is the exact opposite of what you want after building it.
//
// This is a warning rather than a build failure on purpose: that file is
// DELIBERATELY not chained into this script (see scripts/build-order.ts —
// git history is unreliable on a Vercel shallow clone, so the snapshot is
// committed and regenerated by hand). A hard failure here would break every
// deploy that legitimately ships an unranked component. But it went unnoticed
// twice — 16 components once, then 22 more — so silence was clearly the wrong
// default.
try {
  const order: string[] = JSON.parse(
    readFileSync(join(ROOT, "lib/component-order.json"), "utf8")
  );
  const ranked = new Set(order);
  const unranked = items.map((i) => i.name).filter((n) => !ranked.has(n));
  if (unranked.length > 0) {
    console.warn(
      `\n  WARNING: ${unranked.length} component(s) missing from lib/component-order.json.\n` +
        `  They will sort LAST under "Newest" in the catalog, not first.\n` +
        `  Fix: npm run order:build   (then commit lib/component-order.json)\n` +
        `  Unranked: ${unranked.slice(0, 12).join(", ")}${unranked.length > 12 ? `, +${unranked.length - 12} more` : ""}\n`
    );
  }
} catch {
  // No order file yet (fresh clone before the first order:build) — not worth
  // failing a build over.
}
execFileSync("npx", ["shadcn", "build"], { cwd: ROOT, stdio: "inherit" });
