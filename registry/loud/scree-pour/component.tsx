"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

type ViewId = "overview" | "detail";
type Tone = "foreground" | "muted" | "border" | "accent";

interface RegionRect {
  x: number;
  y: number;
  w: number;
  h: number;
  tone: Tone;
}

interface Grain {
  x: number;
  y: number;
  ox: number;
  oy: number;
  tx: number;
  ty: number;
  rgb: string;
  baseAlpha: number;
  size: number;
  delay: number;
  matched: boolean;
  driftX: number;
  localSpan: number; // ms available for this grain's own animation (duration - delay)
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

const DURATION = 900; // ms, full pour simulation
const REDUCED_FADE = 150; // ms, reduced-motion / low-power substitute
const GRAVITY_MATCHED = 1500; // px/s^2, fades out as the funnel takes over
const GRAVITY_FALL = 2100; // px/s^2, unmatched (departing) grains
const K_START = 4; // funnel spring constant at release
const K_END = 150; // funnel spring constant at settle
const DAMP_MATCHED = 0.9;
const DAMP_FALL = 0.995;
const MAX_GRAINS = 4000;
const LOW_POWER_THRESHOLD_MS = 45;

function smoothstep(t: number) {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

// deterministic-enough color parsing for the four house tokens (hex or rgb()).
function parseColor(raw: string): RGB | null {
  const v = raw.trim();
  if (!v) return null;
  if (v.startsWith("#")) {
    const hex = v.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      if ([r, g, b].some(Number.isNaN)) return null;
      return { r, g, b };
    }
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if ([r, g, b].some(Number.isNaN)) return null;
      return { r, g, b };
    }
    return null;
  }
  const m = v.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  if (m) return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
  return null;
}

function rgbString(rgb: RGB | null, fallback: string) {
  if (!rgb) return fallback;
  return `${rgb.r},${rgb.g},${rgb.b}`;
}

// a fixed amount of arithmetic timed synchronously: on a throttled/low-power
// device this takes visibly longer than on a normal one, standing in for a
// frame-budget check without needing to burn a real animation frame to learn
// it. The threshold errs toward NOT flagging: a false negative just runs the
// full pour (harmless), a false positive silently skips the signature effect.
function detectLowPower(): boolean {
  if (typeof performance === "undefined") return false;
  const t0 = performance.now();
  let acc = 0;
  for (let i = 0; i < 200_000; i++) {
    acc += Math.sqrt(i) * Math.sin(i);
  }
  const elapsed = performance.now() - t0;
  // guard against the loop being optimized away entirely
  return elapsed > LOW_POWER_THRESHOLD_MS || !Number.isFinite(acc);
}

function captureRects(container: HTMLElement): Map<string, RegionRect> {
  const cRect = container.getBoundingClientRect();
  const map = new Map<string, RegionRect>();
  container.querySelectorAll<HTMLElement>("[data-scree-id]").forEach((el) => {
    const id = el.dataset.screeId;
    if (!id) return;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    const tone = (el.dataset.screeTone as Tone) || "foreground";
    map.set(id, { x: r.left - cRect.left, y: r.top - cRect.top, w: r.width, h: r.height, tone });
  });
  return map;
}

