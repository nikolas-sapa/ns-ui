"use client";

import { useEffect, useRef } from "react";

// MoireDial — a weighted rotary knob whose feedback channel is optical
// interference. Two fine-line gratings counter-rotate as you drag; grating A
// is fixed but carries a hidden message as a locally phase-inverted region
// (glyphs rasterized offscreen to an alpha mask, half-pitch phase offset
// inside), so the word only gains contrast when the overlay grating aligns
// and the dial clicks into its detent. Canvas 2D, DPR clamp 2, direct-DOM
// rAF is the sole writer, loop sleeps when settled. Zero deps.

const DEG = Math.PI / 180;
const DETENT_BAND = 4 * DEG; // rad — snap capture zone
const DETENT_K = 200; // s^-2
const DETENT_C = 2 * 0.9 * Math.sqrt(DETENT_K); // zeta = 0.9 → one tiny overshoot
const NEEDLE_K = 120; // s^-2
const NEEDLE_C = 2 * 0.75 * Math.sqrt(NEEDLE_K); // zeta = 0.75 → weighted lag
const SLEEP_OMEGA = 0.02; // rad/s
const SLEEP_NEEDLE = 0.05 * DEG; // rad
const SNAP_EPS = 0.0002; // rad — close enough to hard-snap the detent
const TICKS = Array.from({ length: 24 }, (_, i) => i * 15);

function wrapPi(a: number) {
  a = (a + Math.PI) % (2 * Math.PI);
  if (a < 0) a += 2 * Math.PI;
  return a - Math.PI;
}

