"use client";

import { useEffect, useId, useRef } from "react";

// ---------------------------------------------------------------------------
// BladeStop — a full-viewport route curtain built as an iris diaphragm: nine
// leaves pivoting on a mount ring, stopping the aperture down to zero to cover
// the outgoing page and opening back up on the incoming one.
//
// It is a mechanism, not a wipe, because nothing here is authored as a shape
// over time. The only animated quantity is phi, the angle of the actuating ring
// that every leaf's crank is pinned to. Each leaf is a plate whose inner edge is
// a circular arc of radius Rb centred at C = P + L*u(theta + phi): the pivot P
// sits on the mount ring, the crank of length L swings the arc centre, and the
// aperture radius is whatever |C| - Rb happens to be. Everything the eye reads
// as choreography — the aperture opening fast and closing slow, the hole being a
// nine-sided star rather than a circle, the leaves sweeping tangentially rather
// than radially, adjacent plates sliding across each other by different amounts
// at different phases — falls out of that one relation. A wipe would need those
// as separate decisions; here they are consequences.
//
// The travel is integrated, not eased. phi is a second-order system (crank
// inertia, viscous damping in the bearings, a spring return) driven toward its
// commanded end, and the closed end is a HARD STOP with restitution: the ring
// arrives, strikes, rebounds a couple of degrees, and settles in two decaying
// bounces. That is why the close has weight. Each leaf also carries an
// individual bearing clearance of a few tenths of a degree, so the closed
// aperture never resolves into a perfect nine-fold star — real leaves are shimmed
// by hand and the seam pattern shows it.
//
// Because it is an iris, the covered state is not a blank plate. Nine overlapping
// leaves lit by one fixed source, each catching a different value as it rotates,
// leave a visible seam rosette at the centre — so the catalog card and the
// resting screenshot show the mechanism at any phase of the cycle.
//
// Palette: two value stops mixed from --background, --foreground, --ns-muted and
// --border, read via getComputedStyle at mount and re-read on a MutationObserver
// over documentElement's class. --ns-accent is interaction-only and this
// component has no pointer interaction, so it does not read it at all. What is
// held constant across themes is the SPREAD across the nine plates rather than
// their direction against the page — see readColors below for why insisting the
// shutter be the low value in both themes produced a black field in dark.
// ---------------------------------------------------------------------------