function buildGrains(
  oldRects: Map<string, RegionRect>,
  newRects: Map<string, RegionRect>,
  rgbTable: Record<Tone, string>,
  budget: number
): Grain[] {
  const entries: { rect: RegionRect; match?: RegionRect }[] = [];
  let totalArea = 0;
  oldRects.forEach((rect, id) => {
    entries.push({ rect, match: newRects.get(id) });
    totalArea += Math.max(rect.w * rect.h, 1);
  });
  if (entries.length === 0) return [];

  const grains: Grain[] = [];
  for (const { rect, match } of entries) {
    const area = Math.max(rect.w * rect.h, 40);
    const count = Math.max(14, Math.round((budget * area) / totalArea));
    const rgb = rgbTable[rect.tone];
    for (let i = 0; i < count; i++) {
      const gx = rect.x + Math.random() * rect.w;
      const gy = rect.y + Math.random() * rect.h;
      const size = 2 + Math.random();
      const delay = Math.random() * 140;
      const baseAlpha = 0.62 + Math.random() * 0.32;
      if (match) {
        const tx = match.x + Math.random() * match.w;
        const ty = match.y + Math.random() * match.h;
        grains.push({
          x: gx,
          y: gy,
          ox: gx,
          oy: gy,
          tx,
          ty,
          rgb,
          baseAlpha,
          size,
          delay,
          matched: true,
          driftX: 0,
          localSpan: Math.max(120, DURATION - delay),
        });
      } else {
        grains.push({
          x: gx,
          y: gy,
          ox: gx,
          oy: gy,
          tx: gx,
          ty: rect.y + rect.h + 400,
          rgb,
          baseAlpha,
          size,
          delay,
          matched: false,
          driftX: (Math.random() - 0.5) * 70,
          localSpan: Math.max(120, DURATION - delay),
        });
      }
      if (grains.length >= MAX_GRAINS) return grains;
    }
  }
  return grains;
}

const LABELS: Record<ViewId, string> = {
  overview: "Overview",
  detail: "Sessions detail",
};

/**
 * A layout transition where the outgoing panel crumbles into token-colored
 * grains that pour into the incoming panel's silhouette — an hourglass turn
 * between a dashboard overview and a metric's detail pivot. The DOM swap
 * itself is instant and fully accessible from frame one (real content,
 * correct focus, a live-region announcement); the grains are a canvas
 * overlay riding on top that explains where the old layout's matter went,
 * then fades to nothing once the new layout has settled.
 */