export function MoireDial({
  message = "SIGNAL",
  pitch = 6,
  gear = 0.15,
  initialAngle = -132,
  friction = 3.5,
  fieldHeight = 224,
  className = "",
  "aria-label": ariaLabel = "Moire tuning dial",
}: {
  /** hidden word that resolves out of the interference at alignment */
  message?: string;
  /** grating pitch in px — one 1px line every `pitch` px */
  pitch?: number;
  /** grating radians per dial radian — radio-vernier ratio */
  gear?: number;
  /** starting dial angle in degrees (reduced motion forces 0 = aligned) */
  initialAngle?: number;
  /** angular velocity decay in s^-1 while coasting after a flick */
  friction?: number;
  /** interference field height in px */
  fieldHeight?: number;
  className?: string;
  "aria-label"?: string;
}) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const needleRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const field = fieldRef.current;
    const canvas = canvasRef.current;
    const knob = knobRef.current;
    const ring = ringRef.current;
    const needle = needleRef.current;
    const readout = readoutRef.current;
    const input = inputRef.current;
    if (!field || !canvas || !knob || !ring || !needle || !readout || !input)
      return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // hot-path state — locals only, never React state
    let angle = reduced ? 0 : initialAngle * DEG; // ring angle, continuous rad
    let omega = 0; // rad/s
    let needleAngle = angle;
    let needleOmega = 0;
    let dragging = false;
    let raf = 0;
    let last = 0;
    let lastPA = 0; // pointer angle at last move
    let lastT = 0;
    let detentGraceUntil = 0; // keyboard steps suppress the detent briefly
    let disposed = false;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let diag = 0;
    let offA: HTMLCanvasElement | null = null; // fixed grating + inverted word
    let offB: HTMLCanvasElement | null = null; // rotating overlay grating

    // grating ink derives from the --foreground token so the field is
    // legible in both themes — re-read whenever the theme class flips.
    let gratingFill = "rgba(237,237,237,0.5)";
    const deriveGratingFill = () => {
      const fg = getComputedStyle(document.documentElement)
        .getPropertyValue("--foreground")
        .trim();
      if (!fg) return;
      const probe = document.createElement("canvas").getContext("2d");
      if (!probe) return;
      probe.fillStyle = fg;
      const [r, g, b] = probe.fillStyle.match(/\d+/g)?.map(Number) ?? [];
      if (r === undefined) return;
      gratingFill = `rgba(${r},${g},${b},0.5)`;
    };
    deriveGratingFill();

    const build = () => {
      const rect = field.getBoundingClientRect();
      w = Math.round(rect.width);
      h = Math.round(rect.height);
      if (w < 2 || h < 2) return;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = w * dpr;
      canvas.height = h * dpr;

      // message glyphs → offscreen alpha mask (singularity-text pattern)
      const mask = document.createElement("canvas");
      mask.width = w * dpr;
      mask.height = h * dpr;
      const mctx = mask.getContext("2d");
      if (!mctx) return;
      mctx.scale(dpr, dpr);
      const size = Math.min(h * 0.58, (w * 1.5) / Math.max(1, message.length));
      mctx.font = `600 ${size}px GeistSans, "GeistSans Fallback", ui-sans-serif, system-ui, sans-serif`;
      mctx.textAlign = "center";
      mctx.textBaseline = "middle";
      mctx.fillStyle = "#ffffff";
      mctx.fillText(message, w / 2, h / 2);

      // grating A: fixed 1px lines at `pitch`, phase-inverted by half a pitch
      // inside the glyph mask — invisible until the overlay aligns
      offA = document.createElement("canvas");
      offA.width = w * dpr;
      offA.height = h * dpr;
      const actx = offA.getContext("2d");
      if (!actx) return;
      actx.scale(dpr, dpr);
      actx.fillStyle = gratingFill;
      for (let y = 0; y <= h; y += pitch) actx.fillRect(0, y, w, 1);
      actx.globalCompositeOperation = "destination-out";
      actx.drawImage(mask, 0, 0, w, h);
      const inv = document.createElement("canvas");
      inv.width = w * dpr;
      inv.height = h * dpr;
      const ictx = inv.getContext("2d");
      if (!ictx) return;
      ictx.scale(dpr, dpr);
      ictx.fillStyle = gratingFill;
      for (let y = pitch / 2; y <= h; y += pitch) ictx.fillRect(0, y, w, 1);
      ictx.globalCompositeOperation = "destination-in";
      ictx.drawImage(mask, 0, 0, w, h);
      actx.globalCompositeOperation = "source-over";
      actx.drawImage(inv, 0, 0, w, h);

      // grating B: oversized square so rotation never exposes an edge; phase
      // chosen so its lines coincide with A's background lines at zero rotation
      diag = Math.ceil(Math.hypot(w, h)) + pitch * 2;
      offB = document.createElement("canvas");
      offB.width = diag * dpr;
      offB.height = diag * dpr;
      const bctx = offB.getContext("2d");
      if (!bctx) return;
      bctx.scale(dpr, dpr);
      bctx.fillStyle = gratingFill;
      const phase = ((diag / 2 - h / 2) % pitch + pitch) % pitch;
      for (let y = phase; y <= diag; y += pitch) bctx.fillRect(0, y, diag, 1);
    };

    const render = () => {
      const wr = wrapPi(angle);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (offA) ctx.drawImage(offA, 0, 0, w, h);
      if (offB) {
        ctx.save();
        ctx.translate(w / 2, h / 2);
        // |wr| keeps the fringe field continuous across the ±180° wrap
        // (a line grating is 2-fold symmetric, so sign carries no extra info)
        ctx.rotate(gear * Math.abs(wr));
        ctx.drawImage(offB, -diag / 2, -diag / 2, diag, diag);
        ctx.restore();
      }
      ring.style.transform = `rotate(${angle / DEG}deg)`;
      needle.style.transform = `rotate(${needleAngle / DEG}deg)`;
      const pct =
        Math.abs(wr) < SNAP_EPS
          ? 100
          : Math.min(99, Math.floor(100 * (1 - Math.abs(wr) / Math.PI)));
      readout.textContent = `ALIGNMENT ${String(pct).padStart(3, "0")}%`;
      const deg = Math.max(
        -180,
        Math.min(180, Math.round(wr / DEG / 2) * 2)
      );
      if (input.valueAsNumber !== deg) input.value = String(deg);
      input.setAttribute("aria-valuetext", `${pct}% aligned`);
    };

    const loop = (now: number) => {
      const dt = last === 0 ? 1 / 60 : Math.min(0.05, (now - last) / 1000);
      last = now;

      if (!dragging) {
        const wr = wrapPi(angle);
        if (Math.abs(wr) < DETENT_BAND && now > detentGraceUntil) {
          // detent snap spring: k = 200 s^-2, zeta = 0.9 — one tiny overshoot
          omega += (-DETENT_K * wr - DETENT_C * omega) * dt;
          angle += omega * dt;
          const nwr = wrapPi(angle);
          if (Math.abs(nwr) < SNAP_EPS && Math.abs(omega) < SLEEP_OMEGA) {
            angle -= nwr; // exact zero
            omega = 0;
          }
        } else {
          // coast: friction decay 3.5 s^-1 — flick spins, coasts, settles
          omega *= Math.exp(-friction * dt);
          angle += omega * dt;
          if (Math.abs(omega) < SLEEP_OMEGA) omega = 0;
        }
      }

      // needle lags the ring through a second-order spring (weighted feel)
      needleOmega += (NEEDLE_K * (angle - needleAngle) - NEEDLE_C * needleOmega) * dt;
      needleAngle += needleOmega * dt;

      render();

      const wrNow = wrapPi(angle);
      const settled =
        !dragging &&
        Math.abs(omega) < SLEEP_OMEGA &&
        Math.abs(angle - needleAngle) < SLEEP_NEEDLE &&
        Math.abs(needleOmega) < 0.02 &&
        (Math.abs(wrNow) >= DETENT_BAND || Math.abs(wrNow) < SNAP_EPS);
      if (settled) {
        needleAngle = angle;
        needleOmega = 0;
        omega = 0;
        render();
        raf = 0;
        last = 0;
      } else {
        raf = requestAnimationFrame(loop);
      }
    };
    const wake = () => {
      if (!raf && !reduced) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    const pointerAngle = (e: PointerEvent) => {
      const r = knob.getBoundingClientRect();
      return Math.atan2(
        e.clientY - (r.top + r.height / 2),
        e.clientX - (r.left + r.width / 2)
      );
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      try {
        knob.setPointerCapture(e.pointerId);
      } catch {
        // synthetic events may carry an inactive pointerId — drag still works
      }
      dragging = true;
      omega = 0;
      lastPA = pointerAngle(e);
      lastT = performance.now();
      wake();
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const pa = pointerAngle(e);
      const d = wrapPi(pa - lastPA);
      const t = performance.now();
      const mdt = Math.max(1e-3, (t - lastT) / 1000);
      angle += d;
      // smoothed, clamped flick velocity
      omega = Math.max(-24, Math.min(24, 0.7 * omega + 0.3 * (d / mdt)));
      lastPA = pa;
      lastT = t;
      if (reduced) {
        needleAngle = angle;
        render();
      } else {
        wake();
      }
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      if (reduced) {
        // step instantly: snap into the detent if inside the band
        omega = 0;
        const wr = wrapPi(angle);
        if (Math.abs(wr) < DETENT_BAND) angle -= wr;
        needleAngle = angle;
        render();
      } else {
        wake(); // omega carries → flick coasts under friction
      }
    };

    const onInput = () => {
      const deg = input.valueAsNumber;
      if (Number.isNaN(deg)) return;
      // shortest path from the current wrapped position to the slider value
      angle += wrapPi(deg * DEG - wrapPi(angle));
      omega = 0;
      // let arrow keys step through the detent band instead of being recaptured
      detentGraceUntil = performance.now() + 400;
      if (reduced) {
        needleAngle = angle;
        render();
      } else {
        wake();
      }
    };

    build();
    render();
    // re-rasterize once Geist is loaded — a fallback-font mask is wrong
    document.fonts.ready.then(() => {
      if (disposed) return;
      build();
      render();
    });

    const ro = new ResizeObserver(() => {
      build();
      render();
    });
    ro.observe(field);

    // theme toggle flips the `dark` class on <html> — re-derive the grating
    // ink from --foreground and re-rasterize, or light mode ships blank
    const mo = new MutationObserver(() => {
      deriveGratingFill();
      build();
      render();
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    knob.addEventListener("pointerdown", onDown);
    knob.addEventListener("pointermove", onMove);
    knob.addEventListener("pointerup", onUp);
    knob.addEventListener("pointercancel", onUp);
    input.addEventListener("input", onInput);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      ro.disconnect();
      mo.disconnect();
      knob.removeEventListener("pointerdown", onDown);
      knob.removeEventListener("pointermove", onMove);
      knob.removeEventListener("pointerup", onUp);
      knob.removeEventListener("pointercancel", onUp);
      input.removeEventListener("input", onInput);
    };
  }, [message, pitch, gear, initialAngle, friction]);

  return (
    <div className={`flex w-full flex-col items-center gap-6 ${className}`}>
      <div
        ref={fieldRef}
        role="img"
        aria-label={`Interference field concealing the word ${message}`}
        className="relative w-full overflow-hidden rounded-md border border-border"
        style={{ height: fieldHeight }}
      >
        <canvas
          ref={canvasRef}
          aria-hidden
          className="absolute inset-0 h-full w-full"
        />
      </div>

      <div className="relative">
        {/* fixed target index the ring's zero tick lines up with */}
        <span
          aria-hidden
          className="absolute -top-3 left-1/2 h-2 w-px -translate-x-1/2 bg-muted"
        />
        <div
          ref={knobRef}
          className="relative h-40 w-40 cursor-grab touch-none select-none rounded-full border border-border bg-surface active:cursor-grabbing focus-within:outline focus-within:outline-2 focus-within:outline-offset-4 focus-within:outline-accent"
        >
          <input
            ref={inputRef}
            type="range"
            min={-180}
            max={180}
            step={2}
            defaultValue={Math.max(
              -180,
              Math.min(180, Math.round(wrapPi(initialAngle * DEG) / DEG / 2) * 2)
            )}
            aria-label={ariaLabel}
            className="sr-only"
          />
          {/* tick ring rotates rigidly with the dial angle */}
          <div ref={ringRef} aria-hidden className="absolute inset-0 will-change-transform">
            {TICKS.map((deg) => (
              <span
                key={deg}
                className={`absolute left-1/2 top-1/2 w-px ${
                  deg === 0 ? "h-3 bg-foreground" : "h-1.5 bg-border"
                }`}
                style={{
                  transform: `translate(-50%, -50%) rotate(${deg}deg) translateY(-66px)`,
                }}
              />
            ))}
          </div>
          {/* needle lags behind through the second-order spring */}
          <div
            ref={needleRef}
            aria-hidden
            className="absolute inset-0 will-change-transform"
          >
            <span className="absolute left-1/2 top-3.5 h-11 w-0.5 -translate-x-1/2 rounded-full bg-foreground" />
          </div>
          <span
            aria-hidden
            className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-background"
          />
        </div>
      </div>

      <div
        ref={readoutRef}
        aria-hidden
        className="font-mono text-xs tracking-[0.2em] text-muted tabular-nums"
      >
        ALIGNMENT 000%
      </div>
    </div>
  );
}
