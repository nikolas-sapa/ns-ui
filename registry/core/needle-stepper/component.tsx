"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// NeedleStepper — bounded numeric spinbutton fused to a vertical seismograph
// drum. A weighted inertial needle (spring k=120 s^-2, zeta=0.45, two visible
// oscillations, forced-settle 900 ms) swings across a 64px paper strip to
// each committed value; every commit advances the strip 26px downward over
// 600 ms ease-out (event-driven, loop sleeps between) and etches a pen trace
// of the last 20 adjustments as a pruned polyline, alpha fading 0.9 -> 0.15
// by age index with full clears each frame (no destination-in). Min/max show
// as --error edge bands at 12% alpha; clamping at a bound fires a hard-stop
// quiver (±2px, 2 cycles, 180 ms). Direct-DOM rAF, no React state on the hot
// path; all drum ink getComputedStyle-derived at mount and re-derived on
// documentElement class flips. prefers-reduced-motion: instant needle jumps,
// static trace, no strip animation.
// ---------------------------------------------------------------------------

const PEN_Y = 18; // pen carriage line, px from strip top
const PAD_X = 10; // needle travel inset == bound-band width
const ADVANCE = 26; // strip feed per committed adjustment, px
const SCROLL_MS = 600;
const SPRING_K = 120; // s^-2
const SPRING_ZETA = 0.45;
const SETTLE_MS = 900; // forced-settle deadline
const QUIVER_MS = 180;
const QUIVER_AMP = 2;
const HOLD_DELAY_MS = 400;
const HOLD_INTERVAL_MS = 1000 / 12; // 12 steps/s
const MAX_TRACE = 20;

type Vec3 = readonly [number, number, number];

function parseColor(raw: string): Vec3 | null {
  const s = raw.trim();
  if (s.startsWith("#")) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex.slice(0, 1) + hex.slice(0, 1), 16);
      const g = parseInt(hex.slice(1, 2) + hex.slice(1, 2), 16);
      const b = parseInt(hex.slice(2, 3) + hex.slice(2, 3), 16);
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

