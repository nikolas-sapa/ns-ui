"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export interface GrainTallySample {
  /** Stable id — grains are keyed by it so the stack re-settles instead of re-rendering. */
  id: number | string;
  value: number;
}

export interface GrainTallyProps {
  /** Rolling window of samples, oldest first. Append new ones, shift old ones off. */
  samples: GrainTallySample[];
  /** Fixed domain. A live instrument needs a stable scale — auto-ranging makes every arrival move everything. */
  min?: number;
  /** upper bound of the fixed domain, paired with `min` */
  max?: number;
  /** number of histogram buckets across the domain */
  bins?: number;
  /** Unit suffix for readouts, e.g. "ms". */
  unit?: string;
  /** caption above the histogram */
  label?: string;
  /** px height of the plotted bars */
  height?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

// deterministic per-grain alpha so the heap has grain texture, not flat fill
function grainAlpha(id: number | string): number {
  const s = String(id);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return 0.5 + ((h >>> 0) % 1000) / 1000 * 0.4; // 0.5–0.9
}

function Grain({ x, y, w, h, alpha }: { x: number; y: number; w: number; h: number; alpha: number }) {
  // Falls from above the frame on mount, then every later target change
  // (stack re-settling as the window slides) rides the same transition.
  const [dropped, setDropped] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setDropped(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div
      aria-hidden
      className="absolute left-0 top-0 rounded-[1px] bg-foreground transition-transform duration-500 motion-reduce:transition-none"
      style={{
        width: w,
        height: Math.max(1, h - 1),
        opacity: alpha,
        transform: `translate(${x}px, ${dropped ? y : -14}px)`,
        transitionTimingFunction: "cubic-bezier(0.3, 1.25, 0.5, 1)",
      }}
    />
  );
}

/**
 * A live distribution instrument where the histogram IS the samples: each
 * arrival falls as a grain into its bin and stacks; when the rolling window
 * drops old samples the heap visibly re-settles. Quartile fences (P50/P90)
 * slide along the scale as the distribution shifts.
 */
export function GrainTally({
  samples,
  min = 0,
  max = 100,
  bins = 24,
  unit = "",
  label = "Distribution",
  height = 150,
  className = "",
}: GrainTallyProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [inspect, setInspect] = useState<number | null>(null);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const span = max - min || 1;
  const binOf = (v: number) => Math.min(bins - 1, Math.max(0, Math.floor(((v - min) / span) * bins)));

  const { grains, counts, p50, p90 } = useMemo(() => {
    const counts = new Array<number>(bins).fill(0);
    const grains = samples.map((s) => {
      const b = binOf(s.value);
      const stack = counts[b]++;
      return { id: s.id, bin: b, stack };
    });
    const sorted = samples.map((s) => s.value).sort((a, b) => a - b);
    return { grains, counts, p50: quantile(sorted, 0.5), p90: quantile(sorted, 0.9) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [samples, bins, min, max]);

  const maxCount = Math.max(1, ...counts);
  const cw = width / bins;
  const gh = Math.min(5, Math.max(1.5, height / (maxCount + 2))); // grains shrink before the heap clips
  const xOf = (v: number) => ((Math.min(max, Math.max(min, v)) - min) / span) * width;

  // sr-only summary, throttled — announcing every arrival is noise, not signal
  const [announce, setAnnounce] = useState("");
  const statsRef = useRef({ p50, p90, n: samples.length });
  statsRef.current = { p50, p90, n: samples.length };
  useEffect(() => {
    const t = setInterval(() => {
      const { p50, p90, n } = statsRef.current;
      if (n > 0) setAnnounce(`${label}: median ${Math.round(p50)}${unit}, 90th percentile ${Math.round(p90)}${unit}, ${n} samples.`);
    }, 4000);
    return () => clearInterval(t);
  }, [label, unit]);

  const last = samples[samples.length - 1];
  const binLo = (b: number) => Math.round(min + (b / bins) * span);
  const binHi = (b: number) => Math.round(min + ((b + 1) / bins) * span);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const dir = e.key === "ArrowRight" ? 1 : -1;
      setInspect((i) => Math.min(bins - 1, Math.max(0, (i ?? (last ? binOf(last.value) : 0)) + dir)));
    } else if (e.key === "Escape") {
      setInspect(null);
    }
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ns-muted">{label}</span>
        <span className="font-mono text-sm tabular-nums text-foreground">
          {last ? `${Math.round(last.value)}${unit}` : "—"}
          <span className="ml-1.5 text-[10px] uppercase tracking-widest text-ns-muted">last</span>
        </span>
      </div>
      <div
        ref={frameRef}
        role="group"
        aria-label={`${label} histogram. Arrow keys inspect bins.`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerMove={(e) => {
          const rect = frameRef.current!.getBoundingClientRect();
          setInspect(Math.min(bins - 1, Math.max(0, Math.floor(((e.clientX - rect.left) / rect.width) * bins))));
        }}
        onPointerLeave={() => setInspect(null)}
        className="relative w-full cursor-crosshair overflow-hidden rounded-sm border border-border bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
        style={{ height }}
      >
        {/* baseline the grains land on */}
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-border" />
        {inspect !== null && cw > 0 && (
          <div
            aria-hidden
            className="absolute bottom-0 top-0 bg-foreground/[0.05]"
            style={{ left: inspect * cw, width: cw }}
          />
        )}
        {width > 0 &&
          grains.map((g, i) => (
            <Grain
              key={g.id}
              x={g.bin * cw + 1}
              y={height - 1 - (g.stack + 1) * gh}
              w={Math.max(1, cw - 2)}
              h={gh}
              alpha={i === grains.length - 1 ? 1 : grainAlpha(g.id)}
            />
          ))}
        {/* percentile fences ride the same scale as the grains */}
        {width > 0 && samples.length > 1 && (
          <>
            {[
              { q: "P50", v: p50 },
              { q: "P90", v: p90 },
            ].map(({ q, v }) => (
              <div
                key={q}
                aria-hidden
                className="absolute bottom-0 top-0 transition-transform duration-500 ease-out motion-reduce:transition-none"
                style={{ transform: `translateX(${xOf(v)}px)` }}
              >
                <div className="h-full w-px bg-foreground/35" />
                <span className="absolute left-1 top-1 font-mono text-[9px] tracking-widest text-ns-muted">
                  {q}
                </span>
              </div>
            ))}
          </>
        )}
      </div>
      <div className="mt-1.5 flex items-baseline justify-between font-mono text-[10px] tabular-nums text-ns-muted">
        <span>
          {min}
          {unit}
        </span>
        <span className="text-foreground/80" aria-live="off">
          {inspect !== null
            ? `${binLo(inspect)}–${binHi(inspect)}${unit} · ${counts[inspect]} sample${counts[inspect] === 1 ? "" : "s"}`
            : `p50 ${Math.round(p50)}${unit} · p90 ${Math.round(p90)}${unit} · n ${samples.length}`}
        </span>
        <span>
          {max}
          {unit}
        </span>
      </div>
      <span role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </div>
  );
}
