"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// CylinderHillndale — a full-width section divider rendered as a side
// elevation of an Edison-style cylinder phonograph: a rotating wax cylinder
// carrying a helical "hill-and-dale" groove (depth-modulated, not the later
// lateral-cut vinyl groove), a lead-screw rail above it, and a stylus
// carriage that the lead-screw advances axially in EXACT lockstep with the
// cylinder's rotation — one wrap of axial travel per one full turn, always,
// at any frame rate. That lockstep is the entire mechanic: the carriage's
// horizontal creep along the rail and the stylus arm's vertical bob (which
// tracks the groove's hill/dale height at the carriage's own position) are
// both driven off the SAME accumulated rotation angle, so the two motions
// can never drift apart.
//
// Discriminator against loader-thread-spool (this repo's nearest neighbour
// in "something winds/turns"): that component is a top-down concentric
// coil winding radially outward, a spiral. This is a side elevation of a
// horizontal cylinder — a straight helix wrapping a fixed-diameter barrel,
// axial translation locked to rotation, no radial growth, no spool. The
// groove pattern itself never animates; only the carriage/stylus and the
// end-cap rotation tick move.
// ---------------------------------------------------------------------------

const ROTATION_PERIOD_S = 2.6; // rendered seconds per cylinder revolution
const NUM_WRAPS = 10; // wrap crossings across one full traversal
const TRAVERSAL_S = NUM_WRAPS * ROTATION_PERIOD_S; // 26s, matches the real Edison 4" cylinder pass

const END_CAP_RX_FACTOR = 0.22; // end-cap ellipse half-width, relative to radius
const AMPL_FACTOR = 0.62; // groove sine amplitude, relative to radius
const RAIL_GAP_FACTOR = 0.85; // lead-screw rail height above cylinder center, relative to radius

// baked "hill-and-dale" depth envelope — a fixed spatial pattern cut into
// the groove, three non-commensurate components so it never repeats
// visibly across a single traversal. A function of AXIAL POSITION only,
// never of time: the groove doesn't re-record itself, the carriage just
// rides over whatever depth was already cut there.
function grooveDepth(xFrac: number) {
  const a =
    0.5 +
    0.5 *
      Math.sin(2 * Math.PI * 3.1 * xFrac) *
      Math.cos(2 * Math.PI * 1.7 * xFrac + 0.6);
  const b = 0.5 + 0.5 * Math.sin(2 * Math.PI * 7.3 * xFrac + 2.1);
  return Math.max(0, Math.min(1, 0.65 * a + 0.35 * b));
}

export interface CylinderHillndaleProps {
  /** band height in px; the cylinder's radius derives from this. Default 88. */
  height?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function CylinderHillndale({
  height = 88,
  className = "",
}: CylinderHillndaleProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let fg = "currentColor";
    let border = "currentColor";
    const readTokens = () => {
      const root = getComputedStyle(document.documentElement);
      fg = root.getPropertyValue("--foreground").trim() || "currentColor";
      border = root.getPropertyValue("--border").trim() || "currentColor";
    };

    let width = 0;
    let dpr = 1;
    let sized = false;

    // layout, recomputed on resize
    let cx = { left: 0, right: 0 }; // cylinder body x-extent
    let cy = 0; // vertical center of the cylinder
    let radius = 0;
    let railY = 0;
    let wrapSpacing = 1;
    let ampl = 1;

    const layout = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      if (width < 2) {
        sized = false;
        return;
      }
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      radius = height * 0.32;
      const endCapRx = radius * END_CAP_RX_FACTOR;
      const inset = endCapRx + radius * 0.15;
      cx = { left: inset, right: width - inset };
      cy = height * 0.58; // slightly below center so the rail above has room
      railY = cy - radius * RAIL_GAP_FACTOR - radius * 0.55;
      ampl = radius * AMPL_FACTOR;
      const bodyLen = Math.max(1, cx.right - cx.left);
      wrapSpacing = bodyLen / NUM_WRAPS;

      sized = true;
    };

    const grooveY = (x: number) => {
      const frac = (x - cx.left) / Math.max(1, cx.right - cx.left);
      return cy + ampl * Math.sin((2 * Math.PI * (x - cx.left)) / wrapSpacing) * (0.75 + 0.25 * grooveDepth(frac));
    };

