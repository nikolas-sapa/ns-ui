"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// AsciiPatchbay — a patchbay whose distinguishing mechanic is PERSISTENT,
// user-authored topology: dragging from one jack to another creates a patch
// (arbitrary jack-to-jack, not a fixed slider ratio or a one-shot transfer
// tube), the cable is routed orthogonally onto the same shared monospace
// glyph grid diagram-ascii-flow's router uses, and once connected a small
// glyph pulse travels the length of the cable on a loop. Grabbing a jack
// that already carries a patch unplugs it immediately (classic patchbay
// behavior — picking up the far end of a live cable disconnects it) and
// hands you a loose plug to drop on a new jack or nowhere at all. Every
// jack is a real button; Enter/Space "arms" it, a second Enter/Space on a
// different jack completes the patch, and pressing the same jack again
// cancels — so the whole mechanic is reachable without a pointer.
// ---------------------------------------------------------------------------

export interface PatchbayJack {
  id: string;
  label: string;
  row: "top" | "bottom";
  col: number; // 0-based slot index within its row
}

export interface AsciiPatchbayProps {
  jacks?: PatchbayJack[];
  className?: string;
}

const DEFAULT_JACKS: PatchbayJack[] = [
  { id: "a", label: "A", row: "top", col: 0 },
  { id: "b", label: "B", row: "top", col: 1 },
  { id: "c", label: "C", row: "top", col: 2 },
  { id: "1", label: "1", row: "bottom", col: 0 },
  { id: "2", label: "2", row: "bottom", col: 1 },
  { id: "3", label: "3", row: "bottom", col: 2 },
];

const COLS = 26;
const ROWS = 12;
const CELL_W = 13;
const CELL_H = 17;
const JACK_W = 3;
const JACK_H = 2;
const SLOT_GAP = 9;
const TOP_ROW = 1;
const BOTTOM_ROW = 9;

function jackCol(col: number): number {
  return 1 + col * SLOT_GAP;
}
function jackRow(row: "top" | "bottom"): number {
  return row === "top" ? TOP_ROW : BOTTOM_ROW;
}
// The point just outside the jack's box in its natural cabling direction —
// down for a top-row jack, up for a bottom-row one.
function anchor(jack: PatchbayJack): [number, number] {
  const col = jackCol(jack.col) + Math.floor(JACK_W / 2);
  const row = jack.row === "top" ? jackRow(jack.row) + JACK_H : jackRow(jack.row) - 1;
  return [col, row];
}

// Direction bits and glyph table — identical scheme to diagram-ascii-flow's
// shared router, reimplemented here since each component folder is
// self-contained (no shared lib file across registry entries).
const N = 1;
const E = 2;
const S = 4;
const W = 8;
const GLYPH: Record<number, string> = {
  0: " ",
  1: "│",
  2: "─",
  4: "│",
  8: "─",
  5: "│",
  10: "─",
  3: "└",
  9: "┘",
  6: "┌",
  12: "┐",
  7: "├",
  13: "┤",
  14: "┬",
  11: "┴",
  15: "┼",
};
function dirBit(dx: number, dy: number): number {
  if (dx === 1) return E;
  if (dx === -1) return W;
  if (dy === 1) return S;
  if (dy === -1) return N;
  return 0;
}
const OPPOSITE: Record<number, number> = { [N]: S, [S]: N, [E]: W, [W]: E };

// Two-point single-bend orthogonal path: straight if already aligned, else a
// vertical-horizontal-vertical jog through the midpoint row — cables drop
// out of the jack, jog across, then drop into the target jack.
function orthogonalPath(a: [number, number], b: [number, number]): [number, number][] {
  if (a[0] === b[0] || a[1] === b[1]) return [a, b];
  const midY = Math.round((a[1] + b[1]) / 2);
  return [a, [a[0], midY], [b[0], midY], b];
}

function flattenPath(points: [number, number][]): [number, number][] {
  const cells: [number, number][] = [points[0]];
  for (let s = 0; s < points.length - 1; s++) {
    let [x, y] = points[s];
    const [ex, ey] = points[s + 1];
    const dx = Math.sign(ex - x);
    const dy = Math.sign(ey - y);
    while (x !== ex || y !== ey) {
      x += dx;
      y += dy;
      cells.push([x, y]);
    }
  }
  return cells;
}

function tracePolyline(points: [number, number][], grid: Map<string, number>) {
  for (let s = 0; s < points.length - 1; s++) {
    let [x, y] = points[s];
    const [ex, ey] = points[s + 1];
    const dx = Math.sign(ex - x);
    const dy = Math.sign(ey - y);
    if (dx !== 0 && dy !== 0) continue;
    while (x !== ex || y !== ey) {
      const nx = x + dx;
      const ny = y + dy;
      const out = dirBit(dx, dy);
      const into = OPPOSITE[out];
      const k1 = `${x},${y}`;
      const k2 = `${nx},${ny}`;
      grid.set(k1, (grid.get(k1) ?? 0) | out);
      grid.set(k2, (grid.get(k2) ?? 0) | into);
      x = nx;
      y = ny;
    }
  }
}

