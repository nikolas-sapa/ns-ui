// Rewrites the generated token line inside mcp/src/conventions.ts, in place,
// from lib/css-tokens.ts (which reads the real names out of app/globals.css).
//
// Same marker convention as build-readme.ts:
//
//   <!-- generated:NAME start -->value<!-- generated:NAME end -->
//
// Everything outside the marker pair is left byte-untouched. A missing or
// unpaired marker is a hard failure (exit 1) naming the file and the
// marker — this script never inserts a marker that isn't already there.
//
// This is what keeps get_conventions() (the MCP tool) from silently
// omitting a token that exists in globals.css and the registry's cssVars —
// it went stale once (missing --success and --ns-accent-hover) because the
// list was a hand-typed literal with nothing forcing it to track its source.
//
// Run as part of `npm run registry:build`, any time after lib/css-tokens.ts
// can resolve (it only needs app/globals.css, so ordering relative to
// build-registry.ts doesn't matter, but it runs alongside the other
// generated-file rewrites for one clear place to look).
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ALL_TOKEN_NAMES } from "../lib/css-tokens.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONVENTIONS_PATH = join(ROOT, "mcp/src/conventions.ts");

const tokenLine = ALL_TOKEN_NAMES.map((name) => `--${name}`).join("   ");

function applyMarker(text: string, name: string, value: string): string {
  const start = `<!-- generated:${name} start -->`;
  const end = `<!-- generated:${name} end -->`;
  const startIdx = text.indexOf(start);
  const endIdx = text.indexOf(end);
  if (startIdx === -1 || endIdx === -1) {
    console.error(
      `build-mcp-conventions: ${CONVENTIONS_PATH} is missing the "${name}" ` +
        `marker pair (expected both "${start}" and "${end}"). Add the ` +
        `markers by hand around the text they should govern — this script ` +
        `only rewrites content between existing markers, it never inserts them.`
    );
    process.exit(1);
  }
  if (endIdx < startIdx) {
    console.error(
      `build-mcp-conventions: ${CONVENTIONS_PATH} has the "${name}" marker ` +
        `pair out of order (end appears before start).`
    );
    process.exit(1);
  }
  const contentStart = startIdx + start.length;
  return text.slice(0, contentStart) + value + text.slice(endIdx);
}

const before = readFileSync(CONVENTIONS_PATH, "utf8");
const after = applyMarker(before, "tokens", tokenLine);
if (before !== after) writeFileSync(CONVENTIONS_PATH, after);

console.log(
  `mcp/src/conventions.ts: ${ALL_TOKEN_NAMES.length} token(s) (${tokenLine})`
);