    const draw = (elapsedS: number) => {
      if (!sized) return;
      ctx.clearRect(0, 0, width, height);

      const bodyLen = cx.right - cx.left;
      const endCapRx = radius * END_CAP_RX_FACTOR;

      // -- cylinder body outline -------------------------------------------
      ctx.strokeStyle = fg;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(cx.left, cy - radius);
      ctx.lineTo(cx.right, cy - radius);
      ctx.moveTo(cx.left, cy + radius);
      ctx.lineTo(cx.right, cy + radius);
      ctx.stroke();

      // rotation phase, unbounded — everything below derives from this
      const revolutions = elapsedS / ROTATION_PERIOD_S;
      const rotationAngle = revolutions * 2 * Math.PI;
      const traversalFrac = (elapsedS / TRAVERSAL_S) % 1;
      const carriageX = cx.left + traversalFrac * bodyLen;

      // -- end caps, each with a rotation tick ------------------------------
      for (const ex of [cx.left, cx.right]) {
        ctx.strokeStyle = fg;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(ex, cy, endCapRx, radius, 0, 0, Math.PI * 2);
        ctx.stroke();

        // tick marking cylinder rotational phase — the "barrel is turning"
        // cue, kept visually separate from the carriage's own motion
        const tickAngle = rotationAngle % (2 * Math.PI);
        const tx = ex + endCapRx * 0.72 * Math.sin(tickAngle);
        const ty = cy + radius * 0.72 * Math.cos(tickAngle);
        ctx.beginPath();
        ctx.arc(tx, ty, 1.4, 0, Math.PI * 2);
        ctx.fillStyle = fg;
        ctx.fill();
      }

      // -- helical groove, static in space, depth-modulated stroke width --
      // drawn as short segments so lineWidth can vary along its length —
      // width encodes hill/dale depth, never a color or alpha shift
      const STEP = Math.max(2, wrapSpacing / 14);
      ctx.strokeStyle = fg;
      let prevX = cx.left;
      let prevY = grooveY(cx.left);
      for (let x = cx.left + STEP; x <= cx.right + STEP; x += STEP) {
        const clampedX = Math.min(x, cx.right);
        const yv = grooveY(clampedX);
        const frac = (clampedX - cx.left) / bodyLen;
        ctx.lineWidth = 0.8 + grooveDepth(frac) * 1.8;
        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(clampedX, yv);
        ctx.stroke();
        prevX = clampedX;
        prevY = yv;
        if (clampedX >= cx.right) break;
      }

      // -- lead-screw rail: a true separator, never a fill -----------------
      ctx.strokeStyle = border;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx.left, railY);
      ctx.lineTo(cx.right, railY);
      ctx.stroke();

      // -- carriage: pure horizontal translation along the rail ------------
      const carriageW = Math.max(6, radius * 0.36);
      const carriageH = Math.max(4, radius * 0.24);
      ctx.fillStyle = fg;
      ctx.fillRect(
        carriageX - carriageW / 2,
        railY - carriageH / 2,
        carriageW,
        carriageH
      );

      // -- stylus arm: vertical link from carriage down to the groove ------
      // its length is exactly the groove's local height under the current
      // rotation phase — the one visible proof rotation and translation
      // are locked, not two independent animations
      const stylusY = grooveY(carriageX);
      ctx.strokeStyle = fg;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(carriageX, railY + carriageH / 2);
      ctx.lineTo(carriageX, stylusY);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(carriageX, stylusY, 1.8, 0, Math.PI * 2);
      ctx.fill();
    };

    // -- loop ----------------------------------------------------------------
    let raf = 0;
    let clockS = 0; // accumulated elapsed seconds, pauses cleanly on hide
    let lastTs = 0;

    const loop = (now: number) => {
      const dt = lastTs ? Math.min(0.25, (now - lastTs) / 1000) : 1 / 60;
      lastTs = now;
      clockS += dt;
      draw(clockS);
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };

    const start = () => {
      cancelAnimationFrame(raf);
      lastTs = 0;
      raf = requestAnimationFrame(loop);
    };

    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced) draw(TRAVERSAL_S * 0.4);
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const ro = new ResizeObserver(() => {
      layout();
      if (reduced) draw(TRAVERSAL_S * 0.4);
      else if (sized && !document.hidden) start();
    });
    ro.observe(canvas);

    let io: IntersectionObserver | null = null;
    if (!reduced) {
      io = new IntersectionObserver(
        (entries) => {
          const visible = entries[0]?.isIntersecting;
          if (visible && sized && !document.hidden) {
            start();
          } else {
            cancelAnimationFrame(raf);
          }
        },
        { threshold: 0.01 }
      );
      io.observe(canvas);
    }

    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduced && sized) start();
    };
    document.addEventListener("visibilitychange", onVis);

    document.fonts.ready.then(() => {
      readTokens();
      layout();
      if (!sized) return;

      if (reduced) {
        // deliberately non-t0, most-structured frame: traversal progress
        // 40% — the carriage is clearly past the start and the groove's
        // depth-modulated stroke width is visibly non-uniform around it
        draw(TRAVERSAL_S * 0.4);
        return;
      }

      draw(0);
      start();
    });

    return () => {
      cancelAnimationFrame(raf);
      mo.disconnect();
      ro.disconnect();
      io?.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [height]);

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      className={`ns-cyl w-full ${className}`}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="block w-full text-foreground"
        style={{ height }}
      />
    </div>
  );
}