// No JS token reads here on purpose — see diagram-ascii-flow's component.tsx
// for the full story. Short version: this component used to hold
// getComputedStyle(--foreground/--background/etc) in state and apply it via
// inline `style`, and that's a real bug, not a style choice — SSR always
// renders with no `document`, so the FIRST markup bakes in the light-theme
// fallback hex, and React's hydration does not force a mismatched inline
// style property to the client's value the way it does for text content. On
// a genuinely dark-themed load, a value that never CHANGES across renders
// (this component's own render logic recomputes the same "correct" dark hex
// every time) never gets patched into the DOM, because React only writes an
// attribute when it differs from the PREVIOUS render's value, not from
// what's actually painted — confirmed live, reproducibly, on the sibling
// component. Tailwind classes bound to the same custom properties sidestep
// the whole bug class: the cascade resolves --background per theme at PAINT
// time, no JS or hydration step involved.

type Patch = [string, string];

export function AsciiPatchbay({ jacks = DEFAULT_JACKS, className = "" }: AsciiPatchbayProps) {
  const [patches, setPatches] = useState<Patch[]>([
    ["a", "2"],
    ["c", "1"],
  ]);
  const [armedId, setArmedId] = useState<string | null>(null);
  const [livePointer, setLivePointer] = useState<[number, number] | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const gestureRef = useRef<{ id: string; moved: boolean; ownArm: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const markerRefs = useRef<Record<number, HTMLSpanElement | null>>({});
  const reducedRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      reducedRef.current = mq.matches;
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const byId = useMemo(() => new Map(jacks.map((j) => [j.id, j])), [jacks]);
  const partnerOf = (id: string) => {
    for (const [a, b] of patches) {
      if (a === id) return b;
      if (b === id) return a;
    }
    return null;
  };

  const removePatchFor = (id: string) => {
    setPatches((cur) => cur.filter(([a, b]) => a !== id && b !== id));
  };

  const completePatch = (targetId: string, from: string) => {
    setPatches((cur) => cur.filter(([a, b]) => a !== from && b !== from && a !== targetId && b !== targetId).concat([[from, targetId]]));
    setArmedId(null);
  };

  const cellFromClientPoint = (clientX: number, clientY: number): [number, number] | null => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = Math.max(0, Math.min(COLS - 1, Math.round((clientX - rect.left) / CELL_W)));
    const y = Math.max(0, Math.min(ROWS - 1, Math.round((clientY - rect.top) / CELL_H)));
    return [x, y];
  };

  // A gesture's outcome depends on whether the pointer actually moved, not
  // just on where it started/ended — a plain tap (down+up with no movement,
  // exactly what a synthetic/keyboard-equivalent click produces) must never
  // destructively unplug an existing patch; only a real drag-away does.
  const onJackPointerDown = (jack: PatchbayJack) => (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const ownArm = !armedId;
    gestureRef.current = { id: jack.id, moved: false, ownArm };
    draggingRef.current = true;
    if (ownArm) {
      setArmedId(jack.id);
      setLivePointer(anchor(jack));
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const g = gestureRef.current;
    if (g && g.ownArm && !g.moved) {
      g.moved = true;
      // first real movement of a fresh pickup: NOW unplug, giving the
      // dragged cable's far end live visual feedback for the rest of the
      // gesture rather than silently vanishing at pointerdown.
      if (partnerOf(g.id)) removePatchFor(g.id);
    } else if (g) {
      g.moved = true;
    }
    if (armedId) {
      const cell = cellFromClientPoint(e.clientX, e.clientY);
      if (cell) setLivePointer(cell);
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setLivePointer(null);
    const g = gestureRef.current;
    gestureRef.current = null;
    suppressClickRef.current = true;
    if (!armedId) return;
    const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const targetId = target?.closest<HTMLElement>("[data-patchbay-jack]")?.dataset.patchbayJack ?? null;
    if (targetId && targetId !== armedId) {
      completePatch(targetId, armedId);
    } else if (!g?.moved) {
      // a tap that never moved: stay armed, awaiting a second jack — this is
      // the two-step click/keyboard flow's first half, not a cancel.
      return;
    } else {
      // a real drag that ended on empty space (or dropped back on itself):
      // cancel — the plug (already detached, if it had a patch) stays loose.
      setArmedId(null);
    }
  };

  const onJackClick = (jack: PatchbayJack) => () => {
    // reached only via genuine keyboard activation (Enter/Space) — a
    // pointer-driven click's trailing synthetic click is always suppressed
    // above, since that whole gesture was already handled in onPointerUp.
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (!armedId) {
      setArmedId(jack.id);
    } else if (armedId === jack.id) {
      setArmedId(null);
    } else {
      completePatch(jack.id, armedId);
    }
  };

  const grid = useMemo(() => {
    const g = new Map<string, number>();
    for (const [a, b] of patches) {
      const ja = byId.get(a);
      const jb = byId.get(b);
      if (!ja || !jb) continue;
      tracePolyline(orthogonalPath(anchor(ja), anchor(jb)), g);
    }
    if (armedId && livePointer) {
      const ja = byId.get(armedId);
      if (ja) tracePolyline(orthogonalPath(anchor(ja), livePointer), g);
    }
    return g;
  }, [patches, byId, armedId, livePointer]);

  const rows = useMemo(() => {
    const out: string[] = [];
    for (let y = 0; y < ROWS; y++) {
      let line = "";
      for (let x = 0; x < COLS; x++) line += GLYPH[grid.get(`${x},${y}`) ?? 0] ?? " ";
      out.push(line);
    }
    return out;
  }, [grid]);

  // Pulse: one small rAF loop, only while at least one patch exists and
  // motion isn't reduced, moving a marker span along each patch's flattened
  // cell path directly via refs (no per-frame React state).
  useEffect(() => {
    if (reducedRef.current || patches.length === 0) return;
    const paths = patches.map(([a, b]) => {
      const ja = byId.get(a);
      const jb = byId.get(b);
      return ja && jb ? flattenPath(orthogonalPath(anchor(ja), anchor(jb))) : [];
    });
    let raf = 0;
    const period = 1400;
    const start = performance.now();
    const tick = (now: number) => {
      const frac = ((now - start) % period) / period;
      paths.forEach((cells, i) => {
        const marker = markerRefs.current[i];
        if (!marker || cells.length === 0) return;
        const idx = Math.min(cells.length - 1, Math.floor(frac * cells.length));
        const [cx, cy] = cells[idx];
        marker.style.left = `${cx * CELL_W}px`;
        marker.style.top = `${cy * CELL_H}px`;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [patches, byId]);

  return (
    <div className={`ns-pac font-mono ${className}`}>
      <style>{CSS}</style>
      <div
        ref={containerRef}
        className="ns-pac-canvas relative select-none"
        style={{ width: COLS * CELL_W, height: ROWS * CELL_H, maxWidth: "100%" }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 text-ns-muted" style={{ fontSize: 11 }}>
          {rows.map((line, y) => (
            <div key={y} style={{ height: CELL_H, lineHeight: `${CELL_H}px`, whiteSpace: "nowrap" }}>
              {line.split("").map((ch, x) => (
                <span key={x} style={{ display: "inline-block", width: CELL_W, textAlign: "center" }}>
                  {ch}
                </span>
              ))}
            </div>
          ))}
        </div>

        {patches.map(([a], i) => (
          <span
            key={`${a}-${i}`}
            ref={(el) => {
              markerRefs.current[i] = el;
            }}
            aria-hidden
            className="ns-pac-pulse pointer-events-none absolute rounded-full bg-ns-accent"
            style={{ width: 6, height: 6, marginLeft: CELL_W / 2 - 3, marginTop: CELL_H / 2 - 3 }}
          />
        ))}

        {jacks.map((jack) => {
          const col = jackCol(jack.col);
          const row = jackRow(jack.row);
          const armed = armedId === jack.id;
          const patched = !!partnerOf(jack.id);
          const hovered = hoverId === jack.id;
          return (
            <button
              key={jack.id}
              type="button"
              data-patchbay-jack={jack.id}
              className={`ns-pac-jack absolute flex items-center justify-center border bg-background text-[11px] transition-colors duration-150 ${
                armed
                  ? "border-ns-accent text-foreground"
                  : hovered
                    ? "border-ns-accent/40 text-foreground"
                    : patched
                      ? "border-border text-foreground"
                      : "border-border text-ns-muted"
              }`}
              style={{
                left: col * CELL_W,
                top: row * CELL_H,
                width: JACK_W * CELL_W,
                height: JACK_H * CELL_H,
              }}
              aria-label={`Jack ${jack.label}${patched ? `, patched to ${byId.get(partnerOf(jack.id)!)?.label}` : ", unpatched"}. Press Enter to ${
                armedId && armedId !== jack.id ? "complete the patch" : armed ? "cancel" : "arm this jack"
              }.`}
              aria-pressed={armed}
              onPointerEnter={() => setHoverId(jack.id)}
              onPointerLeave={() => setHoverId((c) => (c === jack.id ? null : c))}
              onPointerDown={onJackPointerDown(jack)}
              onClick={onJackClick(jack)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setArmedId(null);
              }}
            >
              {jack.label}
            </button>
          );
        })}
      </div>

      <div className="mt-3 min-h-[1.5em] font-mono text-xs text-ns-muted">
        {armedId ? (
          <span data-patchbay-armed>
            Armed: <strong className="text-foreground">{byId.get(armedId)?.label}</strong> — select another jack to
            patch, or press Escape to cancel.
          </span>
        ) : (
          <span>Drag from one jack to another to patch them, or press Enter to arm.</span>
        )}
      </div>
    </div>
  );
}

const CSS = `
.ns-pac-jack:focus-visible { outline: 2px solid var(--ns-accent); outline-offset: 2px; }
.ns-pac-pulse { animation: ns-pac-blink 1.4s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .ns-pac-pulse { display: none; }
}
@keyframes ns-pac-blink {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 1; }
}
`;
