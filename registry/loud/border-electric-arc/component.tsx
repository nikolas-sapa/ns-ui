"use client";

import { useEffect, useId, useRef } from "react";

// ---------------------------------------------------------------------------
// SparkGap — an electric border for a CTA. A rounded-rect outline crackles
// like a live wire: feTurbulence -> feDisplacementMap jitters a 1.5px
// --foreground stroke over a blurred --ns-accent glow copy, with random
// micro-arcs sparking off the corners every 1-3s. Near the cursor the border
// OPENS a small gap at the pointer's nearest-edge projection and a short
// bright arc jumps across it, tracking the pointer along the perimeter.
// Pressing the button is a full discharge: a bright flash floods the stroke,
// then the border runs "spent" (calmer jitter, dim glow) for 2s before
// normal idle crackle resumes.
//
// Dash-gap math is done in RAW SVG user units against the path's real
// measured perimeter (getTotalLength on an explicit rounded-rect <path>).
// Deliberately NO pathLength attribute and NO vector-effect anywhere:
// combining pathLength with non-scaling-stroke makes Chromium compute the
// dash in screen space and the gap lands wrong while every attribute reads
// correct. This SVG is never CSS-scaled (width/height attrs = CSS pixels,
// no viewBox scaling), so raw-unit dasharray math is exact.
//
// Hot path is all direct DOM writes via refs — feTurbulence seed/frequency
// rewrites on a throttled 150ms interval (not per frame), dasharray/offset
// and the arc path on pointermove, opacity/stroke-width via short CSS
// transitions for flash/settle. No React state anywhere in the loop.
//
// A11y: the CTA is a real <button> with its accessible name intact; every
// effect layer is an aria-hidden, pointer-events-none SVG sibling so nothing
// ever intercepts clicks, hover or focus meant for the button. Idle work
// (jitter + micro-arcs) pauses entirely off-viewport via IntersectionObserver
// and while the document is hidden. prefers-reduced-motion: steady solid
// border (no displacement filter, no gap, no arcs), glow only as a plain
// CSS box-shadow on the button's :hover / :focus-visible.
// ---------------------------------------------------------------------------

export interface SparkGapProps {
  /** Accessible label / visible text of the CTA button. */
  label?: string;
  /** called when the button is clicked */
  onClick?: () => void;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

const OUT = 5; // border sits this far outside the button box
const MARGIN = 14; // extra svg room for glow + corner arcs
const EXT = OUT + MARGIN;
const RADIUS = 10;
const STROKE_W = 1.5;
const GAP_PX = 16; // gap opened under the cursor
const NEAR_PX = 30; // pointer-to-border distance that opens the gap
const JITTER_MS = 150; // throttled turbulence rewrite cadence
const SPARK_MIN_MS = 1000;
const SPARK_MAX_MS = 3000;
const FLASH_MS = 110; // discharge flash duration
const SPENT_MS = 2000; // calm "spent" window after a discharge
const SCALE_IDLE = 2.8; // displacement scale, live wire
const SCALE_SPENT = 1.1; // displacement scale, spent wire

interface Layout {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  P: number; // measured perimeter (getTotalLength), raw user units
  k: number; // measured / analytic correction factor
}

function roundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  return (
    `M ${x + r} ${y} L ${x + w - r} ${y} A ${r} ${r} 0 0 1 ${x + w} ${y + r}` +
    ` L ${x + w} ${y + h - r} A ${r} ${r} 0 0 1 ${x + w - r} ${y + h}` +
    ` L ${x + r} ${y + h} A ${r} ${r} 0 0 1 ${x} ${y + h - r}` +
    ` L ${x} ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`
  );
}

