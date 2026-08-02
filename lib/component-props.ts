import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

/**
 * Public prop signature for one component, read off `component.tsx` at
 * request time (same "source is the artifact" reasoning as `lib/source.ts`).
 *
 * The parsing here is a deliberately narrower port of the bracket-balanced
 * scanner in `scripts/build-llms.ts` (which produces the same information
 * for `llms.txt`) — kept as a separate, smaller module rather than importing
 * that script, since it is a `node --experimental` entrypoint with its own
 * warnings/aux-type-expansion concerns that a page render doesn't need. Only
 * the member-level shape (name, optional, type, default, comment) is kept;
 * unresolved/`(extends X)` cases fall through to `null` and the page simply
 * omits the props table rather than rendering a guess.
 */

const PAIRS: Record<string, string> = { "{": "}", "(": ")", "[": "]", "<": ">" };
const CLOSERS = new Set(Object.values(PAIRS));

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
    if (close === ">" && c === ">" && src[i - 1] === "=") continue;
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) return i; }
  }
  return -1;
}

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
    if (c === ">" && src[i - 1] === "=") continue;
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

export type PropRow = {
  name: string;
  optional: boolean;
  type: string;
  default?: string;
  comment?: string;
};

type Member = { rest: boolean; name: string; optional: boolean; type: string; comment: string };
type Segment = { kind: "object"; members: Member[] } | { kind: "ref"; text: string };
type Extracted = { segments: Segment[]; defaults: Record<string, string>; noProps?: boolean };

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
    if (!m || m[1]) continue;
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
      const members = splitTop(body, ";").map(parseMember).filter((m): m is Member => m !== null);
      segments.push({ kind: "object", members });
    } else {
      segments.push({ kind: "ref", text: seg });
    }
  }
  return segments;
}

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
  let m =
    src.match(/export interface \w+Props\s*\{/) ?? src.match(/export type \w+Props\s*=\s*\{/);
  if (m) {
    const braceIdx = m.index! + m[0].length - 1;
    const close = findMatch(src, braceIdx);
    if (close > 0) {
      const body = src.slice(braceIdx + 1, close);
      const members = splitTop(body, ";").map(parseMember).filter((mm): mm is Member => mm !== null);
      return { segments: [{ kind: "object", members }], defaults: {} };
    }
  }

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
            innerParamText = callText;
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

/**
 * `null` = unresolved shape (source falls outside the recognized patterns) —
 * the page renders no table rather than a guess. `[]` = recognized and
 * confirmed to take no props (`noProps`). Any `{ kind: "ref" }` segment
 * (an extended/omitted external type, e.g. `& Omit<HTMLAttributes<...>>`) is
 * dropped rather than rendered as a row — it names a type, not a prop.
 */
export function loadComponentProps(name: string): PropRow[] | null {
  for (const collection of ["core", "loud"] as const) {
    const file = path.join(process.cwd(), "registry", collection, name, "component.tsx");
    if (!existsSync(file)) continue;
    const src = readFileSync(file, "utf8");
    const extracted = extractComponentProps(src);
    if (!extracted) return null;
    if (extracted.noProps) return [];
    const rows: PropRow[] = [];
    for (const seg of extracted.segments) {
      if (seg.kind !== "object") continue;
      for (const mem of seg.members) {
        if (mem.rest) continue;
        const def = extracted.defaults[mem.name];
        rows.push({
          name: mem.name,
          optional: mem.optional,
          type: mem.type,
          ...(def !== undefined && def !== '""' ? { default: def } : {}),
          ...(mem.comment ? { comment: mem.comment } : {}),
        });
      }
    }
    return rows.length ? rows : null;
  }
  return null;
}
