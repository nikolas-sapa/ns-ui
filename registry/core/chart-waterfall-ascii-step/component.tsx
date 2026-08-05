"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// ChartWaterfallAsciiStep — the registry's first waterfall chart. Nearest
// neighbours: chart-funnel-stage-drop tapers a single monotonic total and
// animates its OWN drop-off as falling ink; chart-bar-dither/-halftone are
// one static series per bar with no relationship between bars. Neither
// recomputes a chain — a waterfall's whole point is that every bar's
// position depends on every bar before it.
//
// The mechanic: every intermediate step has a real toggle (click or
// Enter/Space on its hit button, aria-pressed). Toggling excludes or
// restores that step's delta, and every bar from that step onward — plus
// the trailing running total — animates its floating top/bottom AND its
// displayed cumulative number to the new value over ~420ms. This is a
// genuine recompute rendered as motion, not a tooltip: excluding "Refunds"
// visibly redraws the shape of every later step and the total. Hovering or
// focusing (without toggling) shows a tooltip with that step's exact
// contribution and its before/after cumulative, so the read-out is
// available before committing to a change.
//
// Bars keep the family's shared 4x4-Bayer-equivalent ASCII ramp
// (' .:-=+*#%@') as a redundant density channel tracking |delta| — pure
// var(--foreground) ink, var(--ns-accent) reserved for the active/focused step.
// ---------------------------------------------------------------------------

const RAMP = " .:-=+*#%@";

export interface WaterfallStepDatum {
  label: string;
  /** first entry is the starting balance; every following entry is a signed delta */
  delta: number;
}

export interface ChartWaterfallAsciiStepProps {
  data?: WaterfallStepDatum[];
  title?: string;
  totalLabel?: string;
  className?: string;
}

const DEFAULT_DATA: WaterfallStepDatum[] = [
  { label: "Start", delta: 1000 },
  { label: "New signups", delta: 420 },
  { label: "Upgrades", delta: 180 },
  { label: "Churn", delta: -260 },
  { label: "Refunds", delta: -90 },
  { label: "Expansion", delta: 140 },
];

const BAR_W = 30;
const SLOT_W = 62;
const PLOT_H = 190;
const TOP_PAD = 30;
const AXIS_H = 8;
const LABEL_H = 32;
const LEFT_PAD = 12;
const RIGHT_PAD = 12;
const CELL = 4;
const RECOMPUTE_MS = 420;

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

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function formatValue(v: number): string {
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return `${sign}${Math.round(abs).toLocaleString()}`;
}

interface Bar {
  label: string;
  index: number;
  isStart: boolean;
  isTotal: boolean;
  toggleable: boolean;
  excluded: boolean;
  delta: number;
  from: number;
  to: number;
}

function paintDitherRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  yTop: number,
  yBase: number,
  w: number,
  ch: string,
  ink: string
) {
  if (ch === " ") return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, Math.min(yTop, yBase), w, Math.abs(yBase - yTop));
  ctx.clip();
  ctx.fillStyle = ink;
  ctx.font = `${CELL * 2.4}px "GeistMono", ui-monospace, monospace`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const rowH = CELL * 2.6;
  const top = Math.min(yTop, yBase);
  const bottom = Math.max(yTop, yBase);
  for (let y = top; y < bottom; y += rowH) {
    for (let cx = x; cx < x + w; cx += CELL * 2) {
      ctx.fillText(ch, cx, y);
    }
  }
  ctx.restore();
}

