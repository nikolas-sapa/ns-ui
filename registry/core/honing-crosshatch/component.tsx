"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";

// ---------------------------------------------------------------------------
// HoningCrosshatch — an ambient card texture reproducing cylinder-bore
// plateau honing, not a decorative diagonal pattern. A rotating and
// reciprocating abrasive stone cuts two families of helical scratches
// across a bore surface at a controlled crosshatch angle (30-60 degrees
// included, real process spec) to produce a load-bearing plateau finish
// with oil-retaining valleys. The included angle is a deliberately
// controlled process parameter — it is FIXED here at 45 degrees (mid of
// the real control range) and never varies, including on hover.
//
// Strokes are genuinely discrete, transient scratches, not a persisting
// grid: each stroke is born at a random position, tilted at its family's
// fixed angle from vertical, brightens briefly off the muted token, then
// decays linearly back to the background base over a 4.5s lifetime and is
// dropped. Two independent Poisson-ish accumulators (one per family) birth
// strokes at 6/s each — 12/s combined, alternating A/B by construction
// since both run concurrently — so the expected resident population holds
// at rate * lifetime = 6 * 2 * 4.5s = 54 strokes at any moment: birth rate
// equals death rate, so density holds steady rather than ever filling
// solid or emptying out. Overlap CLAMPS: strokes render with
// globalCompositeOperation "lighten" against a background-coloured base,
// so a stroke re-passing already-bright ground picks the brighter of the
// two values instead of stacking additively — the same clamp logic as
// peen-coverage's dimple `Math.max`, matching how a re-pass on an
// already-plateaued bore surface doesn't cut deeper.
//
// Stroke length is derived from the container's own smaller dimension
// (`cell = min(width,height)/40`, `length = 1.4 * cell`) so the texture
// reads at card scale regardless of card size.
//
// t0 is pre-seeded to steady-state density (strokes backfilled with random
// ages uniform across the 4.5s lifetime) so the card never starts blank;
// the resting loop is legible via stroke IDENTITY turning over, not a
// density change — by 2.5s roughly half the visible strokes are different
// individuals, by 5s the population has fully turned over again, while the
// aggregate angle and density stay visually constant throughout.
//
// Hover locally boosts deposit rate 2x within a dwell radius (the stone
// lingering), decaying linearly over 500ms after the pointer leaves. This
// only adds EXTRA strokes at the same fixed per-family angles — hover
// never touches the crosshatch angle itself, and highlights are pure
// density, never `--ns-accent`.
// ---------------------------------------------------------------------------

export interface HoningCrosshatchProps {
  /** card heading */
  title?: string;
  /** card body copy */
  description?: string;
  /** trailing link label; omit to render the card with no link */
  linkLabel?: string;
  /** link href, used only when linkLabel is set */
  href?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
  /** inline styles merged onto the root element */
  style?: CSSProperties;
}

type RGB = [number, number, number];

