// Generates public/llms.txt and public/llms-full.txt from the same meta.json
// sidecars build-registry.ts reads, plus a deterministic scan of each
// component.tsx for its public prop signature. Plain node, ESM, no parser
// dependency: prop extraction is bracket-balanced text scanning, not an AST.
//
// Why a scanner and not ts-morph: the prop shapes in this repo are a closed,
// observed set (inline destructured object types, occasional forwardRef<Handle,
// Props>, occasional bare HTMLAttributes<T> reference, occasional `& Omit<...>`
// intersection) — balancing {}, (), <> and skipping strings/comments covers all
// of them without a real parser. If a component's shape falls outside what this
// scanner recognizes, it warns loudly and emits an explicit "unresolved" marker
// rather than guessing.
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { REGISTRY_ORIGIN } from "../lib/registry-origin.ts";
import { PACKAGE_PUBLISHED } from "../lib/package-publish-status.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// Single source of truth (lib/registry-origin.ts) — see that file for the
// DNS-pending backstory and the one-line switch once it resolves.
const HOMEPAGE = REGISTRY_ORIGIN;
// Version and license come from root package.json / LICENSE, not a literal,
// so a model reading this file can tell what it's redistributing without
// grepping component prose for an incidental "licen" hit.
const PACKAGE_VERSION = (
  JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { version: string }
).version;
const GENERATED_ON = new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Bracket-balanced text utilities — the only "parsing" this script does.
// Both skip string literals ('...', "...", `...`) and // and /* */ comments
// so brace/paren/angle characters inside them never perturb depth tracking.
// ---------------------------------------------------------------------------

const PAIRS: Record<string, string> = { "{": "}", "(": ")", "[": "]", "<": ">" };
const CLOSERS = new Set(Object.values(PAIRS));

/** Index of the bracket matching the opener at `openIdx`, or -1. */
function findMatch(src: string, openIdx: number): number {
  const open = src[openIdx];
  const close = PAIRS[open];
  let depth = 0;
  let inStr: string | null = null;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (c === "\\") { i++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === "/" && src[i + 1] === "/") {
      const nl = src.indexOf("\n", i);
      i = nl === -1 ? src.length : nl;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      i = end === -1 ? src.length : end + 1;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { inStr = c; continue; }
    // `=>` is an arrow, not a generic close — only matters when close === ">"
    // (findMatch is used standalone, without splitTop's stack, to hunt a
    // forwardRef<...> generic's closing angle bracket).
    if (close === ">" && c === ">" && src[i - 1] === "=") continue;
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) return i; }
  }
  return -1;
}