export function ChartWaterfallAsciiStep({
  data = DEFAULT_DATA,
  title = "Chart",
  totalLabel = "Total",
  className = "",
}: ChartWaterfallAsciiStepProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tokens = useTokens();
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  // index 0 is always the start bar (display-only, never focusable), so the
  // first real control is index 1
  const [activeIndex, setActiveIndex] = useState(1);
  const uidRef = useRef(`cwas-${Math.random().toString(36).slice(2, 8)}`);
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

  const bars: Bar[] = useMemo(() => {
    let cumulative = 0;
    const out: Bar[] = [];
    data.forEach((d, i) => {
      const isStart = i === 0;
      const excludedNow = !isStart && excluded.has(i);
      const from = cumulative;
      const delta = excludedNow ? 0 : d.delta;
      cumulative += delta;
      out.push({
        label: d.label,
        index: i,
        isStart,
        isTotal: false,
        toggleable: !isStart,
        excluded: excludedNow,
        delta: d.delta,
        from,
        to: cumulative,
      });
    });
    out.push({
      label: totalLabel,
      index: data.length,
      isStart: false,
      isTotal: true,
      toggleable: false,
      excluded: false,
      delta: cumulative,
      from: 0,
      to: cumulative,
    });
    return out;
  }, [data, excluded, totalLabel]);

  const maxAbs = useMemo(() => Math.max(1, ...bars.map((b) => Math.max(Math.abs(b.from), Math.abs(b.to)))), [bars]);
  const n = bars.length;
  const viewW = LEFT_PAD + n * SLOT_W + RIGHT_PAD;
  const viewH = TOP_PAD + PLOT_H + AXIS_H + LABEL_H;
  const zeroY = TOP_PAD + PLOT_H;
  const valueToY = (v: number) => zeroY - (v / maxAbs) * PLOT_H;

  // only the intermediate delta steps are real, focusable controls — the
  // start and running-total bars are display-only, so roving tabindex must
  // stay confined to this list or Tab can land on nothing (a disabled
  // button ignores tabIndex entirely)
  const toggleableIndices = useMemo(() => bars.filter((b) => b.toggleable).map((b) => b.index), [bars]);

  useEffect(() => {
    if (!toggleableIndices.includes(activeIndex) && toggleableIndices.length > 0) {
      setActiveIndex(toggleableIndices[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toggleableIndices]);

  const focusByOffset = (offset: number) => {
    const from = toggleableIndices.indexOf(activeIndex);
    const nextPos = Math.min(toggleableIndices.length - 1, Math.max(0, (from < 0 ? 0 : from) + offset));
    const target = toggleableIndices[nextPos];
    if (target === undefined) return;
    setActiveIndex(target);
    document.getElementById(`${uid}-hit-${target}`)?.focus();
  };

  const toggle = (b: Bar) => {
    if (!b.toggleable) return;
    setExcluded((cur) => {
      const next = new Set(cur);
      if (next.has(b.index)) next.delete(b.index);
      else next.add(b.index);
      return next;
    });
  };

  // animated per-bar "to" value + displayed cumulative, lerped every frame
  // toward the freshly computed target so a toggle reads as a live recompute
  const displayToRef = useRef<number[]>([]);
  const rafRef = useRef(0);

  useEffect(() => {
    if (displayToRef.current.length !== n) {
      displayToRef.current = bars.map((b) => b.to);
    }
  }, [n, bars]);

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
      const zy = Math.round(valueToY(0)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(LEFT_PAD, zy);
      ctx.lineTo(viewW - RIGHT_PAD, zy);
      ctx.stroke();

      let stillAnimating = false;

      bars.forEach((b, i) => {
        const x = LEFT_PAD + i * SLOT_W + (SLOT_W - BAR_W) / 2;
        const curTo = displayToRef.current[i] ?? b.to;
        const nextTo = reducedRef.current ? b.to : curTo + (b.to - curTo) * 0.24;
        displayToRef.current[i] = Math.abs(nextTo - b.to) < 0.5 ? b.to : nextTo;
        if (Math.abs(displayToRef.current[i] - b.to) >= 0.5) stillAnimating = true;

        const yFrom = valueToY(b.isTotal ? 0 : b.from);
        const yTo = valueToY(b.isTotal ? displayToRef.current[i] : displayToRef.current[i]);

        // hoverIndex alone carries real interaction (pointer hover AND
        // keyboard focus both set it) — activeIndex is only roving-tabindex
        // bookkeeping and must never tint a resting, unfocused bar
        const isActive = hoverIndex === i;
        const level = Math.min(
          RAMP.length - 1,
          Math.round((Math.abs(b.isTotal ? b.to : b.to - b.from) / maxAbs) * (RAMP.length - 1))
        );
        const ch = b.excluded ? RAMP[1] : RAMP[Math.max(level, 2)];
        const ink = isActive ? tokens.accent : b.excluded ? tokens.muted : tokens.fg;

        paintDitherRect(ctx, x, yFrom, yTo, BAR_W, ch, ink);
        ctx.strokeStyle = ink;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, Math.min(yFrom, yTo) + 0.5, BAR_W, Math.abs(yTo - yFrom));

        // connector to next bar
        if (i < bars.length - 1) {
          ctx.strokeStyle = tokens.border;
          ctx.setLineDash([2, 2]);
          const connY = valueToY(displayToRef.current[i]);
          ctx.beginPath();
          ctx.moveTo(x + BAR_W, connY);
          ctx.lineTo(x + SLOT_W + (SLOT_W - BAR_W) / 2, connY);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        ctx.font = `9.5px "GeistMono", ui-monospace, monospace`;
        ctx.textAlign = "center";
        ctx.fillStyle = ink;
        const labelValue = b.isTotal ? displayToRef.current[i] : b.excluded ? 0 : b.delta;
        const prefix = !b.isStart && !b.isTotal && labelValue >= 0 ? "+" : "";
        ctx.fillText(`${prefix}${formatValue(labelValue)}`, x + BAR_W / 2, Math.min(yFrom, yTo) - 8);
        ctx.fillStyle = tokens.muted;
        ctx.fillText(b.label, x + BAR_W / 2, zeroY + AXIS_H + 12);
        if (b.toggleable) {
          ctx.fillText(b.excluded ? "(excluded)" : "", x + BAR_W / 2, zeroY + AXIS_H + 24);
        }
      });

      if (stillAnimating && !reducedRef.current) {
        rafRef.current = requestAnimationFrame(draw);
      }
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [bars, tokens, viewW, viewH, maxAbs, hoverIndex, activeIndex, zeroY]);

  const hovered = hoverIndex !== null ? bars[hoverIndex] : null;

  return (
    <figure className={`ns-cwas inline-block ${className}`} aria-label={`${title}, waterfall chart`}>
      <style>{CSS}</style>
      <div className="flex items-center justify-between gap-3 pb-2">
        <span className="font-mono text-xs tracking-widest text-ns-muted">{title.toUpperCase()}</span>
        <span className="font-mono text-[10px] tracking-widest text-ns-muted">
          {excluded.size > 0 ? `${excluded.size} STEP${excluded.size > 1 ? "S" : ""} EXCLUDED` : "ALL STEPS ACTIVE"}
        </span>
      </div>

      <div className="relative" style={{ width: viewW, maxWidth: "100%" }}>
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          style={{ width: viewW, height: viewH, maxWidth: "100%", display: "block" }}
        />

        {bars.map((b) =>
          b.toggleable ? (
            <button
              key={b.index}
              type="button"
              id={`${uid}-hit-${b.index}`}
              tabIndex={activeIndex === b.index ? 0 : -1}
              aria-label={`${b.label}: ${formatValue(b.delta)}${b.excluded ? ", excluded" : ""}`}
              aria-pressed={!b.excluded}
              className="ns-cwas-hit absolute cursor-pointer border-0 bg-transparent p-0 outline-none"
              style={{
                left: LEFT_PAD + b.index * SLOT_W,
                top: TOP_PAD - 16,
                width: SLOT_W,
                height: PLOT_H + 16,
              }}
              onPointerEnter={() => setHoverIndex(b.index)}
              onPointerLeave={() => setHoverIndex((c) => (c === b.index ? null : c))}
              onFocus={() => {
                setActiveIndex(b.index);
                setHoverIndex(b.index);
              }}
              onBlur={() => setHoverIndex((c) => (c === b.index ? null : c))}
              onClick={() => toggle(b)}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  focusByOffset(-1);
                } else if (e.key === "ArrowRight") {
                  e.preventDefault();
                  focusByOffset(1);
                }
              }}
            />
          ) : (
            // start / running-total bars are display-only, not real controls
            <div
              key={b.index}
              aria-hidden="true"
              className="ns-cwas-hover absolute"
              style={{
                left: LEFT_PAD + b.index * SLOT_W,
                top: TOP_PAD - 16,
                width: SLOT_W,
                height: PLOT_H + 16,
              }}
              onPointerEnter={() => setHoverIndex(b.index)}
              onPointerLeave={() => setHoverIndex((c) => (c === b.index ? null : c))}
            />
          )
        )}

        {hovered && (
          <div
            aria-hidden="true"
            className="ns-cwas-tip pointer-events-none absolute z-10 rounded-sm border border-border bg-background px-2 py-1 font-mono text-[11px] shadow-sm"
            style={{
              left: `${((LEFT_PAD + hovered.index * SLOT_W + SLOT_W / 2) / viewW) * 100}%`,
              top: `${(Math.max(0, valueToY(Math.max(hovered.from, hovered.to)) - 46) / viewH) * 100}%`,
              transform: "translateX(-50%)",
            }}
          >
            <strong className="text-foreground">
              {hovered.toggleable ? formatValue(hovered.delta) : formatValue(hovered.to)}
            </strong>{" "}
            <span className="text-ns-muted">
              {hovered.toggleable ? `${formatValue(hovered.from)} → ${formatValue(hovered.to)}` : "running total"}
            </span>
          </div>
        )}
      </div>
    </figure>
  );
}

const CSS = `
.ns-cwas-hit { touch-action: manipulation; }
.ns-cwas-hit:focus-visible { outline: 2px solid var(--ns-accent); outline-offset: 2px; }
`;
