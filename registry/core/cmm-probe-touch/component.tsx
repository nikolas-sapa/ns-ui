"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// CmmProbeTouch — an empty-state ambient built on coordinate-measuring
// machine (CMM) touch-trigger probing, standard contact metrology. A probe
// tip indexes to a programmed station on a part's outline, approaches
// slowly along the LOCAL SURFACE NORMAL, dwells at contact (the trigger
// fires — a luminance flash, never a colour change), retracts, and travels
// to the next station — an inspection pass that never finishes, because a
// CMM program loops the same routine part after part.
//
// The part is a single fixed closed contour (rounded-rect silhouette with a
// notch and a boss cut in) built once from an explicit vertex list —
// straight edges plus subdivided corner/boss arcs — then walked into one
// dense, evenly-arc-length-parameterised polyline. STATIONS = 18 stations
// sit at even arc-length fractions of that polyline; each station's local
// outward normal comes from the tangent of its two neighbours on the dense
// polyline, sign-checked against the contour's centroid so it always points
// away from the part.
//
// Per-station cycle is a literal 1.2s state machine (420ms approach / 180ms
// dwell / 300ms retract / 300ms travel-to-next) driven off ONE monotonic
// virtual clock — no per-station timers, no array of "in-flight" probes.
// Touched-point age is read analytically off that same clock: station k's
// most recent contact time is `k*1200 + APPROACH_MS` mod the 21.6s lap, so
// `age = (nowInLap - thatTime + LAP) % LAP` is always "time since k was
// last touched", whether that touch was earlier this lap or the previous
// one — no history array, no per-station timestamp bookkeeping. The clock
// starts pre-seeded a full lap plus a fractional offset ahead of zero, so
// every station already has a valid touch age at t0 (a rolling trail with
// history, never a blank contour) and the lap keeps indexing forever.
// ---------------------------------------------------------------------------

interface Vec {
  x: number;
  y: number;
}

const STATIONS = 18;
const APPROACH_MS = 420;
const DWELL_MS = 180;
const RETRACT_MS = 300;
const TRAVEL_MS = 300;
const STATION_MS = APPROACH_MS + DWELL_MS + RETRACT_MS + TRAVEL_MS; // 1200
const LAP_MS = STATION_MS * STATIONS; // 21600
const SEED_LAP_FRACTION = 0.42; // t0 phase within the pre-seeded lap

// local shape constants (unitless, scaled by the container's smaller dimension)
const HX = 0.82;
const HY = 0.5;
const CORNER_R = 0.12;
const BOSS_R = 0.15;
const NOTCH_HALF = 0.15;
const NOTCH_DEPTH = 0.16;
const ARC_STEPS = 14;

const APPROACH_DIST = 0.24; // station normal offset, in the same local units
const NORMAL_SAMPLE_DELTA = 0.004; // arc-length fraction used for tangent finite-difference

const FREEZE_STATION = 9;
const FREEZE_PHASE = "contact-dwell-station9";

function arcPoints(cx: number, cy: number, r: number, a0: number, a1: number, steps: number): Vec[] {
  const pts: Vec[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = a0 + (a1 - a0) * (i / steps);
    pts.push({ x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) });
  }
  return pts;
}

/** Explicit vertex walk of the part silhouette: top edge with a rectangular
 * notch, rounded top-right corner, right edge with a semicircular boss cut
 * outward, rounded bottom-right corner, bottom edge, rounded bottom-left
 * corner, left edge, rounded top-left corner, closing back to start. */
