"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// CruetSettle — a checkout/invoice total rendered as shaken vinaigrette
// settling in a narrow vessel. On mount, and again on any change to the
// line amounts, the full sum appears as one agitated, undifferentiated
// column (a single dithered SVG rect), then a single 900ms ease-out-expo
// timeline moves every internal boundary from a hash-shuffled start
// position to its sorted final y — final layer height is exactly
// amount_i / grossSum of the column, grossSum being the sum of every
// line's magnitude (so a "discount" line still claims its proportional
// slice of the column instead of shrinking it, which is what keeps the
// outer column height CONSERVED through the whole settle: only interior
// boundaries move, the vessel itself never resizes).
//
// The shuffled start positions come from an integer-only hash (Math.imul,
// no trig, no Math.random) seeded by boundary index and a shake counter
// that starts at 0 — identical on server and first client render, so
// hydration never mismatches; the counter then bumps on every subsequent
// reshake, which is purely a client-side event.
//
// There is deliberately no per-layer stagger: every boundary moves on the
// SAME timeline (a single CSS transition on each band's `d`, the exact
// technique meniscus-meter already uses for its curve), because a
// staggered entrance would imply the layers existed separately before the
// total and then arrived — the semantic here is one sum decomposing into
// parts it was always made of, not parts assembling into a sum.
//
// The <dl> beside the vessel is the real, primary content; the vessel and
// its ruled-out mono labels are a redundant, aria-hidden diagram. Hovering
// or focusing a dl row (each row is a focusable, aria-labelled group)
// highlights the matching band with --ns-accent, so keyboard users get the
// identical coupling pointer users get. A subtract-kind line (a discount)
// renders as a hatched void instead of a solid band — still claiming its
// share of column height, visibly a deduction rather than a fourth
// ingredient. The tax line's own band carries a fine tick ladder so its
// fraction of the column reads as a level, not just a stripe.
// ---------------------------------------------------------------------------

export type CruetSettleLineKind = "add" | "subtract";

export interface CruetSettleLine {
  /** stable identity — also drives which line gets the tax tick ladder ("tax"/"vat" in key or label) */
  key: string;
  /** shown as the dl term and the vessel's ruled-out label */
  label: string;
  /** magnitude in the same unit as every other line — always >= 0, sign comes from `kind` */
  amount: number;
  /** "add" (default) builds the total; "subtract" is a deduction (discount, credit) */
  kind?: CruetSettleLineKind;
}

