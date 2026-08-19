"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// ChartRadarDither — the dithered-chart family's radar/spider chart, the
// fourth CANVAS member. The polygon's interior is tiled into one triangular
// wedge per axis (center to each pair of adjacent vertices), each wedge
// filled with the family's shared ordered-dither ramp (4x4 Bayer matrix, 17
// ink levels) at a density tracking that axis pair's own value — the usual
// redundant channel alongside the polygon's own radius. The mechanic unique
// to this family member: a literal radar sweep line rotates continuously
// around the center, and as it crosses a wedge, that wedge's ink eases down
// to a fine resolution and then decays back to coarse over a trailing
// half-second echo — a scanning "resolve" that visits every axis in turn.
// Hovering or focusing an axis (a real button at its vertex) independently
// pins its two adjacent wedges to fine resolution regardless of where the
// sweep currently is. Resolution is the only thing either mechanic changes;
// colour never encodes data — pure var(--foreground) ink on
// var(--background) paper, var(--ns-accent) reserved for the sweep line and
// keyboard focus only, matching the rest of the family.
// ---------------------------------------------------------------------------

export interface ChartRadarDitherDatum {
  label: string;
  value: number;
  /** axis max; defaults to 100 */
  max?: number;
}

export interface ChartRadarDitherProps {
  /** the plotted axes/values */
  data?: ChartRadarDitherDatum[];
  /** heading above the chart */
  title?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const LEVELS = 16;
const CELL_COARSE = 6;
const CELL_FINE = 2;

const SIZE = 280;
const R_MAX = 98;
const SWEEP_SPEED = (Math.PI * 2) / 6000; // one revolution / 6s
const DECAY_MS = 650;
const ENTRANCE_MS = 460;

function levelFor(norm: number): number {
  return Math.round(Math.min(1, Math.max(0, norm)) * LEVELS);
}

function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function normalizeAngle(a: number): number {
  const twoPi = Math.PI * 2;
  return ((a % twoPi) + twoPi) % twoPi;
}

function inArc(angle: number, from: number, to: number): boolean {
  const a = normalizeAngle(angle);
  const f = normalizeAngle(from);
  const t = normalizeAngle(to);
  if (f <= t) return a >= f && a <= t;
  return a >= f || a <= t;
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
    muted: get("--ns-muted", "#4d4d4d"),
    border: get("--border", "#ebebeb"),
    accent: get("--ns-accent", "#006bff"),
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

function polar(cx: number, cy: number, r: number, angle: number) {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

export function ChartRadarDither({ data = [], title = "Chart", className = "" }: ChartRadarDitherProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tokens = useTokens();
  const [activeIndex, setActiveIndex] = useState(0);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const uidRef = useRef(`crd-${Math.random().toString(36).slice(2, 8)}`);
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
  const cx = SIZE / 2;
  const cy = SIZE / 2;

  const axes = useMemo(
    () =>
      data.map((d, i) => {
        const max = d.max ?? 100;
        const frac = max > 0 ? Math.min(1, Math.max(0, d.value / max)) : 0;
        const angle = -Math.PI / 2 + (i / Math.max(1, n)) * Math.PI * 2;
        const r = R_MAX * frac;
        const vertex = polar(cx, cy, r, angle);
        const labelPos = polar(cx, cy, R_MAX + 22, angle);
        return { ...d, index: i, max, frac, angle, r, vertex, labelPos, level: levelFor(frac) };
      }),
    [data, n, cx, cy]
  );

  const focusAxis = (i: number) => {
    if (i < 0 || i >= n) return;
    setActiveIndex(i);
    document.getElementById(`${uid}-axis-${i}`)?.focus();
  };

  const mountAtRef = useRef(0);
  const rafRef = useRef(0);
  // per-wedge "last time the sweep crossed it" for the decaying echo
  const lastFreshRef = useRef<number[]>([]);

  useEffect(() => {
    mountAtRef.current = performance.now();
    lastFreshRef.current = axes.map(() => -Infinity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const draw = () => {
      ctx.clearRect(0, 0, SIZE, SIZE);
      if (n < 3) return;
      const now = performance.now();
      const t = reducedRef.current ? 1 : Math.min(1, Math.max(0, (now - mountAtRef.current) / ENTRANCE_MS));
      let stillAnimating = t < 1;
      const grow = easeOutExpo(t);

      // background rings + spokes
      ctx.strokeStyle = tokens.border;
      ctx.lineWidth = 1;
      [0.25, 0.5, 0.75, 1].forEach((f) => {
        ctx.beginPath();
        axes.forEach((a, i) => {
          const p = polar(cx, cy, R_MAX * f, a.angle);
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
        ctx.stroke();
      });
      axes.forEach((a) => {
        const p = polar(cx, cy, R_MAX, a.angle);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      });

      // the sweep angle, and per-wedge freshness (fine <- sweep OR hover)
      const sweepAngle = reducedRef.current ? -Math.PI / 2 : normalizeAngle((now * SWEEP_SPEED) % (Math.PI * 2));

      axes.forEach((a, i) => {
        const b = axes[(i + 1) % n];
        const a0 = a.angle;
        const a1 = b.angle > a0 ? b.angle : b.angle + Math.PI * 2;

        const sweptNow = !reducedRef.current && inArc(sweepAngle, a0, a1);
        if (sweptNow) lastFreshRef.current[i] = now;
        const sinceFresh = now - (lastFreshRef.current[i] ?? -Infinity);
        const sweepFresh = reducedRef.current ? 0 : Math.max(0, 1 - sinceFresh / DECAY_MS);
        const hoverFresh = hoverIndex === i || hoverIndex === (i + 1) % n ? 1 : 0;
        const freshness = Math.max(sweepFresh, hoverFresh);
        if (freshness > 0.01 && freshness < 1) stillAnimating = true;
        if (sweptNow) stillAnimating = true;

        const cell = CELL_COARSE - (CELL_COARSE - CELL_FINE) * freshness;
        const vA = { x: cx + (a.vertex.x - cx) * grow, y: cy + (a.vertex.y - cy) * grow };
        const vB = { x: cx + (b.vertex.x - cx) * grow, y: cy + (b.vertex.y - cy) * grow };

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(vA.x, vA.y);
        ctx.lineTo(vB.x, vB.y);
        ctx.closePath();
        ctx.clip();

        ctx.fillStyle = tokens.fg;
        const level = Math.round(((a.level + b.level) / 2));
        const minX = Math.min(cx, vA.x, vB.x);
        const maxX = Math.max(cx, vA.x, vB.x);
        const minY = Math.min(cy, vA.y, vB.y);
        const maxY = Math.max(cy, vA.y, vB.y);
        const startCol = Math.floor(minX / cell);
        const endCol = Math.ceil(maxX / cell);
        const startRow = Math.floor(minY / cell);
        const endRow = Math.ceil(maxY / cell);
        for (let gy = startRow; gy < endRow; gy++) {
          for (let gx = startCol; gx < endCol; gx++) {
            const idx = (((gy % 4) + 4) % 4) * 4 + (((gx % 4) + 4) % 4);
            if (BAYER[idx] < level) ctx.fillRect(gx * cell, gy * cell, cell, cell);
          }
        }
        ctx.restore();
      });

      // polygon outline
      ctx.strokeStyle = tokens.fg;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      axes.forEach((a, i) => {
        const v = { x: cx + (a.vertex.x - cx) * grow, y: cy + (a.vertex.y - cy) * grow };
        if (i === 0) ctx.moveTo(v.x, v.y);
        else ctx.lineTo(v.x, v.y);
      });
      ctx.closePath();
      ctx.stroke();

      // vertex dots + labels
      ctx.font = `9.5px "GeistMono", ui-monospace, monospace`;
      ctx.textAlign = "center";
      axes.forEach((a, i) => {
        const isActive = hoverIndex === i;
        const v = { x: cx + (a.vertex.x - cx) * grow, y: cy + (a.vertex.y - cy) * grow };
        ctx.beginPath();
        ctx.fillStyle = isActive ? tokens.accent : tokens.fg;
        ctx.arc(v.x, v.y, isActive ? 3 : 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = tokens.muted;
        ctx.fillText(a.label.toUpperCase(), a.labelPos.x, a.labelPos.y);
      });

      // the sweep line itself
      if (!reducedRef.current) {
        const tip = polar(cx, cy, R_MAX, sweepAngle);
        ctx.strokeStyle = tokens.accent;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(tip.x, tip.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      if (stillAnimating) {
        rafRef.current = requestAnimationFrame(draw);
      }
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [axes, tokens, n, hoverIndex, cx, cy]);

  const shown = hoverIndex ?? null;
  const shownAxis = shown !== null ? axes[shown] : null;

  return (
    <figure className={`ns-crd inline-block ${className}`} aria-label={`${title}, radar chart`}>
      <style>{CSS}</style>
      <div className="flex items-center justify-between gap-3 pb-2">
        <span className="font-mono text-xs tracking-widest text-ns-muted">{title.toUpperCase()}</span>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-foreground" aria-live="polite">
            {shownAxis ? (
              <>
                <strong>{shownAxis.value.toLocaleString()}</strong>{" "}
                <span className="text-ns-muted">/ {shownAxis.max}</span>
              </>
            ) : (
              " "
            )}
          </span>
          <button
            type="button"
            onClick={() => setShowTable((s) => !s)}
            className="ns-crd-toggle rounded-sm border border-border px-2 py-1 font-mono text-[10px] tracking-widest text-ns-muted transition-colors duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
            aria-pressed={showTable}
          >
            {showTable ? "VIEW CHART" : "VIEW TABLE"}
          </button>
        </div>
      </div>

      {showTable ? (
        <table className="ns-crd-table w-full border-collapse font-mono text-xs">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr>
              <th scope="col" className="border-b border-border px-2 py-1.5 text-left text-ns-muted">
                Axis
              </th>
              <th scope="col" className="border-b border-border px-2 py-1.5 text-right text-ns-muted tabular-nums">
                Value
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.label}>
                <td className="border-b border-border px-2 py-1.5 text-foreground">{d.label}</td>
                <td className="border-b border-border px-2 py-1.5 text-right text-foreground tabular-nums">
                  {d.value.toLocaleString()} / {d.max ?? 100}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="relative" style={{ width: SIZE, height: SIZE, maxWidth: "100%" }}>
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            className="ns-crd-canvas"
            style={{ width: SIZE, height: SIZE, maxWidth: "100%", display: "block" }}
          />

          <div role="listbox" aria-label={`${title} axes`} className="contents">
            {axes.map((a) => (
              <button
                key={a.label}
                type="button"
                role="option"
                id={`${uid}-axis-${a.index}`}
                aria-selected={hoverIndex === a.index}
                tabIndex={activeIndex === a.index ? 0 : -1}
                aria-label={`${a.label}: ${a.value.toLocaleString()} of ${a.max}`}
                className="ns-crd-hit absolute cursor-pointer rounded-full border-0 bg-transparent p-0 outline-none"
                style={{ left: a.vertex.x - 14, top: a.vertex.y - 14, width: 28, height: 28 }}
                onPointerEnter={() => setHoverIndex(a.index)}
                onPointerLeave={() => setHoverIndex((c) => (c === a.index ? null : c))}
                onFocus={() => {
                  setActiveIndex(a.index);
                  setHoverIndex(a.index);
                }}
                onBlur={() => setHoverIndex((c) => (c === a.index ? null : c))}
                onKeyDown={(e) => {
                  if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                    e.preventDefault();
                    focusAxis((a.index - 1 + n) % n);
                  } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                    e.preventDefault();
                    focusAxis((a.index + 1) % n);
                  }
                }}
              />
            ))}
          </div>
        </div>
      )}
    </figure>
  );
}

const CSS = `
.ns-crd-hit { touch-action: manipulation; }
.ns-crd-hit:focus-visible { outline: 2px solid var(--ns-accent); outline-offset: 2px; }
`;