function buildOutline(): Vec[] {
  const pts: Vec[] = [];
  const push = (p: Vec) => {
    const prev = pts[pts.length - 1];
    if (!prev || Math.hypot(p.x - prev.x, p.y - prev.y) > 1e-6) pts.push(p);
  };

  push({ x: -HX + CORNER_R, y: -HY });
  push({ x: -NOTCH_HALF, y: -HY });
  push({ x: -NOTCH_HALF, y: -HY + NOTCH_DEPTH });
  push({ x: NOTCH_HALF, y: -HY + NOTCH_DEPTH });
  push({ x: NOTCH_HALF, y: -HY });
  push({ x: HX - CORNER_R, y: -HY });
  for (const p of arcPoints(HX - CORNER_R, -HY + CORNER_R, CORNER_R, -Math.PI / 2, 0, ARC_STEPS)) push(p);
  push({ x: HX, y: -BOSS_R });
  for (const p of arcPoints(HX, 0, BOSS_R, -Math.PI / 2, Math.PI / 2, ARC_STEPS)) push(p);
  push({ x: HX, y: HY - CORNER_R });
  for (const p of arcPoints(HX - CORNER_R, HY - CORNER_R, CORNER_R, 0, Math.PI / 2, ARC_STEPS)) push(p);
  push({ x: -HX + CORNER_R, y: HY });
  for (const p of arcPoints(-HX + CORNER_R, HY - CORNER_R, CORNER_R, Math.PI / 2, Math.PI, ARC_STEPS)) push(p);
  push({ x: -HX, y: -HY + CORNER_R });
  for (const p of arcPoints(-HX + CORNER_R, -HY + CORNER_R, CORNER_R, Math.PI, (3 * Math.PI) / 2, ARC_STEPS)) push(p);
  return pts;
}

/** A closed polyline resampled into a lookup usable at any arc-length
 * fraction s in [0,1) via linear interpolation between its cumulative
 * lengths — the single source of truth for both the drawn contour and the
 * evenly-spaced station positions. */
class ArcPath {
  private readonly pts: Vec[];
  private readonly cum: number[];
  readonly total: number;
  readonly centroid: Vec;

  constructor(pts: Vec[]) {
    this.pts = pts;
    const cum = [0];
    let sum = 0;
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]!;
      const b = pts[(i + 1) % pts.length]!;
      sum += Math.hypot(b.x - a.x, b.y - a.y);
      cum.push(sum);
      cx += a.x;
      cy += a.y;
    }
    this.cum = cum;
    this.total = sum;
    this.centroid = { x: cx / pts.length, y: cy / pts.length };
  }

  at(sFrac: number): Vec {
    const n = this.pts.length;
    let s = ((sFrac % 1) + 1) % 1;
    const target = s * this.total;
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.cum[mid]! <= target) lo = mid;
      else hi = mid - 1;
    }
    const a = this.pts[lo]!;
    const b = this.pts[(lo + 1) % n]!;
    const segLen = this.cum[lo + 1]! - this.cum[lo]!;
    const t = segLen > 1e-9 ? (target - this.cum[lo]!) / segLen : 0;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }

  normalAt(sFrac: number): Vec {
    const a = this.at(sFrac - NORMAL_SAMPLE_DELTA);
    const b = this.at(sFrac + NORMAL_SAMPLE_DELTA);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len;
    let ny = dx / len;
    const p = this.at(sFrac);
    const outSign = (p.x - this.centroid.x) * nx + (p.y - this.centroid.y) * ny;
    if (outSign < 0) {
      nx = -nx;
      ny = -ny;
    }
    return { x: nx, y: ny };
  }
}

function easeOutCubic(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}

