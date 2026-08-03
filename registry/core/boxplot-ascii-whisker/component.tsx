"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// BoxplotAsciiWhisker — the registry's first distribution instrument.
// Nearest neighbours: histogram-live-grain tallies a rolling window into
// fixed bins, stem-and-leaf-live keeps every raw digit in ascending stem
// rows, chart-ridgeline-terrain renders many distributions as overlapping
// density silhouettes — none of the three computes quartiles, a fence, or
// classifies individual samples as outliers.
//
// The mechanic: ONE shared fence handle — a real <input type="range">,
// visually replaced by a custom track/thumb the way slider-range-shear
// carries its a11y — controls k, the IQR multiplier that defines the
// whisker fence (Q1 - k*IQR .. Q3 + k*IQR) for every box on the chart at
// once. Dragging or keying it re-cuts the whisker caps live against the
// REAL underlying sample (not a cached summary): the farthest sample still
// inside the fence becomes the new whisker end, and every sample outside it
// renders as an outlier glyph that fades in; a sample that re-enters the
// fence as k grows fades back into the whisker instead of vanishing. Box
// bodies are filled with the family's shared ASCII ramp ' .:-=+*#%@' tiled
// at a constant mid density — box height already encodes the interquartile
// spread, so ink here is texture, not a second value channel — pure
// var(--foreground), var(--accent) reserved for the focused/hovered group
// and the fence handle itself.
// ---------------------------------------------------------------------------

const RAMP = " .:-=+*#%@";
const BOX_CH = RAMP[6];

export interface BoxplotGroup {
  label: string;
  samples: number[];
}

export interface BoxplotAsciiWhiskerProps {
  groups?: BoxplotGroup[];
  title?: string;
  className?: string;
}

// deterministic synthetic samples — three clearly fabricated batches
function defaultGroups(): BoxplotGroup[] {
  let seed = 11;
  const rand = () => {
    seed = (seed * 48271) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const gauss = (mean: number, sd: number) => {
    let u = 0;
    let v = 0;
    while (u === 0) u = rand();
    while (v === 0) v = rand();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const make = (mean: number, sd: number, n: number, outliers: number[]) => {
    const out: number[] = [];
    for (let i = 0; i < n; i++) out.push(Math.round(gauss(mean, sd) * 10) / 10);
    return out.concat(outliers);
  };
  return [
    { label: "Batch A", samples: make(40, 6, 34, [12, 68]) },
    { label: "Batch B", samples: make(52, 9, 34, [18, 22, 96]) },
    { label: "Batch C", samples: make(34, 4, 34, [55]) },
  ];
}

function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = p * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

const K_MIN = 0.5;
const K_MAX = 3;
const K_STEP = 0.1;

interface GroupStats {
  label: string;
  sorted: number[];
  q1: number;
  median: number;
  q3: number;
  iqr: number;
  // samples that are outliers at the tightest possible fence (k = K_MIN) —
  // the maximal candidate pool across the whole draggable range
  candidates: number[];
}

function computeStats(g: BoxplotGroup): GroupStats {
  const sorted = [...g.samples].sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25);
  const median = quantile(sorted, 0.5);
  const q3 = quantile(sorted, 0.75);
  const iqr = Math.max(1e-6, q3 - q1);
  const lowAtMin = q1 - K_MIN * iqr;
  const highAtMin = q3 + K_MIN * iqr;
  const candidates = sorted.filter((v) => v < lowAtMin || v > highAtMin);
  return { label: g.label, sorted, q1, median, q3, iqr, candidates };
}

interface Tokens {
  fg: string;
  bg: string;
  muted: string;
  border: string;
  accent: string;
}

function readTokens(): Tokens {
  const cs = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    fg: get("--foreground", "#171717"),
    bg: get("--background", "#ffffff"),
    muted: get("--muted", "#4d4d4d"),
    border: get("--border", "#ebebeb"),
    accent: get("--accent", "#006bff"),
  };
}

function useTokens(): Tokens {
  const [tokens, setTokens] = useState<Tokens>(() =>
    typeof document === "undefined"
      ? { fg: "#171717", bg: "#ffffff", muted: "#4d4d4d", border: "#ebebeb", accent: "#006bff" }
      : readTokens()
  );
  useEffect(() => {
    const sync = () => setTokens(readTokens());
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });
    return () => mo.disconnect();
  }, []);
  return tokens;
}