export function ScreePour({
  className = "",
  grainBudget = 2400,
}: {
  className?: string;
  /** total grains spawned per transition, distributed across regions by area */
  grainBudget?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const headingOverviewRef = useRef<HTMLHeadingElement>(null);
  const headingDetailRef = useRef<HTMLHeadingElement>(null);
  const liveRef = useRef<HTMLParagraphElement>(null);

  const [active, setActive] = useState<ViewId>("overview");
  const [phase, setPhase] = useState<"idle" | "pouring">("idle");
  const [lastUpdated, setLastUpdated] = useState("just now");

  const phaseRef = useRef<"idle" | "pouring">("idle");
  const pendingRef = useRef<{ oldRects: Map<string, RegionRect>; next: ViewId } | null>(null);
  const rafRef = useRef(0);
  const colorsRef = useRef<Record<Tone, string>>({
    foreground: "23,23,23",
    muted: "77,77,77",
    border: "235,235,235",
    accent: "0,107,255",
  });
  const reducedMotionRef = useRef(false);
  const lowPowerRef = useRef(false);

  // theme tokens: read at mount, re-read whenever <html>'s class changes
  useEffect(() => {
    const read = () => {
      const cs = getComputedStyle(document.documentElement);
      colorsRef.current = {
        foreground: rgbString(
          parseColor(cs.getPropertyValue("--foreground")),
          colorsRef.current.foreground
        ),
        muted: rgbString(parseColor(cs.getPropertyValue("--muted")), colorsRef.current.muted),
        border: rgbString(parseColor(cs.getPropertyValue("--border")), colorsRef.current.border),
        accent: rgbString(parseColor(cs.getPropertyValue("--accent")), colorsRef.current.accent),
      };
    };
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);

  // prefers-reduced-motion, live
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = mq.matches;
    const onChange = (e: MediaQueryListEvent) => {
      reducedMotionRef.current = e.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // one-shot frame-budget check standing in for low-power device detection
  useEffect(() => {
    lowPowerRef.current = detectLowPower();
  }, []);

  // canvas backing store tracks the container, dpr-clamped
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  const runPour = (oldRects: Map<string, RegionRect>, newRects: Map<string, RegionRect>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      phaseRef.current = "idle";
      setPhase("idle");
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      phaseRef.current = "idle";
      setPhase("idle");
      return;
    }
    const grains = buildGrains(oldRects, newRects, colorsRef.current, grainBudget);
    if (grains.length === 0) {
      phaseRef.current = "idle";
      setPhase("idle");
      return;
    }

    const start = performance.now();
    let lastT = start;

    const frame = (now: number) => {
      const elapsed = now - start;
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);

      for (const g of grains) {
        const gElapsed = elapsed - g.delay;
        if (gElapsed < 0) {
          // not yet released: sits at its spawn point, still solid
          ctx.fillStyle = `rgba(${g.rgb},${g.baseAlpha.toFixed(3)})`;
          ctx.fillRect(g.x - g.size / 2, g.y - g.size / 2, g.size, g.size);
          continue;
        }
        const localT = clamp01(gElapsed / g.localSpan);
        let alpha: number;
        if (g.matched) {
          const k = K_START + (K_END - K_START) * smoothstep(localT);
          const gravity = GRAVITY_MATCHED * (1 - smoothstep(localT));
          const ax = (g.tx - g.x) * k;
          const ay = (g.ty - g.y) * k + gravity;
          const vx = (g.x - g.ox) * DAMP_MATCHED;
          const vy = (g.y - g.oy) * DAMP_MATCHED;
          g.ox = g.x;
          g.oy = g.y;
          g.x += vx + ax * dt * dt;
          g.y += vy + ay * dt * dt;
          const fadeT = clamp01((localT - 0.6) / 0.4);
          alpha = g.baseAlpha * (1 - smoothstep(fadeT));
        } else {
          const ax = g.driftX;
          const ay = GRAVITY_FALL;
          const vx = (g.x - g.ox) * DAMP_FALL;
          const vy = (g.y - g.oy) * DAMP_FALL;
          g.ox = g.x;
          g.oy = g.y;
          g.x += vx + ax * dt * dt;
          g.y += vy + ay * dt * dt;
          const fadeT = clamp01((localT - 0.5) / 0.5);
          alpha = g.baseAlpha * (1 - smoothstep(fadeT));
        }
        if (alpha <= 0.01) continue;
        ctx.fillStyle = `rgba(${g.rgb},${alpha.toFixed(3)})`;
        ctx.fillRect(g.x - g.size / 2, g.y - g.size / 2, g.size, g.size);
      }

      if (elapsed < DURATION) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, w, h);
        rafRef.current = 0;
        phaseRef.current = "idle";
        setPhase("idle");
      }
    };
    rafRef.current = requestAnimationFrame(frame);
  };

  // after a triggered view swap commits, measure the new layout and either
  // run the full pour or (reduced motion / low power) a plain 150ms fade.
  useLayoutEffect(() => {
    const pending = pendingRef.current;
    if (!pending || pending.next !== active) return;
    pendingRef.current = null;

    const headingEl = active === "detail" ? headingDetailRef.current : headingOverviewRef.current;
    headingEl?.focus();

    if (reducedMotionRef.current || lowPowerRef.current) {
      const panelEl = panelRef.current;
      if (panelEl) {
        // floor at 0.6, never 0 — the panel must never read as transparent,
        // even a single check instant after this branch runs
        panelEl.style.opacity = "0.6";
        panelEl.style.transition = `opacity ${REDUCED_FADE}ms cubic-bezier(0.16,1,0.3,1)`;
        requestAnimationFrame(() => {
          panelEl.style.opacity = "1";
        });
        window.setTimeout(() => {
          panelEl.style.transition = "";
        }, REDUCED_FADE + 40);
      }
      phaseRef.current = "idle";
      setPhase("idle");
      return;
    }

    const container = containerRef.current;
    if (!container) {
      phaseRef.current = "idle";
      setPhase("idle");
      return;
    }
    const newRects = captureRects(container);
    runPour(pending.oldRects, newRects);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const trigger = (next: ViewId) => {
    if (phaseRef.current === "pouring") return;
    if (liveRef.current) liveRef.current.textContent = `Now showing: ${LABELS[next]}`;
    const container = containerRef.current;
    if (!container) {
      setActive(next);
      return;
    }
    const oldRects = captureRects(container);
    pendingRef.current = { oldRects, next };
    phaseRef.current = "pouring";
    setPhase("pouring");
    setActive(next);
  };

  const refresh = () => setLastUpdated(new Date().toLocaleTimeString());

  const triggerClass =
    "inline-flex items-center gap-1.5 rounded-sm border border-accent px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60";

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden rounded-lg border border-border bg-background ${className}`}
    >
      <p ref={liveRef} aria-live="polite" className="sr-only" />

      {active === "overview" ? (
        <div ref={panelRef} data-scree-view="overview" className="flex h-full flex-col gap-6 p-6">
          <div className="flex items-center justify-between gap-3">
            <h2
              ref={headingOverviewRef}
              tabIndex={-1}
              data-scree-id="heading"
              data-scree-tone="foreground"
              className="text-sm font-medium text-foreground outline-none"
            >
              Overview
            </h2>
            <div data-scree-id="meta" data-scree-tone="muted" className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-muted">Updated {lastUpdated}</span>
              <button
                type="button"
                onClick={refresh}
                aria-label="Refresh data"
                className="rounded-sm border border-border p-1 text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <svg viewBox="0 0 16 16" width="12" height="12" fill="none" aria-hidden>
                  <path
                    d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v3h-3"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>

          <div className="grid flex-1 grid-cols-3 gap-3">
            <div
              data-scree-id="focus-metric"
              data-scree-tone="foreground"
              className="flex flex-col justify-between rounded-md border border-border p-3"
            >
              <span className="font-mono text-[11px] text-muted">Sessions</span>
              <span className="text-2xl font-medium tabular-nums text-foreground">12,482</span>
            </div>
            <div
              data-scree-id="metric-b"
              data-scree-tone="foreground"
              className="flex flex-col justify-between rounded-md border border-border p-3"
            >
              <span className="font-mono text-[11px] text-muted">Revenue</span>
              <span className="text-2xl font-medium tabular-nums text-foreground">$8.2k</span>
            </div>
            <div
              data-scree-id="metric-c"
              data-scree-tone="foreground"
              className="flex flex-col justify-between rounded-md border border-border p-3"
            >
              <span className="font-mono text-[11px] text-muted">Users</span>
              <span className="text-2xl font-medium tabular-nums text-foreground">3,014</span>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              data-scree-id="action"
              data-scree-tone="accent"
              data-scree-toggle="to-detail"
              disabled={phase === "pouring"}
              onClick={() => trigger("detail")}
              className={triggerClass}
            >
              View details
              <svg viewBox="0 0 16 16" width="11" height="11" fill="none" aria-hidden>
                <path
                  d="M6 3.5 10.5 8 6 12.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      ) : (
        <div ref={panelRef} data-scree-view="detail" className="flex h-full flex-col gap-6 p-6">
          <button
            type="button"
            data-scree-id="action"
            data-scree-tone="accent"
            data-scree-toggle="to-overview"
            disabled={phase === "pouring"}
            onClick={() => trigger("overview")}
            className="inline-flex w-fit items-center gap-1.5 rounded-sm px-1 py-1 text-xs font-medium text-accent transition-colors hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
          >
            <svg viewBox="0 0 16 16" width="11" height="11" fill="none" aria-hidden>
              <path
                d="M10 3.5 5.5 8l4.5 4.5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Back to overview
          </button>

          <h2
            ref={headingDetailRef}
            tabIndex={-1}
            data-scree-id="heading"
            data-scree-tone="foreground"
            className="text-sm font-medium text-foreground outline-none"
          >
            Sessions detail
          </h2>

          <div className="flex flex-1 flex-col justify-center gap-3">
            <span
              data-scree-id="focus-metric"
              data-scree-tone="foreground"
              className="text-5xl font-medium tabular-nums text-foreground"
            >
              12,482
            </span>
            <p
              data-scree-id="description"
              data-scree-tone="muted"
              className="max-w-sm text-xs leading-relaxed text-muted"
            >
              Sessions across all surfaces, last 24 hours. Up 6.4% from the previous day, driven
              mostly by returning users on mobile.
            </p>
          </div>
        </div>
      )}

      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
    </div>
  );
}