export interface CruetSettleProps {
  /** ordered breakdown lines; net first and discount last reads most naturally */
  lines?: CruetSettleLine[];
  /** prefix before every formatted amount */
  currency?: string;
  /** heading above the breakdown */
  label?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

const DEFAULT_LINES: CruetSettleLine[] = [
  { key: "net", label: "Net", amount: 605 },
  { key: "tax", label: "VAT 20%", amount: 121 },
  { key: "fees", label: "Card fee", amount: 12.5 },
  { key: "discount", label: "Promo SAVE45", amount: 45, kind: "subtract" },
];

const VIEW_W = 220;
const VIEW_H = 196;
const WALL_L = 26;
const WALL_R = 50;
const TOP_Y = 16;
const BOTTOM_Y = 172;
const LABEL_X = 62;
const CELL = 2;
const LEVELS = 12;
const SETTLE_MS = 900;

// 4x4 ordered-dither matrix, the same one background-ascii-dither /
// chart-bar-halftone / chart-donut-halftone already use — duplicated
// verbatim so this vessel's density reads at the same visual weight.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

// integer-only hash: no trig, no Math.random, so the same (seed, index)
// pair produces the byte-identical float on the server and on first
// client render — required for the agitated start frame to hydrate clean.
function hash01(seed: number): number {
  let x = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35) >>> 0;
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

function fmtAmount(n: number, currency: string): string {
  return `${currency}${Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function isTaxLine(line: CruetSettleLine): boolean {
  return /tax|vat/i.test(line.key) || /tax|vat/i.test(line.label);
}

function bandPath(yA: number, yB: number, xL: number, xR: number): string {
  const top = Math.min(yA, yB);
  const bottom = Math.max(yA, yB);
  return `M ${xL} ${top} L ${xR} ${top} L ${xR} ${bottom} L ${xL} ${bottom} Z`;
}

function finalBoundaries(lines: CruetSettleLine[]): number[] {
  const gross = lines.reduce((s, l) => s + Math.max(0, l.amount), 0) || 1;
  const h = BOTTOM_Y - TOP_Y;
  const out = [TOP_Y];
  let acc = 0;
  for (const l of lines) {
    acc += Math.max(0, l.amount);
    out.push(TOP_Y + (acc / gross) * h);
  }
  out[out.length - 1] = BOTTOM_Y;
  return out;
}

function shuffledBoundaries(count: number, seed: number): number[] {
  const out = [TOP_Y];
  for (let i = 1; i < count; i++) {
    const r = hash01(seed * 1013 + i * 97 + 31);
    out.push(TOP_Y + r * (BOTTOM_Y - TOP_Y));
  }
  out.push(BOTTOM_Y);
  return out;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

export function CruetSettle({
  lines = DEFAULT_LINES,
  currency = "$",
  label = "Total",
  className = "",
}: CruetSettleProps) {
  const uid = useId().replace(/[:]/g, "");
  const reduced = useReducedMotion();

  const linesKey = useMemo(
    () => lines.map((l) => `${l.key}:${l.amount}:${l.kind ?? "add"}`).join("|"),
    [lines]
  );

  const [phase, setPhase] = useState<"agitated" | "settled">("agitated");
  const [shakeSeed, setShakeSeed] = useState(0);
  const mountedRef = useRef(false);
  const rafRef = useRef<number[]>([]);

  useEffect(() => {
    rafRef.current.forEach((id) => cancelAnimationFrame(id));
    rafRef.current = [];

    if (reduced) {
      setPhase("settled");
      mountedRef.current = true;
      return;
    }

    if (mountedRef.current) setShakeSeed((s) => s + 1);
    mountedRef.current = true;
    setPhase("agitated");

    const r1 = requestAnimationFrame(() => {
      const r2 = requestAnimationFrame(() => setPhase("settled"));
      rafRef.current.push(r2);
    });
    rafRef.current.push(r1);

    return () => rafRef.current.forEach((id) => cancelAnimationFrame(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linesKey, reduced]);

  const finalB = useMemo(() => finalBoundaries(lines), [lines]);
  const startB = useMemo(() => shuffledBoundaries(lines.length, shakeSeed), [lines.length, shakeSeed]);
  const activeB = phase === "settled" ? finalB : startB;

  const addSum = lines.reduce((s, l) => (l.kind === "subtract" ? s : s + l.amount), 0);
  const subtractSum = lines.reduce((s, l) => (l.kind === "subtract" ? s + l.amount : s), 0);
  const total = addSum - subtractSum;

  const addLines = lines.filter((l) => l.kind !== "subtract");

  const [activeKey, setActiveKey] = useState<string | null>(null);

  const [announce, setAnnounce] = useState("");
  const prevTotalRef = useRef(total);
  useEffect(() => {
    if (prevTotalRef.current !== total) {
      setAnnounce(`${label} updated to ${fmtAmount(total, currency)}`);
      prevTotalRef.current = total;
    }
  }, [total, label, currency]);

  const taxIndex = lines.findIndex(isTaxLine);
  const taxTicks: number[] = [];
  if (taxIndex >= 0) {
    const yTop = finalB[taxIndex];
    const yBottom = finalB[taxIndex + 1];
    const h = yBottom - yTop;
    if (h > 10) {
      const N = 4;
      for (let k = 1; k <= N; k++) taxTicks.push(yTop + (k / (N + 1)) * h);
    }
  }

  return (
    <div className={className}>
      <style>{CSS}</style>

      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[11px] tracking-widest text-ns-muted">{label.toUpperCase()}</span>
        <span className="font-mono text-[11px] tracking-widest text-ns-muted">
          {lines.length} LINE{lines.length === 1 ? "" : "S"}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-start gap-6">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          width={VIEW_W}
          height={VIEW_H}
          aria-hidden="true"
          focusable="false"
          className="ns-cs-svg shrink-0"
        >
          <defs>
            <pattern
              id={`${uid}-agitate`}
              x={0}
              y={0}
              width={CELL * 4}
              height={CELL * 4}
              patternUnits="userSpaceOnUse"
            >
              {BAYER.map((b, i) =>
                b < 6 ? (
                  <rect
                    key={i}
                    x={(i % 4) * CELL}
                    y={Math.floor(i / 4) * CELL}
                    width={CELL}
                    height={CELL}
                    fill="var(--foreground)"
                  />
                ) : null
              )}
            </pattern>

            <pattern id={`${uid}-hatch`} x={0} y={0} width={6} height={6} patternUnits="userSpaceOnUse">
              <path d="M0,6 L6,0" stroke="var(--ns-muted)" strokeWidth={1} />
            </pattern>

            {addLines.map((l, i) => {
              const rank = addLines.length <= 1 ? LEVELS : Math.round((i / (addLines.length - 1)) * LEVELS);
              const level = Math.max(3, rank);
              return (
                <pattern
                  key={l.key}
                  id={`${uid}-p-${l.key}`}
                  x={0}
                  y={0}
                  width={CELL * 4}
                  height={CELL * 4}
                  patternUnits="userSpaceOnUse"
                >
                  {BAYER.map((b, bi) =>
                    b < level ? (
                      <rect
                        key={bi}
                        x={(bi % 4) * CELL}
                        y={Math.floor(bi / 4) * CELL}
                        width={CELL}
                        height={CELL}
                        fill="var(--foreground)"
                      />
                    ) : null
                  )}
                </pattern>
              );
            })}
          </defs>

          {/* the agitated, undifferentiated mass — the whole amount before it stratifies */}
          <rect
            x={WALL_L}
            y={TOP_Y}
            width={WALL_R - WALL_L}
            height={BOTTOM_Y - TOP_Y}
            fill={`url(#${uid}-agitate)`}
            className="ns-cs-agitate"
            style={{ opacity: phase === "agitated" ? 1 : 0 }}
          />

          {/* stratified bands — each boundary eases from its shuffled start to its final y */}
          {lines.map((l, i) => {
            const isSub = l.kind === "subtract";
            const fill = isSub ? `url(#${uid}-hatch)` : `url(#${uid}-p-${l.key})`;
            const active = activeKey === l.key;
            return (
              <path
                key={l.key}
                d={bandPath(activeB[i], activeB[i + 1], WALL_L, WALL_R)}
                fill={fill}
                fillOpacity={isSub ? 0.7 : 1}
                stroke={active ? "var(--ns-accent)" : "none"}
                strokeWidth={active ? 1.5 : 0}
                className="ns-cs-band"
                style={{ opacity: phase === "agitated" ? 0 : 1 }}
              />
            );
          })}

          {/* 1px meniscus rules between layers */}
          {lines.slice(0, -1).map((l, i) => (
            <path
              key={`rule-${l.key}`}
              d={`M ${WALL_L} ${activeB[i + 1]} L ${WALL_R} ${activeB[i + 1]}`}
              stroke="var(--border)"
              strokeWidth={1}
              className="ns-cs-rule"
              style={{ opacity: phase === "agitated" ? 0 : 1 }}
            />
          ))}

          {/* vessel frame */}
          <line x1={WALL_L} x2={WALL_L} y1={TOP_Y} y2={BOTTOM_Y} stroke="var(--border)" strokeWidth={1.5} />
          <line x1={WALL_R} x2={WALL_R} y1={TOP_Y} y2={BOTTOM_Y} stroke="var(--border)" strokeWidth={1.5} />
          <line x1={WALL_L} x2={WALL_R} y1={BOTTOM_Y} y2={BOTTOM_Y} stroke="var(--border)" strokeWidth={1.5} />

          {/* fine tick ladder on the tax band, so its fraction reads as a level */}
          {taxTicks.map((y, i) => (
            <path
              key={`tick-${i}`}
              d={`M ${WALL_L - 5} ${y} L ${WALL_L - 1} ${y}`}
              stroke="var(--ns-muted)"
              strokeWidth={1}
              opacity={0.6}
            />
          ))}

          {/* leader rules — point out to the real, primary labels in the dl beside the vessel */}
          {lines.map((l, i) => {
            const cy = (finalB[i] + finalB[i + 1]) / 2;
            return (
              <path
                key={`leader-${l.key}`}
                d={`M ${WALL_R} ${cy} L ${LABEL_X} ${cy}`}
                stroke="var(--border)"
                strokeWidth={1}
                className="ns-cs-leader"
                style={{ opacity: phase === "agitated" ? 0 : 1 }}
              />
            );
          })}
        </svg>

        <dl className="ns-cs-dl min-w-[9rem] flex-1 font-mono text-xs">
          {lines.map((l) => (
            <div
              key={l.key}
              className="ns-cs-row flex items-baseline justify-between gap-3 rounded-sm px-1 py-1"
              tabIndex={0}
              onPointerEnter={() => setActiveKey(l.key)}
              onPointerLeave={() => setActiveKey((c) => (c === l.key ? null : c))}
              onFocus={() => setActiveKey(l.key)}
              onBlur={() => setActiveKey((c) => (c === l.key ? null : c))}
            >
              <dt className="text-ns-muted">{l.label}</dt>
              <dd className="tabular-nums text-foreground">
                {l.kind === "subtract" ? "−" : ""}
                {fmtAmount(l.amount, currency)}
              </dd>
            </div>
          ))}
          <div className="ns-cs-foot mt-1 flex items-baseline justify-between gap-3 border-t border-border px-1 pt-2">
            <dt className="font-semibold text-foreground">{label}</dt>
            <dd className="font-semibold tabular-nums text-foreground">{fmtAmount(total, currency)}</dd>
          </div>
        </dl>
      </div>

      <span role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </div>
  );
}

const CSS = `
.ns-cs-band, .ns-cs-rule, .ns-cs-agitate, .ns-cs-leader { transition: d ${SETTLE_MS}ms cubic-bezier(0.16,1,0.3,1), opacity ${SETTLE_MS}ms cubic-bezier(0.16,1,0.3,1), stroke 150ms ease-out; }
.ns-cs-row { cursor: default; transition: background-color 150ms ease-out; }
.ns-cs-row:hover { background-color: color-mix(in srgb, var(--foreground) 6%, transparent); }
.ns-cs-row:focus-visible { outline: 2px solid var(--ns-accent); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  .ns-cs-band, .ns-cs-rule, .ns-cs-agitate, .ns-cs-leader { transition: none; }
}
`;
