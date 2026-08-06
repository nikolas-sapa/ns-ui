// Single source of truth for the ns-ui color token contract, read out of
// app/globals.css rather than restated as a literal list anywhere else — a
// second hand-typed copy of the token names is exactly how mcp/src/conventions.ts
// went stale (it silently dropped --success and --ns-accent-hover after they
// were added here). Anything that needs "the list of tokens" imports it from
// this file; nothing else defines its own copy.
//
// Moved out of scripts/build-registry.ts (which still does the per-component
// detection this powers) so scripts/build-mcp-conventions.ts can import the
// same validated names without re-running that script's side effects
// (writing registry.json, invoking `shadcn build`).
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GLOBALS = readFileSync(join(ROOT, "app/globals.css"), "utf8");

function tokenBlock(selector: RegExp): Record<string, string> {
  const open = GLOBALS.match(selector);
  if (!open) throw new Error(`globals.css: no ${selector} block`);
  const start = open.index! + open[0].length;
  const body = GLOBALS.slice(start, GLOBALS.indexOf("\n}", start));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}
export const LIGHT = tokenBlock(/(^|\n):root\s*\{/);
export const DARK = tokenBlock(/(^|\n)\.dark\s*\{/);

// Detection is on the installed file's own text: `--ns-muted` in a var(), or
// the Tailwind utility that the @theme mapping lifts it into (text-ns-muted).
// The lookahead is what keeps --ns-accent from matching --ns-accent-hover.
export const TOKEN_TESTS: Record<string, RegExp> = {
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
export const THEME_MAPPED = new Set([
  "ns-muted",
  "ns-accent",
  "ns-accent-hover",
  "surface",
]);

// Every token a component may reference, in the registry's canonical order.
// This is the full list get_conventions() (mcp/src/conventions.ts) documents.
export const EMITTED_TOKEN_NAMES = Object.keys(TOKEN_TESTS);

// --background/--foreground/--border are deliberately NOT emitted as cssVars
// (see build-registry.ts) — a component that brings its own page colours
// looks foreign in every host project, so those three inherit from the
// consumer's theme instead. They are still part of the contract a component
// author (and get_conventions()) must know about, just not part of what an
// install payload writes into the consumer's stylesheet.
export const INHERITED_TOKEN_NAMES = ["background", "foreground", "border"];

export const ALL_TOKEN_NAMES = [...INHERITED_TOKEN_NAMES, ...EMITTED_TOKEN_NAMES];

// Every name above must resolve to a real light-mode value, or the "single
// source of truth" claim is a lie — fail loud rather than silently document
// a token that globals.css doesn't actually define.
for (const name of ALL_TOKEN_NAMES) {
  if (!LIGHT[name]) {
    throw new Error(`lib/css-tokens.ts: globals.css :root does not define --${name}`);
  }
}

export function cssVarsFor(source: string) {
  const used = EMITTED_TOKEN_NAMES.filter((t) => TOKEN_TESTS[t].test(source));
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