const GROUP_W = 110;
const BOX_W = 46;
const PLOT_H = 220;
const TOP_PAD = 16;
const BOTTOM_PAD = 30;
const LEFT_PAD = 40;
const RIGHT_PAD = 16;

export function BoxplotAsciiWhisker({ groups, title = "Chart", className = "" }: BoxplotAsciiWhiskerProps) {
  const data = useMemo(() => groups ?? defaultGroups(), [groups]);
  const stats = useMemo(() => data.map(computeStats), [data]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tokens = useTokens();
  const [k, setK] = useState(1.5);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const uidRef = useRef(`baw-${Math.random().toString(36).slice(2, 8)}`);
  const uid = uidRef.current;
  const trackRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const globalMin = useMemo(() => Math.min(...stats.map((s) => s.sorted[0] ?? 0)), [stats]);
  const globalMax = useMemo(() => Math.max(...stats.map((s) => s.sorted[s.sorted.length - 1] ?? 0)), [stats]);
  const span = Math.max(1e-6, globalMax - globalMin);
  const pad = span * 0.08;
  const domainMin = globalMin - pad;
  const domainMax = globalMax + pad;
  const domainSpan = domainMax - domainMin;

  const n = stats.length;
  const viewW = LEFT_PAD + n * GROUP_W + RIGHT_PAD;
  const viewH = TOP_PAD + PLOT_H + BOTTOM_PAD;
  const valueToY = (v: number) => TOP_PAD + PLOT_H - ((v - domainMin) / domainSpan) * PLOT_H;

  const cuts = useMemo(
    () =>
      stats.map((s) => {
        const lowFence = s.q1 - k * s.iqr;
        const highFence = s.q3 + k * s.iqr;
        const within = s.sorted.filter((v) => v >= lowFence && v <= highFence);
        const whiskerLow = within.length ? within[0] : s.q1;
        const whiskerHigh = within.length ? within[within.length - 1] : s.q3;
        const outliers = s.candidates.filter((v) => v < lowFence || v > highFence);
        return { whiskerLow, whiskerHigh, outliers };
      }),
    [stats, k]
  );

  // animated display state: per-group whisker ends lerp toward target;
  // per-candidate alpha lerps toward 1 (outlier) or 0 (reclassified inlier)
  const displayWhiskerRef = useRef<{ lo: number; hi: number }[]>([]);
  const alphaRef = useRef<number[][]>([]);
  const rafRef = useRef(0);

  useEffect(() => {
    if (displayWhiskerRef.current.length !== n) {
      displayWhiskerRef.current = cuts.map((c) => ({ lo: c.whiskerLow, hi: c.whiskerHigh }));
    }
    if (alphaRef.current.length !== n) {
      alphaRef.current = stats.map((s) => s.candidates.map(() => 0));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, stats]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = viewW * dpr;
    canvas.height = viewH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const draw = () => {
      ctx.clearRect(0, 0, viewW, viewH);

      ctx.strokeStyle = tokens.border;
      ctx.lineWidth = 1;
      [0, 0.25, 0.5, 0.75, 1].forEach((f) => {
        const y = Math.round(TOP_PAD + PLOT_H * f) + 0.5;
        ctx.beginPath();
        ctx.moveTo(LEFT_PAD, y);
        ctx.lineTo(viewW - RIGHT_PAD, y);
        ctx.stroke();
      });
      ctx.fillStyle = tokens.muted;
      ctx.font = `9px "GeistMono", ui-monospace, monospace`;
      ctx.textAlign = "right";
      ctx.fillText(domainMax.toFixed(0), LEFT_PAD - 6, TOP_PAD + 4);
      ctx.fillText(domainMin.toFixed(0), LEFT_PAD - 6, TOP_PAD + PLOT_H);

      let stillAnimating = false;

      stats.forEach((s, i) => {
        const cx = LEFT_PAD + i * GROUP_W + GROUP_W / 2;
        const boxX = cx - BOX_W / 2;
        // hoverIndex alone carries real interaction (pointer hover AND
        // keyboard focus both set it) — activeIndex is only roving-tabindex
        // bookkeeping and must never tint a resting, unfocused group
        const isActive = hoverIndex === i;
        const ink = isActive ? tokens.accent : tokens.fg;

        const cut = cuts[i];
        const dw = displayWhiskerRef.current[i] ?? { lo: cut.whiskerLow, hi: cut.whiskerHigh };
        const nextLo = reducedRef.current ? cut.whiskerLow : dw.lo + (cut.whiskerLow - dw.lo) * 0.25;
        const nextHi = reducedRef.current ? cut.whiskerHigh : dw.hi + (cut.whiskerHigh - dw.hi) * 0.25;
        displayWhiskerRef.current[i] = {
          lo: Math.abs(nextLo - cut.whiskerLow) < 0.05 ? cut.whiskerLow : nextLo,
          hi: Math.abs(nextHi - cut.whiskerHigh) < 0.05 ? cut.whiskerHigh : nextHi,
        };
        if (
          Math.abs(displayWhiskerRef.current[i].lo - cut.whiskerLow) >= 0.05 ||
          Math.abs(displayWhiskerRef.current[i].hi - cut.whiskerHigh) >= 0.05
        ) {
          stillAnimating = true;
        }

        const yWhiskerLo = valueToY(displayWhiskerRef.current[i].lo);
        const yWhiskerHi = valueToY(displayWhiskerRef.current[i].hi);
        const yQ1 = valueToY(s.q1);
        const yQ3 = valueToY(s.q3);
        const yMed = valueToY(s.median);

        // whisker stem + caps
        ctx.strokeStyle = ink;
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.moveTo(cx, yWhiskerHi);
        ctx.lineTo(cx, yQ3);
        ctx.moveTo(cx, yQ1);
        ctx.lineTo(cx, yWhiskerLo);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - 10, yWhiskerHi);
        ctx.lineTo(cx + 10, yWhiskerHi);
        ctx.moveTo(cx - 10, yWhiskerLo);
        ctx.lineTo(cx + 10, yWhiskerLo);
        ctx.stroke();

        // box body — glyph texture fill, clipped, constant mid density
        ctx.save();
        ctx.beginPath();
        ctx.rect(boxX, yQ3, BOX_W, Math.max(1, yQ1 - yQ3));
        ctx.clip();
        ctx.fillStyle = ink;
        ctx.font = `9px "GeistMono", ui-monospace, monospace`;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        for (let y = yQ3; y < yQ1; y += 10) {
          for (let x = boxX; x < boxX + BOX_W; x += 8) {
            ctx.fillText(BOX_CH, x, y);
          }
        }
        ctx.restore();
        ctx.strokeStyle = ink;
        ctx.lineWidth = 1.25;
        ctx.strokeRect(boxX + 0.5, yQ3 + 0.5, BOX_W, Math.max(1, yQ1 - yQ3));

        // median — heavier solid row
        ctx.fillStyle = ink;
        ctx.fillRect(boxX, yMed - 1, BOX_W, 2);

        // outliers — animated alpha per candidate
        const alphas = alphaRef.current[i] ?? [];
        s.candidates.forEach((v, ci) => {
          const target = cut.outliers.includes(v) ? 1 : 0;
          const cur = alphas[ci] ?? 0;
          const next = reducedRef.current ? target : cur + (target - cur) * 0.28;
          alphas[ci] = Math.abs(next - target) < 0.01 ? target : next;
          if (Math.abs(alphas[ci] - target) >= 0.01) stillAnimating = true;
          if (alphas[ci] <= 0.01) return;
          const y = valueToY(v);
          ctx.globalAlpha = alphas[ci];
          ctx.beginPath();
          ctx.arc(cx, y, 3, 0, Math.PI * 2);
          ctx.strokeStyle = ink;
          ctx.lineWidth = 1.25;
          ctx.stroke();
          ctx.globalAlpha = 1;
        });
        alphaRef.current[i] = alphas;

        ctx.fillStyle = tokens.muted;
        ctx.font = `9.5px "GeistMono", ui-monospace, monospace`;
        ctx.textAlign = "center";
        ctx.fillText(s.label, cx, TOP_PAD + PLOT_H + BOTTOM_PAD - 12);
      });

      if (stillAnimating && !reducedRef.current) {
        rafRef.current = requestAnimationFrame(draw);
      }
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [stats, cuts, tokens, viewW, viewH, domainMin, domainSpan, hoverIndex, activeIndex]);

  const focusGroup = (i: number) => {
    if (i < 0 || i >= n) return;
    setActiveIndex(i);
    document.getElementById(`${uid}-hit-${i}`)?.focus();
  };

  const kFromClientX = (clientX: number): number => {
    const el = trackRef.current;
    if (!el) return k;
    const rect = el.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const raw = K_MIN + frac * (K_MAX - K_MIN);
    return Math.round(raw / K_STEP) * K_STEP;
  };

  const hovered = hoverIndex !== null ? stats[hoverIndex] : null;
  const hoveredCut = hoverIndex !== null ? cuts[hoverIndex] : null;

  return (
    <figure className={`ns-baw inline-block ${className}`} aria-label={`${title}, box plot`}>
      <style>{CSS}</style>
      <div className="flex items-center justify-between gap-3 pb-2">
        <span className="font-mono text-xs tracking-widest text-muted">{title.toUpperCase()}</span>
        <span className="font-mono text-[11px] text-muted tabular-nums">k = {k.toFixed(1)}× IQR</span>
      </div>

      <div className="relative" style={{ width: viewW, maxWidth: "100%" }}>
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          style={{ width: viewW, height: viewH, maxWidth: "100%", display: "block" }}
        />

        {stats.map((s, i) => (
          <button
            key={s.label}
            type="button"
            id={`${uid}-hit-${i}`}
            tabIndex={activeIndex === i ? 0 : -1}
            aria-label={`${s.label}: median ${s.median.toFixed(1)}, Q1 ${s.q1.toFixed(1)}, Q3 ${s.q3.toFixed(1)}, ${cuts[i].outliers.length} outlier${cuts[i].outliers.length === 1 ? "" : "s"}`}
            className="ns-baw-hit absolute cursor-pointer border-0 bg-transparent p-0 outline-none"
            style={{ left: LEFT_PAD + i * GROUP_W, top: TOP_PAD - 10, width: GROUP_W, height: PLOT_H + 10 }}
            onPointerEnter={() => setHoverIndex(i)}
            onPointerLeave={() => setHoverIndex((c) => (c === i ? null : c))}
            onFocus={() => {
              setActiveIndex(i);
              setHoverIndex(i);
            }}
            onBlur={() => setHoverIndex((c) => (c === i ? null : c))}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") {
                e.preventDefault();
                focusGroup(i - 1);
              } else if (e.key === "ArrowRight") {
                e.preventDefault();
                focusGroup(i + 1);
              }
            }}
          />
        ))}

        {hovered && hoveredCut && (
          <div
            aria-hidden="true"
            className="ns-baw-tip pointer-events-none absolute z-10 rounded-sm border border-border bg-background px-2 py-1 font-mono text-[11px] shadow-sm"
            style={{
              left: `${((LEFT_PAD + hoverIndex! * GROUP_W + GROUP_W / 2) / viewW) * 100}%`,
              top: `${(Math.max(0, valueToY(hovered.q3) - 46) / viewH) * 100}%`,
              transform: "translateX(-50%)",
            }}
          >
            <strong className="text-foreground">{hovered.median.toFixed(1)}</strong>{" "}
            <span className="text-muted">
              med · Q1 {hovered.q1.toFixed(1)} · Q3 {hovered.q3.toFixed(1)} · {hoveredCut.outliers.length} out
            </span>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <span className="font-mono text-[10px] tracking-widest text-muted">FENCE</span>
        <div
          ref={trackRef}
          className="ns-baw-track relative h-4 flex-1 cursor-pointer rounded-full bg-border/60"
          onPointerDown={(e) => {
            setK(kFromClientX(e.clientX));
            inputRef.current?.focus();
            const move = (ev: PointerEvent) => setK(kFromClientX(ev.clientX));
            const up = () => {
              window.removeEventListener("pointermove", move);
              window.removeEventListener("pointerup", up);
            };
            window.addEventListener("pointermove", move);
            window.addEventListener("pointerup", up);
          }}
        >
          <input
            ref={inputRef}
            type="range"
            min={K_MIN}
            max={K_MAX}
            step={K_STEP}
            value={k}
            onChange={(e) => setK(Number(e.target.value))}
            aria-label="Whisker fence, multiplier of interquartile range"
            className="ns-baw-range sr-only"
          />
          <div
            aria-hidden="true"
            className="ns-baw-thumb absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-accent bg-background"
            style={{ left: `${((k - K_MIN) / (K_MAX - K_MIN)) * 100}%`, transform: "translate(-50%, -50%)" }}
          />
        </div>
      </div>
    </figure>
  );
}

const CSS = `
.ns-baw-hit { touch-action: manipulation; }
.ns-baw-hit:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.ns-baw-range:focus-visible ~ .ns-baw-thumb { outline: 2px solid var(--accent); outline-offset: 2px; }
`;
