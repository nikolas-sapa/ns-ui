"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// WindRegulatorBellows — a buffer-ahead strip for a media scrub bar, modelled
// on a pipe organ's wind supply: a feeder bellows pumps air into a reservoir
// in discrete strokes, the reservoir's own weighted lid rises and falls to
// smooth that pulsed input into steady pressure, and a spring-loaded spill
// valve bleeds off the excess whenever the lid threatens to overshoot.
//
// Left panel: feeder — a small pump cylinder whose stroke-arm rises fast
// (280ms) on every 1.4s injection, then eases back down over the remainder
// of the interval, idle at the cylinder floor between drives.
// Right panel: reservoir — a pleated accordion (a zigzag fold path re-drawn
// every tick) whose lid line encodes buffered-ahead amount. Each 1.4s stroke
// steps the lid up 6% of max height instantly; a continuous 4%/s drain lowers
// it every tick in between, independent of and concurrent with the strokes.
// Net drift across one 1.4s interval is +0.4% of max height, so the lid
// slowly climbs stroke over stroke until it would cross 92% — at which point
// a flap hinged at the reservoir's top-right corner cracks open (0->28deg,
// 180ms), the excess bleeds back down to 92% over 260ms, and the flap
// reseats — the only route back down once the drift alone would overshoot.
// Lid is floored at 8% of max height so the strip never reads fully empty.
//
// Simulation runs on a fixed 30Hz tick (accumulated real elapsed time, so it
// never depends on frame rate) and is entirely self-driven — no external
// buffered-seconds data required, same convention as this registry's other
// ambient status widgets. Geometry is derived from each panel's own measured
// rect on every ResizeObserver firing; colour is read once via
// getComputedStyle(document.documentElement) with no literal fallback and
// re-read on every documentElement class-attribute mutation.
// ---------------------------------------------------------------------------

const DRAIN_PER_S = 0.04; // continuous demand drain, fraction of max height / s
const STROKE_INTERVAL_S = 1.4; // feeder stroke cadence
const STROKE_INJECT = 0.06; // fraction of max height added per stroke, instant step
const LID_FLOOR = 0.08; // never reads fully empty
const RELIEF_THRESHOLD = 0.92; // lid fraction that trips the spill valve
const RELIEF_CRACK_MS = 180; // flap 0 -> 28deg
const RELIEF_BLEED_MS = 260; // excess bled down to RELIEF_THRESHOLD
const RELIEF_RESEAT_MS = 200; // flap 28deg -> 0, not separately specced
const RELIEF_FLAP_DEG = 28;
const FEEDER_RISE_S = 0.28; // stroke-arm drive, fast
const TICK_S = 1 / 30; // fixed 30Hz simulation step
const FOLD_COUNT = 6; // pleat fold lines in the reservoir accordion

