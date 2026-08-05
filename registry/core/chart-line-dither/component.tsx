"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// ChartLineDither — the dithered-chart family's line/area chart, the second
// CANVAS member alongside chart-bar-dither. The mechanic here is a
// "developing" reticle: the area under the line rests at a uniform coarse
// 7px ordered-dither cell (same shared 4x4 Bayer matrix as the rest of the
// family), and a scrub cursor — pointer or keyboard — drags a local
// resolution field with it: columns near the scrub position ease down to a
// fine 2px cell in a soft falloff band, columns far from it ease back up to
// coarse, so an ink "loupe" of higher print resolution visibly trails the
// reticle across the chart. Density per column still tracks that column's
// own value (redundant with curve height, exactly like chart-bar-dither and
// chart-bar-halftone before it) — the reticle changes RESOLUTION, never
// hue, so the family's density-not-colour rule holds. Pure var(--foreground)
// ink on var(--background) paper; var(--ns-accent) is reserved for keyboard
// focus only.
// ---------------------------------------------------------------------------

export interface ChartLineDitherDatum {
  label: string;
  value: number;
}

export interface ChartLineDitherProps {
  data?: ChartLineDitherDatum[];
  title?: string;
  className?: string;
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const LEVELS = 16;

const COARSE_CELL = 7;
const FINE_CELL = 2;
const RETICLE_RADIUS = 70;
const EASE_RATE = 0.18;
const EPS = 0.4;

const PLOT_W = 480;
const PLOT_H = 200;
const TOP_PAD = 30;
const BOTTOM_PAD = 26;
const LEFT_PAD = 14;
const RIGHT_PAD = 14;
const ENTRANCE_MS = 620;

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

export function ChartLineDither({ data = [], title = "Chart", className = "" }: ChartLineDitherProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tokens = useTokens();
  const [activeIndex, setActiveIndex] = useState(0);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const uidRef = useRef(`cld-${Math.random().toString(36).slice(2, 8)}`);
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
  const viewW = LEFT_PAD + PLOT_W + RIGHT_PAD;
  const viewH = TOP_PAD + PLOT_H + BOTTOM_PAD;
  const baseY = TOP_PAD + PLOT_H;

  const points = useMemo(() => {
    const max = Math.max(...data.map((d) => d.value), 0);
    const min = Math.min(...data.map((d) => d.value), 0);
    const range = max - min || 1;
    return data.map((d, i) => {
      const x = LEFT_PAD + (n <= 1 ? PLOT_W / 2 : (i / (n - 1)) * PLOT_W);
      const norm = (d.value - min) / range;
      const y = baseY - PLOT_H * norm;
      return { ...d, index: i, x, y, level: levelFor(norm) };
    });
  }, [data, n, baseY]);

  const focusPoint = (i: number) => {
    if (i < 0 || i >= n) return;
    setActiveIndex(i);
    document.getElementById(`${uid}-pt-${i}`)?.focus();
  };

  // continuous scrub-x target (canvas coords), eased for a trailing resolve
  const scrubTargetRef = useRef<number | null>(null);
  const scrubXRef = useRef<number | null>(null);
  const mountAtRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    mountAtRef.current = performance.now();
  }, []);

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
        const y = Math.round(baseY - PLOT_H * f) + 0.5;
        ctx.beginPath();
        ctx.moveTo(LEFT_PAD, y);
        ctx.lineTo(viewW - RIGHT_PAD, y);
        ctx.stroke();
      });

      if (points.length >= 2) {
        const now = performance.now();
        const t = reducedRef.current ? 1 : Math.min(1, Math.max(0, (now - mountAtRef.current) / ENTRANCE_MS));
        const grow = easeOutExpo(t);
        const revealX = LEFT_PAD + PLOT_W * grow;

        // ease the scrub cursor toward its target
        const target = scrubTargetRef.current;
        let stillAnimating = t < 1;
        if (target === null) {
          if (scrubXRef.current !== null) {
            scrubXRef.current = null;
          }
        } else if (reducedRef.current) {
          scrubXRef.current = target;
        } else {
          const cur = scrubXRef.current ?? target;
          const next = cur + (target - cur) * EASE_RATE;
          scrubXRef.current = Math.abs(next - target) < EPS ? target : next;
          if (Math.abs(scrubXRef.current - target) >= EPS) stillAnimating = true;
        }

        ctx.save();
        ctx.beginPath();
        ctx.rect(LEFT_PAD, TOP_PAD, Math.max(0, revealX - LEFT_PAD), PLOT_H);
        ctx.clip();

        // dithered area, clipped to the area-under-curve path
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        points.forEach((p) => ctx.lineTo(p.x, p.y));
        ctx.lineTo(points[points.length - 1].x, baseY);
        ctx.lineTo(points[0].x, baseY);
        ctx.closePath();
        ctx.clip();

        const scrub = scrubXRef.current;
        ctx.fillStyle = tokens.fg;
        const startCol = Math.floor(LEFT_PAD / COARSE_CELL);
        const endCol = Math.ceil((LEFT_PAD + PLOT_W) / COARSE_CELL);
        for (let gx = startCol; gx < endCol; gx++) {
          const colCenterX = gx * COARSE_CELL + COARSE_CELL / 2;
          // local column value: linear-interpolate level between the two
          // nearest data points so the dither ramp isn't stair-stepped
          const norm = colCenterX <= points[0].x
            ? points[0].level / LEVELS
            : colCenterX >= points[points.length - 1].x
              ? points[points.length - 1].level / LEVELS
              : (() => {
                  let lo = 0;
                  while (lo < points.length - 2 && points[lo + 1].x < colCenterX) lo++;
                  const a = points[lo];
                  const b = points[lo + 1];
                  const f = (colCenterX - a.x) / Math.max(1, b.x - a.x);
                  return (a.level + (b.level - a.level) * f) / LEVELS;
                })();
          const level = Math.round(norm * LEVELS);

          const dist = scrub === null ? Infinity : Math.abs(colCenterX - scrub);
          const resolveFrac = Math.max(0, 1 - dist / RETICLE_RADIUS);
          const cell = reducedRef.current
            ? COARSE_CELL
            : COARSE_CELL - (COARSE_CELL - FINE_CELL) * resolveFrac;

          const colGrid = Math.round(colCenterX / cell);
          for (let gy = Math.floor(TOP_PAD / cell); gy * cell < baseY; gy++) {
            const idx = (((gy % 4) + 4) % 4) * 4 + (((colGrid % 4) + 4) % 4);
            if (BAYER[idx] < level) {
              ctx.fillRect(gx * COARSE_CELL, gy * cell, COARSE_CELL, cell);
            }
          }
        }
        ctx.restore(); // area clip

        // the line itself, solid ink stroke on top of its own area
        ctx.strokeStyle = tokens.fg;
        ctx.lineWidth = 2;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.beginPath();
        points.forEach((p, i) => {
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();

        ctx.restore(); // reveal clip

        // point markers + labels (outside the reveal clip is fine, always visible once entered)
        ctx.font = `9.5px "GeistMono", ui-monospace, monospace`;
        ctx.textAlign = "center";
        points.forEach((p, i) => {
          if (p.x > revealX + 1) return;
          const isActive = i === (scrubIndex ?? -1);
          ctx.beginPath();
          ctx.fillStyle = isActive ? tokens.accent : tokens.fg;
          ctx.arc(p.x, p.y, isActive ? 3 : 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = tokens.muted;
          ctx.fillText(p.label, p.x, baseY + BOTTOM_PAD - 8);
        });

        if (stillAnimating && !reducedRef.current) {
          rafRef.current = requestAnimationFrame(draw);
        }
      }

      ctx.strokeStyle = tokens.border;
      ctx.beginPath();
      ctx.moveTo(LEFT_PAD, baseY + 0.5);
      ctx.lineTo(viewW - RIGHT_PAD, baseY + 0.5);
      ctx.stroke();
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [points, tokens, viewW, viewH, baseY, scrubIndex]);

  // Lives on the wrapping container, not the canvas: the roving-tabindex
  // point buttons sit on top of the canvas and would otherwise swallow every
  // pointer event before it ever reached a canvas-level handler. Button
  // pointer events still bubble here, so this stays the single authority for
  // continuous scrub while the buttons keep only focus/blur for keyboard.
  const onCanvasPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || points.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const scale = viewW / rect.width;
    const x = (e.clientX - rect.left) * scale;
    scrubTargetRef.current = x;
    let nearest = 0;
    let bestDist = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(p.x - x);
      if (d < bestDist) {
        bestDist = d;
        nearest = i;
      }
    });
    setScrubIndex(nearest);
    // scrubIndex is a draw-effect dependency, so this state update alone
    // triggers a fresh single-frame paint even when reduced motion has no
    // persistent rAF loop running.
  };

  const onCanvasPointerLeave = () => {
    scrubTargetRef.current = null;
    setScrubIndex(null);
  };

  const shownIndex = scrubIndex ?? (points.length ? points.length - 1 : null);
  const shownPoint = shownIndex !== null ? points[shownIndex] : null;

  return (
    <figure className={`ns-cld inline-block ${className}`} aria-label={`${title}, line chart`}>
      <style>{CSS}</style>
      <div className="flex items-center justify-between gap-3 pb-2">
        <span className="font-mono text-xs tracking-widest text-ns-muted">{title.toUpperCase()}</span>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-foreground" aria-live="polite">
            {shownPoint ? (
              <>
                <strong>{formatValue(shownPoint.value)}</strong>{" "}
                <span className="text-ns-muted">{shownPoint.label}</span>
              </>
            ) : (
              " "
            )}
          </span>
          <button
            type="button"
            onClick={() => setShowTable((s) => !s)}
            className="ns-cld-toggle rounded-sm border border-border px-2 py-1 font-mono text-[10px] tracking-widest text-ns-muted transition-colors duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
            aria-pressed={showTable}
          >
            {showTable ? "VIEW CHART" : "VIEW TABLE"}
          </button>
        </div>
      </div>

      {showTable ? (
        <table className="ns-cld-table w-full border-collapse font-mono text-xs">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr>
              <th scope="col" className="border-b border-border px-2 py-1.5 text-left text-ns-muted">
                Point
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
                  {d.value.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div
          className="relative"
          style={{ width: viewW, maxWidth: "100%" }}
          onPointerMove={onCanvasPointerMove}
          onPointerLeave={onCanvasPointerLeave}
        >
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            style={{ width: viewW, height: viewH, maxWidth: "100%", display: "block", cursor: "crosshair" }}
          />

          <div role="listbox" aria-label={`${title} data points`} className="contents">
            {points.map((p, i) => {
              const slotW = n <= 1 ? PLOT_W : PLOT_W / n;
              return (
                <button
                  key={p.label}
                  type="button"
                  role="option"
                  id={`${uid}-pt-${i}`}
                  aria-selected={scrubIndex === i}
                  tabIndex={activeIndex === i ? 0 : -1}
                  aria-label={`${p.label}: ${p.value.toLocaleString()}`}
                  className="ns-cld-hit absolute border-0 bg-transparent p-0 outline-none"
                  style={{
                    left: p.x - slotW / 2,
                    top: TOP_PAD - 10,
                    width: slotW,
                    height: PLOT_H + 20,
                    // the wrapping container is the single pointer authority
                    // (continuous scrub) — these buttons exist for keyboard
                    // reach only, so they must not shadow it from pointer hit-testing
                    pointerEvents: "none",
                  }}
                  onFocus={() => {
                    setActiveIndex(i);
                    scrubTargetRef.current = p.x;
                    setScrubIndex(i);
                  }}
                  onBlur={() => setScrubIndex((c) => (c === i ? null : c))}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                      e.preventDefault();
                      focusPoint(i - 1);
                    } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                      e.preventDefault();
                      focusPoint(i + 1);
                    } else if (e.key === "Home") {
                      e.preventDefault();
                      focusPoint(0);
                    } else if (e.key === "End") {
                      e.preventDefault();
                      focusPoint(n - 1);
                    }
                  }}
                />
              );
            })}
          </div>
        </div>
      )}
    </figure>
  );
}

const CSS = `
.ns-cld-hit { touch-action: manipulation; }
.ns-cld-hit:focus-visible { outline: 2px solid var(--ns-accent); outline-offset: 2px; }
`;
