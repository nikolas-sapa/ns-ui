"use client";

import { useEffect, useId, useRef } from "react";

// ---------------------------------------------------------------------------
// TourbillonCage — a full-bleed loading/route-transition curtain built as
// Breguet's tourbillon (1795): the whole escapement (balance wheel,
// hairspring, pallet fork, escape wheel) is mounted on a carriage that
// itself slowly rotates, so gravity's drag on the balance's rate averages
// out over one carriage revolution instead of biasing it in a fixed
// orientation. Two independent rotations nest on one axis and never
// synchronize: the carriage turns slow, the balance ticks fast inside it.
//
// COMPRESSED, NOT LITERAL, on both axes — a stated departure, not a fidelity
// claim. A real one-minute tourbillon carriage completes one revolution per
// 60s; rendered here at 9s/rev (~6.7x faster) so the slow rotation is
// legible inside a card-scale demo window instead of reading as static. A
// real balance runs 21,600-28,800 vph (3-4 Hz / 6-8 beats per second);
// rendered at 2.5 Hz (5 beats/sec) — still slower than the real rate, and
// deliberately kept well under the ~60Hz paint rate so the tick reads as a
// distinct kick-and-reverse rather than aliasing into a strobe the way a
// literal 1:1 sim would.
//
// ONE ROTATED FRAME holds the entire escapement subassembly (hairspring,
// balance rim, pallet fork, escape wheel). Rotating that single frame by the
// carriage angle is what makes the carriage's slow turn read: the fork's
// rock axis, the hairspring's coil and the escape wheel's tooth positions
// all sweep around together, while the balance's own oscillation angle is
// ADDED on top, inside that already-rotated frame, so the two rotations
// compose without ever driving one from the other. The carriage frame
// itself (outer ring + two asymmetric arms, one the "bridge" carrying the
// escapement, one a bare counterpoise) is drawn in the same rotated space
// so its asymmetry is what actually sells the slow turn — a plain circle
// alone would look identical at every carriage angle.
//
// THE PALLET FORK is the one high-frequency, high-contrast element: it
// rocks +-9deg and releases exactly one escape-wheel tooth every balance
// half-swing (5x/sec at the rendered rate), a genuine locking/impulse
// alternation, not a continuous spin — the escape wheel visibly steps one
// tooth and stops, tooth and stops, which is the actual behavior a real
// escapement exhibits and is legible at this rate specifically because nothing
// else on screen updates that fast.
//
// MONOCHROME: cage ring track and escape-wheel teeth/hairspring (quieter,
// structural/supporting motion) read in --ns-muted; the carriage bridge arm,
// balance rim and pallet fork (the fast, climactic motion) read in
// --foreground. --border is never used as a stroke (~1.1:1 contrast in
// light theme, invisible as a line weight). --ns-accent never appears —
// there is no pointer-driven highlight to reserve it for; this curtain
// takes no input.
// ---------------------------------------------------------------------------

export interface TourbillonCageProps {
  /** Freezes the mechanism on its current frame without unmounting. */
  paused?: boolean;
  /** Rendered in the DOM over the cage — eyebrow, caption, progress copy. */
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const TAU = Math.PI * 2;

// Rendered rates — both explicitly decoupled from their real-mechanism
// reference values; see the top-of-file note for the real numbers and the
// compression factor.
const CAGE_PERIOD_S = 9; // rendered carriage period (real reference: 60s/rev)
const BALANCE_HZ = 2.5; // rendered balance frequency (real reference: 4Hz / 28,800 vph)
const BALANCE_HALF_PERIOD = 1 / (2 * BALANCE_HZ); // 0.2s — one escapement release per half-swing
const BALANCE_AMPLITUDE_DEG = 102; // arc either side of center
// phase offset chosen only so STATIC_TIME below lands the balance away from
// both a zero-crossing and a full-amplitude extreme — not load-bearing
// anywhere else in the mechanism
const BALANCE_PHASE = 1.82;

const FORK_KICK_DEG = 9;
const ESCAPE_TEETH = 15;
const TOOTH_DEG = 360 / ESCAPE_TEETH;
const HAIRSPRING_TURNS = 6;
const HAIRSPRING_BREATH = 0.06; // +-6%, in phase with balance extension

// Snap-and-hold easing window for the fork kick / escape-wheel tooth
// advance: a real escapement's unlocking is effectively instantaneous, so
// this is a fast ease to a held position, not a slow tween — ~12% of the
// half-period, ~24ms at the rendered rate.
const SNAP_FRAC = 0.12;

// The frozen reduced-motion frame: carriage 45deg into its revolution (a
// spread, legible angle for the asymmetric arms — not t0, where the
// carriage sits at its unrotated reference orientation and reads as
// inert), balance away from either swing extreme (mid-arc, per
// BALANCE_PHASE above) and the fork/escape wheel mid-hold between releases.
const STATIC_TIME = CAGE_PERIOD_S / 8; // 1.125s -> carriage at 45deg

function snap(frac: number): number {
  // frac in [0,1) within a half-period; eases 0->1 across SNAP_FRAC of it,
  // then holds at 1 — the escape wheel/fork's "release, then wait" motion.
  if (frac >= SNAP_FRAC) return 1;
  const x = frac / SNAP_FRAC;
  return x * x * (3 - 2 * x); // smoothstep
}

function balanceAngleRad(t: number): number {
  return ((BALANCE_AMPLITUDE_DEG * Math.PI) / 180) * Math.sin(TAU * BALANCE_HZ * t + BALANCE_PHASE);
}

export function TourbillonCage({
  paused,
  children,
  className = "",
  style,
}: TourbillonCageProps) {
  const uid = useId();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let disposed = false;
    let running = false;
    let raf = 0;
    let lastMs = 0;
    let simTime = 0;
    let staticMode = false;

    let cssW = 0;
    let cssH = 0;

    // No hex fallback — a literal here would bake one theme's polarity in
    // before the first real read lands. readTokens() runs synchronously,
    // before resize()/applyMode() ever call draw(), so these are never read
    // unassigned.
    let bg = "";
    let fg = "";
    let muted = "";

    const readTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      bg = cs.getPropertyValue("--background").trim();
      fg = cs.getPropertyValue("--foreground").trim();
      muted = cs.getPropertyValue("--ns-muted").trim();
    };
    readTokens();