// Nearest point on the perimeter, expressed as analytic arc-length from the
// path start (top-left, clockwise) plus the pointer's distance to it. The
// four straight edges are checked and the projection clamped to each; corner
// arcs are approximated as belonging to the nearer adjacent edge (clamping
// to a segment end IS that approximation — no exact arc math needed).
function projectToPerimeter(
  lx: number,
  ly: number,
  L: Layout
): { s: number; dist: number } {
  const { x, y, w, h, r } = L;
  const q = (Math.PI * r) / 2; // one corner arc, analytic
  const edges = [
    { ax: x + r, ay: y, bx: x + w - r, by: y, start: 0 },
    { ax: x + w, ay: y + r, bx: x + w, by: y + h - r, start: w - 2 * r + q },
    {
      ax: x + w - r,
      ay: y + h,
      bx: x + r,
      by: y + h,
      start: w - 2 * r + q + (h - 2 * r) + q,
    },
    {
      ax: x,
      ay: y + h - r,
      bx: x,
      by: y + r,
      start: 2 * (w - 2 * r) + (h - 2 * r) + 3 * q,
    },
  ];
  let bestS = 0;
  let bestDist = Infinity;
  for (const e of edges) {
    const abx = e.bx - e.ax;
    const aby = e.by - e.ay;
    const len2 = abx * abx + aby * aby;
    const t =
      len2 > 0
        ? Math.max(0, Math.min(1, ((lx - e.ax) * abx + (ly - e.ay) * aby) / len2))
        : 0;
    const px = e.ax + abx * t;
    const py = e.ay + aby * t;
    const d = Math.hypot(lx - px, ly - py);
    if (d < bestDist) {
      bestDist = d;
      bestS = e.start + t * Math.sqrt(len2);
    }
  }
  return { s: bestS, dist: bestDist };
}

