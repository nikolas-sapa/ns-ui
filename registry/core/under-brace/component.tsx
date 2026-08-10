"use client";

import { useId, useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// UnderBrace — a regex tester where matches are annotated BENEATH the sample
// text with box-drawing braces instead of inline highlight color, because the
// five-token palette has no room for one color per capture group. Row 0
// (closest to the text) is always the whole match's own └──┘ span; each
// capturing group gets an additional row further down, one row per level of
// SOURCE nesting in the pattern (a group written inside another group's
// parens renders one row lower) — parsed once from the pattern text itself
// (analyzePattern), not from a live containment check, so a group's row never
// jumps around as matches change, only as the pattern's own structure does.
// Group rows shade in stepped --ns-muted opacity by depth; the group's own
// number is centered inside its brace when the span is wide enough to hold
// it. Matches themselves come from the real, native RegExp: `matchAll` with a
// forced global+indices ("gd") flag pair, so every participating group's
// exact [start,end) is read straight from `match.indices`, never
// re-derived or guessed.
//
// The braces are a pure aria-hidden paint layer over a second, textually
// identical render of the sample. The REAL assistive surface is a plain
// native <textarea> (full keyboard/IME/undo behavior, completely untouched)
// plus a live "Matches" list — real <button>s, one per match, each reading
// 'Match 1: "#TX-482" at 7–14; group 1: "TX-482"; group 2: "482"' — inside an
// aria-live=polite region that updates on every pattern/sample/flag edit.
// Focusing a match button (Tab, or click) draws a visible ring on that
// match's row-0 brace; hovering a brace tints the exact substring it covers
// in the annotated view; hovering (or focusing) a small "group token" chip
// next to the pattern field lights every brace that group number produced,
// across every match, because the live pattern <input>'s own text can't be
// individually decorated without breaking normal text editing.
//
// An invalid pattern never throws past this component: `new RegExp` is
// wrapped, the caret position is approximated by binary-shrinking the
// pattern from the end until a PREFIX of it compiles on its own — exact for
// the common "dangling metacharacter at the end" mistake (typing an extra
// quantifier while iterating on a pattern, which is exactly what this
// component's own autoplay does), honestly approximate (falls back to
// column 0) for a still-open, non-terminated group or class, where no
// single column is really "the" fault. The caret renders as a ┗ under the
// pattern field, next to the engine's own SyntaxError text.
//
// Distinct from diagram-ascii-flow (a supplied GRAPH rendered as a static,
// draggable box-drawing diagram — no text, no regex) and from
// validation-inline-wick (pass/fail on ONE field, an eased color diffusion,
// no structural annotation): this is a live annotation layer showing WHERE
// and HOW a pattern grips arbitrary user text, with capture-group structure
// as its whole reason to exist.
// ---------------------------------------------------------------------------

export interface UnderBraceProps {
  defaultPattern?: string;
  defaultFlags?: string;
  defaultSample?: string;
  className?: string;
}

const MAX_GROUP_DEPTH = 4; // deeper groups clamp onto the last row rather than growing forever
const ROW_H = 15; // px, one annotation row
const LINE_H = 20; // px, the sample-line row itself
const GROUP_OPACITY = [1, 0.8, 0.62, 0.48]; // stepped --ns-muted shading, index 0 = depth 1
const MAX_MATCHES = 300; // guards a pathological pattern (e.g. an empty alternative) against runaway output
const INPUT_PAD_PX = 8; // shared by the pattern input's own padding and its caret marker's offset

// ---------------------------------------------------------------------------
// Pattern source parser: capturing-group numbering + nesting depth only.
// Walks the pattern text once, tracking character-class state and escapes,
// and a stack of open groups. `(?:` / `(?=` / `(?!` / `(?<=` / `(?<!` open a
// non-capturing construct (their contents still nest visually, but they
// never get a number or a row of their own); a plain `(` or a named `(?<x>`
// is a real capturing group, numbered in the same left-to-right order the
// engine itself assigns to `match[n]` / `match.indices[n]`.
// ---------------------------------------------------------------------------
function analyzePattern(source: string): { count: number; depthOf: number[] } {
  const depthOf: number[] = [0];
  let count = 0;
  let capDepth = 0;
  const opensCapturing: boolean[] = [];
  let inClass = false;
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    if (c === "\\") {
      i += 2;
      continue;
    }
    if (inClass) {
      if (c === "]") inClass = false;
      i++;
      continue;
    }
    if (c === "[") {
      inClass = true;
      i++;
      continue;
    }
    if (c === "(") {
      if (source[i + 1] === "?") {
        const two = source.slice(i + 1, i + 3);
        if (two === "?:" || two === "?=" || two === "?!") {
          opensCapturing.push(false);
          i += 3;
          continue;
        }
        if (source[i + 2] === "<" && (source[i + 3] === "=" || source[i + 3] === "!")) {
          opensCapturing.push(false);
          i += 4;
          continue;
        }
        if (source[i + 2] === "<") {
          // named capturing group: (?<name>
          count++;
          capDepth++;
          depthOf[count] = capDepth;
          opensCapturing.push(true);
          let j = i + 3;
          while (j < source.length && source[j] !== ">") j++;
          i = j + 1;
          continue;
        }
      }
      count++;
      capDepth++;
      depthOf[count] = capDepth;
      opensCapturing.push(true);
      i++;
      continue;
    }
    if (c === ")") {
      if (opensCapturing.pop()) capDepth--;
      i++;
      continue;
    }
    i++;
  }
  return { count, depthOf };
}