    const resize = () => {
      const { width, height } = wrap.getBoundingClientRect();
      if (width < 2 || height < 2) return;
      cssW = width;
      cssH = height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const drawSpiral = (breath: number) => {
      // Archimedean hairspring, HAIRSPRING_TURNS turns, outer radius
      // breathing +-HAIRSPRING_BREATH in phase with how far the balance has
      // rotated from center — it stretches as the balance swings out.
      const ref = Math.min(cssW, cssH) * 0.34;
      const innerR = ref * 0.16;
      const outerR = ref * 0.34 * (1 + HAIRSPRING_BREATH * breath);
      const steps = 96;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const f = i / steps;
        const a = f * HAIRSPRING_TURNS * TAU;
        const r = innerR + (outerR - innerR) * f;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = muted;
      ctx.lineWidth = Math.max(1, ref * 0.006);
      ctx.stroke();
    };

    const drawEscapeWheel = (r: number, angleRad: number) => {
      ctx.save();
      ctx.rotate(angleRad);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.strokeStyle = muted;
      ctx.lineWidth = Math.max(1, r * 0.05);
      ctx.stroke();
      for (let i = 0; i < ESCAPE_TEETH; i++) {
        const a = (i / ESCAPE_TEETH) * TAU;
        const x0 = Math.cos(a) * r;
        const y0 = Math.sin(a) * r;
        const x1 = Math.cos(a) * r * 1.28;
        const y1 = Math.sin(a) * r * 1.28;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.strokeStyle = muted;
        ctx.lineWidth = Math.max(1, r * 0.05);
        ctx.stroke();
      }
      ctx.restore();
    };

    const drawFork = (r: number, forkAngleRad: number) => {
      // A short two-tined lever pivoting near the balance rim's edge,
      // rocking between +-FORK_KICK_DEG. This is the mechanism's one
      // climactic, foreground element.
      ctx.save();
      ctx.translate(0, -r * 1.42);
      ctx.rotate(forkAngleRad);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-r * 0.28, r * 0.5);
      ctx.moveTo(0, 0);
      ctx.lineTo(r * 0.28, r * 0.5);
      ctx.moveTo(0, -r * 0.18);
      ctx.lineTo(0, r * 0.5);
      ctx.strokeStyle = fg;
      ctx.lineWidth = Math.max(1.5, r * 0.09);
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.restore();
    };

    const draw = (t: number) => {
      if (cssW <= 0 || cssH <= 0) return;
      ctx.clearRect(0, 0, cssW, cssH);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, cssW, cssH);

      const cx = cssW / 2;
      const cy = cssH / 2;
      const cageR = Math.min(cssW, cssH) * 0.34;
      const balanceR = cageR * 0.4;

      const cageAngle = ((t / CAGE_PERIOD_S) * TAU) % TAU;

