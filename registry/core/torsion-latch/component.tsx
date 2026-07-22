"use client";

import { useEffect, useId, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// TorsionLatch — a destructive-action switch wound like a torsion spring. The
// knob's translateX couples linearly to a 0-270deg rotation; an Archimedean
// spiral sitting behind it (SVG, stroke-dashoffset reveal + a whole-coil
// scale tighten, color interpolated --border -> --foreground with tension)
// visibly winds as the knob travels. Dragging applies a falling-gain curve
// centered on an over-center point: pixels buy less travel near it, so the
// resistance is felt, not just implied. On release the physics alone decide
// the outcome — no code-level "which side did you mean" branch:
//   - released before the over-center point: an underdamped spring carries
//     the knob home with 2-3 diminishing overshoots (energy releasing).
//   - released past it: a stiff spring whips the knob to the far stop with
//     one small overshoot ("one hard 1px settle").
// Keyboard can't drag, so Space substitutes a compressed 350ms wind-and-snap.
// Because arming a destructive change with a single instant keypress would
// remove the drag's real safety margin, going OFF->ON via Space/click is
// two-phase: first press winds to the over-center point and holds there
// ("armed", announced via aria-live) instead of continuing past it; a
// second press within 3s completes the whip. Left alone, it un-winds itself.
// Going ON->OFF (the safe direction) is single-phase, matching a real drag
// release below the over-center point. prefers-reduced-motion keeps the same
// two-step safety gate (motion prefs shouldn't remove a confirmation) but
// every transition becomes an instant jump to its end frame, no interpolation.
// ---------------------------------------------------------------------------

const TRACK_W = 136;
const TRACK_H = 56;
const PAD = 6;
const KNOB = 44;
const TRAVEL = TRACK_W - KNOB - PAD * 2; // 80
const OVER_CENTER = 0.58; // fraction of travel where the spring flips sign
const ROTATE_DEG = 270;
const PATH_LEN = 1000; // normalized via the path's pathLength attr
const ARM_MS = 350; // Space/click compressed wind duration
const SNAP_K = 200; // whip-to-on spring: stiff, ~one small overshoot
const SNAP_ZETA = 0.9;
const BACK_K = 70; // spring-home: underdamped, 2-3 diminishing overshoots
const BACK_ZETA = 0.22;
const ARM_WINDOW_MS = 3000;
const DRAG_MOVE_EPS = 3; // px of cumulative movement before a press counts as a drag

type Vec3 = readonly [number, number, number];

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function easeOutCubic(p: number) {
  const q = 1 - p;
  return 1 - q * q * q;
}

// falling-gain curve: resistance peaks at OVER_CENTER, eases away on both sides
function gain(p: number) {
  const d = p - OVER_CENTER;
  const bump = Math.exp(-(d * d) / (2 * 0.16 * 0.16));
  return 1 - 0.82 * bump;
}

function parseColor(raw: string): Vec3 | null {
  const s = raw.trim();
  if (s.startsWith("#")) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0]! + hex[0], 16);
      const g = parseInt(hex[1]! + hex[1], 16);
      const b = parseInt(hex[2]! + hex[2], 16);
      return Number.isNaN(r + g + b) ? null : [r, g, b];
    }
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return Number.isNaN(r + g + b) ? null : [r, g, b];
    }
    return null;
  }
  const m = s.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function mix(a: Vec3, b: Vec3, t: number): Vec3 {
  const c = clamp(t, 0, 1);
  return [
    Math.round(a[0] + (b[0] - a[0]) * c),
    Math.round(a[1] + (b[1] - a[1]) * c),
    Math.round(a[2] + (b[2] - a[2]) * c),
  ];
}

const rgb = (c: Vec3) => `rgb(${c[0]},${c[1]},${c[2]})`;