export interface BladeStopProps {
  /** true drives the iris closed (page covered), false drives it open. */
  active?: boolean;
  /** Number of leaves. @default 9 */
  leaves?: number;
  /** Nominal one-way travel in ms. The spring/inertia constants are derived from it. @default 900 */
  duration?: number;
  /** Fired once the aperture first reaches zero — the moment to swap routes. */
  onCovered?: () => void;
  /** Fired once the leaves are fully clear of the viewport again. */
  onRevealed?: () => void;
  /** Freeze on a composed still frame without unmounting. */
  paused?: boolean;
  /** Rendered under the shutter. */
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

type RGB = [number, number, number];

function parseColor(raw: string): RGB | null {
  const s = raw.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const n = parseInt(h, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  const fn = /^rgba?\(([^)]+)\)$/i.exec(s);
  if (fn) {
    const parts = fn[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
    if (parts.length >= 3) return [parts[0] / 255, parts[1] / 255, parts[2] / 255];
  }
  return null;
}

function mixRGB(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function luminance([r, g, b]: RGB): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function css([r, g, b]: RGB, alpha = 1): string {
  const q = (x: number) => Math.round(Math.min(1, Math.max(0, x)) * 255);
  return alpha >= 1 ? `rgb(${q(r)}, ${q(g)}, ${q(b)})` : `rgba(${q(r)}, ${q(g)}, ${q(b)}, ${alpha})`;
}

// --- iris geometry, in units of R = the radius that must be cleared ---------
//
// The three numbers are a real linkage, and they are coupled: the crank has to
// be long enough that swinging it carries |C| from above Rb + R (leaf edge
// outside the corner, page fully uncovered) down to below Rb (edges past the
// centre, page fully covered), and the pivot ring has to sit far enough out that
// the plates never expose their own outer edge inside the frame. |C|^2 =
// Rp^2 + L^2 + 2*Rp*L*cos(phi), so the whole travel is one cosine: 2.02R at
// phi = 0 down to 0.58R at phi = pi (measured aperture 1.22R open, -0.10R at the
// stop, and the hole only enters the frame at 42% of the travel — the leaves
// spend the first part of every close still outside the corner). That cosine is
// also why the aperture
// closes so much more slowly than it opens — near phi = 0 the crank is moving
// almost radially and |C| barely changes, near phi = pi it is moving almost
// tangentially. No easing curve is applied anywhere; that asymmetry is the
// linkage's own.
//
// The crank is 0.72 and not the 0.64 it started at because of the dead point.
// At phi = pi the crank is folded straight back along the pivot arm and d|C|/dphi
// is exactly zero; with the shorter crank the closed aperture landed ON that
// point, so the last third of the travel moved the blades almost not at all and
// the stop had nothing to strike. 0.72 puts min |C| at 0.58R, well past the
// 0.70R that closure needs, so the ring reaches its stop at phi = 2.74 with the
// linkage still moving — which is what gives the arrival its snap.
const PIVOT_R = 1.3; // mount-ring radius, x R
const CRANK_L = 0.72; // crank length, x R
const EDGE_R = 0.8; // leaf inner-edge arc radius, x R
// The blade is bounded by its leading arc on the aperture side and by the mount
// ring on the other, and the mount ring is centred on the FRAME, not on C: the
// plate is squeezed to nothing against its own mount as the iris opens, so at
// phi = 0 there is no plate inside the viewport at all.
const OUTER_R = 2.7; // mount ring, x R from the frame centre — past the corner
// Plate half-width, measured as an angle AT THE FRAME CENTRE rather than at the
// arc centre. 1.9x the pitch (2*pi/n), so consecutive plates overlap by nearly a
// full plate — which is what makes the covered state opaque no matter where the
// ring happens to be, and what puts a visible seam under every leaf.
const PLATE_SPAN = 1.9;
const OVERCLOSE = 0.1; // how far past zero the aperture is driven, x R
// R is half the viewport diagonal times this, so the frame's corner sits at 1/K
// in the same units. It buys the margin by which the parked leaves clear the
// corner, and it is 0.95 rather than the 1.06 it started at because that margin
// is dead travel: the open aperture is 1.22R, so at 1.06 the leaves spent the
// first 42% of every close still outside the frame — measured, the cycle was
// blank more often than not. 0.88 puts the corner at 1.136R, still a clear 7%
// at rest, and makes the plates larger on screen for the same linkage.
const FRAME_K = 0.88;
const CORNER = 1 / FRAME_K; // frame corner radius, x R

/** Aperture radius, in units of R, for a ring angle phi. Negative = overlapped. */
function aperture(phi: number): number {
  const d2 = PIVOT_R * PIVOT_R + CRANK_L * CRANK_L + 2 * PIVOT_R * CRANK_L * Math.cos(phi);
  return Math.sqrt(d2) - EDGE_R;
}

/** phi at which the aperture first reaches -OVERCLOSE. Monotone on [0, pi]. */
function solvePhiClosed(): number {
  let lo = 0;
  let hi = Math.PI;
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    if (aperture(mid) > -OVERCLOSE) lo = mid;
    else hi = mid;
  }
  return hi;
}

const PHI_CLOSED = solvePhiClosed();

// The still frame drawn under prefers-reduced-motion and `paused`: the leaves
// well into frame with the nine-sided aperture clearly formed, rather than a
// blank page or a flat plate.
const STATIC_FRACTION = 0.72;

export function BladeStop({
  active = false,
  leaves = 9,
  duration = 900,
  onCovered,
  onRevealed,
  paused = false,
  children,
  className = "",
  style,
}: BladeStopProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const uid = useId();

  const activeRef = useRef(active);
  activeRef.current = active;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const coveredCb = useRef(onCovered);
  coveredCb.current = onCovered;
  const revealedCb = useRef(onRevealed);
  revealedCb.current = onRevealed;
  // the running effect publishes its wake() here so the prop-change effect can
  // restart the loop without the effect itself depending on `active` — a dep
  // would tear the canvas down and lose the ring's momentum mid-travel
  const wakeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let raf = 0;
    let running = false;
    let staticMode = false;
    let disposed = false;
    let cssW = 0;
    let cssH = 0;
    let dpr = 1;
    let lastMs = performance.now();

    // --- ring state -------------------------------------------------------
    // phi is the actuating ring's angle, in radians. vel is its angular
    // velocity. Everything visible is a function of phi.
    let phi = active ? PHI_CLOSED : 0;
    let vel = 0;
    let firedCovered = active;
    let firedRevealed = !active;
    // per-leaf bearing clearance: a fixed, deterministic few tenths of a degree
    // of slop per leaf, so the closed rosette is shimmed rather than perfect
    const slop: number[] = [];
    const buildSlop = (n: number) => {
      slop.length = 0;
      for (let i = 0; i < n; i++) {
        slop.push(Math.sin(i * 12.9898) * 0.0075);
      }
    };
    buildSlop(Math.max(3, Math.round(leaves)));

    // --- palette ----------------------------------------------------------
    let plateLo: RGB = [0.05, 0.05, 0.05];
    let plateHi: RGB = [0.3, 0.3, 0.3];
    let edge: RGB = [0.6, 0.6, 0.6];
    let shade: RGB = [0, 0, 0];

    const readColors = () => {
      const cs = getComputedStyle(document.documentElement);
      const bg = parseColor(cs.getPropertyValue("--background")) ?? [1, 1, 1];
      const fg = parseColor(cs.getPropertyValue("--foreground")) ?? [0.09, 0.09, 0.09];
      const muted = parseColor(cs.getPropertyValue("--ns-muted")) ?? [0.55, 0.55, 0.55];
      const border = parseColor(cs.getPropertyValue("--border")) ?? [0.18, 0.18, 0.18];
      const black: RGB = [0, 0, 0];
      // The plates are metal under one lamp, so what fixes their value is the
      // lamp and not the theme: the stack always spans a wide range and it
      // always separates FROM the page rather than agreeing with it. Against a
      // near-black page the lit leaves sit above it, against paper they sit
      // well under it. The first pass got this wrong by insisting the shutter be
      // the low value in both themes — in dark theme there is nothing below the
      // page to be, and the covered state came out as a black field with two
      // faint seams in it. What must stay constant is the SPREAD across the
      // nine plates, because that spread is the only thing that shows the
      // assembly is nine sheets and not one hole punched in a rectangle.
      if (luminance(bg) < 0.5) {
        plateLo = mixRGB(border, bg, 0.28);
        plateHi = mixRGB(muted, fg, 0.34);
        edge = mixRGB(fg, muted, 0.2);
        shade = mixRGB(bg, black, 0.9);
      } else {
        plateLo = mixRGB(fg, muted, 0.22);
        plateHi = mixRGB(muted, bg, 0.42);
        edge = mixRGB(bg, muted, 0.18);
        shade = mixRGB(fg, black, 0.45);
      }
    };
    readColors();

    // --- drawing ----------------------------------------------------------
    // One blade: the leading arc segment, closed back along the mount ring. The
    // leading arc is the only edge ever inside the frame, so it is the whole of
    // what the eye reads; the return along the ring is always past the corner.
    // The plate's inner boundary, sampled as a radius per FRAME-CENTRE angle
    // rather than as an arc swept about C. Same curve either way — it is still
    // the leading circle of radius Rb about C — but in this parameterisation the
    // question "which side of the arc is the plate on" has an answer instead of
    // a winding flag: the plate is everything at a larger radius on that ray.
    // The first pass closed the arc back along the mount ring and picked the
    // sweep direction from the pivot's bearing; that flag came out inverted, the
    // path wrapped the long way round, and every one of the nine leaves then
    // contained the frame centre. There was no aperture at any phase of the
    // travel — the curtain went from clear to solid inside the first third and
    // the remaining two thirds happened behind an opaque plate.
    //
    //   r(psi) = d*cos(D) - sqrt(Rb^2 - d^2*sin(D)^2),  D = psi - angle(C)
    //
    // the near root of the ray/circle intersection. Its three regimes are the
    // three things the mechanism does. Discriminant negative: the ray misses the
    // circle entirely, so the blade has no material on it — that is the leaf
    // pinching out to nothing against its mount as the iris opens, and it is why
    // no plate is inside the frame at phi = 0. Root negative: the frame centre
    // is inside the edge circle, the plate reaches all the way in, and the leaves
    // are pie slices meeting at the axis — closed. Between them, the root is the
    // aperture edge, and because it is a circle seen off-centre it is nearest to
    // the axis in the middle of each plate and furthest at the seams: the hole is
    // a nine-lobed star, ~10% deeper at the lobes than at the points, and that
    // scalloping is the linkage's, not a decorative choice.
    const SAMPLES = 26;
    const inner: { x: number; y: number; r: number }[] = [];
    const leafPath = (
      cx: number,
      cy: number,
      C: { x: number; y: number },
      R: number,
      ox = 0,
      oy = 0
    ) => {
      const d = Math.hypot(C.x, C.y);
      const thC = Math.atan2(C.y, C.x);
      const rb = EDGE_R * R;
      // the widest the plate can physically be: past the tangent ray there is no
      // intersection to bound it, so the material stops
      const wMax = d > rb ? Math.asin(Math.min(1, rb / d)) : Math.PI;
      const half = Math.min(wMax, (PLATE_SPAN * Math.PI) / Math.max(3, Math.round(leaves)));
      inner.length = 0;
      for (let k = 0; k <= SAMPLES; k++) {
        const psi = thC - half + (2 * half * k) / SAMPLES;
        const del = psi - thC;
        const s = d * Math.sin(del);
        const disc = rb * rb - s * s;
        const r = Math.max(0, d * Math.cos(del) - (disc > 0 ? Math.sqrt(disc) : 0));
        inner.push({ x: cx + ox + Math.cos(psi) * r, y: cy + oy + Math.sin(psi) * r, r });
      }
      ctx.beginPath();
      ctx.moveTo(inner[0].x, inner[0].y);
      for (let k = 1; k <= SAMPLES; k++) ctx.lineTo(inner[k].x, inner[k].y);
      // out to the mount ring along the SAME rays, so the plate's two sides are
      // radial seams and the closing edge is always past the corner
      for (let k = SAMPLES; k >= 0; k--) {
        const psi = thC - half + (2 * half * k) / SAMPLES;
        ctx.lineTo(cx + ox + Math.cos(psi) * OUTER_R * R, cy + oy + Math.sin(psi) * OUTER_R * R);
      }
      ctx.closePath();
    };

    const draw = () => {
      if (cssW < 2 || cssH < 2) return;
      const n = Math.max(3, Math.round(leaves));
      const cx = cssW / 2;
      const cy = cssH / 2;
      // R is the linkage's own unit; the frame corner sits at CORNER * R
      const R = Math.hypot(cssW, cssH) * 0.5 * FRAME_K;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);

      const p = staticMode ? PHI_CLOSED * STATIC_FRACTION : phi;
      if (p <= 1e-4) return; // fully open: the shutter is not in the frame at all

      // one fixed source, upper-left, exactly as a shutter sits under a lamp:
      // each plate's value is its own rotation relative to it, so the leaves
      // change tone AS THEY TRAVEL rather than being pre-tinted
      const lightAngle = -2.2;
      const lx = Math.cos(lightAngle);
      const ly = Math.sin(lightAngle);

      ctx.lineJoin = "round";
      for (let i = 0; i < n; i++) {
        const theta = (i / n) * Math.PI * 2;
        const arm = theta + p + slop[i % slop.length] * (p / PHI_CLOSED);
        const px = Math.cos(theta) * PIVOT_R * R;
        const py = Math.sin(theta) * PIVOT_R * R;
        const C = {
          x: px + Math.cos(arm) * CRANK_L * R,
          y: py + Math.sin(arm) * CRANK_L * R,
        };

        // the plate's tilt against the source. The crank angle, not the pivot
        // angle: a leaf that has swung across the frame presents a different
        // face than one still parked at the ring.
        const facing = 0.5 + 0.5 * Math.cos(arm - lightAngle);
        const v = 0.08 + 0.84 * facing;

        // The contact shadow each plate drops on the one under it. It is a second
        // fill of the same outline, offset toward the source and unblurred,
        // rather than a canvas shadowBlur: at DPR 2 a 0.05R blur on nine
        // full-canvas paths measured 400ms per frame (rAF fell to 9fps and the
        // long-task observer reported one ~400ms task per frame), and the offset
        // fill costs a fill. A shutter's leaves are in contact anyway, so the
        // hard step is the more honest edge.
        leafPath(cx, cy, C, R, -R * 0.012, -R * 0.009);
        ctx.fillStyle = css(shade, 0.5);
        ctx.fill();

        leafPath(cx, cy, C, R);
        // one lamp across the whole assembly, not a flat tint per plate: every
        // leaf takes its slice of the same linear ramp, offset by its own tilt,
        // so a plate that spans the frame is brighter at the lit end and the
        // stack reads as sheet metal rather than as nine vector shapes
        const g = ctx.createLinearGradient(
          cx + lx * R * 1.3,
          cy + ly * R * 1.3,
          cx - lx * R * 1.3,
          cy - ly * R * 1.3
        );
        g.addColorStop(0, css(mixRGB(plateLo, plateHi, Math.min(1, v + 0.16))));
        g.addColorStop(1, css(mixRGB(plateLo, plateHi, Math.max(0, v - 0.16))));
        ctx.fillStyle = g;
        ctx.fill();

        // the bevelled inner edge: a bright line whose intensity tracks how
        // square the edge is to the source. Drawn along the sampled boundary and
        // broken wherever the plate has reached the axis — a bevel through the
        // centre would draw a star of lines across the closed shutter.
        ctx.beginPath();
        let pen = false;
        for (let k = 0; k <= SAMPLES; k++) {
          const q = inner[k];
          if (q.r <= R * 0.004) {
            pen = false;
            continue;
          }
          if (pen) ctx.lineTo(q.x, q.y);
          else ctx.moveTo(q.x, q.y);
          pen = true;
        }
        ctx.lineWidth = Math.max(1, R * 0.0022);
        ctx.strokeStyle = css(edge, 0.34 + 0.5 * facing);
        ctx.stroke();
      }
    };

    // --- integration ------------------------------------------------------
    // The ring is a mass on a spring with viscous damping, driven toward its
    // commanded end. omega is set from `duration` so the nominal travel takes
    // the requested time; zeta is under 1 so the OPEN end overshoots slightly
    // and settles, and the CLOSED end is a hard stop with restitution, which is
    // what a leaf shutter physically has — the ring runs into a pin.
    const RESTITUTION = 0.12;
    const step = (dt: number) => {
      const target = activeRef.current ? PHI_CLOSED : 0;
      // 2.6/T rather than a larger constant: the ring's step response settles in
      // roughly 3/omega, so this is what makes `duration` mean the wall-clock
      // travel instead of a third of it
      const omega = (3.4 * 1000) / Math.max(120, duration);
      const zeta = activeRef.current ? 0.72 : 0.86;
      vel += (-omega * omega * (phi - target) - 2 * zeta * omega * vel) * dt;
      phi += vel * dt;

      if (phi >= PHI_CLOSED) {
        // strike the closing stop
        phi = PHI_CLOSED;
        if (vel > 0) vel = -vel * RESTITUTION;
      } else if (phi <= 0) {
        phi = 0;
        if (vel < 0) vel = -vel * RESTITUTION;
      }

      // Completion is reported off the APERTURE, not off phi settling: the page
      // is covered the instant the leaf edges cross, which happens before the
      // ring has finished bouncing, and it is uncovered when the last edge
      // leaves the corner. Swapping a route on "the spring is done" would show
      // the swap through a still-open aperture.
      const a = aperture(phi);
      if (activeRef.current) {
        firedRevealed = false;
        if (!firedCovered && a <= 0) {
          firedCovered = true;
          coveredCb.current?.();
        }
      } else {
        firedCovered = false;
        // symmetrically, revealed is a visibility fact and not a settling one:
        // the page is uncovered once the aperture clears the corner, which is
        // well before the ring has stopped ringing
        if (!firedRevealed && a >= CORNER) {
          firedRevealed = true;
          revealedCb.current?.();
        }
      }
    };

    const settled = () =>
      Math.abs(vel) < 2e-3 && Math.abs(phi - (activeRef.current ? PHI_CLOSED : 0)) < 1e-3;

    const loop = (nowMs: number) => {
      const dt = Math.min(0.05, Math.max(0, (nowMs - lastMs) / 1000));
      lastMs = nowMs;
      // fixed substeps: the spring is stiff enough that a 50ms catch-up frame
      // integrated in one go would jump the ring straight through its stop
      let remaining = dt;
      while (remaining > 1e-6) {
        const h = Math.min(1 / 240, remaining);
        step(h);
        remaining -= h;
      }
      draw();
      if (settled()) {
        running = false;
        return;
      }
      raf = requestAnimationFrame(loop);
    };

    const wake = () => {
      if (running || disposed || staticMode) return;
      running = true;
      lastMs = performance.now();
      raf = requestAnimationFrame(loop);
    };
    const sleep = () => {
      cancelAnimationFrame(raf);
      running = false;
    };
    wakeRef.current = wake;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      cssW = rect.width;
      cssH = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pw = Math.round(cssW * dpr);
      const ph = Math.round(cssH * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      draw();
    };

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = mq.matches;
    const applyMode = () => {
      if (reduced || pausedRef.current) {
        staticMode = true;
        sleep();
        draw();
      } else {
        staticMode = false;
        draw();
        wake();
      }
    };
    const onMq = () => {
      reduced = mq.matches;
      applyMode();
    };
    mq.addEventListener("change", onMq);

    let onScreen = true;
    const io = new IntersectionObserver(
      (entries) => {
        onScreen = entries.some((en) => en.isIntersecting);
        if (!onScreen) sleep();
        else if (!staticMode && !document.hidden) wake();
      },
      { threshold: 0 }
    );
    io.observe(wrap);

    const onVis = () => {
      if (document.hidden) sleep();
      else if (!staticMode && onScreen) wake();
    };
    document.addEventListener("visibilitychange", onVis);

    let lastPolledPaused = pausedRef.current;
    let poll = 0;
    const tick = () => {
      if (pausedRef.current !== lastPolledPaused) {
        lastPolledPaused = pausedRef.current;
        applyMode();
      }
      poll = window.setTimeout(tick, 140);
    };
    tick();

    const themeObserver = new MutationObserver(() => {
      readColors();
      draw();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    applyMode();

    return () => {
      disposed = true;
      wakeRef.current = null;
      ro.disconnect();
      io.disconnect();
      mq.removeEventListener("change", onMq);
      document.removeEventListener("visibilitychange", onVis);
      themeObserver.disconnect();
      window.clearTimeout(poll);
      sleep();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaves, duration]);

  // a commanded change restarts the loop from wherever the ring currently is
  useEffect(() => {
    wakeRef.current?.();
  }, [active]);

  return (
    <div
      ref={wrapRef}
      data-blade-stop={uid}
      className={`relative isolate h-full w-full overflow-hidden bg-background ${className}`}
      style={style}
    >
      {children ? <div className="absolute inset-0">{children}</div> : null}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[2] block"
      />
    </div>
  );
}

BladeStop.displayName = "BladeStop";
