"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// CloudChamber — ambient awareness for a live event stream, styled as a
// Wilson cloud chamber: each real event condenses into a vapor trail, angle
// bucketed by category, length/brightness set by magnitude, heavy events
// forking short branch tracks. A quiet chamber vs one full of long streaks
// tells an on-call engineer something before any threshold fires.
//
// MECHANISM: no persistent ink buffer. Every event pushes a small batch of
// "stamps" (rx/ry fraction position, birth time, per-particle tau, peak
// alpha) into a plain array; each animation frame fully clears the canvas
// and redraws every live stamp from scratch at
// alpha = peak * exp(-age / tau), pruning anything decayed past ~5*tau. This
// is a deliberate departure from a destination-out accumulation buffer:
// destination-out at the low per-frame alpha a 6-10s fade requires rounds
// dst*(1-a) to no-op once dst*alpha < 0.5 in the 8-bit backing store, which
// stalls the fade at a permanent low haze instead of returning to empty —
// the same residue failure mode noted on command-palette-orbit. Redrawing
// from an explicit, analytically-decaying list has no such floor: once every
// stamp prunes out, the canvas is provably transparent again. A soft round
// sprite (radial gradient baked from the CURRENT --foreground token) is
// blitted per stamp with `lighter` compositing, so overlapping fresh
// particles brighten into a hot streak core while the tails stay soft —
// brightness is the only intensity channel, never hue.
//
// Track shape: origin is a random point inside the inner 64% of the box;
// direction is `angleForCategory` (a small canonical table for common
// categories, a deterministic hash bucket for anything else — this never
// throws for an unknown category string); distance covers speed * ~400ms,
// speed and per-particle brightness/radius/lifetime all driven by
// `magnitude`. Positions are stored as box-relative fractions and converted
// to px at DRAW time using the CURRENT box size, so an in-flight resize
// never distorts an already-spawned track. magnitude >= 0.68 also forks 1-2
// short branch tracks off a point partway along the primary path, at a
// randomized angle offset — the "heavy event ionizes harder" read.
//
// A11Y: the canvas is aria-hidden. The paired Geist Mono legend
// (role="log", aria-live="polite") is not decorative — it is the same
// event stream in words, name/category/magnitude, and it is what a screen
// reader user gets instead of the chamber. New rows are batched into one
// flush every `flushMs` so a burst of events produces one live-region
// announcement, not one per event. Under prefers-reduced-motion the canvas
// is not rendered at all; the legend takes the full width and gains a row
// of small static per-event tick marks (angle + brightness, zero motion) —
// the same information, still legible, never a frozen animation.
//
// Every drawn color is read from --foreground via getComputedStyle at mount
// and re-derived (sprite rebuilt) on every documentElement class change, so
// theme flips repaint correctly. The rAF loop pauses via IntersectionObserver
// while offscreen. Canvas 2D, zero dependencies.
// ---------------------------------------------------------------------------

export interface ChamberEvent {
  /** stable, unique id — used to detect "new" events across renders */
  id: string;
  /** short human label, shown in the legend and announced */
  name: string;
  /** free-form category string; drives the track's angle bucket */
  category: string;
  /** 0..1 severity/size — drives speed, length, brightness, branching. default 0.4 */
  magnitude?: number;
  /** epoch ms, display only */
  timestamp?: number;
}