interface GroupSpan {
  num: number;
  start: number;
  end: number;
  text: string;
}
interface MatchInfo {
  idx: number;
  start: number;
  end: number;
  text: string;
  groups: GroupSpan[];
}
interface Segment {
  key: string;
  matchIdx: number;
  groupNum: number; // 0 = whole match
  row: number; // 0 = match row, 1..MAX_GROUP_DEPTH = group rows
  startCol: number;
  endCol: number;
}

// Square corners (└ ┘), not rounded (╰ ╯): every other box-drawing component
// in this registry (diagram-ascii-flow, container-box-drawing) draws from
// the square set, which is the one confirmed to have a predictable 1ch
// advance in Geist Mono in this codebase — a glyph the font falls back on
// silently skews every brace to its right, since this component positions
// entirely by `left: {col}ch` with no per-character span grid to absorb it.
function braceGlyph(width: number, label?: string): string {
  if (width <= 0) return "│";
  if (width === 1) return "┴";
  const chars = new Array(width).fill("─");
  chars[0] = "└";
  chars[width - 1] = "┘";
  if (label && width >= label.length + 2) {
    const start = 1 + Math.floor((width - 2 - label.length) / 2);
    for (let k = 0; k < label.length; k++) chars[start + k] = label[k];
  }
  return chars.join("");
}

function buildMatchLabel(m: MatchInfo): string {
  let s = `Match ${m.idx + 1}: "${m.text}" at ${m.start}–${m.end}`;
  for (const g of m.groups) {
    s += `; group ${g.num}: "${g.text}"`;
  }
  return s;
}

