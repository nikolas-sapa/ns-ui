"use client";

import { useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";

// ---------------------------------------------------------------------------
// PromptVersionGrain — prompt revision history read as woodgrain.
//
// Columns are prompt BLOCKS (system, persona, tools, rules, examples, format),
// rows are VERSIONS with the newest at the top. Every cell where the block
// exists draws a 1px vertical fiber at the column centre spanning the full row
// height. Continuity is the whole mechanism:
//
//   - cell.hash === the hash directly below it  -> the fiber crosses the row
//     boundary uninterrupted (one long unbroken grain).
//   - hashes differ                             -> a NICK: a 1px horizontal
//     mark spanning 60% of the column, and the fiber breaks either side of it.
//   - block absent in that version               -> no line at all, an honest
//     gap in the wood.
//
// So a stable block reads as one continuous fiber down the whole card and a
// churny block reads as a ladder of short segments, with no legend, no colour
// coding and no diffing. Ink coverage at rest is a few percent.
// ---------------------------------------------------------------------------

export interface PromptGrainBlock {
  /** Stable key used to look the block up in each version's `cells`. */
  id: string;
  /** Column header, e.g. "rules". */
  label: string;
}

export interface PromptGrainCell {
  /** Content hash of this block in this version. Equal hashes = unchanged. */
  hash: string;
  /** Token count of this block in this version. */
  tokens: number;
  /** Optional exact churn for the nick summary; derived from tokens if absent. */
  added?: number;
  removed?: number;
}

export interface PromptGrainVersion {
  id: string;
  /** Short version label, e.g. "v24". */
  label: string;
  /** Total prompt tokens for this version (drives the gutter bar). */
  tokens: number;
  /** Eval score, 0..1, shown in the gutter. */
  score: number;
  /** Per-block cell, or null where the block does not exist in this version. */
  cells: Record<string, PromptGrainCell | null>;
}

export interface PromptVersionGrainProps {
  /** Prompt blocks, left to right. */
  blocks?: PromptGrainBlock[];
  /** Versions, NEWEST FIRST. */
  versions?: PromptGrainVersion[];
  /** Resting row height in px. */
  rowHeight?: number;
  /** Row height while a nick is expanded, in px. */
  expandedRowHeight?: number;
  /** Minimum column width in px. */
  columnMinWidth?: number;
  ariaLabel?: string;
  className?: string;
}

const ROW_H = 26;
const ROW_H_OPEN = 44;
const COL_MIN = 84;
const BREAK = 3;
const EASE_ROW = "cubic-bezier(0.22, 1, 0.36, 1)";

const DEFAULT_BLOCKS: PromptGrainBlock[] = [
  { id: "system", label: "system" },
  { id: "persona", label: "persona" },
  { id: "tools", label: "tools" },
  { id: "rules", label: "rules" },
  { id: "examples", label: "examples" },
  { id: "format", label: "format" },
];

interface NickRef {
  key: string;
  row: number;
  col: number;
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function PromptVersionGrain({
  blocks = DEFAULT_BLOCKS,
  versions = [],
  rowHeight = ROW_H,
  expandedRowHeight = ROW_H_OPEN,
  columnMinWidth = COL_MIN,
  ariaLabel = "Prompt version grain",
  className = "",
}: PromptVersionGrainProps) {
  const [hoverCol, setHoverCol] = useState<number | null>(null);
  const [hoverNick, setHoverNick] = useState<string | null>(null);
  const [focusNick, setFocusNick] = useState<string | null>(null);
  const [pinnedNick, setPinnedNick] = useState<string | null>(null);
  const [rovingKey, setRovingKey] = useState<string | null>(null);
  const nickRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Per (row, col): does the block exist here, and does the boundary BELOW
  // this row carry a nick? A nick exists only where the block exists on both
  // sides of the boundary and the two hashes differ — an introduction (null
  // below) is a plain end of grain, not a change.
  const model = useMemo(() => {
    const exists: boolean[][] = [];
    const nickBelow: boolean[][] = [];
    const nicks: NickRef[] = [];
    for (let r = 0; r < versions.length; r++) {
      exists[r] = [];
      nickBelow[r] = [];
      for (let c = 0; c < blocks.length; c++) {
        const id = blocks[c]!.id;
        const cell = versions[r]!.cells[id] ?? null;
        const older = versions[r + 1]?.cells[id] ?? null;
        exists[r]![c] = cell !== null;
        const nick = cell !== null && older !== null && cell.hash !== older.hash;
        nickBelow[r]![c] = nick;
        if (nick) nicks.push({ key: `${r}:${c}`, row: r, col: c });
      }
    }
    const churn = blocks.map((_, c) => {
      const boundaries = Math.max(1, versions.length - 1);
      let n = 0;
      for (let r = 0; r < versions.length; r++) if (nickBelow[r]![c]) n += 1;
      return { count: n, ratio: n / boundaries };
    });
    return { exists, nickBelow, nicks, churn };
  }, [blocks, versions]);

  const maxTokens = useMemo(
    () => Math.max(1, ...versions.map((v) => v.tokens)),
    [versions]
  );

  const activeNick = pinnedNick ?? hoverNick ?? focusNick;
  const activeNickRef = activeNick
    ? (model.nicks.find((n) => n.key === activeNick) ?? null)
    : null;
  // The row that grows is the one BELOW the boundary, never the one above it:
  // the nick is anchored to its row's bottom edge, so growing that row would
  // slide the nick out from under the pointer, drop the hover, collapse, and
  // oscillate. Growing the row below leaves the boundary — and the nick — at
  // exactly the same y, and opens the space downwards.
  const expandedRow = activeNickRef ? activeNickRef.row + 1 : null;
  const activeCol = hoverCol ?? activeNickRef?.col ?? null;

  const templateRows = versions
    .map((_, r) => `${r === expandedRow ? expandedRowHeight : rowHeight}px`)
    .join(" ");

  // A roving key that no longer exists in the model (the data changed under
  // us) would leave every nick at tabIndex -1 and drop the whole component out
  // of the tab order, so fall back to the first nick whenever it goes stale.
  const tabKey =
    (rovingKey !== null && model.nicks.some((n) => n.key === rovingKey)
      ? rovingKey
      : null) ??
    model.nicks[0]?.key ??
    null;

  const moveTo = (next: NickRef | undefined) => {
    if (!next) return;
    setRovingKey(next.key);
    nickRefs.current[next.key]?.focus();
  };

  const onNickKeyDown = (e: KeyboardEvent<HTMLButtonElement>, self: NickRef) => {
    const list = model.nicks;
    if (e.key === "Escape") {
      if (pinnedNick) {
        e.preventDefault();
        setPinnedNick(null);
      }
      return;
    }
    const horizontal = e.key === "ArrowLeft" || e.key === "ArrowRight";
    const vertical = e.key === "ArrowUp" || e.key === "ArrowDown";
    if (!horizontal && !vertical) return;
    e.preventDefault();
    if (horizontal) {
      const dir = e.key === "ArrowLeft" ? -1 : 1;
      const pool = list.filter((n) => (n.col - self.col) * dir > 0);
      pool.sort(
        (a, b) =>
          Math.abs(a.col - self.col) - Math.abs(b.col - self.col) ||
          Math.abs(a.row - self.row) - Math.abs(b.row - self.row)
      );
      moveTo(pool[0]);
    } else {
      const dir = e.key === "ArrowUp" ? -1 : 1;
      const pool = list.filter(
        (n) => n.col === self.col && (n.row - self.row) * dir > 0
      );
      pool.sort((a, b) => Math.abs(a.row - self.row) - Math.abs(b.row - self.row));
      moveTo(pool[0]);
    }
  };

  const onGridPointerOver = (e: ReactPointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    const cell = target?.closest<HTMLElement>("[data-grain-col]");
    setHoverCol(cell ? Number(cell.dataset.grainCol) : null);
    const nick = target?.closest<HTMLElement>("[data-grain-nick]");
    setHoverNick(nick?.dataset.grainNick ?? null);
  };

  const gridCols = `repeat(${blocks.length}, minmax(${columnMinWidth}px, 1fr))`;

  return (
    <div
      className={`ns-pvg flex items-start gap-4 ${className}`}
      role="group"
      aria-label={ariaLabel}
    >
      <style>{CSS}</style>

      <div className="min-w-0 flex-1">
        {/* Column headers: block label + churn readout. */}
        <div className="grid" style={{ gridTemplateColumns: gridCols }}>
          {blocks.map((b, c) => {
            const state = activeCol === null ? "rest" : activeCol === c ? "on" : "off";
            return (
              <div key={b.id} data-state={state} className="ns-pvg-head px-1 pb-2">
                <div className="ns-pvg-head-label font-mono text-[10px] leading-none tracking-tight">
                  {b.label}
                </div>
                <div className="ns-pvg-head-churn mt-1 font-mono text-[10px] leading-none tabular-nums">
                  {pct(model.churn[c]!.ratio)}
                </div>
              </div>
            );
          })}
        </div>

        {/* The grain field. */}
        <div
          data-grain-grid=""
          className="ns-pvg-grid grid"
          style={{ gridTemplateColumns: gridCols, gridTemplateRows: templateRows }}
          onPointerOver={onGridPointerOver}
          onPointerLeave={() => {
            setHoverCol(null);
            setHoverNick(null);
          }}
        >
          {versions.map((v, r) =>
            blocks.map((b, c) => {
              const here = model.exists[r]![c]!;
              const breakBelow = model.nickBelow[r]![c]!;
              const breakAbove = r > 0 && model.nickBelow[r - 1]![c]!;
              const state = activeCol === null ? "rest" : activeCol === c ? "on" : "off";
              const key = `${r}:${c}`;
              const open = activeNick === key;
              const cell = v.cells[b.id] ?? null;
              const older = versions[r + 1]?.cells[b.id] ?? null;
              const added =
                cell?.added ?? Math.max(0, (cell?.tokens ?? 0) - (older?.tokens ?? 0));
              const removed =
                cell?.removed ?? Math.max(0, (older?.tokens ?? 0) - (cell?.tokens ?? 0));
              const summary = `+${added} / -${removed} tok · ${b.label}`;
              const align =
                c === 0 ? "start" : c === blocks.length - 1 ? "end" : "center";
              return (
                <div
                  key={key}
                  data-grain-col={c}
                  data-state={state}
                  className="ns-pvg-cell"
                >
                  {here && (
                    <span
                      aria-hidden="true"
                      className="ns-pvg-fiber"
                      style={{ top: breakAbove ? BREAK : 0, bottom: breakBelow ? BREAK : 0 }}
                    />
                  )}
                  {here && r === 0 && (
                    <span
                      aria-hidden="true"
                      className="ns-pvg-cap"
                      style={{ animationDelay: `${((c * 53) % 401) - 200}ms` }}
                    />
                  )}
                  {breakBelow && (
                    <button
                      type="button"
                      ref={(el) => {
                        nickRefs.current[key] = el;
                      }}
                      data-grain-nick={key}
                      data-open={open ? "" : undefined}
                      className="ns-pvg-nick"
                      tabIndex={tabKey === key ? 0 : -1}
                      aria-expanded={open}
                      aria-label={`${b.label} changed between ${
                        versions[r + 1]?.label ?? "previous"
                      } and ${v.label}: ${summary}`}
                      onFocus={() => {
                        setRovingKey(key);
                        setFocusNick(key);
                        setHoverCol(c);
                      }}
                      onBlur={() => {
                        setFocusNick((cur) => (cur === key ? null : cur));
                        setHoverCol((cur) => (cur === c ? null : cur));
                      }}
                      onClick={() => setPinnedNick((cur) => (cur === key ? null : key))}
                      onKeyDown={(e) => onNickKeyDown(e, { key, row: r, col: c })}
                    />
                  )}
                  {open && (
                    <span
                      aria-hidden="true"
                      data-grain-summary=""
                      className="ns-pvg-summary font-mono text-[9px] leading-none tabular-nums"
                      style={{
                        left: align === "center" ? "50%" : align === "start" ? 0 : "auto",
                        right: align === "end" ? 0 : "auto",
                        transform: align === "center" ? "translateX(-50%)" : "none",
                      }}
                    >
                      {summary}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right gutter: version label, token bar, token count, eval score. */}
      <div className="shrink-0" style={{ width: 168 }}>
        {/* Height matches the two-line grain header (24px + pb-2) so the two
            grids start at the same y and every gutter row stays locked to its
            grain row. */}
        <div className="ns-pvg-gutter-head flex h-8 items-end gap-2 px-0 pb-2 font-mono text-[10px] leading-none">
          <span style={{ width: 30 }}>ver</span>
          <span style={{ width: 48 }} />
          <span className="text-right tabular-nums" style={{ width: 42 }}>
            tok
          </span>
          <span className="text-right tabular-nums" style={{ width: 32 }}>
            eval
          </span>
        </div>
        <div
          className="ns-pvg-grid grid"
          style={{ gridTemplateColumns: "1fr", gridTemplateRows: templateRows }}
        >
          {versions.map((v, r) => (
            <div
              key={v.id}
              data-live={r === 0 ? "" : undefined}
              className="ns-pvg-grow flex items-start gap-2 font-mono text-[10px] leading-none"
              style={{ paddingTop: 7 }}
            >
              <span className="ns-pvg-ver" style={{ width: 30 }}>
                {v.label}
              </span>
              <span className="ns-pvg-bar-track" style={{ width: 48 }}>
                <span
                  aria-hidden="true"
                  className="ns-pvg-bar"
                  style={{ width: `${(v.tokens / maxTokens) * 100}%` }}
                />
              </span>
              <span className="ns-pvg-dim text-right tabular-nums" style={{ width: 42 }}>
                {v.tokens.toLocaleString("en-US")}
              </span>
              <span className="ns-pvg-score text-right tabular-nums" style={{ width: 32 }}>
                {v.score.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* The grain is a picture; these are the same facts as text. */}
      <ul className="sr-only">
        {blocks.map((b, c) => {
          const first = versions.findIndex((v) => (v.cells[b.id] ?? null) !== null);
          const last = versions.map((v) => (v.cells[b.id] ?? null) !== null).lastIndexOf(true);
          const introduced =
            last >= 0 && last < versions.length - 1
              ? ` Introduced in ${versions[last]!.label}.`
              : "";
          return (
            <li key={b.id}>
              {b.label}: {model.churn[c]!.count} of {Math.max(1, versions.length - 1)} version
              boundaries changed, {pct(model.churn[c]!.ratio)} churn.
              {first === -1 ? " Not present in any version." : ""}
              {introduced}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const CSS = `
.ns-pvg { color: var(--foreground); }
.ns-pvg-grid { transition: grid-template-rows 220ms ${EASE_ROW}; }

.ns-pvg-head { transition: opacity 200ms ease-out; }
.ns-pvg-head-label { color: var(--muted); transition: color 200ms ease-out; }
.ns-pvg-head-churn { color: var(--muted); opacity: 0.85; transition: color 200ms ease-out, opacity 200ms ease-out; }
.ns-pvg-head[data-state="on"] .ns-pvg-head-label,
.ns-pvg-head[data-state="on"] .ns-pvg-head-churn { color: var(--foreground); opacity: 1; }
.ns-pvg-head[data-state="off"] { opacity: 0.3; }

.ns-pvg-cell { position: relative; }

.ns-pvg-fiber {
  position: absolute;
  left: 50%;
  width: 1px;
  transform: translateX(-50%);
  background: var(--foreground);
  opacity: 0.55;
  transition: opacity 200ms ease-out, width 200ms ease-out;
}
.ns-pvg-cell[data-state="on"] .ns-pvg-fiber { opacity: 1; width: 2px; }
.ns-pvg-cell[data-state="off"] .ns-pvg-fiber { opacity: 0.16; }

/* Only the newest row's grain heads breathe — the live edition. */
.ns-pvg-cap {
  position: absolute;
  left: 50%;
  top: 0;
  width: 2px;
  height: 3px;
  transform: translateX(-50%);
  background: var(--foreground);
  opacity: 0.55;
  animation: ns-pvg-breathe 3.4s ease-in-out infinite alternate;
  transition: opacity 200ms ease-out;
}
.ns-pvg-cell[data-state="off"] .ns-pvg-cap { animation: none; opacity: 0.16; }
@keyframes ns-pvg-breathe { from { opacity: 0.55; } to { opacity: 1; } }

.ns-pvg-nick {
  position: absolute;
  left: 50%;
  bottom: -5px;
  width: 60%;
  height: 10px;
  transform: translateX(-50%);
  background: transparent;
  border: 0;
  padding: 0;
  cursor: pointer;
  outline: none;
  /* The hit box straddles the row boundary, so its lower half sits over the
     NEXT row's cell — a later DOM sibling that would otherwise win the hit
     test at the button's exact centre and swallow the click. */
  z-index: 3;
}
.ns-pvg-nick::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 1px;
  background: var(--foreground);
  opacity: 0.75;
  transition: opacity 200ms ease-out;
}
.ns-pvg-cell[data-state="on"] .ns-pvg-nick::after { opacity: 1; }
.ns-pvg-cell[data-state="off"] .ns-pvg-nick::after { opacity: 0.16; }
.ns-pvg-nick:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 1px; }
.ns-pvg-nick[data-open]::after { opacity: 1; }

/* Sits in the space the row below just opened, clear of the nick's hit box so
   the nick keeps the pointer and the summary is genuinely hittable. */
.ns-pvg-summary {
  position: absolute;
  top: calc(100% + 7px);
  white-space: nowrap;
  color: var(--foreground);
  background: var(--background);
  padding: 1px 3px;
  z-index: 2;
}

.ns-pvg-ver { color: var(--muted); transition: color 200ms ease-out; }
.ns-pvg-grow[data-live] .ns-pvg-ver,
.ns-pvg-grow[data-live] .ns-pvg-score { color: var(--foreground); }
.ns-pvg-dim { color: var(--muted); }
.ns-pvg-score { color: var(--muted); }
.ns-pvg-gutter-head { color: var(--muted); opacity: 0.8; }
.ns-pvg-bar-track { display: inline-block; position: relative; height: 8px; }
.ns-pvg-bar {
  position: absolute;
  left: 0;
  top: 3px;
  height: 1px;
  background: var(--foreground);
  opacity: 0.45;
}

@media (prefers-reduced-motion: reduce) {
  .ns-pvg-grid,
  .ns-pvg-head,
  .ns-pvg-head-label,
  .ns-pvg-head-churn,
  .ns-pvg-fiber,
  .ns-pvg-cap,
  .ns-pvg-nick::after,
  .ns-pvg-ver { transition: none; }
  .ns-pvg-cap { animation: none; opacity: 1; }
}
`;