/** Split `src` on a literal separator that appears only at bracket depth 0. */
function splitTop(src: string, sep: string): string[] {
  const stack: string[] = [];
  const parts: string[] = [];
  let inStr: string | null = null;
  let last = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (c === "\\") { i++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === "/" && src[i + 1] === "/") {
      const nl = src.indexOf("\n", i);
      i = nl === -1 ? src.length : nl;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      i = end === -1 ? src.length : end + 1;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { inStr = c; continue; }
    if (c === ">" && src[i - 1] === "=") continue; // `=>` arrow, not a generic close
    if (PAIRS[c]) { stack.push(PAIRS[c]); continue; }
    if (CLOSERS.has(c)) { if (stack[stack.length - 1] === c) stack.pop(); continue; }
    if (stack.length === 0 && src.startsWith(sep, i)) {
      parts.push(src.slice(last, i));
      i += sep.length - 1;
      last = i + 1;
    }
  }
  parts.push(src.slice(last));
  return parts.map((p) => p.trim()).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Prop-shape parsing
// ---------------------------------------------------------------------------

type Member = {
  rest: boolean;
  name: string;
  optional: boolean;
  type: string;
  comment: string;
};
type Segment = { kind: "object"; members: Member[] } | { kind: "ref"; text: string };
type Extracted = {
  segments: Segment[];
  defaults: Record<string, string>;
  noProps?: boolean;
};

function parseMember(raw: string): Member | null {
  let text = raw;
  let comment = "";
  const block = text.match(/^\s*\/\*\*([\s\S]*?)\*\/\s*/);
  if (block) {
    comment = block[1].replace(/\r?\n\s*\*?\s*/g, " ").trim();
    text = text.slice(block[0].length);
  } else {
    const lines = text.split("\n");
    let idx = 0;
    const cLines: string[] = [];
    while (idx < lines.length && /^\s*\/\//.test(lines[idx])) {
      cLines.push(lines[idx].replace(/^\s*\/\/\s?/, ""));
      idx++;
    }
    if (cLines.length) {
      comment = cLines.join(" ").trim();
      text = lines.slice(idx).join("\n");
    }
  }
  text = text.trim();
  if (!text) return null;
  const m = text.match(
    /^(\.\.\.)?\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[\w$]+)\s*(\?)?\s*:\s*([\s\S]*)$/
  );
  if (!m) return null;
  let name = m[2];
  if (/^["']/.test(name)) name = name.slice(1, -1);
  return {
    rest: !!m[1],
    name,
    optional: !!m[3],
    type: m[4].trim().replace(/\s+/g, " "),
    comment,
  };
}

function parseDefaults(destructureText: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const entry of splitTop(destructureText, ",")) {
    const m = entry.match(
      /^(\.\.\.)?\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[\w$]+)\s*(?::\s*[\w$]+\s*)?(?:=\s*([\s\S]+))?$/
    );
    if (!m || m[1]) continue; // rest element — nothing to default
    let key = m[2];
    if (/^["']/.test(key)) key = key.slice(1, -1);
    if (m[3] !== undefined) map[key] = m[3].trim().replace(/\s+/g, " ");
  }
  return map;
}

function parseTypeAnnotation(annotation: string): Segment[] {
  const segments: Segment[] = [];
  for (const seg of splitTop(annotation, "&")) {
    if (seg.startsWith("{")) {
      const close = findMatch(seg, 0);
      const body = close > 0 ? seg.slice(1, close) : seg.slice(1, -1);
      const members = splitTop(body, ";")
        .map(parseMember)
        .filter((m): m is Member => m !== null);
      segments.push({ kind: "object", members });
    } else {
      segments.push({ kind: "ref", text: seg });
    }
  }
  return segments;
}

/** Text between the opener at `openIdx` (any of `{([<`) and its match, exclusive. */
function paramTextAt(src: string, openParenIdx: number): string | null {
  const close = findMatch(src, openParenIdx);
  if (close < 0) return null;
  return src.slice(openParenIdx + 1, close);
}

function leadingBrace(paramText: string): string | null {
  const trimmed = paramText.trim();
  if (!trimmed.startsWith("{")) return null;
  const close = findMatch(trimmed, 0);
  if (close < 0) return null;
  return trimmed.slice(1, close);
}

function splitParamAndType(paramText: string): {
  destructure: string | null;
  annotation: string | null;
  empty: boolean;
} {
  const trimmed = paramText.trim();
  if (!trimmed) return { destructure: null, annotation: null, empty: true };
  if (trimmed[0] === "{") {
    const close = findMatch(trimmed, 0);
    if (close < 0) return { destructure: null, annotation: null, empty: false };
    const destructure = trimmed.slice(1, close);
    const rest = trimmed.slice(close + 1).trim();
    const annotation = rest.startsWith(":") ? rest.slice(1).trim() : null;
    return { destructure, annotation, empty: false };
  }
  const colon = trimmed.indexOf(":");
  if (colon > -1) {
    return { destructure: null, annotation: trimmed.slice(colon + 1).trim(), empty: false };
  }
  return { destructure: null, annotation: null, empty: false };
}

/** Recognizes: named Props type, `export function Name(`, and `forwardRef<Handle, Props>(`. */
function extractComponentProps(src: string): Extracted | null {
  // export interface FooProps { ... } / export type FooProps = { ... }
  let m =
    src.match(/export interface \w+Props\s*\{/) ??
    src.match(/export type \w+Props\s*=\s*\{/);
  if (m) {
    const braceIdx = m.index! + m[0].length - 1;
    const close = findMatch(src, braceIdx);
    if (close > 0) {
      const body = src.slice(braceIdx + 1, close);
      const members = splitTop(body, ";")
        .map(parseMember)
        .filter((mm): mm is Member => mm !== null);
      return { segments: [{ kind: "object", members }], defaults: {} };
    }
  }

  // export const Name = forwardRef<Handle, Props>(function Name({ defaults }, ref) { ... })
  m = src.match(/export const \w+\s*=\s*forwardRef</);
  if (m) {
    const ltIdx = m.index! + m[0].length - 1;
    const gtIdx = findMatch(src, ltIdx);
    if (gtIdx > 0) {
      const generic = src.slice(ltIdx + 1, gtIdx);
      const parts = splitTop(generic, ",");
      const propsTypeText = parts[1];
      let defaults: Record<string, string> = {};
      const parenIdx = src.indexOf("(", gtIdx);
      if (parenIdx > -1) {
        const callText = paramTextAt(src, parenIdx);
        if (callText !== null) {
          const fnMatch = callText.match(/function\s+\w+\s*\(/);
          let innerParamText: string | null = null;
          if (fnMatch) {
            const innerParenIdx = parenIdx + 1 + fnMatch.index! + fnMatch[0].length - 1;
            innerParamText = paramTextAt(src, innerParenIdx);
          } else {
            innerParamText = callText; // bare arrow form, not seen today but harmless
          }
          if (innerParamText) {
            const brace = leadingBrace(innerParamText);
            if (brace) defaults = parseDefaults(brace);
          }
        }
      }
      if (propsTypeText) return { segments: parseTypeAnnotation(propsTypeText), defaults };
    }
  }

  // export function Name(...) / export const Name = (...) =>
  m = src.match(/export function \w+\s*\(/) ?? src.match(/export const \w+\s*=\s*\(/);
  if (m) {
    const parenIdx = m.index! + m[0].length - 1;
    const callText = paramTextAt(src, parenIdx);
    if (callText !== null) {
      const { destructure, annotation, empty } = splitParamAndType(callText);
      if (empty) return { segments: [], defaults: {}, noProps: true };
      const defaults = destructure ? parseDefaults(destructure) : {};
      if (annotation) return { segments: parseTypeAnnotation(annotation), defaults };
    }
  }

  return null;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

// ---------------------------------------------------------------------------
// Auxiliary type expansion (llms-full.txt only) — a prop signature like
// `items?: CausticCoverflowItem[]` doesn't close the gap by itself if
// CausticCoverflowItem's shape still requires reading the source. These are
// plain `export interface X` / `export type X = ...` declarations in the same
// file (not the component's own Props type — that's handled separately), so
// the same bracket-balanced scan resolves them, one level deep (an aux type
// referencing another aux type is shown by name only, not expanded further).
// ---------------------------------------------------------------------------

type AuxShape = { kind: "object"; members: Member[] } | { kind: "raw"; text: string };

function extractAuxTypes(src: string): Record<string, AuxShape> {
  const aux: Record<string, AuxShape> = {};
  // Not just `export`ed — a prop can reference a local (non-exported) union
  // or object alias too (e.g. `mode?: Mode` with a private `type Mode = ...`
  // in the same file). Since these are only ever surfaced when a prop's type
  // actually names them (see referencedAuxNames), harvesting every top-level
  // interface/type alias here — exported or not — can't add noise.
  const ifaceRe = /^(?:export )?interface (\w+)\s*\{/gm;
  let m: RegExpExecArray | null;
  while ((m = ifaceRe.exec(src))) {
    const braceIdx = m.index + m[0].length - 1;
    const close = findMatch(src, braceIdx);
    if (close < 0) continue;
    const body = src.slice(braceIdx + 1, close);
    const members = splitTop(body, ";").map(parseMember).filter((mm): mm is Member => mm !== null);
    aux[m[1]] = { kind: "object", members };
  }
  const typeRe = /^(?:export )?type (\w+)\s*=\s*/gm;
  while ((m = typeRe.exec(src))) {
    const name = m[1];
    if (aux[name]) continue;
    const afterEq = m.index + m[0].length;
    if (src[afterEq] === "{") {
      const close = findMatch(src, afterEq);
      if (close < 0) continue;
      const body = src.slice(afterEq + 1, close);
      const members = splitTop(body, ";").map(parseMember).filter((mm): mm is Member => mm !== null);
      aux[name] = { kind: "object", members };
    } else {
      const semi = src.indexOf(";", afterEq);
      const raw = semi > -1 ? src.slice(afterEq, semi) : src.slice(afterEq, afterEq + 80);
      aux[name] = { kind: "raw", text: raw.trim().replace(/\s+/g, " ") };
    }
  }
  return aux;
}

function formatAuxShape(shape: AuxShape): string {
  if (shape.kind === "raw") return shape.text;
  return (
    "{ " +
    shape.members.map((mm) => `${mm.name}${mm.optional ? "?" : ""}: ${mm.type}`).join("; ") +
    " }"
  );
}

/** Names, in first-seen order, of any prop's type that resolves to a known aux type. */
function referencedAuxNames(extracted: Extracted, auxTypes: Record<string, AuxShape>): string[] {
  const seen = new Set<string>();
  const found: string[] = [];
  for (const seg of extracted.segments) {
    if (seg.kind !== "object") continue;
    for (const mem of seg.members) {
      for (const ident of mem.type.match(/[A-Z]\w*/g) ?? []) {
        if (auxTypes[ident] && !seen.has(ident)) {
          seen.add(ident);
          found.push(ident);
        }
      }
    }
  }
  return found;
}

// `compact`: llms.txt is budget-constrained (dense reference signature only —
// name, type, default inline). llms-full.txt keeps the explanatory comments,
// since that file exists specifically for agents that want full detail.
function formatPropLines(name: string, warnings: string[], compact: boolean): string[] {
  const path = join(ROOT, "registry", componentDir(name), name, "component.tsx");
  const src = readFileSync(path, "utf8");
  const extracted = extractComponentProps(src);
  if (!extracted) {
    warnings.push(name);
    return ["(unresolved — read the source)"];
  }
  if (extracted.noProps) return ["(none)"];
  const lines: string[] = [];
  for (const seg of extracted.segments) {
    if (seg.kind === "ref") {
      lines.push(`(extends ${seg.text})`);
      continue;
    }
    for (const mem of seg.members) {
      let line = `${mem.rest ? "..." : ""}${mem.name}${mem.optional ? "?" : ""}: ${mem.type}`;
      const def = extracted.defaults[mem.name];
      const hasDefault = def !== undefined && def !== '""';
      if (compact) {
        if (hasDefault) line += ` = ${truncate(def!, 20)}`;
      } else {
        const bits: string[] = [];
        if (mem.comment) bits.push(mem.comment);
        if (hasDefault) bits.push(`default: ${def}`);
        if (bits.length) line += `  // ${bits.join("; ")}`;
      }
      lines.push(line);
    }
  }
  if (lines.length === 0) {
    warnings.push(name);
    return ["(unresolved — read the source)"];
  }
  if (!compact) {
    const auxTypes = extractAuxTypes(src);
    for (const auxName of referencedAuxNames(extracted, auxTypes)) {
      lines.push(`↳ ${auxName} = ${formatAuxShape(auxTypes[auxName])}`);
    }
  }
  return lines;
}

// ---------------------------------------------------------------------------
// "use when" derivation — tag-driven, not a restatement of the title.
// Functional tags name the UI role (what it IS); everything else is treated
// as a differentiator (what makes THIS one worth picking over a plain default).
//
// This is a fallback: components sharing a role and only differentiated by a
// tag dump (e.g. three hero canvases that all just list "cursor") give an
// agent nothing to decide on. Where that happened, meta.useWhen carries a
// hand-authored, source-of-truth-is-meta.instruction sentence naming the
// actual distinguishing behavior instead — see deriveUseWhen above. Add
// meta.useWhen to a component only once it turns out to share a role with
// something else; singletons are unambiguous by tag-derivation alone.
// ---------------------------------------------------------------------------

const FUNCTIONAL_TAGS: Record<string, string> = {
  button: "a clickable button",
  control: "an interactive control",
  form: "a form field",
  field: "a form field",
  input: "a text/number input",
  slider: "a slider or range input",
  switch: "a toggle switch",
  toggle: "a toggle",
  dial: "a rotary value dial",
  knob: "a rotary knob",
  stepper: "a numeric stepper",
  spinbutton: "a numeric spinbutton",
  dropdown: "a dropdown/select",
  listbox: "a listbox/select",
  select: "a select control",
  calendar: "a calendar",
  "date-picker": "a date picker",
  otp: "an OTP/verification-code input",
  "2fa": "a 2FA code input",
  password: "a password field",
  "file-upload": "a file-upload control",
  dropzone: "a drag-and-drop upload zone",
  toast: "a toast/notification stack",
  notification: "a notification",
  chart: "a chart",
  sparkline: "a sparkline",
  kpi: "a KPI stat tile",
  dashboard: "a dashboard stat",
  progress: "a progress indicator",
  loader: "a loading indicator",
  countdown: "a countdown timer",
  timeline: "a timeline",
  hero: "a hero/landing section",
  menu: "a menu",
  nav: "site navigation",
  "cmd-k": "a command palette",
  "command-palette": "a command palette",
  tooltip: "a tooltip",
  avatar: "an avatar",
  card: "a card",
  cards: "cards",
  table: "a table",
  compare: "a comparison view",
  "before-after": "a before/after comparison",
  "image-diff": "an image diff/comparison",
  confirm: "a confirmation step",
  confirmation: "a confirmation step",
  destructive: "a destructive-action control",
  changelog: "a changelog",
  pricing: "a pricing table",
  team: "a team section",
  toc: "a table of contents",
  gallery: "a gallery",
  "404": "a 404/error page",
  page: "a page section",
  background: "a background/ambient layer",
  "text-reveal": "animated text reveal",
  headline: "a headline",
  sortable: "a sortable list",
  coverflow: "a coverflow-style browser",
  "fuzzy-search": "fuzzy search",
  container: "a container/panel",
  dock: "a dock",
  sections: "page sections",
  section: "a page section",
  "scroll-story": "a scroll-driven story",
  "scroll-trigger": "scroll-triggered reveal",
  media: "media display",
  image: "image display",
  text: "an animated text/headline effect",
  scroll: "a scroll-driven effect",
  terrain: "a generative terrain surface",
};

function humanizeTag(t: string): string {
  return t.replace(/-/g, " ");
}

function deriveUseWhen(meta: Meta): string {
  // Hand-authored guidance wins when present — see meta.useWhen below for why.
  if (meta.useWhen) return meta.useWhen;
  const tags = meta.tags ?? [];
  let needIdx = tags.findIndex((t) => FUNCTIONAL_TAGS[t]);
  let need: string;
  if (needIdx === -1) {
    needIdx = 0;
    need = humanizeTag(tags[0] ?? meta.collection);
  } else {
    need = FUNCTIONAL_TAGS[tags[needIdx]];
  }
  const flavor = tags.filter((_, i) => i !== needIdx).map(humanizeTag);
  const flavorPart = flavor.length ? ` (${flavor.slice(0, 3).join(", ")})` : "";
  return `${need}${flavorPart}.`;
}

// ---------------------------------------------------------------------------
// Meta loading (same source of truth as build-registry.ts)
// ---------------------------------------------------------------------------

type Meta = {
  name: string;
  title: string;
  description: string;
  collection: string;
  tags: string[];
  instruction: string;
  dependencies: string[];
  // Optional hand-authored "use when" override — see the deriveUseWhen
  // comment above. Site-only: build-registry.ts never reads this, so it
  // can't leak into the published registry:ui items in public/r/*.json.
  useWhen?: string;
};

const dirByName: Record<string, "core" | "loud"> = {};
function componentDir(name: string): "core" | "loud" {
  return dirByName[name];
}

const components: Meta[] = [];
for (const collection of ["core", "loud"] as const) {
  const dir = join(ROOT, "registry", collection);
  if (!existsSync(dir)) continue;
  for (const name of readdirSync(dir).sort()) {
    const metaPath = join(dir, name, "meta.json");
    if (!existsSync(metaPath)) continue;
    const meta: Meta = JSON.parse(readFileSync(metaPath, "utf8"));
    dirByName[meta.name] = collection;
    components.push(meta);
  }
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

const warnings: string[] = [];

// Two optional tools sit on top of the plain-fetch path below. Both read
// PACKAGE_PUBLISHED (lib/package-publish-status.ts) so this text can't say a
// command works when it 404s — flip that file and rerun `registry:build`
// once either package is actually on npm.
const MCP_LINE = PACKAGE_PUBLISHED.mcp
  ? "MCP server (search_components, get_component with real source, list_categories,\n" +
    "  install_command, get_conventions): npx -y @nikolas.sapa/ns-ui-mcp. Config and\n" +
    `  per-client setup: ${HOMEPAGE}/connect`
  : "MCP server: built (search_components, get_component with real source, list_categories,\n" +
    "  install_command, get_conventions) but not yet published to npm. Run it from a clone:\n" +
    `  ${HOMEPAGE}/connect has the per-client config and the working local command.`;
const CLI_LINE = PACKAGE_PUBLISHED.cliSearch
  ? "CLI: npx @nikolas.sapa/ns-ui add <name> to install, list/search subcommands also\n" +
    "  available — see npx @nikolas.sapa/ns-ui --help."
  : "CLI: npx @nikolas.sapa/ns-ui add <name> installs a component today. list/search\n" +
    "  subcommands are built but not yet published (0.1.1 on npm is install-only).";

const HEADER = `# ns-ui — AI-agent quickstart

License: MIT (SPDX: MIT) · Version: ${PACKAGE_VERSION} · Components: ${components.length} · Generated: ${GENERATED_ON}

ns-ui is a personal React/Next.js component registry: ${components.length} self-contained,
dependency-light components (a Geist-dark "core" set + a deliberately flashy "loud" set).
Every component installs as plain source you own — no runtime package required.

Install directly, zero config:
  npx shadcn add ${HOMEPAGE}/r/<name>.json

This drops component.tsx into your project (components/ui/<name>.tsx) and pulls its npm
deps via shadcn. No account, no API key. Both tools below are optional — this one command
is the whole dependency.

- ${MCP_LINE}
- ${CLI_LINE}

Requirements before you use any of these:
- Colors MUST come from CSS custom properties already in scope: --background --foreground
  --muted --border --accent --surface --error --warning. Never hardcode hex — these
  components are light/dark theme-reactive only if those tokens exist in the host app's
  globals.css.
- Peer deps: react 19+, Tailwind CSS v4 (components are styled entirely with Tailwind
  utility classes — no shipped CSS file). Fonts assumed Geist Sans / Geist Mono (components
  inherit font-family, they don't set it; where a monospace face is set explicitly they read
  the font tokens --font-mono or --font-geist-mono). Per-component npm deps listed below as
  "deps".

Full behavioral detail (long form, one paragraph per component): ${HOMEPAGE}/llms-full.txt

Each block below:
  ## <name>  [collection]
  <title> — <one-line purpose>
  use when: <selection guidance — the problem it solves, not a restatement of the title>
  props: <condensed public prop signature: name, type, optionality, default, purpose>
  deps: <npm dependencies beyond react>
  install: npx shadcn add ${HOMEPAGE}/r/<name>.json
`;

function renderBlock(meta: Meta, full: boolean): string {
  const propLines = formatPropLines(meta.name, warnings, !full);
  const props =
    propLines.length === 1 ? propLines[0] : propLines.map((l) => `  ${l}`).join("\n");
  const deps = meta.dependencies.length ? meta.dependencies.join(", ") : "(none)";
  const lines = [
    `## ${meta.name}  [${meta.collection}]`,
    `${meta.title} — ${full ? meta.description : truncate(meta.description, 80)}`,
    `use when: ${deriveUseWhen(meta)}`,
    propLines.length === 1 ? `props: ${props}` : `props:\n${props}`,
    `deps: ${deps}`,
  ];
  if (full) lines.push(`behavior: ${meta.instruction}`);
  lines.push(`install: npx shadcn add ${HOMEPAGE}/r/${meta.name}.json`);
  return lines.join("\n");
}

const shortBody = components.map((m) => renderBlock(m, false)).join("\n\n");
const fullBody = components.map((m) => renderBlock(m, true)).join("\n\n");

writeFileSync(join(ROOT, "public", "llms.txt"), HEADER + "\n" + shortBody + "\n");
writeFileSync(join(ROOT, "public", "llms-full.txt"), HEADER + "\n" + fullBody + "\n");

const uniqueWarnings = [...new Set(warnings)];
console.log(
  `llms.txt / llms-full.txt: ${components.length} component(s)` +
    (uniqueWarnings.length
      ? ` — WARNING: prop extraction failed for: ${uniqueWarnings.join(", ")}`
      : "")
);