export function UnderBrace({
  defaultPattern = "",
  defaultFlags = "",
  defaultSample = "",
  className = "",
}: UnderBraceProps) {
  const uid = useId();
  const [pattern, setPattern] = useState(defaultPattern);
  const [flagsInput, setFlagsInput] = useState(defaultFlags);
  const [sample, setSample] = useState(defaultSample);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null); // `${matchIdx}:${groupNum}`
  const [hoveredGroupNum, setHoveredGroupNum] = useState<number | null>(null);
  const [focusedMatchIdx, setFocusedMatchIdx] = useState<number | null>(null);

  const patternId = `ub-pattern-${uid}`;
  const flagsId = `ub-flags-${uid}`;
  const sampleId = `ub-sample-${uid}`;
  const statusId = `ub-status-${uid}`;

  const sanitizedFlags = useMemo(() => {
    const allowed = new Set(["i", "m", "s"]);
    const seen = new Set<string>();
    let out = "";
    for (const ch of flagsInput) {
      if (allowed.has(ch) && !seen.has(ch)) {
        seen.add(ch);
        out += ch;
      }
    }
    return out;
  }, [flagsInput]);

  const compiled = useMemo(() => {
    if (pattern === "") {
      return { regex: null as RegExp | null, error: null as string | null, caret: 0, analysis: { count: 0, depthOf: [0] } };
    }
    const runtimeFlags = "gd" + sanitizedFlags;
    try {
      const regex = new RegExp(pattern, runtimeFlags);
      return { regex, error: null as string | null, caret: 0, analysis: analyzePattern(pattern) };
    } catch (err) {
      // Approximate the fault column: the longest PREFIX of the pattern
      // that compiles entirely on its own. Exact for a dangling trailing
      // construct (e.g. a double quantifier); degrades to column 0 for a
      // still-open group/class, where no single column is really at fault.
      let caret = 0;
      for (let L = pattern.length; L >= 0; L--) {
        try {
          new RegExp(pattern.slice(0, L), runtimeFlags);
          caret = L;
          break;
        } catch {
          // keep shrinking
        }
      }
      return { regex: null as RegExp | null, error: (err as Error).message, caret, analysis: { count: 0, depthOf: [0] } };
    }
  }, [pattern, sanitizedFlags]);

  const lines = useMemo(() => sample.split("\n"), [sample]);
  const lineStarts = useMemo(() => {
    const starts: number[] = [];
    let acc = 0;
    for (const l of lines) {
      starts.push(acc);
      acc += l.length + 1;
    }
    return starts;
  }, [lines]);

  const matches: MatchInfo[] = useMemo(() => {
    const { regex } = compiled;
    if (!regex) return [];
    const out: MatchInfo[] = [];
    for (const m of sample.matchAll(regex)) {
      if (m.index == null) continue;
      const indices = (m as unknown as { indices?: Array<[number, number] | undefined> }).indices;
      const groups: GroupSpan[] = [];
      if (indices) {
        for (let g = 1; g < indices.length; g++) {
          const span = indices[g];
          if (!span) continue;
          groups.push({ num: g, start: span[0], end: span[1], text: sample.slice(span[0], span[1]) });
        }
      }
      out.push({ idx: out.length, start: m.index, end: m.index + m[0].length, text: m[0], groups });
      if (out.length >= MAX_MATCHES) break;
    }
    return out;
  }, [compiled, sample]);

  const segmentsByLine: Segment[][] = useMemo(() => {
    const perLine: Segment[][] = lines.map(() => []);
    const depthOf = compiled.analysis.depthOf;

    const project = (lineIdx: number, start: number, end: number) => {
      const ls = lineStarts[lineIdx];
      const le = ls + lines[lineIdx].length;
      if (start === end) {
        if (start >= ls && start <= le) return { s: start - ls, e: start - ls };
        return null;
      }
      const cs = Math.max(start, ls);
      const ce = Math.min(end, le);
      if (cs >= ce) return null;
      return { s: cs - ls, e: ce - ls };
    };

    matches.forEach((m) => {
      for (let li = 0; li < lines.length; li++) {
        const p = project(li, m.start, m.end);
        if (!p) continue;
        perLine[li].push({ key: `${m.idx}:0:${li}`, matchIdx: m.idx, groupNum: 0, row: 0, startCol: p.s, endCol: p.e });
      }
      m.groups.forEach((g) => {
        const depth = Math.min(depthOf[g.num] ?? 1, MAX_GROUP_DEPTH);
        for (let li = 0; li < lines.length; li++) {
          const p = project(li, g.start, g.end);
          if (!p) continue;
          perLine[li].push({
            key: `${m.idx}:${g.num}:${li}`,
            matchIdx: m.idx,
            groupNum: g.num,
            row: depth,
            startCol: p.s,
            endCol: p.e,
          });
        }
      });
    });
    return perLine;
  }, [matches, lines, lineStarts, compiled.analysis]);

  return (
    <div className={`ns-under-brace font-mono ${className}`}>
      <style>{CSS}</style>

      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <label htmlFor={patternId} className="block text-[11px] uppercase tracking-wide text-ns-muted">
            Pattern
          </label>
          <input
            id={patternId}
            name="pattern"
            type="text"
            spellCheck={false}
            autoComplete="off"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            aria-invalid={!!compiled.error}
            aria-describedby={statusId}
            placeholder="e.g. ([A-Z]{2}-(\d{2,4}))"
            style={{ paddingLeft: INPUT_PAD_PX }}
            className="mt-1 w-full rounded-[6px] border border-border bg-background py-1.5 pr-2 text-[13px] text-foreground outline-none placeholder:text-ns-muted/70 focus-visible:ring-2 focus-visible:ring-ns-accent"
          />
          {compiled.error ? (
            <div aria-hidden className="relative mt-0.5 h-[1.1em]">
              <span
                className="absolute text-ns-muted"
                style={{ left: `calc(${INPUT_PAD_PX}px + ${compiled.caret}ch)` }}
              >
                ┗
              </span>
            </div>
          ) : null}
          <p id={statusId} aria-live="polite" className="mt-1 min-h-[1.2em] text-[11px] text-ns-muted">
            {compiled.error ? compiled.error : pattern === "" ? "Type a pattern to test it." : `${matches.length} match${matches.length === 1 ? "" : "es"}`}
          </p>
        </div>

        <div className="w-20 shrink-0">
          <label htmlFor={flagsId} className="block text-[11px] uppercase tracking-wide text-ns-muted">
            Flags
          </label>
          <input
            id={flagsId}
            name="flags"
            type="text"
            spellCheck={false}
            autoComplete="off"
            maxLength={3}
            value={flagsInput}
            onChange={(e) => setFlagsInput(e.target.value)}
            aria-label="Flags (i, m, s)"
            placeholder="i m s"
            className="mt-1 w-full rounded-[6px] border border-border bg-background px-2 py-1.5 text-[13px] text-ns-muted outline-none placeholder:text-ns-muted/50 focus-visible:ring-2 focus-visible:ring-ns-accent"
          />
        </div>

        {!compiled.error && compiled.analysis.count > 0 ? (
          <div className="shrink-0">
            <span className="block text-[11px] uppercase tracking-wide text-ns-muted">Groups</span>
            <div className="mt-1 flex gap-1">
              {Array.from({ length: compiled.analysis.count }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`Group ${n}`}
                  onMouseEnter={() => setHoveredGroupNum(n)}
                  onMouseLeave={() => setHoveredGroupNum((g) => (g === n ? null : g))}
                  onFocus={() => setHoveredGroupNum(n)}
                  onBlur={() => setHoveredGroupNum((g) => (g === n ? null : g))}
                  className={`h-7 min-w-7 rounded-[6px] border px-1.5 text-[11px] transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent ${
                    hoveredGroupNum === n
                      ? "border-ns-accent text-ns-accent"
                      : "border-border text-ns-muted hover:border-foreground/30 hover:text-foreground"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-4">
        <label htmlFor={sampleId} className="block text-[11px] uppercase tracking-wide text-ns-muted">
          Sample text
        </label>
        <textarea
          id={sampleId}
          name="sample"
          value={sample}
          onChange={(e) => setSample(e.target.value)}
          spellCheck={false}
          rows={5}
          placeholder="Paste or type text to test the pattern against…"
          style={{ lineHeight: `${LINE_H}px`, paddingLeft: INPUT_PAD_PX }}
          className="mt-1 w-full resize-y rounded-[6px] border border-border bg-background py-1.5 pr-2 text-[13px] text-foreground outline-none placeholder:text-ns-muted/70 focus-visible:ring-2 focus-visible:ring-ns-accent"
        />
      </div>

      <div className="mt-4">
        <p className="text-[11px] uppercase tracking-wide text-ns-muted">Annotated</p>
        <div
          aria-hidden
          className="mt-1 overflow-x-auto rounded-[6px] border border-border bg-background py-2"
          style={{ paddingLeft: INPUT_PAD_PX, paddingRight: INPUT_PAD_PX }}
        >
          {lines.map((line, li) => {
            const segs = segmentsByLine[li] ?? [];
            const maxRow = segs.reduce((mx, s) => Math.max(mx, s.row), -1);
            const rowsUsed = maxRow >= 0 ? maxRow + 1 : 0;
            const tints: { s: number; e: number }[] = [];
            for (const seg of segs) {
              const segKey = `${seg.matchIdx}:${seg.groupNum}`;
              const active = segKey === hoveredKey || (hoveredGroupNum != null && seg.groupNum === hoveredGroupNum);
              if (active) tints.push({ s: seg.startCol, e: seg.endCol });
            }
            return (
              <div key={li} className="relative whitespace-pre text-[13px]" style={{ lineHeight: `${LINE_H}px` }}>
                {tints.map((t, ti) => (
                  // Bounded to the TEXT row only (top:0, height:LINE_H) — not
                  // inset-y-0 across the whole line box, which would also
                  // include the rows div below and wash a translucent column
                  // down through every OTHER group's brace at that depth.
                  <span
                    key={ti}
                    className="absolute rounded-[2px]"
                    style={{
                      left: `${t.s}ch`,
                      top: 0,
                      height: LINE_H,
                      width: `${Math.max(1, t.e - t.s)}ch`,
                      background: "color-mix(in srgb, var(--ns-accent) 18%, transparent)",
                    }}
                  />
                ))}
                <span className="relative text-foreground">{line.length ? line : " "}</span>
                <div style={{ height: rowsUsed ? rowsUsed * ROW_H : 0 }} className="relative">
                  {segs.map((seg) => {
                    const segKey = `${seg.matchIdx}:${seg.groupNum}`;
                    const hoverActive = segKey === hoveredKey || (hoveredGroupNum != null && seg.groupNum === hoveredGroupNum);
                    const focusRing = seg.row === 0 && seg.matchIdx === focusedMatchIdx;
                    const width = seg.endCol - seg.startCol;
                    const glyph = braceGlyph(width, seg.groupNum > 0 ? String(seg.groupNum) : undefined);
                    const duration = Math.min(600, Math.max(120, Math.max(1, width) * 12));
                    return (
                      <span
                        key={seg.key}
                        onMouseEnter={() => setHoveredKey(segKey)}
                        onMouseLeave={() => setHoveredKey((k) => (k === segKey ? null : k))}
                        className={`ns-under-brace-seg absolute select-none whitespace-pre transition-colors duration-150 motion-reduce:transition-none ${
                          hoverActive ? "text-ns-accent" : seg.row === 0 ? "text-foreground" : "text-ns-muted"
                        }`}
                        style={
                          {
                            left: `${seg.startCol}ch`,
                            top: seg.row * ROW_H,
                            lineHeight: `${ROW_H}px`,
                            opacity: hoverActive || seg.row === 0 ? 1 : GROUP_OPACITY[Math.min(seg.row - 1, GROUP_OPACITY.length - 1)],
                            outline: focusRing ? "2px solid var(--ns-accent)" : undefined,
                            outlineOffset: focusRing ? "1px" : undefined,
                            "--under-brace-dur": `${duration}ms`,
                          } as React.CSSProperties
                        }
                      >
                        {glyph}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[11px] uppercase tracking-wide text-ns-muted">Matches</p>
        <ol aria-live="polite" className="mt-1 flex flex-col gap-1">
          {compiled.error ? (
            <li className="text-[12px] text-ns-muted">Fix the pattern to see matches.</li>
          ) : matches.length === 0 ? (
            <li className="text-[12px] text-ns-muted">{pattern === "" ? "No pattern yet." : "No matches yet."}</li>
          ) : (
            matches.map((m) => (
              <li key={m.idx}>
                <button
                  type="button"
                  onFocus={() => setFocusedMatchIdx(m.idx)}
                  onBlur={() => setFocusedMatchIdx((i) => (i === m.idx ? null : i))}
                  onMouseEnter={() => setHoveredKey(`${m.idx}:0`)}
                  onMouseLeave={() => setHoveredKey((k) => (k === `${m.idx}:0` ? null : k))}
                  className="w-full rounded-[6px] border border-border px-2 py-1 text-left text-[12px] text-ns-muted transition-colors duration-150 motion-reduce:transition-none hover:border-foreground/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent"
                >
                  {buildMatchLabel(m)}
                </button>
              </li>
            ))
          )}
        </ol>
      </div>
    </div>
  );
}

const CSS = `
@property --under-brace-reveal {
  syntax: '<percentage>';
  inherits: false;
  initial-value: 100%;
}
.ns-under-brace-seg {
  --under-brace-reveal: 100%;
  -webkit-mask-image: linear-gradient(to right, black var(--under-brace-reveal), transparent var(--under-brace-reveal));
  mask-image: linear-gradient(to right, black var(--under-brace-reveal), transparent var(--under-brace-reveal));
  animation-name: ns-under-brace-reveal;
  animation-duration: var(--under-brace-dur, 300ms);
  animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
  animation-fill-mode: both;
}
@keyframes ns-under-brace-reveal {
  from { --under-brace-reveal: 0%; }
  to { --under-brace-reveal: 100%; }
}
@media (prefers-reduced-motion: reduce) {
  .ns-under-brace-seg {
    animation: none;
    -webkit-mask-image: none;
    mask-image: none;
  }
}
`;
