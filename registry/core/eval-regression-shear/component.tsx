"use client";

// ---------------------------------------------------------------------------
// ShearProfile — two eval runs compared as a SHEAR, not as a bar chart.
//
// Every case in the suite is one 1px hairline. The left end of every hairline
// is anchored on a fixed rail; the RIGHT end is displaced horizontally by
// dx = clamp(delta * shearScale, -56, 56) where delta = candidate - baseline.
// Because the cases are sorted by delta descending, the right terminus of the
// stack traces a monotone signed profile: it bows right at the top
// (improvements), runs dead straight through a long quiet waist (ties), and
// bows left at the bottom (regressions). The shape IS the distribution.
//
// Sign is shape-coded, never color-coded: improvements are solid ink,
// regressions are a 2px/2px stipple (the DOM equivalent of stroke-dasharray
// "2 2"), ties are flush against the zero line at a near-invisible alpha.
// In a real suite most cases tie, so 70-85% of the frame is deliberately
// quiet and the ink concentrates in the two tails — that sparsity is
// data-driven, not decorative.
//
// The pointer is a caliper. On pointermove the row under the cursor and its
// neighbours fan apart (pitch 7px -> 15px, gaussian weight exp(-d^2/2.2),
// 0.14s time constant) while the rest of the stack compresses so the block's
// total height never changes; the fanned rows reveal case id and
// "baseline -> candidate" at their sheared end. Keyboard gets the identical
// caliper through a roving-tabindex listbox.
//
// Colors are the registry tokens only (--background --foreground --muted
// --border --accent). --accent appears twice: the caliper line and the focus
// ring. No canvas, no dependencies.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { FocusEvent as ReactFocusEvent, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";

export interface ShearCase {
  /** Short, stable case identifier — shown at the sheared end when fanned. */
  id: string;
  /** Suite this case belongs to. Suites are grouped and ruled off. */
  suite: string;
  /** Score on the baseline run, 0..1. */
  baseline: number;
  /** Score on the candidate run, 0..1. */
  candidate: number;
}

export interface EvalRegressionShearProps {
  /** The two runs, one entry per eval case. */
  cases: ShearCase[];
  /** |delta| below this counts as unchanged. Default 0.005. */
  tieEps?: number;
  /** Score at or above which a case counts as passing. Default 0.5. */
  passThreshold?: number;
  /** Pixels of shear per 1.0 of delta, clamped to +/-56px. Default 260. */
  shearScale?: number;
  /** Accessible name for the case list. */
  label?: string;
  className?: string;
}

const ROW_PITCH = 7;
const FAN_PITCH = 15;
const GAUSS = 2.2;
const SHEAR_MAX = 56;
const TAU = 0.14;
const SUITE_H = 24;
const LABEL_W = 232;
const BREATHE_MS = 3600;
const JITTER_MS = 240;

type Sign = "up" | "down" | "tie";

interface Row {
  id: string;
  suite: string;
  baseline: number;
  candidate: number;
  delta: number;
  dx: number;
  sign: Sign;
  newFail: boolean;
  jitter: number;
}

type Item =
  | { kind: "suite"; suite: string; sum: number; n: number; hi: number }
  | { kind: "case"; row: Row; ci: number };

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function signed(n: number, digits = 3): string {
  const s = n.toFixed(digits);
  return n > 0 ? `+${s}` : n < 0 ? s.replace("-", "−") : s;
}