export interface CloudChamberProps {
  /** the event stream so far — append new items, ids already seen are ignored */
  events: ChamberEvent[];
  /** accessible name for the log region */
  label?: string;
  /** override or extend the category -> angle (degrees) table */
  categoryAngles?: Record<string, number>;
  /** rows kept in the legend / considered for tick marks. default 30 */
  maxLegendItems?: number;
  /** batching window (ms) for legend rows + the live-region announcement. default 350 */
  flushMs?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

type RGB = [number, number, number];

interface Stamp {
  rx: number;
  ry: number;
  r: number;
  born: number; // performance.now() ms — may be in the future (staggered reveal)
  tau: number; // seconds
  peak: number; // alpha ceiling 0..1
}

const MAX_STAMPS = 700;
const TRAVEL_MS = 400;

// canonical angle table (degrees, canvas convention: 0 = right, 90 = down).
// anything not listed here falls back to a deterministic hash bucket, so
// no category string is ever "unhandled".
const CANONICAL_ANGLES: Record<string, number> = {
  deploy: -50,
  release: -50,
  error: 100,
  crash: 100,
  purchase: 15,
  payment: 15,
  warning: 135,
  signal: -125,
};

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function angleForCategory(category: string, overrides?: Record<string, number>): number {
  if (overrides && overrides[category] !== undefined) return overrides[category];
  const canon = CANONICAL_ANGLES[category.toLowerCase()];
  if (canon !== undefined) return canon;
  return (hashString(category) % 24) * 15;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const deg2rad = (d: number) => (d * Math.PI) / 180;

function magnitudeOf(e: ChamberEvent): number {
  return clamp01(e.magnitude ?? 0.4);
}

function parseHex(v: string): RGB | null {
  const m = v.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let h = m[1]!;
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function readForeground(el: HTMLElement): RGB {
  const cs = getComputedStyle(el);
  return parseHex(cs.getPropertyValue("--foreground")) ?? [237, 237, 237];
}

// baked once per token derivation: a soft round dot, tinted from the token
// so nothing downstream ever touches a color literal.
function buildSprite(rgb: RGB): HTMLCanvasElement {
  const size = 48;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d");
  if (!g) return c;
  const [r, gr, b] = rgb;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, `rgba(${r},${gr},${b},1)`);
  grad.addColorStop(0.45, `rgba(${r},${gr},${b},0.5)`);
  grad.addColorStop(1, `rgba(${r},${gr},${b},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

function computeBranch(
  ox: number,
  oy: number,
  ex: number,
  ey: number,
  angle: number,
  magnitude: number
) {
  const originF = lerp(0.3, 0.65, Math.random());
  const bx = lerp(ox, ex, originF);
  const by = lerp(oy, ey, originF);
  const sign = Math.random() < 0.5 ? -1 : 1;
  const branchAngle = angle + sign * deg2rad(35 + Math.random() * 35);
  const branchMag = magnitude * 0.55;
  const branchSpeed = lerp(90, 340, branchMag);
  const branchTravelMs = TRAVEL_MS * 0.55;
  const branchDist = (branchSpeed * branchTravelMs) / 1000;
  const bex = bx + Math.cos(branchAngle) * branchDist;
  const bey = by + Math.sin(branchAngle) * branchDist;
  const count = Math.max(3, Math.round(lerp(3, 8, branchMag)));
  const tau = lerp(2.2, 3.4, branchMag);
  const delay = originF * TRAVEL_MS;
  return { bx, by, bex, bey, count, tau, delay, branchTravelMs, branchMag };
}

function spawnTrack(
  ev: ChamberEvent,
  stamps: Stamp[],
  dims: { w: number; h: number },
  categoryAngles: Record<string, number> | undefined,
  nowMs: number
) {
  const w0 = dims.w > 0 ? dims.w : 400;
  const h0 = dims.h > 0 ? dims.h : 220;
  const magnitude = magnitudeOf(ev);
  const angle = deg2rad(angleForCategory(ev.category, categoryAngles));
  const speed = lerp(90, 340, magnitude);
  const dist = (speed * TRAVEL_MS) / 1000;
  const ox = lerp(w0 * 0.18, w0 * 0.82, Math.random());
  const oy = lerp(h0 * 0.18, h0 * 0.82, Math.random());
  const ex = ox + Math.cos(angle) * dist;
  const ey = oy + Math.sin(angle) * dist;
  const count = Math.max(6, Math.round(lerp(6, 18, magnitude)));
  const tau = lerp(2.2, 3.4, magnitude);

  for (let i = 0; i < count; i++) {
    const f = count === 1 ? 0 : i / (count - 1);
    stamps.push({
      rx: lerp(ox, ex, f) / w0,
      ry: lerp(oy, ey, f) / h0,
      r: lerp(1.1, 2.6, magnitude) * (0.85 + Math.random() * 0.3),
      born: nowMs + f * TRAVEL_MS,
      tau,
      peak: lerp(0.35, 0.95, magnitude),
    });
  }

  // heavier events ionize harder: fork 1-2 short branch tracks
  if (magnitude >= 0.68) {
    const branchCount = magnitude >= 0.88 ? 2 : 1;
    for (let b = 0; b < branchCount; b++) {
      const branch = computeBranch(ox, oy, ex, ey, angle, magnitude);
      for (let i = 0; i < branch.count; i++) {
        const f = branch.count === 1 ? 0 : i / (branch.count - 1);
        stamps.push({
          rx: lerp(branch.bx, branch.bex, f) / w0,
          ry: lerp(branch.by, branch.bey, f) / h0,
          r: lerp(1.0, 2.0, branch.branchMag) * (0.85 + Math.random() * 0.3),
          born: nowMs + branch.delay + f * branch.branchTravelMs,
          tau: branch.tau,
          peak: lerp(0.3, 0.75, branch.branchMag),
        });
      }
    }
  }

  if (stamps.length > MAX_STAMPS) stamps.splice(0, stamps.length - MAX_STAMPS);
}

// -------------------------------------------------------- event log hook ---
// Diffs `events` by id, batches genuinely-new arrivals into one flush every
// `flushMs` — a burst of events produces one legend update and one
// aria-live announcement, not one per event. Shared by both the canvas and
// reduced-motion paths (the throttle is an a11y/legend concern, independent
// of whether the chamber itself is rendered).
function useEventLog(events: ChamberEvent[], flushMs: number, maxItems: number) {
  const seenRef = useRef<Set<string>>(new Set());
  const pendingRef = useRef<ChamberEvent[]>([]);
  const timerRef = useRef<number | undefined>(undefined);
  const [rows, setRows] = useState<ChamberEvent[]>([]);
  const [liveText, setLiveText] = useState("");

  useEffect(() => {
    const fresh: ChamberEvent[] = [];
    for (const e of events) {
      if (!seenRef.current.has(e.id)) {
        seenRef.current.add(e.id);
        fresh.push(e);
      }
    }
    if (fresh.length === 0) return;
    pendingRef.current.push(...fresh);
    if (timerRef.current === undefined) {
      timerRef.current = window.setTimeout(() => {
        const batch = pendingRef.current;
        pendingRef.current = [];
        timerRef.current = undefined;
        setRows((prev) => [...batch].reverse().concat(prev).slice(0, maxItems));
        setLiveText(
          batch.length === 1
            ? `${batch[0]!.name}, ${batch[0]!.category}, magnitude ${Math.round(magnitudeOf(batch[0]!) * 100)} percent`
            : `${batch.length} events: ${batch.map((e) => e.name).join(", ")}`
        );
      }, flushMs);
    }
  }, [events, flushMs, maxItems]);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  return { rows, liveText };
}

function useReducedMotionPref(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

export function CloudChamber({
  events,
  label = "Live event chamber",
  categoryAngles,
  maxLegendItems = 30,
  flushMs = 350,
  className = "h-96",
}: CloudChamberProps) {
  const reduced = useReducedMotionPref();
  const { rows, liveText } = useEventLog(events, flushMs, maxLegendItems);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stampsRef = useRef<Stamp[]>([]);
  const dimsRef = useRef({ w: 0, h: 0 });

  // spawn a track the instant a genuinely new event lands — this must not
  // be throttled by the legend batching above, the vapor should condense in
  // step with the real stream.
  const spawnSeenRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (reduced) return;
    const nowMs = performance.now();
    for (const e of events) {
      if (spawnSeenRef.current.has(e.id)) continue;
      spawnSeenRef.current.add(e.id);
      spawnTrack(e, stampsRef.current, dimsRef.current, categoryAngles, nowMs);
    }
  }, [events, categoryAngles, reduced]);

  useEffect(() => {
    if (reduced) return;
    const root = containerRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let dpr = 1;
    const resize = () => {
      const rect = root.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      dimsRef.current = { w, h };
    };
    resize();

    let fg = readForeground(root);
    let sprite = buildSprite(fg);
    const mo = new MutationObserver(() => {
      fg = readForeground(root);
      sprite = buildSprite(fg);
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    let raf = 0;
    let visible = true;

    const draw = () => {
      if (w < 1 || h < 1) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const now = performance.now();
      const stamps = stampsRef.current;
      const alive: Stamp[] = [];
      ctx.globalCompositeOperation = "lighter";
      for (const s of stamps) {
        const age = (now - s.born) / 1000;
        if (age < 0) {
          alive.push(s); // not yet revealed — stays pending
          continue;
        }
        if (age > s.tau * 5) continue; // fully decayed, drop
        const alpha = s.peak * Math.exp(-age / s.tau);
        if (alpha > 0.008) {
          const x = s.rx * w;
          const y = s.ry * h;
          ctx.globalAlpha = Math.min(1, alpha);
          ctx.drawImage(sprite, x - s.r, y - s.r, s.r * 2, s.r * 2);
        }
        alive.push(s);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      stampsRef.current = alive;
    };

    const loop = () => {
      draw();
      raf = visible ? requestAnimationFrame(loop) : 0;
    };

    const ro = new ResizeObserver(() => resize());
    ro.observe(root);

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        visible = entry.isIntersecting;
        if (visible && !raf) raf = requestAnimationFrame(loop);
      },
      { threshold: 0 }
    );
    io.observe(root);

    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      raf = 0;
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
    };
  }, [reduced]);

  return (
    <div className={`flex w-full gap-4 ${className}`}>
      {!reduced && (
        <div
          ref={containerRef}
          aria-hidden
          className="relative min-w-0 flex-1 overflow-hidden rounded-md border border-border bg-background"
        >
          <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
        </div>
      )}

      <div className={`flex min-w-0 flex-col ${reduced ? "w-full" : "w-64 shrink-0"}`}>
        {reduced && (
          <div aria-hidden className="mb-3 flex flex-wrap items-end gap-2">
            {rows.length === 0 ? (
              <span className="font-mono text-[10px] text-ns-muted">no ticks yet</span>
            ) : (
              rows
                .slice(0, 40)
                .reverse()
                .map((e) => {
                  const m = magnitudeOf(e);
                  const pct = Math.round(30 + m * 70);
                  return (
                    <span
                      key={e.id}
                      title={`${e.name} — ${e.category}`}
                      className="inline-block w-[2px] rounded-full"
                      style={{
                        height: `${14 + m * 16}px`,
                        transform: `rotate(${angleForCategory(e.category, categoryAngles) - 90}deg)`,
                        backgroundColor: `color-mix(in srgb, var(--foreground) ${pct}%, var(--ns-muted))`,
                      }}
                    />
                  );
                })
            )}
          </div>
        )}

        <div
          role="log"
          aria-live="polite"
          aria-atomic="false"
          aria-label={label}
          className="min-h-0 flex-1 overflow-y-auto rounded-md border border-border bg-background p-3 font-mono text-[11px] leading-relaxed"
        >
          {rows.length === 0 ? (
            <p className="text-ns-muted">Chamber quiet — no events yet.</p>
          ) : (
            <ul className="space-y-1">
              {rows.map((e) => (
                <li key={e.id} className="truncate text-ns-muted">
                  <span className="text-foreground">{e.name}</span> · {e.category} ·{" "}
                  {Math.round(magnitudeOf(e) * 100)}%
                </li>
              ))}
            </ul>
          )}
          <span className="sr-only">{liveText}</span>
        </div>
      </div>
    </div>
  );
}