function parseColor(raw: string): RGB | null {
  const s = raw.trim();
  if (s.startsWith("#")) {
    let hex = s.slice(1);
    if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
    if (hex.length < 6) return null;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return Number.isNaN(r + g + b) ? null : [r, g, b];
  }
  const m = s.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function relLuminance([r, g, b]: RGB): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function mixRGB(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function rgbString([r, g, b]: RGB): string {
  return `rgb(${r | 0}, ${g | 0}, ${b | 0})`;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CELL_DIVISOR = 40; // cell = min(w,h) / 40
const STROKE_LEN_MULT = 1.4; // stroke length = 1.4 * cell
const INCLUDED_ANGLE_DEG = 45; // fixed controlled crosshatch angle, never varies
const HALF_ANGLE_RAD = (INCLUDED_ANGLE_DEG / 2) * (Math.PI / 180);
const RATE_PER_FAMILY = 6; // strokes/s per family, 12/s combined
const LIFETIME_MS = 4500; // birth-to-fully-eroded
const BIRTH_RISE_MS = 280; // brief brightening on birth before linear decay
const STEADY_COUNT_PER_FAMILY = Math.round(RATE_PER_FAMILY * (LIFETIME_MS / 1000)); // 27
const HOVER_RADIUS_CELLS = 6;
const HOVER_RATE_MULT = 1; // extra rate == base rate inside radius -> ~2x locally
const HOVER_DECAY_MS = 500;
// Reduced motion freezes on a seeded steady-state population, both
// families evenly represented, ages spread across the full lifetime.
const FREEZE_PHASE = "steady-crosshatch-lock";

type Family = "A" | "B";

interface Stroke {
  x: number;
  y: number;
  family: Family;
  birth: number; // sim-clock ms
}

export function HoningCrosshatch({
  title = "Bore finish, cross-hone pass",
  description = "Two scratch families hold a fixed 45 degree crosshatch as individual strokes turn over — density never fills solid, never empties out.",
  linkLabel = "Read the process card",
  href = "#",
  className = "",
  style,
}: HoningCrosshatchProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = mq.matches;

    // -- token-derived colour, re-read on any theme class flip, never a literal --
    let background: RGB = [10, 10, 10];
    let muted: RGB = [143, 143, 143];
    let foreground: RGB = [237, 237, 237];
    let surfaceBase: RGB = background;
    let birthColor: RGB = muted;
    let peakColor: RGB = muted;
    const deriveColors = () => {
      const cs = getComputedStyle(document.documentElement);
      background = parseColor(cs.getPropertyValue("--background")) ?? background;
      muted = parseColor(cs.getPropertyValue("--ns-muted")) ?? muted;
      foreground = parseColor(cs.getPropertyValue("--foreground")) ?? foreground;
      const isDark = relLuminance(background) < 0.5;
      surfaceBase = background;
      if (isDark) {
        birthColor = muted;
        peakColor = mixRGB(muted, foreground, 0.6);
      } else {
        // light theme: same base->stroke relationship, contrast
        // compressed and pulled toward foreground so strokes clear
        // --border-adjacent territory (~1.1:1) instead of vanishing.
        birthColor = mixRGB(muted, foreground, 0.45);
        peakColor = mixRGB(muted, foreground, 0.85);
      }
    };
    deriveColors();

    let w = 0;
    let h = 0;
    let dpr = 1;
    let cell = 4;
    let visible = true;
    let raf = 0;
    let simTime = 0; // virtual sim clock, ms, advances only while painting
    let lastNow = 0;

    let strokes: Stroke[] = [];
    let accA = 0;
    let accB = 0;
    let accHoverA = 0;
    let accHoverB = 0;

    let hovering = false;
    let hoverX = 0;
    let hoverY = 0;
    let hoverLeaveAt = -Infinity;

    const rand = mulberry32(0x4b1e9d7f);

    const seedSteadyState = () => {
      strokes = [];
      const families: Family[] = ["A", "B"];
      for (const family of families) {
        for (let i = 0; i < STEADY_COUNT_PER_FAMILY; i++) {
          const age = rand() * LIFETIME_MS;
          strokes.push({
            x: rand() * w,
            y: rand() * h,
            family,
            birth: simTime - age,
          });
        }
      }
      accA = 0;
      accB = 0;
      accHoverA = 0;
      accHoverB = 0;
    };

    const hoverMultiplier = (now: number): number => {
      if (hovering) return 1;
      if (!Number.isFinite(hoverLeaveAt)) return 0;
      const t = 1 - (now - hoverLeaveAt) / HOVER_DECAY_MS;
      return t > 0 ? t : 0;
    };

    const stepDeposits = (dtMs: number, now: number) => {
      const dtS = dtMs / 1000;
      accA += RATE_PER_FAMILY * dtS;
      accB += RATE_PER_FAMILY * dtS;
      const countA = Math.floor(accA);
      const countB = Math.floor(accB);
      accA -= countA;
      accB -= countB;
      for (let i = 0; i < countA; i++) {
        strokes.push({ x: rand() * w, y: rand() * h, family: "A", birth: simTime });
      }
      for (let i = 0; i < countB; i++) {
        strokes.push({ x: rand() * w, y: rand() * h, family: "B", birth: simTime });
      }

      const mult = hoverMultiplier(now);
      if (mult > 0 && w > 0 && h > 0) {
        const rPx = HOVER_RADIUS_CELLS * cell;
        accHoverA += RATE_PER_FAMILY * HOVER_RATE_MULT * mult * dtS;
        accHoverB += RATE_PER_FAMILY * HOVER_RATE_MULT * mult * dtS;
        const hCountA = Math.floor(accHoverA);
        const hCountB = Math.floor(accHoverB);
        accHoverA -= hCountA;
        accHoverB -= hCountB;
        const spawnNear = (family: Family, count: number) => {
          for (let i = 0; i < count; i++) {
            const ang = rand() * Math.PI * 2;
            const rad = Math.sqrt(rand()) * rPx;
            const x = Math.min(w, Math.max(0, hoverX + Math.cos(ang) * rad));
            const y = Math.min(h, Math.max(0, hoverY + Math.sin(ang) * rad));
            strokes.push({ x, y, family, birth: simTime });
          }
        };
        spawnNear("A", hCountA);
        spawnNear("B", hCountB);
      } else {
        accHoverA = 0;
        accHoverB = 0;
      }

      // drop fully-eroded strokes
      if (strokes.length > 0) {
        strokes = strokes.filter((s) => simTime - s.birth < LIFETIME_MS);
      }
    };

    const strokeColorAt = (age: number): RGB => {
      if (age < BIRTH_RISE_MS) {
        return mixRGB(birthColor, peakColor, age / BIRTH_RISE_MS);
      }
      const t = Math.min(1, (age - BIRTH_RISE_MS) / (LIFETIME_MS - BIRTH_RISE_MS));
      return mixRGB(peakColor, surfaceBase, t);
    };

    const composeFrom = (list: Stroke[], atTime: number) => {
      if (w <= 0 || h <= 0) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = rgbString(surfaceBase);
      ctx.fillRect(0, 0, w, h);

      const half = (STROKE_LEN_MULT * cell) / 2;
      const dxA = Math.sin(-HALF_ANGLE_RAD) * half;
      const dyA = Math.cos(-HALF_ANGLE_RAD) * half;
      const dxB = Math.sin(HALF_ANGLE_RAD) * half;
      const dyB = Math.cos(HALF_ANGLE_RAD) * half;

      ctx.globalCompositeOperation = "lighten";
      ctx.lineCap = "round";
      ctx.lineWidth = Math.max(1.25, cell * 0.08);

      for (const s of list) {
        const age = atTime - s.birth;
        if (age < 0 || age >= LIFETIME_MS) continue;
        const [r, g, b] = strokeColorAt(age);
        ctx.strokeStyle = `rgb(${r | 0}, ${g | 0}, ${b | 0})`;
        const dx = s.family === "A" ? dxA : dxB;
        const dy = s.family === "A" ? dyA : dyB;
        ctx.beginPath();
        ctx.moveTo(s.x - dx, s.y - dy);
        ctx.lineTo(s.x + dx, s.y + dy);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
    };

    const loop = (now: number) => {
      const dt = lastNow === 0 ? 0 : Math.min(100, now - lastNow);
      lastNow = now;
      simTime += dt;
      stepDeposits(dt, now);
      composeFrom(strokes, simTime);
      if (!reduced && visible) raf = requestAnimationFrame(loop);
      else raf = 0;
    };
    const wake = () => {
      if (raf === 0 && !reduced && visible) {
        lastNow = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    const resize = () => {
      const rect = root.getBoundingClientRect();
      const prevW = w;
      const prevH = h;
      w = rect.width;
      h = rect.height;
      if (w < 2 || h < 2) return;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      cell = Math.max(1, Math.min(w, h) / CELL_DIVISOR);

      // A ResizeObserver fires on every layout nudge (font load, scrollbar,
      // initial observe) — only a genuine dimension change should discard
      // the live population. Otherwise rescale existing strokes in place so
      // an in-flight stroke's 4.5s lifetime stays traceable across resizes.
      if (prevW > 1 && prevH > 1 && strokes.length > 0) {
        const sx = w / prevW;
        const sy = h / prevH;
        for (const s of strokes) {
          s.x *= sx;
          s.y *= sy;
        }
      } else {
        simTime = 0;
        seedSteadyState();
      }

      composeFrom(strokes, simTime);
    };

    resize();
    if (!reduced) wake();

    const ro = new ResizeObserver(resize);
    ro.observe(root);

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) wake();
      else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    });
    io.observe(root);

    const mo = new MutationObserver(() => {
      deriveColors();
      composeFrom(strokes, simTime);
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const onReducedChange = () => {
      reduced = mq.matches;
      if (reduced) {
        cancelAnimationFrame(raf);
        raf = 0;
        simTime = 0;
        seedSteadyState();
        composeFrom(strokes, simTime);
      } else {
        wake();
      }
    };
    mq.addEventListener("change", onReducedChange);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        wake();
      } else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const toLocal = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    };
    const onPointerMove = (e: PointerEvent) => {
      if (reduced) return;
      const { x, y } = toLocal(e.clientX, e.clientY);
      hovering = true;
      hoverX = x;
      hoverY = y;
      hoverLeaveAt = -Infinity;
    };
    const onPointerLeave = () => {
      hovering = false;
      hoverLeaveAt = performance.now();
    };
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("pointercancel", onPointerLeave);

    return () => {
      cancelAnimationFrame(raf);
      raf = 0;
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      mq.removeEventListener("change", onReducedChange);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("pointercancel", onPointerLeave);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      data-reduced-motion-freeze={FREEZE_PHASE}
      className={`ns-honing relative w-full max-w-sm overflow-hidden rounded-[14px] border border-border bg-background ${className}`}
      style={style}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-auto absolute inset-0 h-full w-full" />
      <div ref={contentRef} className="pointer-events-none relative flex flex-col gap-3 p-6">
        <h3 className="text-balance font-sans text-lg font-medium text-foreground">{title}</h3>
        <p className="text-pretty font-mono text-xs leading-relaxed text-ns-muted">{description}</p>
        {linkLabel ? (
          <a
            href={href}
            className="pointer-events-auto mt-1 inline-flex w-fit items-center gap-1 rounded-sm font-mono text-xs font-medium text-foreground underline decoration-border underline-offset-4 transition-colors duration-150 hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            {linkLabel}
            <span aria-hidden="true">&rarr;</span>
          </a>
        ) : null}
      </div>
    </div>
  );
}

HoningCrosshatch.displayName = "HoningCrosshatch";

export default HoningCrosshatch;