// One Archimedean spiral, computed once — deterministic, no props involved.
function buildSpiralPath(cx: number, cy: number, turns: number, rMax: number, steps: number) {
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const theta = t * turns * Math.PI * 2;
    const r = t * rMax;
    const x = cx + r * Math.cos(theta - Math.PI / 2);
    const y = cy + r * Math.sin(theta - Math.PI / 2);
    d += `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }
  return d;
}
const SPIRAL_D = buildSpiralPath(TRACK_W / 2, TRACK_H / 2, 3.4, TRACK_H / 2 - 6, 220);

export interface TorsionLatchProps {
  /** controlled state; omit for uncontrolled */
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  /** announced via aria-live once armed, waiting on the second press */
  armedLabel?: string;
  /** announced via aria-live once committed on */
  activeLabel?: string;
  /** announced via aria-live once committed off, or when an arm times out */
  offLabel?: string;
}

export function TorsionLatch({
  checked,
  defaultChecked = false,
  onCheckedChange,
  disabled = false,
  className = "",
  "aria-label": ariaLabel = "Kill switch",
  armedLabel = "Armed. Press again within 3 seconds to confirm.",
  activeLabel = "Active.",
  offLabel = "Off.",
}: TorsionLatchProps) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const knobRef = useRef<HTMLSpanElement>(null);
  const spiralGroupRef = useRef<SVGGElement>(null);
  const spiralPathRef = useRef<SVGPathElement>(null);
  const liveId = useId();

  const isControlled = checked !== undefined;
  const [internal, setInternal] = useState(defaultChecked);
  const isChecked = isControlled ? checked : internal;
  const [armed, setArmed] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const isControlledRef = useRef(isControlled);
  isControlledRef.current = isControlled;
  const armedLabelRef = useRef(armedLabel);
  armedLabelRef.current = armedLabel;
  const activeLabelRef = useRef(activeLabel);
  activeLabelRef.current = activeLabel;
  const offLabelRef = useRef(offLabel);
  offLabelRef.current = offLabel;
  const onCheckedChangeRef = useRef(onCheckedChange);
  onCheckedChangeRef.current = onCheckedChange;

  const engineRef = useRef<{ transition: (on: boolean) => void } | null>(null);

  useEffect(() => {
    const btn = btnRef.current;
    const knob = knobRef.current;
    const group = spiralGroupRef.current;
    const path = spiralPathRef.current;
    if (!btn || !knob || !group || !path) return;

    let borderRGB: Vec3 = [235, 235, 235];
    let fgRGB: Vec3 = [23, 23, 23];
    const derive = () => {
      const cs = getComputedStyle(document.documentElement);
      borderRGB = parseColor(cs.getPropertyValue("--border")) ?? borderRGB;
      fgRGB = parseColor(cs.getPropertyValue("--foreground")) ?? fgRGB;
    };
    derive();

    let reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // -- hot-path state: locals/refs only, never React state on the loop ----
    let progress = isChecked ? 1 : 0; // 0..1, committed source of truth for the visual
    let current = isChecked; // last value React was told is committed
    let dragging = false;
    let moved = false;
    let startX = 0;
    let lastX = 0;
    let lastT = 0;
    let vel = 0;
    let raf = 0;
    let runToken = 0;
    let armTimer = 0;
    let armedNow = false; // logic-authoritative; `armed` React state mirrors it for render

    const setArmedState = (v: boolean) => {
      armedNow = v;
      setArmed(v);
    };

    const applyVisual = (p: number) => {
      knob.style.transform = `translateX(${(p * TRAVEL).toFixed(2)}px) rotate(${(p * ROTATE_DEG).toFixed(2)}deg)`;
      path.style.strokeDashoffset = String(PATH_LEN * (1 - p));
      path.style.stroke = rgb(mix(borderRGB, fgRGB, Math.min(1, p ** 1.3)));
      group.style.transform = `scale(${(1 - p * 0.06).toFixed(4)})`;
    };
    applyVisual(progress);

    const clearArmTimer = () => {
      if (armTimer) {
        window.clearTimeout(armTimer);
        armTimer = 0;
      }
    };

    const cancelRunner = () => {
      runToken++;
      raf && cancelAnimationFrame(raf);
      raf = 0;
    };

    // generic damped-spring runner toward `target`, from current progress/vel
    const runSpring = (
      target: number,
      k: number,
      zeta: number,
      initialVel: number,
      onSettle: () => void
    ) => {
      cancelRunner();
      const token = ++runToken;
      if (reduced) {
        progress = target;
        vel = 0;
        applyVisual(progress);
        onSettle();
        return;
      }
      let last = performance.now();
      let v = initialVel;
      const c = 2 * zeta * Math.sqrt(k);
      const tick = (now: number) => {
        if (token !== runToken) return;
        const dt = Math.min(0.032, (now - last) / 1000);
        last = now;
        v += (-k * (progress - target) - c * v) * dt;
        progress += v * dt;
        applyVisual(progress);
        if (Math.abs(progress - target) < 0.0015 && Math.abs(v) < 0.03) {
          progress = target;
          vel = 0;
          applyVisual(progress);
          raf = 0;
          onSettle();
          return;
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    // generic eased time-tween, for the deliberate keyboard/click wind steps
    const runTween = (from: number, to: number, ms: number, onDone: () => void) => {
      cancelRunner();
      const token = ++runToken;
      if (reduced) {
        progress = to;
        applyVisual(progress);
        onDone();
        return;
      }
      const start = performance.now();
      const tick = (now: number) => {
        if (token !== runToken) return;
        const t = clamp((now - start) / ms, 0, 1);
        progress = from + (to - from) * easeOutCubic(t);
        applyVisual(progress);
        if (t >= 1) {
          raf = 0;
          onDone();
          return;
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    const commit = (on: boolean) => {
      // logical state only — the caller is always mid-animation (runSpring/
      // runTween) toward this same value, and must own `progress` itself
      current = on;
      if (!isControlledRef.current) setInternal(on);
      onCheckedChangeRef.current?.(on);
      setAnnouncement(on ? activeLabelRef.current : offLabelRef.current);
    };

    const startArmWait = () => {
      setArmedState(true);
      setAnnouncement(armedLabelRef.current);
      clearArmTimer();
      armTimer = window.setTimeout(() => {
        armTimer = 0;
        setArmedState(false);
        setAnnouncement(offLabelRef.current);
        runSpring(0, BACK_K, BACK_ZETA, 0, () => {});
      }, ARM_WINDOW_MS);
    };

    const activate = () => {
      if (disabledRef.current || dragging) return;
      clearArmTimer();
      if (current) {
        // ON -> OFF: safe direction, single compressed unwind, no confirm
        setArmedState(false);
        runTween(progress, 0, ARM_MS, () => commit(false));
        return;
      }
      if (armedNow) {
        // second press: complete the whip into ON
        setArmedState(false);
        commit(true);
        runSpring(1, SNAP_K, SNAP_ZETA, 0.5, () => {});
        return;
      }
      // first press: wind to the over-center point and hold, armed
      runTween(progress, OVER_CENTER, ARM_MS, startArmWait);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (disabledRef.current) return;
      try {
        btn.setPointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      cancelRunner();
      // Hold the arm-window timer while the pointer is down, but do NOT disarm
      // here: this pointerdown may be the second press of the press-press
      // confirm, and the click handler after pointerup needs armedNow intact to
      // commit. Disarming belongs to the moment a real drag begins (see
      // onPointerMove) — a drag takes over the decision from the arm state.
      clearArmTimer();
      dragging = true;
      moved = false;
      startX = e.clientX;
      lastX = e.clientX;
      lastT = performance.now();
      vel = 0;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const now = performance.now();
      const dt = Math.max(1, now - lastT) / 1000;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      lastT = now;
      if (!moved && Math.abs(e.clientX - startX) > DRAG_MOVE_EPS) {
        moved = true;
        // a real drag has begun — the gesture, not the armed hold, now owns
        // the outcome, so the pending confirm is cancelled
        if (armedNow) setArmedState(false);
      }
      if (!moved) return;
      const dp = (dx * gain(progress)) / TRAVEL;
      const next = clamp(progress + dp, 0, 1);
      vel = (next - progress) / dt;
      progress = next;
      applyVisual(progress);
    };

    const finishDrag = (commitDecision: boolean) => {
      dragging = false;
      if (!moved) return; // treated as a click/tap — let the click handler run
      const toOn = commitDecision;
      commit(toOn);
      if (toOn) runSpring(1, SNAP_K, SNAP_ZETA, vel, () => {});
      else runSpring(0, BACK_K, BACK_ZETA, vel, () => {});
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!dragging) return;
      try {
        btn.releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      finishDrag(progress >= OVER_CENTER);
    };

    const onPointerCancel = () => {
      if (!dragging) return;
      dragging = false;
      moved = false;
      // aborted mid-gesture: spring back to whatever was last committed, no change
      runSpring(current ? 1 : 0, BACK_K, BACK_ZETA, vel, () => {});
    };

    const onClick = () => {
      if (moved) {
        moved = false;
        return; // tail end of a real drag; already handled on pointerup
      }
      activate();
    };

    const onMq = (e: MediaQueryListEvent) => {
      reduced = e.matches;
    };
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    mq.addEventListener("change", onMq);

    const mo = new MutationObserver(() => {
      derive();
      applyVisual(progress);
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    btn.addEventListener("pointerdown", onPointerDown);
    btn.addEventListener("pointermove", onPointerMove);
    btn.addEventListener("pointerup", onPointerUp);
    btn.addEventListener("pointercancel", onPointerCancel);
    btn.addEventListener("click", onClick);

    engineRef.current = {
      transition: (on: boolean) => {
        if (on === current) return;
        current = on;
        setArmedState(false);
        clearArmTimer();
        runTween(progress, on ? 1 : 0, ARM_MS, () => {});
      },
    };

    return () => {
      cancelRunner();
      clearArmTimer();
      mq.removeEventListener("change", onMq);
      mo.disconnect();
      btn.removeEventListener("pointerdown", onPointerDown);
      btn.removeEventListener("pointermove", onPointerMove);
      btn.removeEventListener("pointerup", onPointerUp);
      btn.removeEventListener("pointercancel", onPointerCancel);
      btn.removeEventListener("click", onClick);
      engineRef.current = null;
    };
    // mount-once: the imperative engine owns all subsequent updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engineRef.current?.transition(isChecked);
  }, [isChecked]);

  const state = disabled ? "off" : armed ? "armed" : isChecked ? "on" : "off";

  return (
    <span className={`relative inline-flex ${className}`}>
      <button
        ref={btnRef}
        type="button"
        role="switch"
        aria-checked={isChecked}
        aria-label={ariaLabel}
        aria-describedby={liveId}
        disabled={disabled}
        data-torsion-state={state}
        className={`relative touch-none select-none rounded-full border border-border bg-surface outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
          disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer hover:border-foreground/25"
        }`}
        style={{ width: TRACK_W, height: TRACK_H }}
      >
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0"
          width={TRACK_W}
          height={TRACK_H}
          viewBox={`0 0 ${TRACK_W} ${TRACK_H}`}
        >
          <g ref={spiralGroupRef} style={{ transformOrigin: `${TRACK_W / 2}px ${TRACK_H / 2}px` }}>
            <path
              ref={spiralPathRef}
              d={SPIRAL_D}
              fill="none"
              strokeWidth={1.4}
              strokeLinecap="round"
              pathLength={PATH_LEN}
              style={{ strokeDasharray: PATH_LEN, strokeDashoffset: PATH_LEN }}
            />
          </g>
        </svg>
        <span
          ref={knobRef}
          aria-hidden
          data-torsion-knob
          className="absolute rounded-full bg-foreground shadow-[0_1px_3px_rgba(0,0,0,0.3)] will-change-transform"
          style={{ left: PAD, top: PAD, width: KNOB, height: KNOB }}
        >
          <span
            aria-hidden
            className="absolute rounded-full bg-background/70"
            style={{ left: "50%", top: 4, width: 3, height: 9, marginLeft: -1.5 }}
          />
        </span>
      </button>
      <span id={liveId} role="status" aria-live="assertive" className="sr-only">
        {announcement}
      </span>
    </span>
  );
}