      // idx/frac locate the current escapement half-swing, driving both the
      // fork's snap-and-hold rock and the escape wheel's one-tooth advance
      // from the SAME clock, so they release in lockstep the way the real
      // parts are physically forced to.
      const idx = Math.floor(t / BALANCE_HALF_PERIOD);
      const frac = t / BALANCE_HALF_PERIOD - idx;
      const eased = snap(frac);
      const forkSign = idx % 2 === 0 ? 1 : -1;
      const forkAngleRad = ((FORK_KICK_DEG * Math.PI) / 180) * forkSign * eased;
      const escapeAngleRad = ((idx + eased) * TOOTH_DEG * Math.PI) / 180;

      const balA = balanceAngleRad(t);
      const breath = Math.abs(Math.sin(TAU * BALANCE_HZ * t + BALANCE_PHASE));

      ctx.save();
      ctx.translate(cx, cy);

      // faint cage track — the low-opacity structural ring everything else
      // sits inside
      ctx.beginPath();
      ctx.arc(0, 0, cageR, 0, TAU);
      ctx.strokeStyle = muted;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = Math.max(1, cageR * 0.012);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // ---- everything below lives in the single carriage-rotated frame ---
      ctx.rotate(cageAngle);

      // counterpoise arm (bare, ns-muted) opposite the bridge — the
      // asymmetry between the two arms is what makes the slow carriage turn
      // actually legible frame to frame
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(cageR * Math.cos((200 * Math.PI) / 180), cageR * Math.sin((200 * Math.PI) / 180));
      ctx.strokeStyle = muted;
      ctx.lineWidth = Math.max(1, cageR * 0.02);
      ctx.stroke();

      // bridge arm carrying the escapement — foreground, the carriage's
      // "named" spoke
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(cageR * Math.cos((15 * Math.PI) / 180), cageR * Math.sin((15 * Math.PI) / 180));
      ctx.strokeStyle = fg;
      ctx.lineWidth = Math.max(1.5, cageR * 0.025);
      ctx.stroke();

      drawSpiral(breath);
      drawEscapeWheel(balanceR * 0.32, escapeAngleRad);
      drawFork(balanceR, forkAngleRad);

      // balance rim + three crossbar spokes, rotated by the balance's OWN
      // fast oscillation on top of the carriage rotation already applied —
      // the two rotations compose here without ever driving one from the
      // other
      ctx.save();
      ctx.rotate(balA);
      ctx.beginPath();
      ctx.arc(0, 0, balanceR, 0, TAU);
      ctx.strokeStyle = fg;
      ctx.lineWidth = Math.max(1.5, balanceR * 0.05);
      ctx.stroke();
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * balanceR, Math.sin(a) * balanceR);
        ctx.strokeStyle = fg;
        ctx.lineWidth = Math.max(1, balanceR * 0.035);
        ctx.stroke();
      }
      ctx.restore();

      ctx.restore();
      ctx.restore();
    };

    const loopFrame = (nowMs: number) => {
      if (!running) return;
      const dt = Math.min(0.05, lastMs ? (nowMs - lastMs) / 1000 : 1 / 60);
      lastMs = nowMs;
      simTime += dt;
      draw(simTime);
      raf = requestAnimationFrame(loopFrame);
    };

    const wake = () => {
      if (running || disposed || staticMode) return;
      running = true;
      lastMs = 0;
      raf = requestAnimationFrame(loopFrame);
    };
    const sleep = () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = mq.matches;
    const applyMode = () => {
      if (reduced || pausedRef.current) {
        staticMode = true;
        sleep();
        draw(reduced ? STATIC_TIME : simTime);
      } else {
        staticMode = false;
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

    const ro = new ResizeObserver(() => {
      resize();
      if (staticMode) draw(reduced ? STATIC_TIME : simTime);
    });
    ro.observe(wrap);
    resize();

    const themeObserver = new MutationObserver(() => {
      readTokens();
      if (staticMode) draw(reduced ? STATIC_TIME : simTime);
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    let lastPolledPaused = pausedRef.current;
    const poll = window.setInterval(() => {
      if (pausedRef.current !== lastPolledPaused) {
        lastPolledPaused = pausedRef.current;
        applyMode();
      }
    }, 140);

    applyMode();

    return () => {
      disposed = true;
      sleep();
      ro.disconnect();
      io.disconnect();
      themeObserver.disconnect();
      mq.removeEventListener("change", onMq);
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(poll);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      data-tourbillon-cage={uid}
      className={`relative h-full w-full overflow-hidden bg-background ${className}`}
      style={style}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 block h-full w-full" />
      <div role="status" aria-live="polite" className="sr-only">
        Loading
      </div>
      {children ? <div className="relative z-[1] h-full w-full">{children}</div> : null}
    </div>
  );
}

TourbillonCage.displayName = "TourbillonCage";
