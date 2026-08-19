"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// ZipperStall — merge resolution staged as closing a zipper. Two columns of
// teeth (your ops, their ops), one operation per tooth, laid down the spine
// in arrival order. A single scalar, closureY (px down the spine), governs
// everything: which teeth have meshed flush to the spine, where the drag
// handle sits, the merged-count readout, and which conflict (if any) is
// live. There is no per-tooth animation clock — a tooth's transform is a
// pure function of closureY crossing its row's center, expressed as a CSS
// transition on a state flip, so scrubbing the handle back deterministically
// re-opens teeth in the same order they closed.
//
// A conflict is two ops that land on the same document offset — they share
// a row and neither can mesh until the human picks a side. The real
// mechanism for "the slider physically cannot pass a conflict" is that the
// native <input type="range"> always spans the FULL spine in its min/max
// (so the handle's pixel position always corresponds to real row geometry),
// while the COMMITTED value is clamped in JS to conflictCenter - 8px. Native
// max never shrinks — only the reachable value does — which is what keeps
// "where it stops" honest against the rows actually drawn underneath it,
// rather than a max attribute that would silently rescale the whole track.
// A parallel signal (the raw value reported by the same change event, before
// clamping) drives a small 0-3px "jam" bump on the decorative handle cap via
// a k=500 spring, so pushing past the wall reads as resistance, not a wall
// that silently swallows input. prefers-reduced-motion turns that spring
// into a single instant border flash instead.
//
// A11y: the range input is real (native min/max/step, arrow/Home/End work),
// carries aria-valuetext ("12 of 14 ops merged, stopped at conflict 1 of
// 3"). The spine itself is a plain <ol>, one <li> per row, each named for
// screen readers ("theirs, 14:02, replaced heading"; conflicts name both
// sides plus resolution status). Resolution is two real <button>s that
// appear only once the handle is actually jammed against that row, so a
// prior programmatic click on the handle (which jumps value like any native
// range) still leaves the same buttons re-derivable and clickable.
// ---------------------------------------------------------------------------

export type ZipperSide = "ours" | "theirs";

export interface ZipperOp {
  /** stable id */
  id: string;
  /** which edit stream this op came from */
  side: ZipperSide;
  /** arrival order — lower sorts first; ties are fine */
  t: number;
  /** display timestamp, e.g. "14:02" — pre-formatted, never Date-derived, so
   * server and client render byte-identical text */
  timestamp: string;
  /** document offset this op targets. two ops sharing an offset conflict. */
  offset: number;
  /** short description, e.g. "replaced heading" */
  label: string;
}

