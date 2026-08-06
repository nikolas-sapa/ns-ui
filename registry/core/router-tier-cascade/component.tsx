"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// RouterTierCascade — model routing drawn as a cascade of weirs. One hairline
// row per model tier, cheapest at top. Each row's 1px baseline is broken by a
// WEIR NOTCH at x = ceiling: a 10px gap flanked by two short vertical lips.
// A request enters the top row as a 3px square and travels right at 90px/s.
// If it reaches the notch and its difficulty exceeds that tier's ceiling it
// SPILLS — one row down over 260ms with a 3px overshoot — and resumes on the
// next row. It comes to rest at x = difficulty on whichever row could hold it.
// Cost lives on the same geometry: a mono gutter per row with the accepted
// count, the cumulative spend, and a 1px bar scaled to the busiest row.
// There is no color coding anywhere — tier identity is row position and notch
// x, never hue. DOM + CSS only, one rAF loop shared by all in-flight glyphs.
// ---------------------------------------------------------------------------

export interface RouterTier {
  id: string;
  /** shown in the left column, e.g. "edge-2b" */
  label: string;
  /** cost ceiling as a 0..1 difficulty fraction — where this row's notch sits */
  ceiling: number;
  /** price per 1k tokens, in whatever currency the caller formats around */
  pricePer1k: number;
}

export interface RouterRequest {
  id: string;
  /** 0..1 — how hard the request is; also its resting x on the accepting row */
  difficulty: number;
  /** tokens billed for this request */
  tokens: number;
  /**
   * Advisory only. The component always derives the accepting row from the
   * LIVE ceilings, so dragging a notch re-routes settled traffic; a fixed
   * accepted tier would contradict that.
   */
  acceptedTier?: string;
}

