"use client";

import { useEffect, useId, useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// SolventFront — a part-of-whole breakdown drawn as paper chromatography.
// Every band starts stacked on the SAME baseline position, so at rest they
// render as one solid, blurred bar — the "opaque spot" the brief asks for —
// with no separate blob element required. A boolean flip (`started`, after a
// short hold) transitions every band's `top` from that shared baseline to its
// own target height in one CSS transition per element; no rAF loop drives
// position. The front line and the wet-tint backdrop share that same
// transition (ease-out-expo, matching this registry's existing
// cubic-bezier(0.16,1,0.3,1) convention), so the boundary and the tint always
// stay in lockstep. Bands use a bouncier spring easing so they visibly settle
// once the front has already climbed past their own height — "outrunning"
// them, per the brief.
//
// Distinct from chart-funnel-stage-drop (discrete stages ARRIVE in sequence)
// and litmus-wick (wicking is progress/pass-fail only): here nothing arrives
// and there is no pass/fail — one total resolves into its shares, and the
// resolving motion IS the chart.
// ---------------------------------------------------------------------------

export interface SolventBand {
  id: string;
  label: string;
  value: number;
}

export interface SolventFrontProps {
  /** grand total; defaults to the sum of `bands` values */
  total?: number;
  bands?: SolventBand[];
  title?: string;
  /** value prefix, e.g. "$" */
  unit?: string;
  decimals?: number;
  className?: string;
}

const DEFAULT_BANDS: SolventBand[] = [
  { id: "output", label: "Output tokens", value: 37.8 },
  { id: "input", label: "Input tokens", value: 25.2 },
  { id: "cache-write", label: "Cache write", value: 12.6 },
  { id: "cache-read", label: "Cache read", value: 8.4 },
];

const RULER_W = 30;
const GAP_1 = 10;
const STRIP_W = 44;
const GAP_2 = 14;
const LABEL_W = 152;
const STRIP_H = 288;
const BAND_H = 8; // visible band thickness
const HIT_H = 18; // focusable hit target height, centred on the band
const DIAGRAM_W = RULER_W + GAP_1 + STRIP_W + GAP_2 + LABEL_W;

const HOLD_MS = 500; // the un-separated whole sits still before anything splits
const RISE_MS = 1600;
const FRONT_EASE = "cubic-bezier(0.16, 1, 0.3, 1)"; // ease-out-expo
const BAND_EASE = "cubic-bezier(0.34, 1.56, 0.64, 1)"; // soft spring settle

const TICKS = [0, 25, 50, 75, 100];

function easeOutExpo(x: number): number {
  return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

function formatValue(v: number, unit: string, decimals: number): string {
  return `${unit}${v.toFixed(decimals)}`;
}

/** top offset (px, from the strip's own top edge) where a band of this share settles */
function targetTop(share: number): number {
  return STRIP_H * (1 - share) - BAND_H / 2;
}

const baselineTop = STRIP_H - BAND_H / 2;

export function SolventFront({
  total,
  bands: bandsProp,
  title = "LLM bill",
  unit = "$",
  decimals = 2,
  className = "",
}: SolventFrontProps) {
  const rawId = useId();
  const fid = rawId.replace(/[^a-zA-Z0-9-]/g, "");
  const dlId = `${fid}-legend`;

  const bands = useMemo(() => {
    const src = bandsProp && bandsProp.length > 0 ? bandsProp : DEFAULT_BANDS;
    const sum = total ?? src.reduce((s, b) => s + b.value, 0);
    return [...src]
      .sort((a, b) => b.value - a.value)
      .map((b) => ({ ...b, share: sum > 0 ? b.value / sum : 0 }));
  }, [bandsProp, total]);

  const grandTotal = total ?? bands.reduce((s, b) => s + b.value, 0);

  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const [started, setStarted] = useState(reduced);
  const [revealT, setRevealT] = useState(reduced ? 1 : 0);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (reduced) {
      setStarted(true);
      setRevealT(1);
      return;
    }
    setStarted(false);
    setRevealT(0);
    const t = window.setTimeout(() => setStarted(true), HOLD_MS);
    return () => window.clearTimeout(t);
    // re-run the whole entrance if the reduced-motion preference itself flips
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  useEffect(() => {
    if (!started || reduced) return;
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const x = Math.min(1, (now - t0) / RISE_MS);
      setRevealT(easeOutExpo(x));
      if (x < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [started, reduced]);

  const activeBand = active ? bands.find((b) => b.id === active) ?? null : null;
  const activeCenterY = activeBand ? targetTop(activeBand.share) + BAND_H / 2 : 0;

  return (
    <figure
      className={`ns-solvent-front inline-block font-mono ${className}`}
      aria-label={`${title}, chromatographic breakdown of ${formatValue(grandTotal, unit, decimals)}`}
      aria-describedby={dlId}
    >
      <style>{CSS}</style>

      <figcaption className="mb-4 flex items-baseline justify-between gap-4">
        <span className="text-xs tracking-widest text-ns-muted">{title.toUpperCase()}</span>
        <span className="text-sm font-medium tabular-nums text-foreground">
          {formatValue(grandTotal, unit, decimals)}
        </span>
      </figcaption>

      <div className="ns-solvent-front-diagram relative" style={{ width: DIAGRAM_W, maxWidth: "100%", height: STRIP_H }}>
        {/* ruler — decorative, the real numbers live in the <dl> below */}
        <div aria-hidden className="absolute left-0 top-0" style={{ width: RULER_W, height: STRIP_H }}>
          {TICKS.map((tv) => {
            const y = STRIP_H * (1 - tv / 100);
            return (
              <div key={tv} className="absolute right-0 flex items-center gap-1" style={{ top: y, transform: "translateY(-50%)" }}>
                <span className="text-[9px] leading-none text-ns-muted tabular-nums">{tv}</span>
                <span className="block h-px w-1.5" style={{ background: "var(--border)" }} />
              </div>
            );
          })}
        </div>

        {/* the strip itself: 1px border box on --background */}
        <div
          aria-hidden
          className="absolute overflow-hidden border border-border"
          style={{ left: RULER_W + GAP_1, top: 0, width: STRIP_W, height: STRIP_H }}
        >
          <div
            className="ns-solvent-front-wet absolute inset-x-0 bottom-0"
            style={{
              top: started ? 0 : STRIP_H,
              background: "color-mix(in srgb, var(--foreground) 2%, var(--background))",
              transition: reduced ? "none" : `top ${RISE_MS}ms ${FRONT_EASE}`,
            }}
          />
          <div
            className="ns-solvent-front-line absolute inset-x-0"
            style={{
              top: started ? 0 : STRIP_H,
              height: 1,
              background: "var(--foreground)",
              transition: reduced ? "none" : `top ${RISE_MS}ms ${FRONT_EASE}`,
            }}
          />
        </div>

        {/* bands — real, focusable controls, DOM order = descending value */}
        {bands.map((b) => {
          const top = (started ? targetTop(b.share) : baselineTop) - (HIT_H - BAND_H) / 2;
          return (
            <button
              key={b.id}
              type="button"
              className="ns-solvent-front-band absolute cursor-pointer border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
              style={{
                left: RULER_W + GAP_1,
                width: STRIP_W,
                height: HIT_H,
                top,
                transition: reduced ? "none" : `top ${RISE_MS}ms ${BAND_EASE}`,
              }}
              aria-label={`${b.label}: ${formatValue(b.value, unit, decimals)}, ${(b.share * 100).toFixed(1)}% of total`}
              aria-describedby={`${fid}-dd-${b.id}`}
              onPointerEnter={() => setActive(b.id)}
              onPointerLeave={() => setActive((c) => (c === b.id ? null : c))}
              onFocus={() => setActive(b.id)}
              onBlur={() => setActive((c) => (c === b.id ? null : c))}
            >
              <span
                aria-hidden
                className="ns-solvent-front-band-fill absolute inset-x-0"
                style={{ top: (HIT_H - BAND_H) / 2, height: BAND_H }}
              />
            </button>
          );
        })}

        {/* inline labels — decorative duplicate of the <dl>, values tick up with revealT */}
        {bands.map((b) => {
          const top = (started ? targetTop(b.share) : baselineTop) + BAND_H / 2;
          const shown = b.value * revealT;
          return (
            <div
              key={b.id}
              aria-hidden
              className="absolute flex flex-col leading-tight"
              style={{
                left: RULER_W + GAP_1 + STRIP_W + GAP_2,
                width: LABEL_W,
                top,
                transform: "translateY(-50%)",
                opacity: started ? 1 : 0,
                transition: reduced ? "none" : `top ${RISE_MS}ms ${BAND_EASE}, opacity 420ms ease-out`,
              }}
            >
              <span className="truncate text-[10px] tracking-wide text-ns-muted">{b.label}</span>
              <span className="text-xs tabular-nums text-foreground">{formatValue(shown, unit, decimals)}</span>
            </div>
          );
        })}

        {/* retention-height projection onto the ruler, on hover/focus of a band */}
        {activeBand && (
          <>
            <div
              aria-hidden
              className="ns-solvent-front-projection pointer-events-none absolute border-t border-dashed"
              style={{
                left: 0,
                width: RULER_W + GAP_1 + STRIP_W,
                top: activeCenterY,
                borderColor: "var(--ns-accent)",
              }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute rounded-full"
              style={{
                left: RULER_W - 4,
                top: activeCenterY - 3,
                width: 6,
                height: 6,
                background: "var(--ns-accent)",
              }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute whitespace-nowrap text-[10px] tabular-nums"
              style={{
                left: 0,
                width: RULER_W - 8,
                top: activeCenterY,
                transform: "translateY(-50%)",
                textAlign: "right",
                color: "var(--ns-accent)",
              }}
            >
              {(activeBand.share * 100).toFixed(0)}%
            </div>
          </>
        )}
      </div>

      {/* the real data: exists as text from mount, independent of the animation */}
      <dl id={dlId} className="mt-4 space-y-1 text-[11px] leading-relaxed text-ns-muted" style={{ width: DIAGRAM_W, maxWidth: "100%" }}>
        {bands.map((b) => (
          <div key={b.id} className="flex items-baseline justify-between gap-3">
            <dt className="truncate">{b.label}</dt>
            <dd id={`${fid}-dd-${b.id}`} className="shrink-0 tabular-nums text-foreground">
              {formatValue(b.value, unit, decimals)} · {(b.share * 100).toFixed(1)}%
            </dd>
          </div>
        ))}
      </dl>
    </figure>
  );
}

const CSS = `
.ns-solvent-front-band-fill::before {
  content: "";
  position: absolute;
  inset: 0;
  background: var(--foreground);
  filter: blur(1px);
  transition: background 150ms ease-out;
}
.ns-solvent-front-band:hover .ns-solvent-front-band-fill::before,
.ns-solvent-front-band:focus-visible .ns-solvent-front-band-fill::before { background: var(--ns-accent); }
.ns-solvent-front-projection { opacity: 0.9; }
@media (prefers-reduced-motion: reduce) {
  .ns-solvent-front-band-fill::before { transition: none; }
}
`;