export function ShearProfile({
  cases,
  tieEps = 0.005,
  passThreshold = 0.5,
  shearScale = 260,
  label = "Eval cases, sorted by score delta",
  className,
}: EvalRegressionShearProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const headerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const caliperRef = useRef<HTMLDivElement | null>(null);

  const aRef = useRef(0);
  const hRef = useRef(0);
  const aT = useRef(0);
  const hT = useRef(0);
  const hovering = useRef(false);
  const layoutRef = useRef<{ ys: number[]; pitch: number[] }>({ ys: [], pitch: [] });
  const wakeRef = useRef<() => void>(() => {});

  const [width, setWidth] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [focusIdx, setFocusIdx] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // -- data ----------------------------------------------------------------
  const { items, caseRows, counts, newFails } = useMemo(() => {
    const rows: Row[] = cases.map((c) => {
      const delta = c.candidate - c.baseline;
      const sign: Sign = Math.abs(delta) < tieEps ? "tie" : delta > 0 ? "up" : "down";
      const dx = Math.max(-SHEAR_MAX, Math.min(SHEAR_MAX, delta * shearScale));
      return {
        id: c.id,
        suite: c.suite,
        baseline: c.baseline,
        candidate: c.candidate,
        delta,
        dx: sign === "tie" ? 0 : dx,
        sign,
        newFail: c.baseline >= passThreshold && c.candidate < passThreshold,
        jitter: ((hashStr(c.id) % 1000) / 1000) * 2 * JITTER_MS - JITTER_MS,
      };
    });

    // Group by suite so each suite is ruled off and summed, sort cases within
    // a suite by delta descending, and order the suites themselves by their
    // own delta sum descending — so the stack still reads improved-to-regressed
    // from top to bottom while every suite keeps its own signed profile.
    const bySuite = new Map<string, Row[]>();
    for (const r of rows) {
      const list = bySuite.get(r.suite);
      if (list) list.push(r);
      else bySuite.set(r.suite, [r]);
    }
    const groups = [...bySuite.entries()]
      .map(([suite, list]) => ({
        suite,
        list: [...list].sort((a, b) => b.delta - a.delta),
        sum: list.reduce((t, r) => t + r.delta, 0),
      }))
      .sort((a, b) => b.sum - a.sum);

    const flat: Item[] = [];
    const ordered: Row[] = [];
    let hi = 0;
    for (const g of groups) {
      flat.push({ kind: "suite", suite: g.suite, sum: g.sum, n: g.list.length, hi: hi++ });
      for (const row of g.list) {
        flat.push({ kind: "case", row, ci: ordered.length });
        ordered.push(row);
      }
    }

    return {
      items: flat,
      caseRows: ordered,
      counts: {
        up: ordered.filter((r) => r.sign === "up").length,
        down: ordered.filter((r) => r.sign === "down").length,
        tie: ordered.filter((r) => r.sign === "tie").length,
      },
      newFails: ordered.filter((r) => r.newFail).length,
    };
  }, [cases, tieEps, passThreshold, shearScale]);

  const n = caseRows.length;
  const stackH = n * ROW_PITCH + items.filter((i) => i.kind === "suite").length * SUITE_H;
  const zeroX = Math.max(120, (width || 640) - LABEL_W - SHEAR_MAX);
  // The tick sits at 0.20 delta unless that would exceed the shear clamp, in
  // which case it falls back to whatever delta the clamp represents — the
  // label is formatted from the same number, so the stated scale can never
  // drift from the drawn one at a large shearScale.
  const tickDelta = Math.min(0.2, SHEAR_MAX / shearScale);
  const tickPx = tickDelta * shearScale;
  const tickLabel = tickDelta.toFixed(2);
  // Roving tabindex must always land on a real row, even if `cases` shrinks
  // under the current focus index — otherwise Tab cannot reach the list.
  const activeIdx = Math.min(focusIdx, Math.max(0, n - 1));

  /** Resting (unfanned) y for every item, so the first paint — and any render
   *  before hydration — is already the correct uniform-pitch stack rather than
   *  every row piled at y=0. */
  const restY = useMemo(() => {
    const out: number[] = [];
    let y = 0;
    for (const it of items) {
      out.push(y);
      y += it.kind === "suite" ? SUITE_H : ROW_PITCH;
    }
    return out;
  }, [items]);

  // -- layout --------------------------------------------------------------
  const applyLayout = useCallback(() => {
    if (!n) return;
    const a = aRef.current;
    const h = hRef.current;
    const raw = new Array<number>(n);
    let total = 0;
    for (let i = 0; i < n; i++) {
      const d = i - h;
      const w = Math.exp(-(d * d) / GAUSS);
      const p = ROW_PITCH + (FAN_PITCH - ROW_PITCH) * w * a;
      raw[i] = p;
      total += p;
    }
    const scale = (n * ROW_PITCH) / total;

    const ys = layoutRef.current.ys;
    const pitches = layoutRef.current.pitch;
    let y = 0;
    let ci = 0;
    let hi = 0;
    for (const it of items) {
      if (it.kind === "suite") {
        const el = headerRefs.current[hi++];
        if (el) el.style.transform = `translate3d(0,${y}px,0)`;
        y += SUITE_H;
        continue;
      }
      const p = raw[ci] * scale;
      const el = rowRefs.current[ci];
      if (el) {
        el.style.transform = `translate3d(0,${y}px,0)`;
        el.style.height = `${p}px`;
      }
      const lab = labelRefs.current[ci];
      if (lab) {
        const d = ci - h;
        const w = Math.exp(-(d * d) / GAUSS) * a;
        lab.style.opacity = String(Math.max(0, Math.min(1, (w - 0.34) / 0.34)));
      }
      ys[ci] = y;
      pitches[ci] = p;
      ci++;
      y += p;
    }

    const cal = caliperRef.current;
    if (cal) {
      const idx = Math.max(0, Math.min(n - 1, Math.round(h)));
      const cy = (ys[idx] ?? 0) + (pitches[idx] ?? ROW_PITCH) / 2;
      cal.style.transform = `translate3d(0,${cy}px,0)`;
      cal.style.opacity = String(a * 0.9);
    }
  }, [items, n]);

  useEffect(() => {
    let raf = 0;
    let last = 0;
    let running = false;
    const frame = (t: number) => {
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 1 / 60;
      last = t;
      const k = reduced ? 1 : 1 - Math.exp(-dt / TAU);
      aRef.current += (aT.current - aRef.current) * k;
      hRef.current += (hT.current - hRef.current) * k;
      const done =
        Math.abs(aT.current - aRef.current) < 0.002 && Math.abs(hT.current - hRef.current) < 0.01;
      if (done) {
        aRef.current = aT.current;
        hRef.current = hT.current;
      }
      applyLayout();
      if (done) {
        running = false;
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    wakeRef.current = () => {
      if (running) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    };
    applyLayout();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      running = false;
      wakeRef.current = () => {};
    };
  }, [applyLayout, reduced]);

  const nearestIndex = useCallback(
    (y: number) => {
      const { ys, pitch } = layoutRef.current;
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < n; i++) {
        const c = (ys[i] ?? i * ROW_PITCH) + (pitch[i] ?? ROW_PITCH) / 2;
        const d = Math.abs(c - y);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      return best;
    },
    [n],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const el = bodyRef.current;
      if (!el || !n) return;
      hovering.current = true;
      const r = el.getBoundingClientRect();
      hT.current = nearestIndex(e.clientY - r.top);
      aT.current = 1;
      wakeRef.current();
    },
    [n, nearestIndex],
  );

  const onPointerLeave = useCallback(() => {
    hovering.current = false;
    // A focused row keeps the caliper open — only the pointer left.
    const root = bodyRef.current;
    if (root && root.contains(document.activeElement)) hT.current = Math.min(focusIdx, Math.max(0, n - 1));
    else aT.current = 0;
    wakeRef.current();
  }, [focusIdx, n]);

  const moveTo = useCallback((i: number) => {
    const el = rowRefs.current[i];
    if (el) el.focus({ preventScroll: true });
  }, []);

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (!n) return;
      const cur = Math.min(focusIdx, n - 1);
      let next = cur;
      if (e.key === "ArrowDown") next = Math.min(n - 1, cur + 1);
      else if (e.key === "ArrowUp") next = Math.max(0, cur - 1);
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = n - 1;
      else return;
      e.preventDefault();
      moveTo(next);
    },
    [focusIdx, moveTo, n],
  );

  const onRowFocus = useCallback((i: number) => {
    setFocusIdx(i);
    hT.current = i;
    aT.current = 1;
    wakeRef.current();
  }, []);

  const onBlurCapture = useCallback((e: ReactFocusEvent<HTMLDivElement>) => {
    const next = e.relatedTarget as Node | null;
    if (next && e.currentTarget.contains(next)) return;
    if (!hovering.current) {
      aT.current = 0;
      wakeRef.current();
    }
  }, []);

  const listId = `ns-shear-${uid}`;

  return (
    <div
      className={["w-full font-sans text-foreground", className].filter(Boolean).join(" ")}
    >
      <style>{CSS}</style>

      <div
        role="status"
        aria-live="polite"
        className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 font-mono text-[11px] tabular-nums text-muted"
      >
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="ns-shear-key ns-shear-key-up" />
          {counts.up} improved
        </span>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="ns-shear-key ns-shear-key-down" />
          {counts.down} regressed
        </span>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="ns-shear-key ns-shear-key-tie" />
          {counts.tie} unchanged
        </span>
        {newFails > 0 ? (
          <span className="inline-flex items-center gap-2">
            <span aria-hidden className="ns-shear-key-cap" />
            {newFails} new failures
          </span>
        ) : null}
      </div>

      <div
        ref={bodyRef}
        data-shear-rows
        className="relative w-full"
        style={{ height: stackH }}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
      >
        {/* left anchor rail + unsheared zero line */}
        <span aria-hidden className="ns-shear-rail" style={{ left: 0 }} />
        <span aria-hidden className="ns-shear-zero" style={{ left: zeroX }} />

        <div
          ref={caliperRef}
          aria-hidden
          className="ns-shear-caliper"
          style={{ width: zeroX + SHEAR_MAX, opacity: 0 }}
        />

        <div
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute inset-0"
          onKeyDown={onKeyDown}
          onBlurCapture={onBlurCapture}
        >
          {items.map((it, k) => {
            if (it.kind === "suite") {
              const hi = it.hi;
              return (
                <div
                  key={`s-${it.suite}`}
                  ref={(el) => {
                    headerRefs.current[hi] = el;
                  }}
                  aria-hidden
                  className="ns-shear-suite"
                  style={{
                    height: SUITE_H,
                    width: zeroX,
                    transform: `translate3d(0,${restY[k]}px,0)`,
                  }}
                >
                  <span className="truncate font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                    {it.suite}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted">
                    {it.n} cases · Σ {signed(it.sum)}
                  </span>
                </div>
              );
            }

            const r = it.row;
            const i = it.ci;
            const lineW = Math.max(2, zeroX + r.dx);
            const alpha = r.sign === "up" ? 0.55 : r.sign === "down" ? 0.7 : 0.18;
            return (
              <div
                key={r.id}
                ref={(el) => {
                  rowRefs.current[i] = el;
                }}
                role="option"
                aria-selected={i === activeIdx}
                tabIndex={i === activeIdx ? 0 : -1}
                onFocus={() => onRowFocus(i)}
                aria-label={`${r.suite} ${r.id}: baseline ${r.baseline.toFixed(
                  2,
                )}, candidate ${r.candidate.toFixed(2)}, delta ${signed(r.delta, 3)}${
                  r.newFail ? ", new failure" : ""
                }`}
                className="ns-shear-row"
                style={{ height: ROW_PITCH, transform: `translate3d(0,${restY[k]}px,0)` }}
              >
                <span
                  aria-hidden
                  className={
                    r.newFail && !reduced ? "ns-shear-ink ns-shear-breathe" : "ns-shear-ink"
                  }
                  style={r.newFail && !reduced ? { animationDelay: `${r.jitter}ms` } : undefined}
                >
                  <span
                    className={
                      r.sign === "down" ? "ns-shear-line ns-shear-stipple" : "ns-shear-line"
                    }
                    style={{ width: lineW, opacity: alpha }}
                  />
                  {r.newFail ? (
                    <span className="ns-shear-cap" style={{ left: lineW - 1 }} />
                  ) : null}
                </span>
                <span
                  aria-hidden
                  ref={(el) => {
                    labelRefs.current[i] = el;
                  }}
                  className="ns-shear-label"
                  style={{
                    left: lineW + 6,
                    opacity: 0,
                    // Clamp to the remaining gutter so a long case id can never
                    // push the component past its own width (mobile scrollbar).
                    maxWidth: Math.max(48, (width || 640) - lineW - 12),
                  }}
                >
                  {r.id}
                  <span className="text-muted">
                    {"  "}
                    {r.baseline.toFixed(2)} → {r.candidate.toFixed(2)}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="relative mt-2 h-9 w-full" aria-hidden>
        <span className="ns-shear-tick" style={{ left: zeroX - tickPx }} />
        <span className="ns-shear-tick" style={{ left: zeroX }} />
        <span className="ns-shear-tick" style={{ left: zeroX + tickPx }} />
        <span className="ns-shear-axis" style={{ left: zeroX - tickPx }}>
          {"−"}
          {tickLabel}
        </span>
        <span className="ns-shear-axis" style={{ left: zeroX }}>
          0
        </span>
        <span className="ns-shear-axis" style={{ left: zeroX + tickPx }}>
          +{tickLabel}
        </span>
        <span className="absolute left-0 top-[18px] font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
          Δ score · candidate − baseline
        </span>
      </div>
    </div>
  );
}

export default ShearProfile;

const CSS = `
.ns-shear-row{position:absolute;left:0;right:0;top:0;outline:none;will-change:transform;}
.ns-shear-row:focus-visible{outline:2px solid var(--accent);outline-offset:1px;border-radius:2px;}
.ns-shear-ink{position:absolute;inset:0;display:block;}
.ns-shear-line{position:absolute;left:0;top:50%;height:1px;display:block;background:var(--foreground);transform:translateY(-0.5px);}
.ns-shear-stipple{background:none;background-image:repeating-linear-gradient(to right,var(--foreground) 0 2px,transparent 2px 4px);}
.ns-shear-cap{position:absolute;top:50%;width:2px;height:7px;display:block;background:var(--foreground);transform:translateY(-3.5px);}
.ns-shear-label{position:absolute;top:50%;transform:translateY(-50%);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none;background:var(--background);padding:0 4px;font-family:var(--font-mono, ui-monospace, monospace);font-size:10px;line-height:1;color:var(--foreground);font-variant-numeric:tabular-nums;}
.ns-shear-rail{position:absolute;top:0;bottom:0;width:1px;background:var(--border);}
.ns-shear-zero{position:absolute;top:0;bottom:0;width:1px;background:var(--border);}
.ns-shear-caliper{position:absolute;left:0;top:0;height:1px;background:var(--accent);pointer-events:none;will-change:transform;}
.ns-shear-suite{position:absolute;left:0;top:0;display:flex;align-items:flex-end;justify-content:space-between;gap:12px;padding:0 8px 4px 0;border-bottom:1px solid var(--border);will-change:transform;}
.ns-shear-key{display:block;width:18px;height:1px;background:var(--foreground);}
.ns-shear-key-up{opacity:0.55;}
.ns-shear-key-down{background:none;background-image:repeating-linear-gradient(to right,var(--foreground) 0 2px,transparent 2px 4px);opacity:0.7;}
.ns-shear-key-tie{opacity:0.18;}
.ns-shear-key-cap{display:block;width:2px;height:8px;background:var(--foreground);}
.ns-shear-tick{position:absolute;top:0;width:1px;height:4px;background:var(--border);}
.ns-shear-axis{position:absolute;top:6px;transform:translateX(-50%);font-family:var(--font-mono, ui-monospace, monospace);font-size:10px;line-height:1;color:var(--muted);font-variant-numeric:tabular-nums;}
.ns-shear-breathe{animation:ns-shear-breathe ${BREATHE_MS}ms ease-in-out infinite;}
@keyframes ns-shear-breathe{0%,100%{opacity:0.5;}50%{opacity:1;}}
@media (prefers-reduced-motion: reduce){
  .ns-shear-breathe{animation:none;opacity:1;}
}
`;
