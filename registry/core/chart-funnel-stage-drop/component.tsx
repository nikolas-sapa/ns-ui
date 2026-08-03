"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// ChartFunnelStageDrop — the dithered-chart family's funnel / stage-drop
// chart (backlog queue #13). Each stage is a tapering trapezoid, its interior
// filled with the family's shared ordered-dither ramp (4x4 Bayer matrix, 17
// ink levels) at a density tracking the stage's share of the top of the
// funnel — the usual redundant density channel. The mechanic that is new to
// this family member: hovering or focusing a stage animates its OWN drop-off
// — the count lost before the next stage — as ink particles trickling out of
// its bottom edge into the gap toward the next stage, gravity-plus-jitter,
// particle count proportional to the actual drop, seeded per stage so a
// replay of the same stage always looks identical. Nothing else in the
// registry visualizes a delta as falling ink. Pure var(--foreground) ink on
// var(--background) paper; var(--accent) is reserved for keyboard focus
// only, matching the rest of the family's colour rule.
// ---------------------------------------------------------------------------

export interface ChartFunnelStageDropDatum {
  label: string;
  value: number;
}

export interface ChartFunnelStageDropProps {
  data?: ChartFunnelStageDropDatum[];
  title?: string;
  className?: string;
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const LEVELS = 16;
const CELL = 5;

const FUNNEL_W = 380;
const MIN_W_FRAC = 0.22;
const LABEL_ROW_H = 32;
const BAR_H = 44;
const GAP_H = 26;
const TOP_PAD = 6;
const BOTTOM_PAD = 6;
const SIDE_PAD = 24;
const MAX_PARTICLES = 34;
const PARTICLE_PERIOD_MS = 1000;
const ENTRANCE_MS = 420;
const ENTRANCE_STAGGER = 60;

function levelFor(norm: number): number {
  return Math.round(Math.min(1, Math.max(0, norm)) * LEVELS);
}

function formatValue(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return Math.round(v).toLocaleString();
}

function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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

/** A seeded rain of ink particles falling through a gap between two stage
 *  edges — deterministic per stage label so hovering the same stage twice
 *  looks identical. `phase` is 0..1 loop position. */
function particlesFor(seed: string, count: number, topW: number, botW: number) {
  const rng = mulberry32(hashStr(seed));
  return Array.from({ length: count }, () => ({
    x0: (rng() - 0.5) * topW,
    x1: (rng() - 0.5) * botW,
    offset: rng(),
    jitter: rng() * Math.PI * 2,
  }));
}

export function ChartFunnelStageDrop({ data = [], title = "Chart", className = "" }: ChartFunnelStageDropProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tokens = useTokens();
  const [activeIndex, setActiveIndex] = useState(0);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const uidRef = useRef(`cfs-${Math.random().toString(36).slice(2, 8)}`);
  const uid = uidRef.current;

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

  const n = data.length;
  const top = data[0]?.value ?? 1;

  const stages = useMemo(
    () =>
      data.map((d, i) => {
        const frac = top > 0 ? d.value / top : 0;
        const w = FUNNEL_W * (MIN_W_FRAC + (1 - MIN_W_FRAC) * frac);
        const next = data[i + 1];
        const nextFrac = next && top > 0 ? next.value / top : frac * 0.9;
        const wBottom = FUNNEL_W * (MIN_W_FRAC + (1 - MIN_W_FRAC) * nextFrac);
        const drop = next ? Math.max(0, d.value - next.value) : 0;
        const dropFrac = top > 0 ? drop / top : 0;
        return { ...d, index: i, wTop: w, wBottom, frac, drop, dropFrac, level: levelFor(frac) };
      }),
    [data, top]
  );

  const rowH = LABEL_ROW_H + BAR_H;
  const viewW = FUNNEL_W + SIDE_PAD * 2;
  const viewH = TOP_PAD + n * rowH + Math.max(0, n - 1) * GAP_H + BOTTOM_PAD;

  const rowTop = (i: number) => TOP_PAD + i * (rowH + GAP_H);

  const focusStage = (i: number) => {
    if (i < 0 || i >= n) return;
    setActiveIndex(i);
    document.getElementById(`${uid}-stage-${i}`)?.focus();
  };

  const mountAtRef = useRef(0);
  const activeAtRef = useRef<number | null>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    mountAtRef.current = performance.now();
  }, []);

  useEffect(() => {
    if (hoverIndex !== null) activeAtRef.current = performance.now();
    else activeAtRef.current = null;
  }, [hoverIndex]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = viewW * dpr;
    canvas.height = viewH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = viewW / 2;

    const draw = () => {
      ctx.clearRect(0, 0, viewW, viewH);
      const now = performance.now();
      let stillAnimating = false;

      stages.forEach((s, i) => {
        const delay = i * ENTRANCE_STAGGER;
        const t = reducedRef.current ? 1 : Math.min(1, Math.max(0, (now - mountAtRef.current - delay) / ENTRANCE_MS));
        if (t < 1) stillAnimating = true;
        const grow = easeOutExpo(t);

        const yTop = rowTop(i) + LABEL_ROW_H;
        const yBottom = yTop + BAR_H;
        const wTop = s.wTop * grow;
        const wBottom = s.wBottom * grow;

        // trapezoid path
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cx - wTop / 2, yTop);
        ctx.lineTo(cx + wTop / 2, yTop);
        ctx.lineTo(cx + wBottom / 2, yBottom);
        ctx.lineTo(cx - wBottom / 2, yBottom);
        ctx.closePath();
        const isActive = hoverIndex === i;
        ctx.strokeStyle = isActive ? tokens.accent : tokens.border;
        ctx.lineWidth = isActive ? 1.5 : 1;
        ctx.stroke();
        ctx.clip();

        ctx.fillStyle = tokens.fg;
        const startCol = Math.floor((cx - FUNNEL_W / 2) / CELL);
        const endCol = Math.ceil((cx + FUNNEL_W / 2) / CELL);
        const startRow = Math.floor(yTop / CELL);
        const endRow = Math.ceil(yBottom / CELL);
        for (let gy = startRow; gy < endRow; gy++) {
          for (let gx = startCol; gx < endCol; gx++) {
            const idx = (((gy % 4) + 4) % 4) * 4 + (((gx % 4) + 4) % 4);
            if (BAYER[idx] < s.level) ctx.fillRect(gx * CELL, gy * CELL, CELL, CELL);
          }
        }
        ctx.restore();

        // label + value row above the bar
        ctx.textAlign = "center";
        ctx.font = `10px "GeistMono", ui-monospace, monospace`;
        ctx.fillStyle = tokens.muted;
        ctx.globalAlpha = grow;
        ctx.fillText(s.label.toUpperCase(), cx, rowTop(i) + 12);
        ctx.font = `11px "GeistMono", ui-monospace, monospace`;
        ctx.fillStyle = tokens.fg;
        ctx.fillText(
          `${formatValue(s.value)}  (${Math.round(s.frac * 100)}%)`,
          cx,
          rowTop(i) + 26
        );
        ctx.globalAlpha = 1;

        // the drop-off rain, only in the gap after this stage
        if (i < n - 1 && s.drop > 0) {
          const isHot = hoverIndex === i;
          const count = Math.max(3, Math.round(s.dropFrac * MAX_PARTICLES));
          const parts = particlesFor(`${uid}:${s.label}`, count, s.wBottom, stages[i + 1].wTop);
          const activeAt = activeAtRef.current;

          if (isHot && !reducedRef.current && activeAt !== null) {
            stillAnimating = true;
            ctx.fillStyle = tokens.fg;
            parts.forEach((p) => {
              const elapsed = (now - activeAt + p.offset * PARTICLE_PERIOD_MS) % PARTICLE_PERIOD_MS;
              const phase = elapsed / PARTICLE_PERIOD_MS;
              const y = yBottom + phase * GAP_H;
              const wig = Math.sin(phase * Math.PI * 3 + p.jitter) * 3;
              const x = cx + p.x0 + (p.x1 - p.x0) * phase + wig;
              const alpha = phase < 0.12 ? phase / 0.12 : phase > 0.75 ? Math.max(0, (1 - phase) / 0.25) : 1;
              ctx.globalAlpha = alpha;
              ctx.beginPath();
              ctx.arc(x, y, 1.4, 0, Math.PI * 2);
              ctx.fill();
            });
            ctx.globalAlpha = 1;
          } else if (isHot && reducedRef.current) {
            // reduced motion: one static frame of evenly-spaced particles,
            // no animation loop, still communicates the drop-off count
            ctx.fillStyle = tokens.fg;
            parts.forEach((p, k) => {
              const phase = (k + 0.5) / parts.length;
              const y = yBottom + phase * GAP_H;
              const x = cx + p.x0 + (p.x1 - p.x0) * phase;
              ctx.beginPath();
              ctx.arc(x, y, 1.4, 0, Math.PI * 2);
              ctx.fill();
            });
          }
        }
      });

      if (stillAnimating) {
        rafRef.current = requestAnimationFrame(draw);
      }
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [stages, tokens, viewW, viewH, n, hoverIndex, uid]);

  const hovered = hoverIndex;

  return (
    <figure className={`ns-cfs inline-block ${className}`} aria-label={`${title}, funnel chart`}>
      <style>{CSS}</style>
      <div className="flex items-center justify-between gap-3 pb-2">
        <span className="font-mono text-xs tracking-widest text-muted">{title.toUpperCase()}</span>
        <button
          type="button"
          onClick={() => setShowTable((s) => !s)}
          className="ns-cfs-toggle rounded-sm border border-border px-2 py-1 font-mono text-[10px] tracking-widest text-muted transition-colors duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          aria-pressed={showTable}
        >
          {showTable ? "VIEW CHART" : "VIEW TABLE"}
        </button>
      </div>

      {showTable ? (
        <table className="ns-cfs-table w-full border-collapse font-mono text-xs">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr>
              <th scope="col" className="border-b border-border px-2 py-1.5 text-left text-muted">
                Stage
              </th>
              <th scope="col" className="border-b border-border px-2 py-1.5 text-right text-muted tabular-nums">
                Value
              </th>
              <th scope="col" className="border-b border-border px-2 py-1.5 text-right text-muted tabular-nums">
                Dropped
              </th>
            </tr>
          </thead>
          <tbody>
            {stages.map((s) => (
              <tr key={s.label}>
                <td className="border-b border-border px-2 py-1.5 text-foreground">{s.label}</td>
                <td className="border-b border-border px-2 py-1.5 text-right text-foreground tabular-nums">
                  {s.value.toLocaleString()}
                </td>
                <td className="border-b border-border px-2 py-1.5 text-right text-foreground tabular-nums">
                  {s.index < n - 1 ? s.drop.toLocaleString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="relative" style={{ width: viewW, maxWidth: "100%" }}>
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            style={{ width: viewW, height: viewH, maxWidth: "100%", display: "block" }}
          />

          {stages.map((s) => (
            <button
              key={s.label}
              type="button"
              id={`${uid}-stage-${s.index}`}
              tabIndex={activeIndex === s.index ? 0 : -1}
              aria-label={
                s.index < n - 1
                  ? `${s.label}: ${s.value.toLocaleString()}, ${Math.round(s.frac * 100)}% of top, ${s.drop.toLocaleString()} dropped before next stage`
                  : `${s.label}: ${s.value.toLocaleString()}, ${Math.round(s.frac * 100)}% of top`
              }
              className="ns-cfs-hit absolute cursor-pointer border-0 bg-transparent p-0 outline-none"
              style={{
                left: 0,
                top: rowTop(s.index),
                width: viewW,
                height: rowH + (s.index < n - 1 ? GAP_H : 0),
              }}
              onPointerEnter={() => setHoverIndex(s.index)}
              onPointerLeave={() => setHoverIndex((c) => (c === s.index ? null : c))}
              onFocus={() => {
                setActiveIndex(s.index);
                setHoverIndex(s.index);
              }}
              onBlur={() => setHoverIndex((c) => (c === s.index ? null : c))}
              onKeyDown={(e) => {
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  focusStage(s.index - 1);
                } else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  focusStage(s.index + 1);
                }
              }}
            />
          ))}

          {hovered !== null && stages[hovered] && stages[hovered].index < n - 1 && (
            <div
              aria-hidden="true"
              className="ns-cfs-tip pointer-events-none absolute z-10 rounded-sm border border-border bg-background px-2 py-1 font-mono text-[11px] shadow-sm"
              style={{
                left: "50%",
                top: `${((rowTop(hovered) + rowH + GAP_H / 2) / viewH) * 100}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <strong className="text-foreground">{stages[hovered].drop.toLocaleString()}</strong>{" "}
              <span className="text-muted">dropped</span>
            </div>
          )}
        </div>
      )}
    </figure>
  );
}

const CSS = `
.ns-cfs-hit { touch-action: manipulation; }
.ns-cfs-hit:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
`;