const rgba = (c: Vec3, a: number) =>
  `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;

interface TracePoint {
  v: number; // committed value — x recomputed at draw time (resize-safe)
  s: number; // strip-space position, ADVANCE * commit index
}

export function NeedleStepper({
  value,
  defaultValue = 20,
  min = 0,
  max = 100,
  step = 1,
  label = "Value",
  onValueChange,
  disabled = false,
  className = "",
}: {
  /** controlled value; omit for uncontrolled */
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  /** accessible name for the spinbutton */
  label?: string;
  onValueChange?: (value: number) => void;
  disabled?: boolean;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const drumRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<{
    commit: (v: number, clamped: boolean) => void;
    redraw: () => void;
  } | null>(null);

  const decimals = (() => {
    const frac = String(step).split(".")[1];
    return frac ? frac.length : 0;
  })();
  const clampRound = (v: number) =>
    Number(Math.min(max, Math.max(min, v)).toFixed(decimals));

  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(() => clampRound(defaultValue));
  const current = isControlled ? clampRound(value) : internal;
  const [text, setText] = useState(() => String(current));

  const valueRef = useRef(current);
  valueRef.current = current;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const boundsRef = useRef({ min, max });
  boundsRef.current = { min, max };
  const holdRef = useRef<{
    timeout: ReturnType<typeof setTimeout> | null;
    interval: ReturnType<typeof setInterval> | null;
  }>({ timeout: null, interval: null });

  // ---- drum engine --------------------------------------------------------
  useEffect(() => {
    const drum = drumRef.current;
    const canvas = canvasRef.current;
    const root = rootRef.current;
    if (!drum || !canvas || !root) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // token-derived ink: read at mount, re-derived on theme class change
    let fg: Vec3 = [237, 237, 237];
    let bd: Vec3 = [46, 46, 46];
    let err: Vec3 = [234, 0, 29];
    const derive = () => {
      const cs = getComputedStyle(document.documentElement);
      fg = parseColor(cs.getPropertyValue("--foreground")) ?? fg;
      bd = parseColor(cs.getPropertyValue("--border")) ?? bd;
      err = parseColor(cs.getPropertyValue("--error")) ?? err;
    };
    derive();

    // hot-path state: locals only, never React state
    let w = 0;
    let h = 0;
    let dpr = 1;
    let sized = false;
    let raf = 0;
    let last = 0;
    let visible = true;
    let lastV = valueRef.current;
    let x = 0; // needle px (assigned real value on first resize)
    let vx = 0;
    let springOn = false;
    let deadline = 0;
    let qOff = 0;
    let quiverStart = -1;
    let commitIdx = 0;
    const points: TracePoint[] = [{ v: lastV, s: 0 }];
    let scrollCur = 0;
    let scrollFrom = 0;
    let scrollTarget = 0;
    let scrollStart = -1;

    const xFor = (v: number) => {
      const { min: lo, max: hi } = boundsRef.current;
      const span = hi - lo || 1;
      return PAD_X + ((v - lo) / span) * (w - PAD_X * 2);
    };

    const draw = () => {
      if (!sized) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h); // full clear — no accumulating alpha
      // min/max status bands (semantic --error, status use only)
      ctx.fillStyle = rgba(err, 0.12);
      ctx.fillRect(0, 0, PAD_X, h);
      ctx.fillRect(w - PAD_X, 0, PAD_X, h);
      // drum feed lines, fixed in strip space so they roll with the paper
      ctx.strokeStyle = rgba(bd, 0.45);
      ctx.lineWidth = 1;
      ctx.beginPath();
      const first = ((((PEN_Y + scrollCur) % ADVANCE) + ADVANCE) % ADVANCE);
      for (let y = first; y < h; y += ADVANCE) {
        ctx.moveTo(0, Math.round(y) + 0.5);
        ctx.lineTo(w, Math.round(y) + 0.5);
      }
      ctx.stroke();
      // pen carriage hairline
      ctx.strokeStyle = rgba(bd, 0.9);
      ctx.beginPath();
      ctx.moveTo(0, PEN_Y + 0.5);
      ctx.lineTo(w, PEN_Y + 0.5);
      ctx.stroke();
      // pen trace: pruned polyline, newest -> oldest, alpha by age index
      const nx = x + qOff;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 1.5;
      let px = nx;
      let py = PEN_Y;
      const n = points.length;
      for (let i = n - 1; i >= 0; i--) {
        const p = points[i];
        if (!p) continue;
        const age = n - 1 - i;
        const a = Math.max(0.15, 0.9 - (0.75 * age) / (MAX_TRACE - 1));
        const cx = xFor(p.v);
        const cy = PEN_Y + (scrollCur - p.s);
        ctx.strokeStyle = rgba(fg, a);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(cx, cy);
        ctx.stroke();
        ctx.fillStyle = rgba(fg, a);
        ctx.beginPath();
        ctx.arc(cx, cy, 1.4, 0, Math.PI * 2);
        ctx.fill();
        px = cx;
        py = cy;
        if (cy > h + 4) break; // scrolled off the strip — stop early
      }
      // weighted needle: counterweight, stem, tip riding the pen line
      ctx.strokeStyle = rgba(fg, 0.9);
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(nx, 3);
      ctx.lineTo(nx, PEN_Y - 6);
      ctx.stroke();
      ctx.fillStyle = rgba(fg, 0.9);
      ctx.beginPath();
      ctx.arc(nx, 5, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgba(fg, 1);
      ctx.beginPath();
      ctx.moveTo(nx, PEN_Y);
      ctx.lineTo(nx - 3, PEN_Y - 7);
      ctx.lineTo(nx + 3, PEN_Y - 7);
      ctx.closePath();
      ctx.fill();
    };

    const loop = (now: number) => {
      raf = 0;
      const dt = last ? Math.min(0.033, (now - last) / 1000) : 1 / 60;
      last = now;
      let active = false;

      if (springOn) {
        const target = xFor(lastV);
        const c = 2 * SPRING_ZETA * Math.sqrt(SPRING_K);
        vx += (-SPRING_K * (x - target) - c * vx) * dt;
        x += vx * dt;
        // velocity-epsilon sleep, backstopped by the forced-settle deadline
        if (now >= deadline || (Math.abs(x - target) < 0.05 && Math.abs(vx) < 2)) {
          x = target;
          vx = 0;
          springOn = false;
        } else active = true;
      }

      qOff = 0;
      if (quiverStart >= 0) {
        const t = (now - quiverStart) / QUIVER_MS;
        if (t >= 1) quiverStart = -1;
        else {
          qOff = QUIVER_AMP * Math.sin(t * Math.PI * 4) * (1 - t); // 2 cycles
          active = true;
        }
      }

      if (scrollStart >= 0) {
        const t = (now - scrollStart) / SCROLL_MS;
        if (t >= 1) {
          scrollCur = scrollTarget;
          scrollStart = -1;
        } else {
          const e = 1 - Math.pow(1 - t, 3); // ease-out
          scrollCur = scrollFrom + (scrollTarget - scrollFrom) * e;
          active = true;
        }
      }

      draw();
      if (active && visible && !document.hidden)
        raf = requestAnimationFrame(loop);
    };

    const wake = () => {
      if (!raf && visible && !document.hidden) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    const commit = (v: number, clamped: boolean) => {
      const changed = v !== lastV;
      lastV = v;
      if (changed) {
        commitIdx++;
        points.push({ v, s: commitIdx * ADVANCE });
        while (points.length > MAX_TRACE) points.shift(); // pruned list
        scrollFrom = scrollCur;
        scrollTarget = commitIdx * ADVANCE;
        scrollStart = performance.now();
      }
      if (reduced) {
        // instant needle, static trace, no strip animation
        x = xFor(v);
        vx = 0;
        springOn = false;
        scrollCur = scrollTarget;
        scrollStart = -1;
        quiverStart = -1;
        draw();
        return;
      }
      if (changed) {
        springOn = true;
        deadline = performance.now() + SETTLE_MS;
      }
      if (clamped) quiverStart = performance.now();
      wake();
    };

    const resize = () => {
      const rect = drum.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) {
        sized = false; // zero-size guard — never draw into nothing
        return;
      }
      w = rect.width;
      h = rect.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      // canvas is a replaced element: inset does not size it — explicit CSS
      // size plus dpr-scaled backing store, or it renders at dpr scale
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      sized = true;
      x = xFor(lastV); // px space changed — snap, springs resume on next commit
      vx = 0;
      springOn = false;
      draw();
    };
    resize();

    engineRef.current = { commit, redraw: draw };

    const ro = new ResizeObserver(resize);
    ro.observe(drum);
    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) wake();
    });
    io.observe(root);
    // live theme re-derive: watch documentElement class flips
    const mo = new MutationObserver(() => {
      derive();
      draw();
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    const onVis = () => {
      if (!document.hidden) wake();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      points.length = 0;
      engineRef.current = null;
    };
  }, []);

  // controlled/external value changes ride the same drum path (deduped inside)
  useEffect(() => {
    engineRef.current?.commit(current, false);
  }, [current]);

  useEffect(() => {
    setText(String(current));
  }, [current]);

  // ---- value plumbing -----------------------------------------------------
  const commitValue = (next: number) => {
    const clamped = next < min || next > max;
    const v = clampRound(next);
    if (v !== valueRef.current) {
      if (!isControlled) setInternal(v);
      onValueChange?.(v);
    }
    setText(String(v));
    engineRef.current?.commit(v, clamped);
  };

  const stepBy = (mult: number) => {
    if (disabledRef.current) return;
    commitValue(valueRef.current + step * mult);
  };

  const commitFromText = () => {
    const parsed = Number(text.replace(",", "."));
    if (!Number.isFinite(parsed)) {
      setText(String(valueRef.current)); // revert garbage
      return;
    }
    commitValue(parsed);
  };

  const endHold = () => {
    const hold = holdRef.current;
    if (hold.timeout !== null) clearTimeout(hold.timeout);
    if (hold.interval !== null) clearInterval(hold.interval);
    hold.timeout = null;
    hold.interval = null;
  };
  const startHold = (dir: number) => (e: React.PointerEvent) => {
    e.preventDefault(); // keep focus where it is; no text selection
    if (disabled) return;
    endHold();
    stepBy(dir); // immediate step
    holdRef.current.timeout = setTimeout(() => {
      holdRef.current.interval = setInterval(
        () => stepBy(dir),
        HOLD_INTERVAL_MS
      ); // needle rides continuously at 12 steps/s
    }, HOLD_DELAY_MS);
  };
  useEffect(() => endHold, []); // tear down hold-repeat timers on unmount

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        stepBy(e.shiftKey ? 10 : 1);
        break;
      case "ArrowDown":
        e.preventDefault();
        stepBy(e.shiftKey ? -10 : -1);
        break;
      case "Home":
        e.preventDefault();
        commitValue(min);
        break;
      case "End":
        e.preventDefault();
        commitValue(max);
        break;
      case "Enter":
        e.preventDefault();
        commitFromText();
        break;
      case "Escape":
        setText(String(valueRef.current));
        break;
    }
  };

  const atMin = current <= min;
  const atMax = current >= max;
  const btnBase =
    "flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-sm border border-border bg-background text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface";
  const btnLive = "cursor-pointer hover:border-foreground/25 hover:bg-foreground/[0.05] active:bg-foreground/[0.09]";
  const btnDead = "cursor-default opacity-40";

  return (
    <div
      ref={rootRef}
      className={`flex overflow-hidden rounded-md border border-border bg-surface ${
        disabled ? "opacity-60" : ""
      } ${className}`}
    >
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 p-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          {label}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            tabIndex={-1}
            aria-label={`Decrease ${label}`}
            aria-disabled={disabled || atMin}
            onPointerDown={startHold(-1)}
            onPointerUp={endHold}
            onPointerLeave={endHold}
            onPointerCancel={endHold}
            className={`${btnBase} ${disabled || atMin ? btnDead : btnLive}`}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path
                d="M2 6h8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </button>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            role="spinbutton"
            aria-label={label}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={current}
            disabled={disabled}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={commitFromText}
            className="h-8 w-16 min-w-0 flex-1 rounded-sm border border-border bg-background px-2 text-center font-mono text-sm text-foreground outline-none transition-colors hover:border-foreground/25 focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent disabled:cursor-not-allowed"
          />
          <button
            type="button"
            tabIndex={-1}
            aria-label={`Increase ${label}`}
            aria-disabled={disabled || atMax}
            onPointerDown={startHold(1)}
            onPointerUp={endHold}
            onPointerLeave={endHold}
            onPointerCancel={endHold}
            className={`${btnBase} ${disabled || atMax ? btnDead : btnLive}`}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path
                d="M6 2v8M2 6h8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </button>
        </div>
        <span className="font-mono text-[10px] text-muted">
          min {min} · max {max} · step {step}
        </span>
      </div>
      <div
        ref={drumRef}
        aria-hidden
        className="relative w-16 shrink-0 self-stretch border-l border-border bg-background"
      >
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute left-0 top-0"
        />
      </div>
    </div>
  );
}