export interface RouterTierCascadeProps {
  /** model tiers, cheapest first — one hairline row each */
  tiers: RouterTier[];
  /** the routed traffic; appending to this array is what animates a cascade */
  requests: RouterRequest[];
  /** ms for a settled tick to fade 1 -> 0.25 (default 45000) */
  decayMs?: number;
  /** fires when a notch is dragged or arrow-keyed to a new ceiling */
  onCeilingChange?: (tierId: string, ceiling: number) => void;
  /** formats a spend figure for the right gutter */
  formatCost?: (amount: number) => string;
  /** accessible name for the cascade */
  ariaLabel?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

const ROW_H = 34; // px, one tier
const TICK = 3; // px, settled tick
const TICK_HOVER = 5;
const LIP = 4; // px, notch lip height
const LIP_HOVER = 10;
const NOTCH_GAP = 10; // px cut out of the baseline
const SPILL_MS = 260;
const SPILL_SETTLE_MS = 60; // the last stretch, easing the 3px overshoot out
const OVERSHOOT = 3; // px
const SPEED = 90; // px/s rightward travel
const HOVER_TC = "0.16s";
const PULSE_MS = 3400;
const JITTER_MS = 180;
const CAP = 40; // FIFO settled ticks per row
const MIN_CEIL = 0.02;
const MAX_CEIL = 0.98;

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function snap(v: number) {
  return Math.round(clamp(v, MIN_CEIL, MAX_CEIL) * 100) / 100;
}

// cubic-bezier(0.33, 0, 0.15, 1) evaluated in JS — the spill uses the same
// curve the CSS re-cascade transition uses, so a drag-triggered re-route and a
// live arrival move identically.
function bezier(x1: number, y1: number, x2: number, y2: number, p: number) {
  const cx = (t: number) => ((1 - t) * (1 - t) * 3 * t * x1) + ((1 - t) * 3 * t * t * x2) + t * t * t;
  const cy = (t: number) => ((1 - t) * (1 - t) * 3 * t * y1) + ((1 - t) * 3 * t * t * y2) + t * t * t;
  let t = p;
  for (let i = 0; i < 6; i++) {
    const err = cx(t) - p;
    if (Math.abs(err) < 1e-5) break;
    const d = (cx(t + 1e-4) - cx(t - 1e-4)) / 2e-4;
    if (Math.abs(d) < 1e-6) break;
    t -= err / d;
    t = clamp(t, 0, 1);
  }
  return cy(t);
}

const SPILL_EASE = (p: number) => bezier(0.33, 0, 0.15, 1, clamp(p, 0, 1));

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

function defaultFormatCost(amount: number) {
  if (!Number.isFinite(amount)) return "$0";
  if (amount === 0) return "$0";
  if (amount >= 1) return `$${amount.toFixed(2)}`;
  return `$${amount.toFixed(4)}`;
}

interface Settled {
  id: string;
  difficulty: number;
  tokens: number;
  seq: number;
  /** ms of decay already elapsed when the tick first rendered (seeded batch) */
  aged: number;
}

interface Flight {
  id: string;
  difficulty: number;
  tokens: number;
  row: number;
  x: number; // normalized 0..1
  phase: "travel" | "spill";
  t0: number;
}

/** first tier whose ceiling can hold this difficulty; the last tier otherwise */
function acceptRow(difficulty: number, ceilings: number[]) {
  for (let i = 0; i < ceilings.length; i++) {
    if (difficulty <= ceilings[i]) return i;
  }
  return Math.max(0, ceilings.length - 1);
}

export function RouterTierCascade({
  tiers,
  requests,
  decayMs = 45000,
  onCeilingChange,
  formatCost = defaultFormatCost,
  ariaLabel = "Model routing cascade",
  className = "",
}: RouterTierCascadeProps) {
  const uid = useId();
  const reduced = useReducedMotion();

  const [ceilings, setCeilings] = useState<number[]>(() => tiers.map((t) => snap(t.ceiling)));
  const [settled, setSettled] = useState<Settled[]>([]);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [hover, setHover] = useState<number | null>(null);

  const ceilingsRef = useRef(ceilings);
  ceilingsRef.current = ceilings;

  // keep ceilings in sync when the caller genuinely changes the tier config,
  // without clobbering a ceiling the user just dragged
  const incomingSig = tiers.map((t) => `${t.id}:${t.ceiling}`).join("|");
  const prevSig = useRef(incomingSig);
  useEffect(() => {
    if (prevSig.current === incomingSig) return;
    prevSig.current = incomingSig;
    setCeilings(tiers.map((t) => snap(t.ceiling)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingSig]);

  const trackRef = useRef<HTMLDivElement | null>(null);
  const trackW = useRef(640);
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const read = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) trackW.current = w;
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---- intake -------------------------------------------------------------
  const seen = useRef<Set<string>>(new Set());
  const seq = useRef(0);
  const firstBatch = useRef(true);

  useEffect(() => {
    const fresh = requests.filter((r) => !seen.current.has(r.id));
    if (fresh.length === 0) return;
    fresh.forEach((r) => seen.current.add(r.id));

    // The first batch is history, not live traffic: it lands settled, and each
    // tick is pre-aged along the decay ramp in arrival order so the resting
    // frame reads as accumulated traffic rather than 40 simultaneous arrivals.
    const seeding = firstBatch.current;
    firstBatch.current = false;

    if (seeding || reduced) {
      setSettled((prev) => {
        const next = [...prev];
        fresh.forEach((r, i) => {
          next.push({
            id: r.id,
            difficulty: clamp(r.difficulty, 0, 1),
            tokens: Math.max(0, r.tokens),
            seq: seq.current++,
            aged: seeding ? (1 - (i + 1) / (fresh.length + 1)) * decayMs * 0.55 : 0,
          });
        });
        return next.slice(-CAP * Math.max(1, tiers.length));
      });
      return;
    }

    setFlights((prev) => [
      ...prev,
      ...fresh.map((r) => ({
        id: r.id,
        difficulty: clamp(r.difficulty, 0, 1),
        tokens: Math.max(0, r.tokens),
        row: 0,
        x: 0,
        phase: "travel" as const,
        t0: 0,
      })),
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests, reduced]);

  // ---- the cascade loop ---------------------------------------------------
  const flightRefs = useRef(new Map<string, HTMLDivElement>());
  const stateRef = useRef(new Map<string, Flight>());
  const rafRef = useRef(0);

  // mirror the React flight list into the mutable map the loop walks
  useEffect(() => {
    flights.forEach((f) => {
      if (!stateRef.current.has(f.id)) stateRef.current.set(f.id, { ...f });
    });
    const live = new Set(flights.map((f) => f.id));
    stateRef.current.forEach((_, id) => {
      if (!live.has(id)) stateRef.current.delete(id);
    });
  }, [flights]);

  const settle = useCallback((f: Flight) => {
    setSettled((prev) =>
      [...prev, { id: f.id, difficulty: f.difficulty, tokens: f.tokens, seq: seq.current++, aged: 0 }].slice(
        -CAP * 8
      )
    );
    setFlights((prev) => prev.filter((x) => x.id !== f.id));
  }, []);

  useEffect(() => {
    if (flights.length === 0 || reduced) return;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const cs = ceilingsRef.current;
      const speedNorm = SPEED / Math.max(1, trackW.current);
      const done: Flight[] = [];

      stateRef.current.forEach((f) => {
        const el = flightRefs.current.get(f.id);
        if (f.phase === "travel") {
          const ceil = cs[f.row] ?? 1;
          const lastRow = f.row >= cs.length - 1;
          const target = f.difficulty <= ceil || lastRow ? f.difficulty : ceil;
          f.x = Math.min(target, f.x + speedNorm * dt);
          if (f.x >= target - 1e-4) {
            f.x = target;
            if (f.difficulty <= ceil || lastRow) {
              done.push(f);
            } else {
              f.phase = "spill";
              f.t0 = now;
            }
          }
          if (el) {
            el.style.left = `${f.x * 100}%`;
            el.style.transform = `translate(-50%, calc(-50% + ${f.row * ROW_H}px))`;
          }
        } else {
          const p = clamp((now - f.t0) / SPILL_MS, 0, 1);
          const risePart = (SPILL_MS - SPILL_SETTLE_MS) / SPILL_MS;
          let dy: number;
          if (p < risePart) {
            dy = SPILL_EASE(p / risePart) * (ROW_H + OVERSHOOT);
          } else {
            const q = (p - risePart) / (1 - risePart);
            dy = ROW_H + OVERSHOOT - OVERSHOOT * q;
          }
          if (el) {
            el.style.transform = `translate(-50%, calc(-50% + ${f.row * ROW_H + dy}px))`;
          }
          if (p >= 1) {
            f.row += 1;
            f.phase = "travel";
            if (el) el.style.transform = `translate(-50%, calc(-50% + ${f.row * ROW_H}px))`;
          }
        }
      });

      done.forEach((f) => {
        stateRef.current.delete(f.id);
        settle(f);
      });
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [flights.length, reduced, settle]);

  // ---- derived rows -------------------------------------------------------
  const rows = useMemo(() => {
    const byRow: Settled[][] = tiers.map(() => []);
    settled.forEach((s) => {
      const r = acceptRow(s.difficulty, ceilings);
      byRow[Math.min(r, byRow.length - 1)]?.push(s);
    });
    return byRow.map((list, i) => {
      const kept = list.slice(-CAP);
      const price = tiers[i]?.pricePer1k ?? 0;
      const spend = kept.reduce((a, s) => a + (s.tokens / 1000) * price, 0);
      const per = kept.map((s) => (s.tokens / 1000) * price).sort((a, b) => a - b);
      const median =
        per.length === 0
          ? 0
          : per.length % 2
            ? per[(per.length - 1) / 2]
            : (per[per.length / 2 - 1] + per[per.length / 2]) / 2;
      return { ticks: kept, spend, median, count: kept.length };
    });
  }, [settled, ceilings, tiers]);

  const maxSpend = Math.max(1e-9, ...rows.map((r) => r.spend));
  const newestId = useMemo(() => {
    let best: Settled | null = null;
    settled.forEach((s) => {
      if (!best || s.seq > best.seq) best = s;
    });
    return (best as Settled | null)?.id ?? null;
  }, [settled]);

  // ---- notch drag / keyboard ---------------------------------------------
  const setCeiling = useCallback(
    (i: number, value: number) => {
      const v = snap(value);
      setCeilings((prev) => {
        if (prev[i] === v) return prev;
        const next = [...prev];
        next[i] = v;
        return next;
      });
      const tier = tiers[i];
      if (tier) onCeilingChange?.(tier.id, v);
    },
    [onCeilingChange, tiers]
  );

  const dragging = useRef<number | null>(null);
  const onNotchDown = (i: number) => (e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = i;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };
  const onNotchMove = (i: number) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragging.current !== i) return;
    const box = trackRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    setCeiling(i, (e.clientX - box.left) / box.width);
  };
  const onNotchUp = (i: number) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragging.current !== i) return;
    dragging.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };
  const onNotchKey = (i: number) => (e: React.KeyboardEvent<HTMLDivElement>) => {
    const c = ceilings[i] ?? 0;
    let next = c;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = c - 0.01;
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") next = c + 0.01;
    else if (e.key === "PageDown") next = c - 0.1;
    else if (e.key === "PageUp") next = c + 0.1;
    else if (e.key === "Home") next = MIN_CEIL;
    else if (e.key === "End") next = MAX_CEIL;
    else return;
    e.preventDefault();
    setCeiling(i, next);
  };

  const dimmed = (i: number) => hover !== null && hover !== i;

  return (
    <div className={className}>
      <style>{`
.ns-rtc-row{transition:opacity ${HOVER_TC} cubic-bezier(0.4,0,0.2,1)}
.ns-rtc-tick{transition:width ${HOVER_TC} cubic-bezier(0.4,0,0.2,1),height ${HOVER_TC} cubic-bezier(0.4,0,0.2,1),left 260ms cubic-bezier(0.33,0,0.15,1),transform 260ms cubic-bezier(0.33,0,0.15,1)}
.ns-rtc-lip{transition:height ${HOVER_TC} cubic-bezier(0.4,0,0.2,1)}
.ns-rtc-decay{animation:ns-rtc-fade linear forwards}
.ns-rtc-pulse{animation:ns-rtc-breathe ${PULSE_MS}ms ease-in-out infinite alternate}
.ns-rtc-bar{transition:width 400ms cubic-bezier(0.16,1,0.3,1)}
@keyframes ns-rtc-fade{from{opacity:1}to{opacity:0.25}}
@keyframes ns-rtc-breathe{from{opacity:0.55}to{opacity:1}}
@media (prefers-reduced-motion: reduce){
  .ns-rtc-tick,.ns-rtc-row,.ns-rtc-lip,.ns-rtc-bar{transition:none !important}
  .ns-rtc-decay,.ns-rtc-pulse{animation:none !important}
}
`}</style>

      <div role="group" aria-label={ariaLabel} className="w-full select-none">
        <div className="grid grid-cols-[112px_1fr_132px] items-baseline gap-x-3 pb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ns-muted">
          <span>tier</span>
          <span>difficulty spill &rarr;</span>
          <span className="text-right">accepted · spend</span>
        </div>

        <div className="border-t border-border pt-2" onPointerLeave={() => setHover(null)}>
          {tiers.map((tier, i) => {
            const c = ceilings[i] ?? 0;
            const row = rows[i] ?? { ticks: [], spend: 0, median: 0, count: 0 };
            const hot = hover === i;
            const size = hot ? TICK_HOVER : TICK;
            const lipH = hot ? LIP_HOVER : LIP;
            return (
              <div
                key={tier.id}
                data-tier-row={tier.id}
                className="ns-rtc-row grid grid-cols-[112px_1fr_132px] items-center gap-x-3"
                style={{ height: ROW_H, opacity: dimmed(i) ? 0.18 : 1 }}
                onPointerOver={() => setHover(i)}
                onPointerOut={(e) => {
                  const to = e.relatedTarget as Node | null;
                  if (!to || !e.currentTarget.contains(to)) setHover(null);
                }}
              >
                <div className="flex items-baseline gap-1.5 overflow-hidden font-mono text-[11px]">
                  <span className="truncate text-foreground">{tier.label}</span>
                  <span className="shrink-0 tabular-nums text-ns-muted">
                    {formatCost(tier.pricePer1k)}
                  </span>
                </div>

                {/* track: baseline + weir notch + settled ticks */}
                <div
                  ref={i === 0 ? trackRef : undefined}
                  className="relative h-full"
                  style={i === 0 ? { zIndex: 5 } : undefined}
                >
                  {/* baseline, cut by the notch */}
                  <div
                    className="absolute top-1/2 h-px bg-border"
                    style={{ left: 0, width: `calc(${c * 100}% - ${NOTCH_GAP / 2}px)` }}
                  />
                  <div
                    className="absolute top-1/2 right-0 h-px bg-border"
                    style={{ left: `calc(${c * 100}% + ${NOTCH_GAP / 2}px)` }}
                  />
                  {/* the two weir lips */}
                  <div
                    className="ns-rtc-lip absolute w-px bg-foreground"
                    style={{
                      left: `calc(${c * 100}% - ${NOTCH_GAP / 2}px)`,
                      height: lipH,
                      top: `calc(50% - ${lipH}px)`,
                    }}
                  />
                  <div
                    className="ns-rtc-lip absolute w-px bg-foreground"
                    style={{
                      left: `calc(${c * 100}% + ${NOTCH_GAP / 2}px)`,
                      height: lipH,
                      top: "50%",
                    }}
                  />

                  {/* settled ticks */}
                  {row.ticks.map((s) => {
                    const jitter = ((s.seq * 97) % (2 * JITTER_MS)) - JITTER_MS;
                    return (
                      <div
                        key={s.id}
                        className="ns-rtc-decay absolute top-1/2"
                        style={{
                          left: `${s.difficulty * 100}%`,
                          animationDuration: `${decayMs}ms`,
                          animationDelay: `${-s.aged}ms`,
                        }}
                      >
                        <div
                          className={
                            "ns-rtc-tick bg-foreground" +
                            (s.id === newestId ? " ns-rtc-pulse" : "")
                          }
                          style={{
                            width: size,
                            height: size,
                            marginLeft: -size / 2,
                            marginTop: -size / 2,
                            animationDelay: s.id === newestId ? `${jitter}ms` : undefined,
                          }}
                        />
                      </div>
                    );
                  })}

                  {/* in-flight glyphs live in row 0's track and translate down */}
                  {i === 0
                    ? flights.map((f) => (
                        <div
                          key={f.id}
                          ref={(el) => {
                            if (el) flightRefs.current.set(f.id, el);
                            else flightRefs.current.delete(f.id);
                          }}
                          data-flight
                          className="absolute top-1/2 bg-foreground"
                          style={{
                            left: 0,
                            width: TICK,
                            height: TICK,
                            transform: "translate(-50%, -50%)",
                          }}
                        />
                      ))
                    : null}

                  {/* the notch itself — a real slider */}
                  <div
                    role="slider"
                    tabIndex={0}
                    aria-label={`${tier.label} cost ceiling`}
                    aria-valuemin={MIN_CEIL}
                    aria-valuemax={MAX_CEIL}
                    aria-valuenow={c}
                    aria-valuetext={`${Math.round(c * 100)} percent difficulty`}
                    aria-orientation="horizontal"
                    aria-describedby={`${uid}-r${i}`}
                    onPointerDown={onNotchDown(i)}
                    onPointerMove={onNotchMove(i)}
                    onPointerUp={onNotchUp(i)}
                    onPointerCancel={onNotchUp(i)}
                    onKeyDown={onNotchKey(i)}
                    className="absolute top-0 h-full cursor-ew-resize rounded-[2px] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ns-accent"
                    style={{ left: `${c * 100}%`, width: 18, marginLeft: -9, touchAction: "none" }}
                  />
                </div>

                {/* cost gutter, same geometry as the routing */}
                <div className="flex flex-col items-end gap-1 font-mono text-[11px] tabular-nums">
                  <span className="flex items-baseline gap-2">
                    <span className="text-ns-muted">{row.count}</span>
                    <span className="text-foreground">
                      {hot ? `~${formatCost(row.median)}` : formatCost(row.spend)}
                    </span>
                  </span>
                  <span className="block h-px w-full bg-border">
                    <span
                      className="ns-rtc-bar block h-px bg-foreground"
                      style={{ width: `${(row.spend / maxSpend) * 100}%` }}
                    />
                  </span>
                </div>

                <span className="sr-only" id={`${uid}-r${i}`}>
                  {tier.label}: ceiling {Math.round(c * 100)} percent, {row.count} requests accepted,{" "}
                  {formatCost(row.spend)} spent.
                </span>
              </div>
            );
          })}
        </div>

        <p className="pt-2 font-mono text-[10px] text-ns-muted">
          {hover === null
            ? "each row spills at its notch — median per request on hover"
            : `${tiers[hover]?.label ?? ""} · median per request`}
        </p>
      </div>
    </div>
  );
}
