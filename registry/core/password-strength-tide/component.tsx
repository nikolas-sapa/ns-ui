"use client";

import { useEffect, useId, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// TideGaugePassword — password field with a canvas water tank behind the
// masked text. Live entropy score drives the water level through a damped
// spring (k=90 s^-2, zeta=0.55, ~8% overshoot), each keystroke sloshes a real
// 1D heightfield wave at the caret's approximate x, deletions bump the surface
// and let the tide recede. Fill hue runs muted -> accent with strength. Full
// clear + redraw each frame (no accumulating alpha), canvas sized with
// explicit style.width/height (replaced-element dpr trap), rAF sleeps at a
// velocity epsilon with a 1.2 s forced-settle deadline, pauses offscreen. All
// ink derives from CSS tokens at mount and re-derives live on documentElement
// class changes. Input semantics are fully standard: real <input>, visible
// label, polite live region for strength, reveal toggle with aria-pressed.
// ---------------------------------------------------------------------------

const DX = 4; // heightfield column pitch px
const WAVE_C = 140; // wave speed px/s
const DAMP = 0.985; // per-frame velocity damping
const KEY_IMPULSE = -6; // px surface dip per keystroke
const DEL_IMPULSE = 4; // px surface bump per deletion
const TOGGLE_IMPULSE = 4; // px ripple at the eye icon
const SPRING_K = 90; // s^-2
const SPRING_ZETA = 0.55; // ~8% overshoot then settle
const MAX_FILL = 0.94; // strength 100 fills to 94% so the surface line shows
const SETTLE_MS = 1200; // forced-settle deadline after last excitement
const HARD_SNAP_MS = 2000; // absolute cutoff — snap flat, sleep
const V_EPS = 0.02; // px/frame sleep epsilon
const LEVEL_EPS = 0.3; // px distance-to-target sleep epsilon
const FILL_ALPHA = 0.2;
const LINE_ALPHA = 0.6;
const RIM_ALPHA = 0.3; // faint empty-tank baseline shown at zero entropy
// splash spread across five neighboring columns
const KERNEL = [0.25, 0.6, 1, 0.6, 0.25] as const;

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

function mix(a: Vec3, b: Vec3, t: number): Vec3 {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

// length + charset-class entropy, mapped 0-100 (72 bits caps the gauge)
function scorePassword(v: string): number {
  if (!v) return 0;
  let pool = 0;
  if (/[a-z]/.test(v)) pool += 26;
  if (/[A-Z]/.test(v)) pool += 26;
  if (/[0-9]/.test(v)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(v)) pool += 33;
  const bits = v.length * Math.log2(pool || 1);
  return Math.max(0, Math.min(100, (bits / 72) * 100));
}

type Band = "Weak" | "Fair" | "Strong" | null;

function bandOf(score: number): Band {
  if (score <= 0) return null;
  if (score < 34) return "Weak";
  if (score < 67) return "Fair";
  return "Strong";
}

export function TideGaugePassword({
  label = "Password",
  name = "password",
  placeholder = "",
  defaultValue = "",
  value,
  onValueChange,
  autoComplete = "new-password",
  required = false,
  disabled = false,
  className = "",
}: {
  /** visible label text above the field */
  label?: string;
  /** name for the underlying `<input>`, for native form submission */
  name?: string;
  /** placeholder text for the field */
  placeholder?: string;
  /** uncontrolled initial value */
  defaultValue?: string;
  /** controlled value; omit for uncontrolled */
  value?: string;
  /** called on every keystroke with the raw input value */
  onValueChange?: (value: string) => void;
  /** passed straight through to the underlying `<input autoComplete>` */
  autoComplete?: string;
  /** marks the underlying `<input>` as `required` for native form validation */
  required?: boolean;
  /** blocks the underlying `<input>` */
  disabled?: boolean;
  /** extra classes merged onto the rendered root element */
  className?: string;
}) {
  const uid = useId();
  const inputId = `tide-pw-${uid}`;
  const liveId = `tide-pw-live-${uid}`;
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const engineRef = useRef<{
    input: (v: string, instant?: boolean) => void;
    ripple: (x: number) => void;
  } | null>(null);

  const isControlled = value !== undefined;
  const initial = isControlled ? value : defaultValue;
  const [revealed, setRevealed] = useState(false);
  const [band, setBand] = useState<Band>(() => bandOf(scorePassword(initial)));

  useEffect(() => {
    const frame = frameRef.current;
    const canvas = canvasRef.current;
    const input = inputRef.current;
    if (!frame || !canvas || !input) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const motionMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = motionMq.matches;

    // -- token-derived ink: read at mount, re-derived on theme class change --
    let mutedC: Vec3 = [143, 143, 143];
    let accentC: Vec3 = [0, 107, 255];
    const derive = () => {
      const cs = getComputedStyle(document.documentElement);
      mutedC = parseColor(cs.getPropertyValue("--ns-muted")) ?? mutedC;
      accentC = parseColor(cs.getPropertyValue("--ns-accent")) ?? accentC;
    };
    derive();

    // -- hot-path state: locals only, never React state ---------------------
    let w = 0;
    let h = 0;
    let dpr = 1;
    let sized = false;
    let raf = 0;
    let last = 0;
    let visible = true;
    let cols = 0;
    let hf = new Float32Array(0); // surface offset px, + is up
    let vf = new Float32Array(0); // px/s
    let level = 0; // water height px
    let levelV = 0; // px/s
    let target = 0; // px
    let exciteAt = 0; // performance.now() of last impulse/target change
    let prevLen = 0;
    let maskW = 8; // measured mask-glyph advance px
    let padLeft = 12;

    const measure = () => {
      const csIn = getComputedStyle(input);
      padLeft = parseFloat(csIn.paddingLeft) || 12;
      ctx.font = `${csIn.fontWeight} ${csIn.fontSize} ${csIn.fontFamily}`;
      const m = ctx.measureText("•").width;
      if (m > 0) maskW = m;
    };

    const drawFrame = () => {
      if (!sized) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h); // full clear + redraw — nothing accumulates
      if (level < 0.5) {
        // zero-entropy idle: no fill, but a faint rim a couple px above the
        // frame's own border (the outermost row is clipped by the frame's
        // overflow-hidden) so the tank floor reads as a gauge even at rest.
        ctx.beginPath();
        ctx.moveTo(0, h - 3);
        ctx.lineTo(w, h - 3);
        ctx.strokeStyle = `rgba(${mutedC[0]},${mutedC[1]},${mutedC[2]},${RIM_ALPHA})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        return;
      }
      const yBase = h - level;
      const t = Math.max(0, Math.min(1, level / (h * MAX_FILL)));
      const c = mix(mutedC, accentC, t);
      // fill body
      ctx.beginPath();
      ctx.moveTo(0, yBase - (hf[0] ?? 0));
      for (let i = 1; i < cols; i++) ctx.lineTo(i * DX, yBase - (hf[i] ?? 0));
      ctx.lineTo(w, yBase - (hf[cols - 1] ?? 0));
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${FILL_ALPHA})`;
      ctx.fill();
      // surface line
      ctx.beginPath();
      ctx.moveTo(0, yBase - (hf[0] ?? 0));
      for (let i = 1; i < cols; i++) ctx.lineTo(i * DX, yBase - (hf[i] ?? 0));
      ctx.lineTo(w, yBase - (hf[cols - 1] ?? 0));
      ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${LINE_ALPHA})`;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";
      ctx.stroke();
    };

    const snapFlat = () => {
      hf.fill(0);
      vf.fill(0);
      level = target;
      levelV = 0;
      drawFrame();
    };

    const loop = (now: number) => {
      raf = 0;
      if (!sized || !visible || document.hidden) return; // wake() resumes
      // dt clamp respects the wave CFL bound: c*dt/dx = 140*0.025/4 < 1,
      // so dropped frames slow the sim instead of blowing up the heightfield
      const dt = last ? Math.min(0.025, (now - last) / 1000) : 1 / 60;
      last = now;

      if (now - exciteAt > HARD_SNAP_MS) {
        snapFlat(); // absolute forced-settle — sleep flat
        return;
      }
      const overdue = now - exciteAt > SETTLE_MS;

      // damped level spring
      const cDamp = 2 * SPRING_ZETA * Math.sqrt(SPRING_K);
      levelV += (-SPRING_K * (level - target) - cDamp * levelV) * dt;
      level += levelV * dt;

      // 1D heightfield: neighbor coupling, per-frame damping
      const damp = overdue ? 0.85 : DAMP;
      const c2 = (WAVE_C * WAVE_C) / (DX * DX);
      let vMax = 0;
      for (let i = 0; i < cols; i++) {
        const l = hf[Math.max(0, i - 1)] ?? 0;
        const r = hf[Math.min(cols - 1, i + 1)] ?? 0;
        const acc = c2 * (l + r - 2 * (hf[i] ?? 0));
        vf[i] = ((vf[i] ?? 0) + acc * dt) * damp;
      }
      for (let i = 0; i < cols; i++) {
        hf[i] = (hf[i] ?? 0) + (vf[i] ?? 0) * dt;
        if (overdue) hf[i] = (hf[i] ?? 0) * 0.9; // pull flat past deadline
        const pf = Math.abs((vf[i] ?? 0) * dt);
        if (pf > vMax) vMax = pf;
      }

      drawFrame();

      const settled =
        vMax < V_EPS &&
        Math.abs(level - target) < LEVEL_EPS &&
        Math.abs(levelV * dt) < V_EPS;
      if (settled) {
        snapFlat();
        return;
      }
      raf = requestAnimationFrame(loop);
    };

    const wake = () => {
      if (!raf && !reduced && visible && !document.hidden) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    const splash = (x: number, amp: number) => {
      if (!sized) return;
      const i0 = Math.round(x / DX);
      for (let k = 0; k < KERNEL.length; k++) {
        const i = i0 + k - 2;
        if (i < 0 || i >= cols) continue;
        hf[i] = (hf[i] ?? 0) + amp * (KERNEL[k] ?? 0);
      }
    };

    const caretX = (len: number) =>
      Math.max(4, Math.min(w - 8, padLeft + len * maskW));

    const inputFn = (v: string, instant = false) => {
      const s = scorePassword(v);
      target = h * MAX_FILL * (s / 100);
      const dLen = v.length - prevLen;
      prevLen = v.length;
      if (reduced || instant || !sized) {
        // static gauge: instant height, no waves
        hf.fill(0);
        vf.fill(0);
        level = target;
        levelV = 0;
        drawFrame();
        return;
      }
      // keystroke sloshes at the caret's approximate x; delete bumps + recedes
      if (dLen > 0) splash(caretX(v.length), KEY_IMPULSE);
      else if (dLen < 0) splash(caretX(v.length), DEL_IMPULSE);
      exciteAt = performance.now();
      wake();
    };

    const rippleFn = (x: number) => {
      if (reduced) return;
      splash(x, TOGGLE_IMPULSE);
      exciteAt = performance.now();
      wake();
    };

    const resize = () => {
      const rect = frame.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) {
        sized = false; // zero-size guard — never simulate into nothing
        return;
      }
      w = rect.width;
      h = rect.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      // replaced element: inset does not size it — explicit CSS size + bitmap
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const nextCols = Math.floor(w / DX) + 1;
      if (nextCols !== cols) {
        cols = nextCols;
        hf = new Float32Array(cols);
        vf = new Float32Array(cols);
      }
      sized = true;
      measure();
      // re-anchor level to the (possibly new) height
      const s = scorePassword(input.value);
      target = h * MAX_FILL * (s / 100);
      if (!raf) level = target;
      drawFrame();
    };
    resize();

    // -- init: seed level from the initial value, no waves ------------------
    prevLen = input.value.length;
    inputFn(input.value, true);

    engineRef.current = { input: inputFn, ripple: rippleFn };

    // -- landing-page card demo (autoplay) -----------------------------------
    // The shared autoplay driver (app/preview/[name]/autoplay-driver.tsx) only
    // synthesises Pointer/Mouse events. This component's entire demonstration
    // is value-driven — typed characters via <input onChange> — which no
    // pointer/scroll/press/drag descriptor can reach, and the one
    // pointer-reachable surface (the reveal toggle -> ripple) is invisible on
    // an empty tank. So meta.json declares "mode": "none" (no shared driver
    // mounts, no data-autoplay-root/inert change) and, gated strictly on the
    // ?autoplay=1 query param the embed sets, this scripts a password being
    // typed and deleted by calling the exact same `inputFn` real typing
    // already calls — no new rendering path, no bespoke canvas animation.
    // Real users never see this: the param is absent on both the plain
    // /preview page and on plain ?embed=1.
    let scriptTimer = 0;
    let scriptCancelled = false;
    if (!isControlled && !reduced) {
      const isAutoplay =
        new URLSearchParams(window.location.search).get("autoplay") === "1";
      if (isAutoplay) {
        const script = "Tr0ub4dor&3";
        const TYPE_MS = 190;
        const DELETE_MS = 110;
        const HOLD_MS = 850;
        const REST_MS = 700;
        const setVal = (v: string) => {
          input.value = v;
          setBand((prev) => {
            const b = bandOf(scorePassword(v));
            return prev === b ? prev : b;
          });
          inputFn(v);
        };
        const typeStep = (i: number) => {
          if (scriptCancelled) return;
          setVal(script.slice(0, i));
          scriptTimer = window.setTimeout(
            () => (i < script.length ? typeStep(i + 1) : deleteStep(script.length)),
            i < script.length ? TYPE_MS : HOLD_MS
          );
        };
        const deleteStep = (len: number) => {
          if (scriptCancelled) return;
          const next = len - 1;
          setVal(script.slice(0, Math.max(0, next)));
          scriptTimer = window.setTimeout(
            () => (next > 0 ? deleteStep(next) : typeStep(1)),
            next > 0 ? DELETE_MS : REST_MS
          );
        };
        scriptTimer = window.setTimeout(() => typeStep(1), 500);
      }
    }

    // -- observers ----------------------------------------------------------
    const ro = new ResizeObserver(resize);
    ro.observe(frame);
    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) wake();
    });
    io.observe(frame);
    // live theme re-derive: watch documentElement class flips
    const mo = new MutationObserver(() => {
      derive();
      if (raf) return; // running loop repaints next frame anyway
      drawFrame();
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    const onVis = () => {
      if (!document.hidden) wake();
    };
    document.addEventListener("visibilitychange", onVis);
    // live OS-setting re-derive, mirroring the documentElement class observer
    const onMotionChange = () => {
      reduced = motionMq.matches;
      if (reduced) {
        cancelAnimationFrame(raf);
        raf = 0;
        snapFlat();
      }
    };
    motionMq.addEventListener("change", onMotionChange);

    return () => {
      cancelAnimationFrame(raf);
      scriptCancelled = true;
      window.clearTimeout(scriptTimer);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      motionMq.removeEventListener("change", onMotionChange);
      engineRef.current = null;
    };
  }, []);

  // controlled value set programmatically (autofill, reset) re-syncs the tide
  useEffect(() => {
    if (isControlled) engineRef.current?.input(value ?? "");
  }, [isControlled, value]);

  const handleInput = (v: string) => {
    const b = bandOf(scorePassword(v));
    setBand((prev) => (prev === b ? prev : b));
    engineRef.current?.input(v);
    onValueChange?.(v);
  };

  const handleToggle = () => {
    setRevealed((r) => !r);
    const btn = toggleRef.current;
    if (btn) engineRef.current?.ripple(btn.offsetLeft + btn.offsetWidth / 2);
  };

  return (
    <div className={className}>
      <label
        htmlFor={inputId}
        className="mb-1.5 block text-sm font-medium text-foreground"
      >
        {label}
        {required ? <span className="text-ns-muted"> *</span> : null}
      </label>
      <div
        ref={frameRef}
        className={`relative overflow-hidden rounded-sm border border-border bg-surface transition-colors focus-within:border-ns-accent/60 focus-within:ring-2 focus-within:ring-ns-accent/30 ${
          disabled ? "opacity-60" : "hover:border-foreground/25"
        }`}
      >
        <canvas
          ref={canvasRef}
          aria-hidden
          className="pointer-events-none absolute left-0 top-0"
        />
        <input
          ref={inputRef}
          id={inputId}
          type={revealed ? "text" : "password"}
          name={name}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          disabled={disabled}
          aria-describedby={liveId}
          spellCheck={false}
          {...(isControlled ? { value } : { defaultValue })}
          onChange={(e) => handleInput(e.currentTarget.value)}
          className="relative z-10 w-full bg-transparent py-2 pl-3 pr-11 font-mono text-sm text-foreground outline-none placeholder:text-ns-muted/70"
        />
        <button
          ref={toggleRef}
          type="button"
          aria-pressed={revealed}
          aria-label={revealed ? "Hide password" : "Show password"}
          disabled={disabled}
          onClick={handleToggle}
          className="absolute right-1.5 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-sm text-ns-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent disabled:pointer-events-none"
        >
          {revealed ? (
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
              <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
              <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
              <line x1="2" x2="22" y1="2" y2="22" />
            </svg>
          ) : (
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
      <div className="mt-1.5 flex min-h-4 items-center justify-end">
        <span
          aria-hidden
          className={`font-mono text-[11px] uppercase tracking-[0.14em] transition-colors ${
            band === "Strong"
              ? "text-ns-accent"
              : band === "Fair"
                ? "text-foreground/70"
                : band === "Weak"
                  ? "text-ns-muted"
                  : "text-transparent"
          }`}
        >
          {band ?? "·"}
        </span>
      </div>
      <span id={liveId} aria-live="polite" className="sr-only">
        {band ? `Password strength: ${band}` : ""}
      </span>
    </div>
  );
}