export interface ZipperStallProps {
  /** the two edit streams, unsorted — sorted internally by t */
  ops: ZipperOp[];
  /** column heading over the left (ours) teeth */
  oursLabel?: string;
  /** column heading over the right (theirs) teeth */
  theirsLabel?: string;
  /** px height of one row / one tooth */
  rowHeight?: number;
  /** called every time a conflict is resolved */
  onResolve?: (kept: ZipperOp, droppedOp: ZipperOp) => void;
  /** called once the spine is fully closed with nothing left pending */
  onComplete?: () => void;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

type Row = {
  key: string;
  offset: number;
  ours?: ZipperOp;
  theirs?: ZipperOp;
  conflict: boolean;
  center: number; // px, along the spine
};

const TRACK_W = 28;
const CLAMP_GAP = 8;
const BUMP_MAX = 3;
const BUMP_GAIN = 0.6; // px raw overrun -> px of visible bump, pre-clamp
const SPRING_K = 500; // s^-2
const SPRING_ZETA = 0.5;
const FLASH_MS = 150;

function buildRows(ops: ZipperOp[]): Row[] {
  const sorted = [...ops].sort((a, b) => a.t - b.t);
  const rows: Row[] = [];
  const rowForOffset = new Map<number, number>();
  for (const op of sorted) {
    const existingIdx = rowForOffset.get(op.offset);
    const existing = existingIdx !== undefined ? rows[existingIdx] : undefined;
    if (existing && !existing[op.side]) {
      existing[op.side] = op;
      existing.conflict = !!existing.ours && !!existing.theirs;
      continue;
    }
    const row: Row = {
      key: `${op.offset}-${rows.length}`,
      offset: op.offset,
      conflict: false,
      center: 0,
      [op.side]: op,
    } as Row;
    rowForOffset.set(op.offset, rows.length);
    rows.push(row);
  }
  return rows;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

export function ZipperStall({
  ops,
  oursLabel = "Yours",
  theirsLabel = "Theirs",
  rowHeight = 44,
  onResolve,
  onComplete,
  className = "",
}: ZipperStallProps) {
  const uid = useId();
  const ROW_H = rowHeight > 0 ? rowHeight : 44;

  const rows = useMemo(() => {
    const built = buildRows(ops);
    return built.map((r, i) => ({ ...r, center: i * ROW_H + ROW_H / 2 }));
  }, [ops, ROW_H]);

  const spineHeight = rows.length * ROW_H;
  const totalOps = ops.length;

  const [closureY, setClosureY] = useState(0);
  const [resolved, setResolved] = useState<Record<string, ZipperSide>>({});
  const [bump, setBump] = useState(0);
  const [flash, setFlash] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [focused, setFocused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [pressed, setPressed] = useState(false);

  const closureYRef = useRef(closureY);
  closureYRef.current = closureY;

  const reducedRef = useRef(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    const onChange = () => {
      reducedRef.current = mq.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const conflictRows = useMemo(() => rows.filter((r) => r.conflict), [rows]);
  const firstUnresolvedConflict = useMemo(
    () => conflictRows.find((r) => !resolved[r.key]),
    [conflictRows, resolved]
  );
  const effectiveMax = firstUnresolvedConflict
    ? Math.max(0, firstUnresolvedConflict.center - CLAMP_GAP)
    : spineHeight;
  const jammed = firstUnresolvedConflict !== undefined && closureY >= effectiveMax;

  const mergedCount = useMemo(() => {
    let n = 0;
    for (const row of rows) {
      if (row.conflict) {
        // a resolved conflict is two decided ops (the kept one meshed, the
        // dropped one filed down) — both count toward the total, since the
        // filed-down tooth is a decided record, not an unmerged one.
        const side = resolved[row.key];
        if (side && closureY >= row.center) n += 2;
      } else if (closureY >= row.center) {
        n += 1;
      }
    }
    return n;
  }, [rows, resolved, closureY]);

  const completedRef = useRef(false);
  useEffect(() => {
    const allResolved = conflictRows.every((r) => resolved[r.key]);
    const done = allResolved && closureY >= spineHeight && spineHeight > 0;
    if (done && !completedRef.current) {
      completedRef.current = true;
      setAnnounce(`Merge complete: ${totalOps} of ${totalOps} ops merged.`);
      onComplete?.();
    } else if (!done) {
      completedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closureY, resolved, conflictRows, spineHeight]);

  // -- bump / flash engine (excess drag past the clamp, purely visual) -----
  const excessRef = useRef(0);
  const bumpRef = useRef(0);
  const bumpVelRef = useRef(0);
  const rafRef = useRef(0);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  // excess decays on its own ~100ms after the last push registers it, so a
  // single keypress or a drag that ends mid-push still springs back instead
  // of sitting jammed forever waiting for a change event that never comes
  const excessDecayRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      if (excessDecayRef.current) clearTimeout(excessDecayRef.current);
    };
  }, []);

  const wakeSpring = () => {
    if (rafRef.current) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.032, Math.max(0, (now - last) / 1000));
      last = now;
      const target = clamp(excessRef.current * BUMP_GAIN, 0, BUMP_MAX);
      const c = 2 * SPRING_ZETA * Math.sqrt(SPRING_K);
      const disp = bumpRef.current - target;
      bumpVelRef.current += (-SPRING_K * disp - c * bumpVelRef.current) * dt;
      bumpRef.current += bumpVelRef.current * dt;
      if (
        Math.abs(bumpRef.current - target) < 0.05 &&
        Math.abs(bumpVelRef.current) < 1 &&
        excessRef.current === 0
      ) {
        bumpRef.current = 0;
        bumpVelRef.current = 0;
        setBump(0);
        rafRef.current = 0;
        return;
      }
      setBump(bumpRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const registerExcess = (excess: number) => {
    excessRef.current = excess;
    if (excessDecayRef.current) clearTimeout(excessDecayRef.current);
    if (excess > 0) {
      excessDecayRef.current = setTimeout(() => {
        excessRef.current = 0;
        if (!reducedRef.current) wakeSpring();
      }, 100);
    }
    if (excess <= 0 && bumpRef.current === 0) return;
    if (reducedRef.current) {
      if (excess > 0) {
        setFlash(true);
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        flashTimerRef.current = setTimeout(() => setFlash(false), FLASH_MS);
      }
      return;
    }
    wakeSpring();
  };

  const commit = (raw: number) => {
    const bounded = clamp(raw, 0, spineHeight);
    const excess = Math.max(0, bounded - effectiveMax);
    registerExcess(excess);
    const next = Math.min(bounded, effectiveMax);
    if (next !== closureYRef.current) setClosureY(next);
  };

  const inputRef = useRef<HTMLInputElement>(null);
  const draggingRef = useRef(false);

  // authoritative pointer math — kept independent of native drag-to-value so
  // synthetic pointer events (the autoplay driver, dispatched programmatically
  // via dispatchEvent) drive the same commit() path a real drag does; a real
  // browser's own native slider-drag would otherwise never see a synthetic
  // pointerdown/move as a drag gesture at all.
  const rawFromClientY = (clientY: number) => {
    const rect = inputRef.current?.getBoundingClientRect();
    if (!rect || rect.height <= 0) return closureYRef.current;
    return ((clientY - rect.top) / rect.height) * spineHeight;
  };

  const onPointerDownInput = (e: React.PointerEvent<HTMLInputElement>) => {
    draggingRef.current = true;
    setPressed(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    commit(rawFromClientY(e.clientY));
  };
  const onPointerMoveInput = (e: React.PointerEvent<HTMLInputElement>) => {
    if (!draggingRef.current) return;
    commit(rawFromClientY(e.clientY));
  };
  const endDrag = () => {
    draggingRef.current = false;
    setPressed(false);
    if (excessDecayRef.current) clearTimeout(excessDecayRef.current);
    excessRef.current = 0;
    if (!reducedRef.current) wakeSpring();
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // fallback for any change the pointer/keyboard handlers above didn't
    // already cover (e.g. an assistive-tech-driven value set)
    commit(Number(e.target.value));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const v = closureYRef.current;
    let next: number | null = null;
    switch (e.key) {
      case "ArrowDown":
      case "ArrowRight":
        next = v + ROW_H;
        break;
      case "ArrowUp":
      case "ArrowLeft":
        next = v - ROW_H;
        break;
      case "PageDown":
        next = v + ROW_H * 3;
        break;
      case "PageUp":
        next = v - ROW_H * 3;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = spineHeight;
        break;
      default:
        return;
    }
    e.preventDefault();
    commit(next);
  };

  const resolve = (row: Row, side: ZipperSide) => {
    if (!row.ours || !row.theirs || resolved[row.key]) return;
    const kept = side === "ours" ? row.ours : row.theirs;
    const dropped = side === "ours" ? row.theirs : row.ours;
    setResolved((r) => ({ ...r, [row.key]: side }));
    setAnnounce(
      `Kept ${kept.side}, ${kept.timestamp}, ${kept.label}. ${dropped.side} version struck through, not taken.`
    );
    onResolve?.(kept, dropped);
    inputRef.current?.focus({ preventScroll: true });
  };

  const conflictIndex = firstUnresolvedConflict
    ? conflictRows.indexOf(firstUnresolvedConflict) + 1
    : 0;
  const valueText = jammed
    ? `${mergedCount} of ${totalOps} ops merged, stopped at conflict ${conflictIndex} of ${conflictRows.length}`
    : `${mergedCount} of ${totalOps} ops merged`;

  const capY = closureY + bump;

  return (
    <div className={`w-full max-w-2xl font-mono ${className}`}>
      <style>{`
.zs-tooth{transition:transform 90ms cubic-bezier(0.16,1,0.3,1),opacity 90ms cubic-bezier(0.16,1,0.3,1),color 90ms linear;}
.zs-fold{transition:transform 160ms cubic-bezier(0.16,1,0.3,1),opacity 160ms cubic-bezier(0.16,1,0.3,1);}
.zs-cap{transition:background-color 120ms linear,box-shadow 120ms linear;}
.zs-flash{transition:border-color 60ms linear;}
@media (prefers-reduced-motion: reduce){
  .zs-tooth,.zs-fold,.zs-cap{transition:none;}
}
`}</style>

      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-ns-muted">
            merge closure
          </p>
          <p className="mt-0.5 text-xs text-ns-muted" aria-hidden>
            {jammed
              ? `stopped at conflict ${conflictIndex} of ${conflictRows.length}`
              : `${mergedCount} / ${totalOps} ops merged`}
          </p>
        </div>
        <div className="grid grid-cols-[1fr_28px_1fr] gap-1 px-2 text-[10px] uppercase tracking-[0.15em] text-ns-muted">
          <span className="text-right">{oursLabel}</span>
          <span aria-hidden />
          <span className="text-left">{theirsLabel}</span>
        </div>
      </div>

      <div className="relative" style={{ height: spineHeight }}>
        <ol
          className="relative list-none divide-y divide-border/60 rounded-md border border-border"
          aria-label="Merge operations, in arrival order"
        >
          {rows.map((row) => (
            <li
              key={row.key}
              style={{ height: ROW_H }}
              className="grid grid-cols-[1fr_28px_1fr] items-center gap-1 px-2"
              aria-label={rowAriaLabel(row, resolved[row.key])}
            >
              <div className="flex justify-end">
                {row.ours ? (
                  <Tooth
                    op={row.ours}
                    align="right"
                    state={toothState(row, "ours", closureY, resolved)}
                  />
                ) : null}
              </div>
              <div aria-hidden />
              <div className="flex justify-start">
                {row.theirs ? (
                  <Tooth
                    op={row.theirs}
                    align="left"
                    state={toothState(row, "theirs", closureY, resolved)}
                  />
                ) : null}
              </div>
            </li>
          ))}
        </ol>

        {/* decorative spine: rail, fill, and the visual handle cap — all
            pure functions of closureY/bump, no independent animation */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-1/2"
          style={{ width: TRACK_W, transform: "translateX(-50%)" }}
        >
          <div
            className="absolute left-1/2 top-0 bottom-0 w-px"
            style={{ transform: "translateX(-50%)", backgroundColor: "var(--border)" }}
          />
          <div
            className="absolute left-1/2 top-0 w-px"
            style={{
              height: capY,
              transform: "translateX(-50%)",
              backgroundColor: "var(--foreground)",
              opacity: 0.5,
            }}
          />
          <div
            className={`zs-cap zs-flash absolute left-1/2 rounded-full border ${
              flash ? "border-ns-accent" : "border-border"
            }`}
            style={{
              top: capY,
              width: TRACK_W,
              height: 18,
              transform: "translate(-50%, -50%)",
              backgroundColor:
                focused || hovering || pressed
                  ? "var(--ns-accent)"
                  : "var(--foreground)",
              boxShadow: focused
                ? "0 0 0 2px var(--background), 0 0 0 4px var(--ns-accent)"
                : "none",
            }}
          />
        </div>

        {/* the real control — spans the full spine so its pixel position
            always maps to the rows actually drawn beneath it; the reachable
            VALUE is clamped in JS, the native max never shrinks */}
        <input
          ref={inputRef}
          type="range"
          min={0}
          max={spineHeight}
          step={1}
          value={closureY}
          data-zipper-input
          aria-label="Merge closure"
          aria-valuemin={0}
          aria-valuemax={effectiveMax}
          aria-valuenow={closureY}
          aria-valuetext={valueText}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onPointerEnter={() => setHovering(true)}
          onPointerLeave={() => setHovering(false)}
          onPointerDown={onPointerDownInput}
          onPointerMove={onPointerMoveInput}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className="absolute cursor-ns-resize touch-none appearance-none bg-transparent opacity-0 outline-none"
          style={{
            top: "50%",
            left: "50%",
            width: spineHeight,
            height: TRACK_W,
            margin: 0,
            transform: "translate(-50%, -50%) rotate(90deg)",
          }}
        />

        {/* resolution: two real buttons, only present once the handle is
            genuinely jammed against this row. z-20 keeps them clickable
            above the full-height transparent input they visually sit atop. */}
        {jammed && firstUnresolvedConflict?.ours && firstUnresolvedConflict?.theirs ? (
          <div
            className="absolute left-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 gap-1.5"
            style={{ top: firstUnresolvedConflict.center }}
          >
            <button
              type="button"
              data-zipper-choice
              onClick={() => resolve(firstUnresolvedConflict, "ours")}
              className="whitespace-nowrap rounded-full border border-border bg-background px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-foreground transition-colors hover:border-ns-accent hover:text-ns-accent focus-visible:border-ns-accent focus-visible:text-ns-accent focus-visible:ring-2 focus-visible:ring-ns-accent"
            >
              Keep {oursLabel.toLowerCase()}
            </button>
            <button
              type="button"
              data-zipper-choice
              onClick={() => resolve(firstUnresolvedConflict, "theirs")}
              className="whitespace-nowrap rounded-full border border-border bg-background px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-foreground transition-colors hover:border-ns-accent hover:text-ns-accent focus-visible:border-ns-accent focus-visible:text-ns-accent focus-visible:ring-2 focus-visible:ring-ns-accent"
            >
              Keep {theirsLabel.toLowerCase()}
            </button>
          </div>
        ) : null}
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>

      <p className="mt-2 text-[11px] text-ns-muted">
        drag, or arrow keys, down the spine to merge · a stall means pick a
        side before it can continue
      </p>
      <p className="sr-only" id={`${uid}-hint`}>
        Struck-through rows are edits that were not taken; they stay in the
        list as a permanent record.
      </p>
    </div>
  );
}

function toothState(
  row: Row,
  side: ZipperSide,
  closureY: number,
  resolved: Record<string, ZipperSide>
): "pending" | "meshed" | "kept" | "folded" {
  if (!row.conflict) {
    return closureY >= row.center ? "meshed" : "pending";
  }
  const winner = resolved[row.key];
  if (!winner) return "pending";
  if (winner === side) return closureY >= row.center ? "kept" : "pending";
  return "folded";
}

function rowAriaLabel(row: Row, winner: ZipperSide | undefined): string {
  if (!row.conflict) {
    const op = (row.ours ?? row.theirs) as ZipperOp;
    return `${op.side}, ${op.timestamp}, ${op.label}`;
  }
  const a = row.ours as ZipperOp;
  const b = row.theirs as ZipperOp;
  const status = winner
    ? `resolved, kept ${winner}`
    : "conflict, unresolved, stalls the merge here";
  return `ours, ${a.timestamp}, ${a.label}; theirs, ${b.timestamp}, ${b.label} — ${status}`;
}

function Tooth({
  op,
  align,
  state,
}: {
  op: ZipperOp;
  align: "left" | "right";
  state: "pending" | "meshed" | "kept" | "folded";
}) {
  const dx = align === "right" ? 16 : -16;
  const isFolded = state === "folded";
  const flush = state === "meshed" || state === "kept";

  if (isFolded) {
    return (
      <div
        className="zs-fold max-w-[11rem] truncate rounded-md px-1.5 py-0.5 text-[11px]"
        style={{ transform: "translateX(0) scaleY(0.5)", opacity: 0.7 }}
        title={`${op.timestamp} · ${op.label} · not taken`}
      >
        <s className="text-ns-muted decoration-1">{op.label}</s>
        <span className="ml-1 text-[9px] uppercase tracking-wide text-ns-muted">
          not taken
        </span>
      </div>
    );
  }

  return (
    <div
      className="zs-tooth max-w-[11rem] truncate rounded-md border px-1.5 py-1 text-[11px]"
      style={{
        transform: `translateX(${flush ? 0 : dx}px)`,
        borderColor: flush ? "transparent" : "var(--border)",
        color: flush ? "var(--foreground)" : "var(--ns-muted)",
      }}
      title={`${op.timestamp} · ${op.label}`}
    >
      <span className="tabular-nums text-ns-muted">{op.timestamp}</span>{" "}
      {op.label}
    </div>
  );
}