function easeInCubic(t: number): number {
  return t * t * t;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** deterministic small-int hash -> a plausible synthetic deviation reading
 * in mm, stable per station index across renders and reduced-motion. */
function syntheticDeviation(i: number): string {
  const h = Math.sin(i * 12.9898) * 43758.5453;
  const frac = h - Math.floor(h);
  const mm = (frac - 0.5) * 0.036;
  const sign = mm >= 0 ? "+" : "-";
  return `${sign}${Math.abs(mm).toFixed(3)}mm`;
}

export interface CmmProbeTouchProps {
  /** icon/card box size in px (square) */
  size?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function CmmProbeTouch({ size = 220, className = "" }: CmmProbeTouchProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [activeStation, setActiveStation] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const pathRef = useRef<ArcPath | null>(null);
  if (!pathRef.current) pathRef.current = new ArcPath(buildOutline());

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const path = pathRef.current!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let fg = "currentColor";
    let muted = "currentColor";
    let border = "currentColor";

    const readTokens = () => {
      const s = getComputedStyle(document.documentElement);
      fg = s.getPropertyValue("--foreground").trim() || "currentColor";
      muted = s.getPropertyValue("--ns-muted").trim() || fg;
      border = s.getPropertyValue("--border").trim() || muted;
    };

    let width = 0;
    let height = 0;
    let dpr = 1;
    let sized = false;
    let disposed = false;
    let visible = true;

    let scale = 1;
    let originX = 0;
    let originY = 0;

    const toScreen = (p: Vec): Vec => ({ x: originX + p.x * scale, y: originY + p.y * scale });

    let raf = 0;
    let last = 0;
    let elapsed = LAP_MS + SEED_LAP_FRACTION * LAP_MS; // pre-seeded virtual clock, ms

    const stationTouchTime = (k: number) => k * STATION_MS + APPROACH_MS;

    const stationAge = (k: number, nowMs: number): number => {
      const nowInLap = ((nowMs % LAP_MS) + LAP_MS) % LAP_MS;
      const touch = stationTouchTime(k);
      return ((nowInLap - touch + LAP_MS) % LAP_MS) || 0;
    };

    const stationScreenPoint = (k: number): Vec => toScreen(path.at(k / STATIONS));
    const stationApproachPoint = (k: number): Vec => {
      const p = path.at(k / STATIONS);
      const n = path.normalAt(k / STATIONS);
      return toScreen({ x: p.x + n.x * APPROACH_DIST, y: p.y + n.y * APPROACH_DIST });
    };

    const drawContour = () => {
      ctx.beginPath();
      const n = 200;
      for (let i = 0; i <= n; i++) {
        const p = toScreen(path.at(i / n));
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.strokeStyle = border;
      ctx.lineWidth = Math.max(1, scale * 0.006);
      ctx.stroke();
    };

    const dotR = () => Math.max(1.6, scale * 0.02);

    const drawTouchedPoints = (nowMs: number) => {
      const r = dotR();
      // base pass: every station drawn once in --ns-muted at full alpha
      ctx.fillStyle = muted;
      for (let k = 0; k < STATIONS; k++) {
        const p = stationScreenPoint(k);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      // overlay pass: --foreground crossfaded in by how recently each
      // station was touched — alpha ramp only, never string arithmetic
      ctx.fillStyle = fg;
      for (let k = 0; k < STATIONS; k++) {
        const age = stationAge(k, nowMs);
        const alpha = clamp01(1 - age / LAP_MS);
        if (alpha <= 0.02) continue;
        const p = stationScreenPoint(k);
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const drawProbe = (nowMs: number) => {
      const nowInLap = ((nowMs % LAP_MS) + LAP_MS) % LAP_MS;
      const k = Math.floor(nowInLap / STATION_MS) % STATIONS;
      const within = nowInLap - k * STATION_MS;
      const stationS = k / STATIONS;
      const contact = path.at(stationS);
      const normal = path.normalAt(stationS);
      const contactPt = toScreen(contact);
      const approachPt = toScreen({ x: contact.x + normal.x * APPROACH_DIST, y: contact.y + normal.y * APPROACH_DIST });

      let tip: Vec;
      let flashT = 0;

      if (within < APPROACH_MS) {
        const t = easeOutCubic(within / APPROACH_MS);
        tip = { x: approachPt.x + (contactPt.x - approachPt.x) * t, y: approachPt.y + (contactPt.y - approachPt.y) * t };
      } else if (within < APPROACH_MS + DWELL_MS) {
        tip = contactPt;
        const dt = (within - APPROACH_MS) / DWELL_MS;
        flashT = Math.sin(dt * Math.PI); // 0 -> 1 -> 0 across the dwell window
      } else if (within < APPROACH_MS + DWELL_MS + RETRACT_MS) {
        const t = easeInCubic((within - APPROACH_MS - DWELL_MS) / RETRACT_MS);
        tip = { x: contactPt.x + (approachPt.x - contactPt.x) * t, y: contactPt.y + (approachPt.y - contactPt.y) * t };
      } else {
        const nextK = (k + 1) % STATIONS;
        const nextS = nextK / STATIONS;
        const nextContact = path.at(nextS);
        const nextNormal = path.normalAt(nextS);
        const nextApproach = toScreen({
          x: nextContact.x + nextNormal.x * APPROACH_DIST,
          y: nextContact.y + nextNormal.y * APPROACH_DIST,
        });
        const t = easeInOutCubic((within - APPROACH_MS - DWELL_MS - RETRACT_MS) / TRAVEL_MS);
        tip = { x: approachPt.x + (nextApproach.x - approachPt.x) * t, y: approachPt.y + (nextApproach.y - approachPt.y) * t };
      }

      // stylus shaft: a short segment trailing outward from the tip along
      // the current station's normal, so the probe reads as a stylus, not
      // a bare dot
      const shaftLen = scale * 0.14;
      const shaftEnd = { x: tip.x + normal.x * shaftLen, y: tip.y + normal.y * shaftLen };
      ctx.strokeStyle = fg;
      ctx.lineWidth = Math.max(1, scale * 0.01);
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(tip.x, tip.y);
      ctx.lineTo(shaftEnd.x, shaftEnd.y);
      ctx.stroke();
      ctx.globalAlpha = 1;

      const baseR = Math.max(1.8, scale * 0.024);
      if (flashT > 0.01) {
        // trigger flash: a luminance bump (larger radius, brighter
        // overlay), never a colour tint
        ctx.fillStyle = fg;
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(tip.x, tip.y, baseR * (1 + 0.9 * flashT), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.35 * flashT;
        ctx.beginPath();
        ctx.arc(tip.x, tip.y, baseR * (1 + 2.2 * flashT), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(tip.x, tip.y, baseR, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const render = (nowMs: number) => {
      if (!sized) return;
      ctx.clearRect(0, 0, width, height);
      drawContour();
      drawTouchedPoints(nowMs);
      drawProbe(nowMs);
    };

    const positionOverlay = () => {
      for (let k = 0; k < STATIONS; k++) {
        const btn = buttonRefs.current[k];
        if (!btn) continue;
        const p = stationScreenPoint(k);
        btn.style.left = `${p.x}px`;
        btn.style.top = `${p.y}px`;
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      if (width < 2 || height < 2) {
        sized = false;
        return;
      }
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const minDim = Math.min(width, height);
      scale = minDim * 0.42;
      originX = width / 2;
      originY = height / 2;
      sized = true;
      positionOverlay();
      render(elapsed);
    };

    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(resize, 100);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(canvas);

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && !reduced && !raf) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    });
    io.observe(canvas);

    function loop(now: number) {
      raf = 0;
      if (!visible || document.hidden) return;
      if (last === 0) last = now;
      const dt = Math.min(100, now - last);
      last = now;
      elapsed += dt;
      render(elapsed);
      raf = requestAnimationFrame(loop);
    }

    const onVis = () => {
      if (!document.hidden && visible && !reduced && !raf) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    const mo = new MutationObserver(() => {
      readTokens();
      render(elapsed);
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    document.fonts.ready.then(() => {
      if (disposed) return;
      readTokens();
      resize();
      if (reduced) {
        elapsed = LAP_MS + FREEZE_STATION * STATION_MS + APPROACH_MS + DWELL_MS / 2;
        render(elapsed);
      } else {
        raf = requestAnimationFrame(loop);
      }
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      window.clearTimeout(resizeTimer);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  const showTooltip = (k: number) => {
    const btn = buttonRefs.current[k];
    const root = rootRef.current;
    if (!btn || !root) return;
    const rootRect = root.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    setActiveStation(k);
    setTooltipPos({ x: btnRect.left - rootRect.left + btnRect.width / 2, y: btnRect.top - rootRect.top });
  };
  const hideTooltip = () => {
    setActiveStation(null);
    setTooltipPos(null);
  };

  return (
    <div
      ref={rootRef}
      className={`relative ${className}`}
      style={{ width: size, height: size }}
      data-reduced-motion-freeze={FREEZE_PHASE}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="block h-full w-full" />
      {Array.from({ length: STATIONS }, (_, k) => (
        <button
          key={k}
          ref={(el) => {
            buttonRefs.current[k] = el;
          }}
          type="button"
          aria-label={`Inspection station ${k + 1} deviation ${syntheticDeviation(k)}`}
          className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-1"
          onMouseEnter={() => showTooltip(k)}
          onMouseLeave={hideTooltip}
          onFocus={() => showTooltip(k)}
          onBlur={hideTooltip}
        />
      ))}
      {activeStation !== null && tooltipPos && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-sm border border-border bg-background px-2 py-1 font-mono text-[10px] text-ns-muted"
          style={{ left: tooltipPos.x, top: tooltipPos.y - 6 }}
        >
          station {activeStation + 1} dev {syntheticDeviation(activeStation)}
        </div>
      )}
    </div>
  );
}