function easeOutCubic(t: number): number {
  const c = 1 - t;
  return 1 - c * c * c;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

type ReliefPhase = "idle" | "crack" | "bleed" | "reseat";

interface Tokens {
  fg: string;
  muted: string;
  border: string;
}

function readTokens(): Tokens | null {
  if (typeof document === "undefined") return null;
  const cs = getComputedStyle(document.documentElement);
  const fg = cs.getPropertyValue("--foreground").trim();
  const muted = cs.getPropertyValue("--ns-muted").trim();
  const border = cs.getPropertyValue("--border").trim();
  if (!fg || !muted || !border) return null; // stylesheet not applied yet — paint nothing
  return { fg, muted, border };
}

/** Builds the accordion pleat path: FOLD_COUNT evenly spaced fold lines
 * between the lid (top) and the reservoir floor (bottom), each drawn as a
 * shallow 3-segment zigzag whose amplitude is a fraction of the current
 * fold spacing — so pleats genuinely compress into tight zigzags as the lid
 * rises and spread into loose ones as it falls, rather than just sliding a
 * fixed pattern. */
function buildFoldsPath(x0: number, x1: number, yLid: number, yFloor: number): string {
  const span = yFloor - yLid;
  if (span <= 0 || x1 <= x0) return "";
  const spacing = span / (FOLD_COUNT + 1);
  const amp = Math.min(spacing * 0.32, (x1 - x0) * 0.04);
  const w = x1 - x0;
  const segs = 4;
  let d = "";
  for (let i = 1; i <= FOLD_COUNT; i++) {
    const y = yLid + spacing * i;
    d += `M${x0.toFixed(1)} ${y.toFixed(1)}`;
    for (let s = 1; s <= segs; s++) {
      const x = x0 + (w * s) / segs;
      const dy = s % 2 === 0 ? amp : -amp;
      d += `L${x.toFixed(1)} ${(y + dy).toFixed(1)}`;
    }
  }
  return d;
}

export interface WindRegulatorBellowsProps {
  /** small mono label above the strip */
  label?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function WindRegulatorBellows({
  label = "Buffered ahead",
  className = "",
}: WindRegulatorBellowsProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const feederWrapRef = useRef<HTMLDivElement>(null);
  const reservoirWrapRef = useRef<HTMLDivElement>(null);
  const feederSvgRef = useRef<SVGSVGElement>(null);
  const reservoirSvgRef = useRef<SVGSVGElement>(null);

  const cylinderRef = useRef<SVGRectElement>(null);
  const armRef = useRef<SVGLineElement>(null);
  const armHeadRef = useRef<SVGCircleElement>(null);

  const foldsRef = useRef<SVGPathElement>(null);
  const lidRef = useRef<SVGLineElement>(null);
  const sideLeftRef = useRef<SVGLineElement>(null);
  const sideRightRef = useRef<SVGLineElement>(null);
  const floorRef = useRef<SVGLineElement>(null);
  const flapRef = useRef<SVGLineElement>(null);
  const hissRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const feederWrap = feederWrapRef.current;
    const reservoirWrap = reservoirWrapRef.current;
    const feederSvg = feederSvgRef.current;
    const reservoirSvg = reservoirSvgRef.current;
    if (!wrap || !feederWrap || !reservoirWrap || !feederSvg || !reservoirSvg) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let disposed = false;
    let tokens: Tokens | null = null;
    let visible = true;

    let fw = 0;
    let fh = 0;
    let rw = 0;
    let rh = 0;
    let sized = false;

    // -- simulation state ---------------------------------------------------
    let lid = 0.5; // start mid, per spec — a fresh mount is an arbitrary sample
    let strokeClock = Math.random() * STROKE_INTERVAL_S; // t0: mid-stroke or idle between, not synced
    let reliefPhase: ReliefPhase = "idle";
    let reliefMs = 0;
    let bleedStartLid = RELIEF_THRESHOLD;
    let flapDeg = 0;

    let raf = 0;
    let tokenWaitRaf = 0;
    let last = 0;
    let acc = 0;

    const setStroke = (el: SVGElement | null, color: string) => {
      el?.setAttribute("stroke", color);
    };
    const setFill = (el: SVGElement | null, color: string) => {
      el?.setAttribute("fill", color);
    };

    const applyTokens = () => {
      if (!tokens) return;
      setStroke(sideLeftRef.current, tokens.fg);
      setStroke(sideRightRef.current, tokens.fg);
      setStroke(lidRef.current, tokens.fg);
      setStroke(floorRef.current, tokens.border);
      setStroke(foldsRef.current, tokens.muted);
      setStroke(flapRef.current, tokens.fg);
      setStroke(hissRef.current, tokens.muted);
      setStroke(cylinderRef.current, tokens.border);
      setStroke(armRef.current, tokens.fg);
      setFill(armHeadRef.current, tokens.fg);
    };

    // -- feeder layout: a cylinder occupying the panel's middle band, an
    // arm that rises from its floor to its head on each stroke drive. -----
    const drawFeeder = (armFrac: number) => {
      if (!sized || fw <= 0 || fh <= 0) return;
      const minDim = Math.min(fw, fh);
      const cx = fw / 2;
      const cw = Math.min(fw * 0.5, minDim * 0.6);
      const top = fh * 0.18;
      const bottom = fh * 0.82;
      const x0 = cx - cw / 2;
      const x1 = cx + cw / 2;
      cylinderRef.current?.setAttribute("x", x0.toFixed(1));
      cylinderRef.current?.setAttribute("y", top.toFixed(1));
      cylinderRef.current?.setAttribute("width", (x1 - x0).toFixed(1));
      cylinderRef.current?.setAttribute("height", (bottom - top).toFixed(1));
      cylinderRef.current?.setAttribute("stroke-width", Math.max(1, minDim * 0.02).toFixed(2));

      const armTravel = (bottom - top) * 0.66;
      const armBase = bottom - (bottom - top) * 0.06;
      const armY = armBase - armFrac * armTravel;
      armRef.current?.setAttribute("x1", cx.toFixed(1));
      armRef.current?.setAttribute("x2", cx.toFixed(1));
      armRef.current?.setAttribute("y1", armBase.toFixed(1));
      armRef.current?.setAttribute("y2", armY.toFixed(1));
      armRef.current?.setAttribute("stroke-width", Math.max(1.5, minDim * 0.03).toFixed(2));
      armHeadRef.current?.setAttribute("cx", cx.toFixed(1));
      armHeadRef.current?.setAttribute("cy", armY.toFixed(1));
      armHeadRef.current?.setAttribute("r", Math.max(1.5, minDim * 0.045).toFixed(2));
    };

    // -- reservoir layout: lid line + accordion pleats between it and the
    // floor, flap hinged at the top-right corner. -------------------------
    const drawReservoir = (lidFrac: number, flapAngle: number, hissAlpha: number) => {
      if (!sized || rw <= 0 || rh <= 0) return;
      const minDim = Math.min(rw, rh);
      const pad = Math.max(6, minDim * 0.06);
      const x0 = pad;
      const x1 = rw - pad;
      const yTop = pad; // 100% mark
      const yFloor = rh - pad; // 0% mark
      const yLid = yFloor - lidFrac * (yFloor - yTop);

      sideLeftRef.current?.setAttribute("x1", x0.toFixed(1));
      sideLeftRef.current?.setAttribute("x2", x0.toFixed(1));
      sideLeftRef.current?.setAttribute("y1", yTop.toFixed(1));
      sideLeftRef.current?.setAttribute("y2", yFloor.toFixed(1));
      sideRightRef.current?.setAttribute("x1", x1.toFixed(1));
      sideRightRef.current?.setAttribute("x2", x1.toFixed(1));
      sideRightRef.current?.setAttribute("y1", yTop.toFixed(1));
      sideRightRef.current?.setAttribute("y2", yFloor.toFixed(1));
      const wallWidth = Math.max(1, minDim * 0.012);
      sideLeftRef.current?.setAttribute("stroke-width", wallWidth.toFixed(2));
      sideRightRef.current?.setAttribute("stroke-width", wallWidth.toFixed(2));

      floorRef.current?.setAttribute("x1", x0.toFixed(1));
      floorRef.current?.setAttribute("x2", x1.toFixed(1));
      floorRef.current?.setAttribute("y1", yFloor.toFixed(1));
      floorRef.current?.setAttribute("y2", yFloor.toFixed(1));
      floorRef.current?.setAttribute("stroke-width", "1");

      lidRef.current?.setAttribute("x1", x0.toFixed(1));
      lidRef.current?.setAttribute("x2", x1.toFixed(1));
      lidRef.current?.setAttribute("y1", yLid.toFixed(1));
      lidRef.current?.setAttribute("y2", yLid.toFixed(1));
      lidRef.current?.setAttribute("stroke-width", Math.max(1.5, minDim * 0.018).toFixed(2));

      foldsRef.current?.setAttribute("d", buildFoldsPath(x0, x1, yLid, yFloor));
      foldsRef.current?.setAttribute("stroke-width", Math.max(1, minDim * 0.008).toFixed(2));

      // flap hinged at the reservoir's top-right corner, rotating outward
      const hingeX = x1;
      const hingeY = yTop;
      const flapLen = Math.max(6, minDim * 0.14);
      flapRef.current?.setAttribute("x1", hingeX.toFixed(1));
      flapRef.current?.setAttribute("y1", hingeY.toFixed(1));
      flapRef.current?.setAttribute("x2", (hingeX - flapLen).toFixed(1));
      flapRef.current?.setAttribute("y2", hingeY.toFixed(1));
      flapRef.current?.setAttribute("stroke-width", Math.max(1, minDim * 0.014).toFixed(2));
      flapRef.current?.setAttribute("transform", `rotate(${(-flapAngle).toFixed(2)} ${hingeX.toFixed(1)} ${hingeY.toFixed(1)})`);

      // faint venting hiss marks near the hinge, visible only while bleeding
      if (hissRef.current) {
        if (hissAlpha > 0.01) {
          const hx = hingeX - flapLen * 0.55;
          const hy = hingeY - flapLen * 0.15;
          hissRef.current.setAttribute(
            "d",
            `M${hx.toFixed(1)} ${hy.toFixed(1)}l${(-flapLen * 0.22).toFixed(1)} ${(-flapLen * 0.1).toFixed(1)}M${hx.toFixed(1)} ${(hy + flapLen * 0.12).toFixed(1)}l${(-flapLen * 0.26).toFixed(1)} ${(-flapLen * 0.02).toFixed(1)}`
          );
          hissRef.current.setAttribute("opacity", hissAlpha.toFixed(2));
        } else {
          hissRef.current.setAttribute("opacity", "0");
        }
      }
    };

    const resize = () => {
      const fr = feederWrap.getBoundingClientRect();
      const rr = reservoirWrap.getBoundingClientRect();
      if (fr.width < 4 || fr.height < 4 || rr.width < 4 || rr.height < 4) {
        sized = false;
        return;
      }
      fw = fr.width;
      fh = fr.height;
      rw = rr.width;
      rh = rr.height;
      feederSvg.setAttribute("viewBox", `0 0 ${fw} ${fh}`);
      reservoirSvg.setAttribute("viewBox", `0 0 ${rw} ${rh}`);
      sized = true;
    };

    const step = (dt: number) => {
      // continuous demand drain, always running
      lid -= DRAIN_PER_S * dt;

      // feeder stroke cadence, independent of drain
      strokeClock += dt;
      if (strokeClock >= STROKE_INTERVAL_S) {
        strokeClock -= STROKE_INTERVAL_S;
        lid += STROKE_INJECT;
      }
      if (lid < LID_FLOOR) lid = LID_FLOOR;

      if (reliefPhase === "idle" && lid > RELIEF_THRESHOLD) {
        reliefPhase = "crack";
        reliefMs = 0;
      }

      const dtMs = dt * 1000;
      if (reliefPhase === "crack") {
        reliefMs += dtMs;
        flapDeg = RELIEF_FLAP_DEG * Math.min(1, reliefMs / RELIEF_CRACK_MS);
        if (reliefMs >= RELIEF_CRACK_MS) {
          reliefPhase = "bleed";
          reliefMs = 0;
          bleedStartLid = lid;
        }
      } else if (reliefPhase === "bleed") {
        reliefMs += dtMs;
        const t = Math.min(1, reliefMs / RELIEF_BLEED_MS);
        lid = bleedStartLid + (RELIEF_THRESHOLD - bleedStartLid) * easeInOutCubic(t);
        if (reliefMs >= RELIEF_BLEED_MS) {
          lid = RELIEF_THRESHOLD;
          reliefPhase = "reseat";
          reliefMs = 0;
        }
      } else if (reliefPhase === "reseat") {
        reliefMs += dtMs;
        const t = Math.min(1, reliefMs / RELIEF_RESEAT_MS);
        flapDeg = RELIEF_FLAP_DEG * (1 - t);
        if (reliefMs >= RELIEF_RESEAT_MS) {
          reliefPhase = "idle";
          reliefMs = 0;
          flapDeg = 0;
        }
      }
    };

    const render = () => {
      if (!tokens || !sized) return;
      // feeder arm: fast rise over FEEDER_RISE_S, eased return over the rest
      let armFrac = 0;
      if (strokeClock < FEEDER_RISE_S) {
        armFrac = easeOutCubic(strokeClock / FEEDER_RISE_S);
      } else {
        const t = (strokeClock - FEEDER_RISE_S) / (STROKE_INTERVAL_S - FEEDER_RISE_S);
        armFrac = 1 - easeInOutCubic(Math.min(1, t));
      }
      drawFeeder(armFrac);
      const hissAlpha = reliefPhase === "bleed" ? 0.7 : reliefPhase === "crack" ? 0.3 : 0;
      drawReservoir(lid, flapDeg, hissAlpha);
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible || !tokens || !sized) return;
      if (last === 0) last = now;
      acc += Math.min(100, now - last);
      last = now;
      while (acc >= TICK_S * 1000) {
        acc -= TICK_S * 1000;
        step(TICK_S);
      }
      render();
    };

    const drawReducedMotionFreeze = () => {
      // STROKE_PEAK: a feeder stroke has just completed and the lid sits at
      // its local peak, just before the relief valve would consider
      // cracking — compressed pleats, a clearly legible lid height, flap
      // fully seated, feeder arm at the top of its stroke.
      const freezeLid = RELIEF_THRESHOLD - STROKE_INJECT * 0.6;
      drawFeeder(1);
      drawReservoir(freezeLid, 0, 0);
    };

    const boot = () => {
      if (disposed) return;
      tokens = readTokens();
      if (!tokens) {
        tokenWaitRaf = requestAnimationFrame(boot);
        return;
      }
      applyTokens();
      resize();
      if (reduced) {
        drawReducedMotionFreeze();
        return; // no rAF loop, no timers, no observers driving motion
      }
      if (!raf) raf = requestAnimationFrame(loop);
    };

    const ro = new ResizeObserver(() => {
      if (!tokens) return;
      resize();
      if (reduced) drawReducedMotionFreeze();
      else render();
    });
    ro.observe(feederWrap);
    ro.observe(reservoirWrap);

    const mo = new MutationObserver(() => {
      const next = readTokens();
      if (!next) return;
      tokens = next;
      applyTokens();
      if (reduced) drawReducedMotionFreeze();
      else render();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) last = 0; // avoid a large dt jump on resume
    });
    io.observe(wrap);

    document.fonts.ready.then(() => {
      if (!disposed) {
        resize();
        if (reduced) drawReducedMotionFreeze();
      }
    });

    boot();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(tokenWaitRaf);
      ro.disconnect();
      mo.disconnect();
      io.disconnect();
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className={`relative flex w-full max-w-md items-stretch overflow-hidden rounded-md border border-border bg-surface ${className}`}
    >
      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="font-mono text-[11px] tracking-widest text-ns-muted">{label}</p>
        <div className="flex flex-1 items-stretch gap-0" style={{ minHeight: 64 }}>
          <div ref={feederWrapRef} className="relative w-1/4 border-r border-border">
            <svg
              ref={feederSvgRef}
              aria-hidden="true"
              focusable="false"
              className="pointer-events-none absolute inset-0 h-full w-full"
            >
              <rect ref={cylinderRef} fill="none" />
              <line ref={armRef} strokeLinecap="round" />
              <circle ref={armHeadRef} />
            </svg>
          </div>
          <div ref={reservoirWrapRef} className="relative flex-1">
            <svg
              ref={reservoirSvgRef}
              aria-hidden="true"
              focusable="false"
              className="pointer-events-none absolute inset-0 h-full w-full"
            >
              <path ref={foldsRef} fill="none" strokeLinecap="round" />
              <line ref={sideLeftRef} />
              <line ref={sideRightRef} />
              <line ref={floorRef} />
              <line ref={lidRef} strokeLinecap="round" />
              <line ref={flapRef} strokeLinecap="round" />
              <path ref={hissRef} fill="none" strokeWidth={1} strokeLinecap="round" opacity={0} />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