export function SparkGap({
  label = "Get Started",
  onClick,
  className = "",
}: SparkGapProps) {
  const uid = useId().replace(/:/g, "");
  const filterId = `ns-sg-jitter-${uid}`;

  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const glowRef = useRef<SVGPathElement>(null);
  const coreRef = useRef<SVGPathElement>(null);
  const arcRef = useRef<SVGPathElement>(null);
  const sparkARef = useRef<SVGPathElement>(null);
  const sparkBRef = useRef<SVGPathElement>(null);
  const turbRef = useRef<SVGFETurbulenceElement>(null);
  const dispRef = useRef<SVGFEDisplacementMapElement>(null);
  const engineRef = useRef<{ discharge: () => void } | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const svg = svgRef.current;
    const glow = glowRef.current;
    const core = coreRef.current;
    const arc = arcRef.current;
    const sparkA = sparkARef.current;
    const sparkB = sparkBRef.current;
    const turb = turbRef.current;
    const disp = dispRef.current;
    if (!wrap || !svg || !glow || !core || !arc || !sparkA || !sparkB || !turb || !disp)
      return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = mq.matches;

    // -- hot-path state: locals + refs only, never React state --------------
    let layout: Layout | null = null;
    let visible = true;
    let mode: "idle" | "spent" = "idle";
    let near = false; // pointer within NEAR_PX of the border
    let gapCur = 0;
    let gapTarget = 0;
    let sPath = 0; // gap center, measured units along the path
    let seed = 7;
    let skipTick = false;
    let sparkFork = false;
    let tweenRaf = 0;
    let tweenLast = 0;
    let jitterTimer: number | undefined;
    let sparkTimer: number | undefined;
    let flashT1: number | undefined;
    let flashT2: number | undefined;

    const applyGlow = () => {
      if (mode === "spent") {
        glow.style.opacity = "0.12";
        return;
      }
      glow.style.opacity = near ? "0.55" : "0.3";
    };

    // Dash window: pattern is [dash P-g, gap g]; offsetting by P - s - g/2
    // centers the gap at path distance s. All raw measured units — no
    // pathLength, no vector-effect (see header comment for why).
    const applyGap = () => {
      if (!layout) return;
      const { P } = layout;
      if (gapCur < 0.6) {
        core.removeAttribute("stroke-dasharray");
        core.removeAttribute("stroke-dashoffset");
        glow.removeAttribute("stroke-dasharray");
        glow.removeAttribute("stroke-dashoffset");
        arc.style.opacity = "0";
        return;
      }
      const g = gapCur;
      const dash = `${(P - g).toFixed(2)} ${g.toFixed(2)}`;
      const off = (P - sPath - g / 2).toFixed(2);
      core.setAttribute("stroke-dasharray", dash);
      core.setAttribute("stroke-dashoffset", off);
      glow.setAttribute("stroke-dasharray", dash);
      glow.setAttribute("stroke-dashoffset", off);
      // the arc that jumps the gap: jagged 4-point path between the gap lips
      const a = core.getPointAtLength((((sPath - g / 2) % P) + P) % P);
      const b = core.getPointAtLength((sPath + g / 2) % P);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len; // unit normal for the zigzag
      const ny = dx / len;
      const j1 = (Math.random() - 0.5) * 5;
      const j2 = (Math.random() - 0.5) * 5;
      arc.setAttribute(
        "d",
        `M ${a.x.toFixed(1)} ${a.y.toFixed(1)}` +
          ` L ${(a.x + dx * 0.33 + nx * j1).toFixed(1)} ${(a.y + dy * 0.33 + ny * j1).toFixed(1)}` +
          ` L ${(a.x + dx * 0.66 + nx * j2).toFixed(1)} ${(a.y + dy * 0.66 + ny * j2).toFixed(1)}` +
          ` L ${b.x.toFixed(1)} ${b.y.toFixed(1)}`
      );
      arc.style.opacity = Math.min(1, g / GAP_PX).toFixed(2);
    };

    // short rAF tween only while the gap is opening/closing — not a
    // permanent loop; pointer position writes happen in the move handler
    const tweenStep = (t: number) => {
      tweenRaf = 0;
      const dt = tweenLast ? Math.min(0.05, (t - tweenLast) / 1000) : 1 / 60;
      tweenLast = t;
      gapCur += (gapTarget - gapCur) * Math.min(1, dt * 16);
      if (Math.abs(gapTarget - gapCur) < 0.4) gapCur = gapTarget;
      applyGap();
      if (gapCur !== gapTarget) tweenRaf = requestAnimationFrame(tweenStep);
    };
    const startTween = () => {
      if (!tweenRaf && gapCur !== gapTarget) {
        tweenLast = 0;
        tweenRaf = requestAnimationFrame(tweenStep);
      }
    };

    const onMove = (e: MouseEvent) => {
      if (reduced || !layout) return;
      const rect = wrap.getBoundingClientRect();
      if (rect.width < 4) return;
      // svg's top-left sits at (rect.left - EXT, rect.top - EXT)
      const lx = e.clientX - rect.left + EXT;
      const ly = e.clientY - rect.top + EXT;
      const proj = projectToPerimeter(lx, ly, layout);
      const nowNear = proj.dist < NEAR_PX;
      if (nowNear !== near) {
        near = nowNear;
        applyGlow();
      }
      sPath = proj.s * layout.k;
      gapTarget = nowNear ? GAP_PX : 0;
      if (gapCur > 0.6) applyGap(); // gap follows the cursor instantly
      startTween();
    };

    // -- throttled crackle: rewrite turbulence attrs every 150ms, not/frame --
    const jitterTick = () => {
      if (!visible || document.hidden) return;
      skipTick = !skipTick;
      if (mode === "spent" && skipTick) return; // spent wire ticks half rate
      seed = (seed + 1) % 997;
      turb.setAttribute("seed", String(seed));
      turb.setAttribute(
        "baseFrequency",
        `0.02 ${(0.05 + Math.random() * 0.04).toFixed(3)}`
      );
      disp.setAttribute("scale", String(mode === "spent" ? SCALE_SPENT : SCALE_IDLE));
    };
    const startJitter = () => {
      if (jitterTimer === undefined && !reduced)
        jitterTimer = window.setInterval(jitterTick, JITTER_MS);
    };
    const stopJitter = () => {
      if (jitterTimer !== undefined) {
        window.clearInterval(jitterTimer);
        jitterTimer = undefined;
      }
    };

    // -- micro-arcs: recursive setTimeout re-rolling 1-3s each round ---------
    const flashPath = (el: SVGPathElement, d: string) => {
      el.setAttribute("d", d);
      el.style.transition = "none";
      el.style.opacity = "0.95";
      requestAnimationFrame(() => {
        el.style.transition = "opacity 220ms ease-out";
        el.style.opacity = "0";
      });
    };
    const jaggedBranch = (cx: number, cy: number, nx: number, ny: number): string => {
      let px = cx;
      let py = cy;
      let d = `M ${px.toFixed(1)} ${py.toFixed(1)}`;
      for (let i = 0; i < 3; i++) {
        const step = 3 + Math.random() * 4;
        const jit = (Math.random() - 0.5) * 5;
        px += nx * step - ny * jit;
        py += ny * step + nx * jit;
        d += ` L ${px.toFixed(1)} ${py.toFixed(1)}`;
      }
      return d;
    };
    const fireSpark = () => {
      if (!layout || !visible || document.hidden || reduced || mode === "spent") return;
      const { x, y, w, h, r } = layout;
      const inset = r * 0.3;
      const corners = [
        { cx: x + inset, cy: y + inset, dx: -1, dy: -1 },
        { cx: x + w - inset, cy: y + inset, dx: 1, dy: -1 },
        { cx: x + w - inset, cy: y + h - inset, dx: 1, dy: 1 },
        { cx: x + inset, cy: y + h - inset, dx: -1, dy: 1 },
      ];
      const c = corners[Math.floor(Math.random() * corners.length)];
      if (!c) return;
      const nx = c.dx / Math.SQRT2;
      const ny = c.dy / Math.SQRT2;
      flashPath(sparkA, jaggedBranch(c.cx, c.cy, nx, ny));
      sparkFork = Math.random() < 0.4;
      if (sparkFork) {
        // second branch forks off at a steeper angle from the same corner
        const rot = (Math.random() < 0.5 ? 1 : -1) * 0.7;
        const fx = nx * Math.cos(rot) - ny * Math.sin(rot);
        const fy = nx * Math.sin(rot) + ny * Math.cos(rot);
        flashPath(sparkB, jaggedBranch(c.cx, c.cy, fx, fy));
      }
    };
    const scheduleSpark = () => {
      sparkTimer = window.setTimeout(() => {
        fireSpark();
        scheduleSpark();
      }, SPARK_MIN_MS + Math.random() * (SPARK_MAX_MS - SPARK_MIN_MS));
    };
    const startSparks = () => {
      if (sparkTimer === undefined && !reduced) scheduleSpark();
    };
    const stopSparks = () => {
      if (sparkTimer !== undefined) {
        window.clearTimeout(sparkTimer);
        sparkTimer = undefined;
      }
    };

    // -- discharge: flash flood, then 2s spent, then idle resumes ------------
    const discharge = () => {
      if (reduced) return;
      window.clearTimeout(flashT1);
      window.clearTimeout(flashT2);
      mode = "idle";
      const fast =
        "opacity 80ms ease-out, stroke-width 80ms ease-out, filter 80ms ease-out";
      core.style.transition = fast;
      core.style.opacity = "1";
      core.style.strokeWidth = "2.6";
      glow.style.transition = fast;
      glow.style.opacity = "1";
      glow.style.filter = "blur(6px)";
      flashT1 = window.setTimeout(() => {
        mode = "spent";
        disp.setAttribute("scale", String(SCALE_SPENT));
        const settle =
          "opacity 260ms ease-in, stroke-width 260ms ease-in, filter 260ms ease-in";
        core.style.transition = settle;
        core.style.opacity = "0.65";
        core.style.strokeWidth = String(STROKE_W);
        glow.style.transition = settle;
        glow.style.filter = "blur(3.5px)";
        applyGlow();
        flashT2 = window.setTimeout(() => {
          mode = "idle";
          disp.setAttribute("scale", String(SCALE_IDLE));
          core.style.transition = "opacity 300ms ease-out";
          core.style.opacity = "1";
          glow.style.transition = "opacity 300ms ease-out";
          applyGlow();
        }, SPENT_MS);
      }, FLASH_MS);
    };
    engineRef.current = { discharge };

    // -- sizing: real pixel geometry, measured perimeter ---------------------
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) return;
      const bw = rect.width + OUT * 2;
      const bh = rect.height + OUT * 2;
      const sw = bw + MARGIN * 2;
      const sh = bh + MARGIN * 2;
      svg.setAttribute("width", String(sw));
      svg.setAttribute("height", String(sh));
      const r = Math.min(RADIUS, bw / 2, bh / 2);
      const d = roundedRectPath(MARGIN, MARGIN, bw, bh, r);
      glow.setAttribute("d", d);
      core.setAttribute("d", d);
      const P = core.getTotalLength();
      const analytic = 2 * (bw - 2 * r) + 2 * (bh - 2 * r) + 2 * Math.PI * r;
      layout = { x: MARGIN, y: MARGIN, w: bw, h: bh, r, P, k: P / analytic };
      applyGap();
    };

    const applyReduced = () => {
      if (reduced) {
        stopJitter();
        stopSparks();
        window.clearTimeout(flashT1);
        window.clearTimeout(flashT2);
        if (tweenRaf) cancelAnimationFrame(tweenRaf);
        tweenRaf = 0;
        gapCur = gapTarget = 0;
        mode = "idle";
        near = false;
        applyGap();
        // steady solid border: crisp stroke, no displacement filter at all
        core.removeAttribute("filter");
        core.style.transition = "none";
        core.style.opacity = "1";
        core.style.strokeWidth = String(STROKE_W);
        arc.style.opacity = "0";
        sparkA.style.opacity = "0";
        sparkB.style.opacity = "0";
        // glow layer off; hover/focus glow comes from CSS box-shadow instead
      } else {
        core.setAttribute("filter", `url(#${filterId})`);
        applyGlow();
        if (visible) {
          startJitter();
          startSparks();
        }
      }
    };
    const onMq = () => {
      reduced = mq.matches;
      applyReduced();
    };
    mq.addEventListener("change", onMq);

    // -- observers -----------------------------------------------------------
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && !reduced) {
        startJitter();
        startSparks();
      } else {
        stopJitter();
        stopSparks();
      }
    });
    io.observe(wrap);

    const onVis = () => {
      // interval ticks already no-op while hidden; kick a tick on return
      if (!document.hidden && !reduced && visible) jitterTick();
    };
    document.addEventListener("visibilitychange", onVis);

    window.addEventListener("pointermove", onMove);
    window.addEventListener("mousemove", onMove); // synthetic MouseEvents too

    applyReduced();
    if (!reduced && visible) {
      startJitter();
      startSparks();
    }

    return () => {
      stopJitter();
      stopSparks();
      window.clearTimeout(flashT1);
      window.clearTimeout(flashT2);
      if (tweenRaf) cancelAnimationFrame(tweenRaf);
      mq.removeEventListener("change", onMq);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("mousemove", onMove);
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={wrapRef} className={`ns-sg relative inline-flex ${className}`}>
      <style>{CSS}</style>
      {/* Effect overlay: aria-hidden + pointer-events-none sibling, extends
          EXT px past the wrapper so glow and corner arcs never clip. */}
      <svg
        ref={svgRef}
        width={0}
        height={0}
        aria-hidden="true"
        focusable="false"
        className="pointer-events-none absolute"
        style={{ left: -EXT, top: -EXT, overflow: "visible" }}
      >
        <defs>
          <filter id={filterId} x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence
              ref={turbRef}
              type="fractalNoise"
              baseFrequency="0.02 0.06"
              numOctaves={2}
              seed={7}
              result="n"
            />
            <feDisplacementMap
              ref={dispRef}
              in="SourceGraphic"
              in2="n"
              scale={SCALE_IDLE}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
        <path
          ref={glowRef}
          className="ns-sg-glow"
          fill="none"
          stroke="var(--ns-accent)"
          strokeWidth={5}
          strokeLinecap="round"
          style={{
            opacity: 0.3,
            filter: "blur(3.5px)",
            transition: "opacity 200ms ease-out",
          }}
        />
        <path
          ref={coreRef}
          fill="none"
          stroke="var(--foreground)"
          strokeWidth={STROKE_W}
          strokeLinecap="round"
          filter={`url(#${filterId})`}
        />
        <path
          ref={arcRef}
          className="ns-sg-arc"
          fill="none"
          stroke="var(--foreground)"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            opacity: 0,
            filter:
              "drop-shadow(0 0 4px var(--ns-accent)) drop-shadow(0 0 1.5px var(--ns-accent))",
          }}
        />
        <path
          ref={sparkARef}
          className="ns-sg-spark"
          fill="none"
          stroke="var(--ns-accent)"
          strokeWidth={1.3}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ opacity: 0, filter: "drop-shadow(0 0 3px var(--ns-accent))" }}
        />
        <path
          ref={sparkBRef}
          className="ns-sg-spark"
          fill="none"
          stroke="var(--ns-accent)"
          strokeWidth={1.1}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ opacity: 0, filter: "drop-shadow(0 0 3px var(--ns-accent))" }}
        />
      </svg>

      <button
        type="button"
        onPointerDown={() => engineRef.current?.discharge()}
        onClick={(e) => {
          // keyboard activation (Enter/Space) arrives as click with detail 0
          if (e.detail === 0) engineRef.current?.discharge();
          onClick?.();
        }}
        className="ns-sg-btn relative z-[1] rounded-[6px] bg-background px-6 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-foreground/[0.08] active:bg-foreground/[0.14] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
      >
        {label}
      </button>
    </div>
  );
}

const CSS = `
@media (prefers-reduced-motion: reduce){
  .ns-sg-glow,.ns-sg-arc,.ns-sg-spark{opacity:0 !important;transition:none !important;}
  .ns-sg-btn:hover,.ns-sg-btn:focus-visible{
    box-shadow:0 0 14px 0 color-mix(in srgb, var(--ns-accent) 45%, transparent);
  }
}
`;
