"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// CipherReelOtp — 6-box code entry where every box is a tiny slot-machine
// cipher reel. Each cell is a real numeric <input> with a canvas overlay
// drawing a vertical mono glyph strip (0-9 plus cipher glyphs); the input
// text is transparent, the canvas is the visible face. Keystrokes spin the
// reel at 14 rows/s, decelerating at 30 rows/s^2 into a detent spring
// (k=380 s^-2, zeta=0.6, ~0.15-row overshoot) with an accent border flash on
// lock. Backspace reverse-spins to blank, paste/autofill staggers cells
// left-to-right, idle empty cells carry a faint ambient drift. The error prop
// shakes the row and re-scrambles the reels out. Direct-DOM rAF sleeps the
// instant every reel rests, pauses offscreen/hidden; all canvas ink is
// derived from CSS tokens at mount and re-derived on theme class changes.
// ---------------------------------------------------------------------------

const STRIP = "0123456789#$%&*+"; // digits first: digit d lives on row d
const N = STRIP.length;
const SPIN_V = 14; // rows/s entry speed
const DECEL = 30; // rows/s^2
const SPIN_ROWS = 2; // rows travelled before the detent takes over
const SPRING_K = 380; // s^-2
const SPRING_ZETA = 0.6; // ~0.15-row mechanical overshoot
const REV_V = 8; // rows/s backspace reverse-spin
const REV_ROWS = 1.2;
const AMBIENT_V = 0.15; // rows/s idle drift
const AMBIENT_A = 0.25; // idle strip alpha
const STAGGER_MS = 70; // paste/autofill left-to-right stagger
const FLASH_MS = 120; // accent border flash on lock
const DEADLINE_MS = 600; // forced-settle deadline per reel
const SCRAMBLE_MS = 240; // error scramble-out
const SHAKE_MS = 260; // error row shake, 3 cycles, +-4px

type Vec3 = readonly [number, number, number];
type Mode =
  | "empty"
  | "queued"
  | "spin"
  | "spring"
  | "rest"
  | "reverse"
  | "scramble";

interface Cell {
  mode: Mode;
  pos: number; // row position, float; glyph = STRIP[(row + offset) mod N]
  v: number; // rows/s
  target: number; // absolute detent row
  offset: number; // strip rotation so the detent row shows the typed digit
  alpha: number; // base strip alpha for the current mode
  startAt: number; // stagger gate (performance.now ms)
  deadline: number; // forced-settle timestamp
  revStart: number; // pos when the reverse-spin began
  scrStart: number; // scramble start timestamp
  pendingDigit: number;
  dirty: boolean; // needs one redraw while otherwise asleep
}

interface Engine {
  type: (i: number, digit: number, delayMs: number) => void;
  clear: (i: number) => void;
  errorOut: () => void;
  wake: () => void;
}

function parseColor(raw: string, fallback: Vec3): Vec3 {
  const s = raw.trim();
  if (s.startsWith("#")) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex.slice(0, 1) + hex.slice(0, 1), 16);
      const g = parseInt(hex.slice(1, 2) + hex.slice(1, 2), 16);
      const b = parseInt(hex.slice(2, 3) + hex.slice(2, 3), 16);
      return Number.isNaN(r + g + b) ? fallback : [r, g, b];
    }
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return Number.isNaN(r + g + b) ? fallback : [r, g, b];
    }
    return fallback;
  }
  const m = s.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : fallback;
}

const rgba = (c: Vec3, a: number) =>
  `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;

export function CipherReelOtp({
  length = 6,
  label = "Verification code",
  helperText = "",
  error = false,
  errorMessage = "That code didn't match. Try again.",
  disabled = false,
  autoFocus = false,
  onChange,
  onComplete,
  className = "",
}: {
  /** number of reel cells; fixed at mount */
  length?: number;
  /** visible legend labelling the group */
  label?: string;
  /** muted helper line under the reels */
  helperText?: string;
  /** flip true to shake the row and scramble the reels clear */
  error?: boolean;
  /** helper line while error is set — the only place the error token appears */
  errorMessage?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  onChange?: (code: string) => void;
  onComplete?: (code: string) => void;
  className?: string;
}) {
  const fieldRef = useRef<HTMLFieldSetElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const wrapRefs = useRef<(HTMLDivElement | null)[]>([]);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const engineRef = useRef<Engine | null>(null);

  const [values, setValues] = useState<string[]>(() =>
    Array.from({ length }, () => "")
  );
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // -- canvas engine: locals only on the hot path, never React state --------
  useEffect(() => {
    const field = fieldRef.current;
    const row = rowRef.current;
    if (!field || !row) return;
    const count = canvasRefs.current.length;
    const ctxs = canvasRefs.current.map(
      (cv) => cv?.getContext("2d") ?? null
    );

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // token-derived ink: read at mount, re-derived on theme class change
    let fg: Vec3 = [237, 237, 237];
    let accent: Vec3 = [0, 107, 255];
    const derive = () => {
      const cs = getComputedStyle(document.documentElement);
      fg = parseColor(cs.getPropertyValue("--foreground"), fg);
      accent = parseColor(cs.getPropertyValue("--accent"), accent);
    };
    derive();

    const cells: Cell[] = Array.from({ length: count }, (_, i) => ({
      mode: "empty",
      pos: (i * 2.7 + 0.4) % N, // desynced ambient strips
      v: 0,
      target: 0,
      offset: (i * 5) % N,
      alpha: AMBIENT_A,
      startAt: 0,
      deadline: 0,
      revStart: 0,
      scrStart: 0,
      pendingDigit: 0,
      dirty: true,
    }));

    let raf = 0;
    let last = 0;
    let visible = true;
    let sized = false;
    let cw = 0;
    let ch = 0;
    let dpr = 1;
    let font = "500 20px monospace";
    let shakeStart = -1;
    const timeouts = new Set<number>();

    const normalize = (c: Cell) => {
      // subtract whole strips only — glyph lookup is invariant mod N
      c.pos = ((c.pos % N) + N) % N;
    };

    const drawCell = (i: number) => {
      const c = cells[i];
      const ctx = ctxs[i];
      if (!c || !ctx || !sized) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch); // full clear + redraw every frame
      ctx.font = font;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const cx = cw / 2;
      const cy = ch / 2;
      if (c.mode === "rest") {
        const g = STRIP[(((Math.round(c.pos) + c.offset) % N) + N) % N];
        if (g) {
          ctx.fillStyle = rgba(fg, 1);
          ctx.fillText(g, cx, cy);
        }
        return;
      }
      const rowH = ch * 0.6;
      const base = Math.floor(c.pos);
      for (let r = base - 1; r <= base + 2; r++) {
        const dy = (r - c.pos) * rowH;
        if (Math.abs(dy) > cy + rowH * 0.5) continue;
        const g = STRIP[(((r + c.offset) % N) + N) % N];
        if (!g) continue;
        const a = c.alpha * Math.max(0, 1 - (Math.abs(dy) / rowH) * 0.75);
        if (a <= 0.012) continue;
        ctx.fillStyle = rgba(fg, a);
        ctx.fillText(g, cx, cy + dy);
      }
    };

    const flash = (i: number) => {
      // accent border flash at 35% alpha for 120 ms on detent lock
      const el = wrapRefs.current[i];
      if (!el || reduced) return;
      el.style.borderColor = rgba(accent, 0.35);
      el.style.boxShadow = `0 0 0 1px ${rgba(accent, 0.35)}, 0 0 10px ${rgba(accent, 0.18)}`;
      const t = window.setTimeout(() => {
        el.style.borderColor = "";
        el.style.boxShadow = "";
        timeouts.delete(t);
      }, FLASH_MS);
      timeouts.add(t);
    };

    const settle = (i: number) => {
      const c = cells[i];
      if (!c) return;
      c.pos = c.target;
      normalize(c);
      c.v = 0;
      c.alpha = 1;
      c.mode = "rest";
      c.dirty = false;
      drawCell(i);
      flash(i);
    };

    const resize = () => {
      const first = wrapRefs.current[0];
      if (!first) return;
      const rect = first.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) {
        sized = false; // zero-size guard
        return;
      }
      cw = rect.width;
      ch = rect.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      font = `500 ${Math.round(ch * 0.42)}px ${getComputedStyle(row).fontFamily}`;
      for (const cv of canvasRefs.current) {
        if (!cv) continue;
        cv.width = Math.round(cw * dpr);
        cv.height = Math.round(ch * dpr);
        // replaced element: CSS position does not size it — set both explicitly
        cv.style.width = `${cw}px`;
        cv.style.height = `${ch}px`;
      }
      sized = true;
      for (const c of cells) c.dirty = true;
      wake();
    };

    const loop = (now: number) => {
      raf = 0;
      const dt = last ? Math.min(0.033, (now - last) / 1000) : 1 / 60;
      last = now;
      let active = false;
      const ambientOk =
        visible && !document.hidden && !reduced && !disabledRef.current;

      // error shake: +-4px, 3 cycles, damped over 260 ms
      if (shakeStart >= 0) {
        const p = (now - shakeStart) / SHAKE_MS;
        if (p >= 1) {
          row.style.transform = "";
          shakeStart = -1;
        } else {
          const x = 4 * Math.sin(Math.PI * 2 * 3 * p) * (1 - p);
          row.style.transform = `translateX(${x.toFixed(2)}px)`;
          active = true;
        }
      }

      for (let i = 0; i < count; i++) {
        const c = cells[i];
        if (!c) continue;
        switch (c.mode) {
          case "queued": {
            // paste/autofill stagger gate; keep drifting while waiting
            if (now >= c.startAt) {
              c.target = Math.round(c.pos) + SPIN_ROWS;
              c.offset = (((c.pendingDigit - c.target) % N) + N) % N;
              c.v = SPIN_V;
              c.mode = "spin";
            } else if (ambientOk) {
              c.pos += AMBIENT_V * dt;
            }
            drawCell(i);
            active = true;
            break;
          }
          case "spin": {
            c.v = Math.max(4, c.v - DECEL * dt);
            c.pos += c.v * dt;
            if (now >= c.deadline || c.pos >= c.target) {
              settle(i); // forced-settle deadline
            } else if (c.pos >= c.target - 0.45) {
              c.mode = "spring";
              drawCell(i);
              active = true;
            } else {
              drawCell(i);
              active = true;
            }
            break;
          }
          case "spring": {
            if (now >= c.deadline) {
              settle(i);
              break;
            }
            const damp = 2 * SPRING_ZETA * Math.sqrt(SPRING_K);
            c.v += (-SPRING_K * (c.pos - c.target) - damp * c.v) * dt;
            c.pos += c.v * dt;
            if (Math.abs(c.pos - c.target) < 0.004 && Math.abs(c.v) < 0.08) {
              settle(i); // reel rests, its rAF share sleeps now
            } else {
              drawCell(i);
              active = true;
            }
            break;
          }
          case "reverse": {
            c.pos -= REV_V * dt;
            const p = Math.min(1, (c.revStart - c.pos) / REV_ROWS);
            c.alpha = 1 - (1 - AMBIENT_A) * p;
            if (p >= 1 || now >= c.deadline) {
              c.mode = "empty";
              c.alpha = AMBIENT_A;
              normalize(c);
              c.dirty = true;
            } else {
              drawCell(i);
              active = true;
            }
            break;
          }
          case "scramble": {
            const p = Math.min(1, (now - c.scrStart) / SCRAMBLE_MS);
            c.pos += (6 + 18 * p) * dt; // accelerating scramble-out
            c.alpha = 1 - (1 - AMBIENT_A) * p;
            if (p >= 1) {
              c.mode = "empty";
              c.alpha = AMBIENT_A;
              normalize(c);
              c.dirty = true;
            } else {
              drawCell(i);
              active = true;
            }
            break;
          }
          case "empty": {
            if (ambientOk) {
              c.pos += AMBIENT_V * dt; // ambient drift is the default look
              c.dirty = false;
              drawCell(i);
              active = true;
            } else if (c.dirty) {
              c.dirty = false;
              drawCell(i); // one static frame, then sleep
            }
            break;
          }
          case "rest": {
            if (c.dirty) {
              c.dirty = false;
              drawCell(i);
            }
            break;
          }
        }
      }

      // pause offscreen/hidden even mid-spin — forced-settle deadlines catch
      // up the moment the loop wakes again
      if (active && visible && !document.hidden) {
        raf = requestAnimationFrame(loop);
      }
    };

    const wake = () => {
      if (!raf) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    // -- engine API ----------------------------------------------------------
    const type = (i: number, digit: number, delayMs: number) => {
      const c = cells[i];
      if (!c) return;
      if (reduced) {
        // digits render instantly: no spin, plain advance
        c.target = Math.round(c.pos);
        c.offset = (((digit - c.target) % N) + N) % N;
        c.pos = c.target;
        c.v = 0;
        c.alpha = 1;
        c.mode = "rest";
        c.dirty = true;
        wake();
        return;
      }
      const now = performance.now();
      c.pendingDigit = digit;
      c.alpha = 1;
      c.startAt = now + delayMs;
      c.deadline = c.startAt + DEADLINE_MS;
      c.mode = "queued";
      wake();
    };

    const clear = (i: number) => {
      const c = cells[i];
      if (!c) return;
      if (reduced || c.mode === "empty") {
        c.mode = "empty";
        c.alpha = AMBIENT_A;
        c.v = 0;
        normalize(c);
        c.dirty = true;
        wake();
        return;
      }
      c.revStart = c.pos;
      c.deadline = performance.now() + DEADLINE_MS;
      c.mode = "reverse";
      c.v = 0;
      wake();
    };

    const errorOut = () => {
      const now = performance.now();
      if (!reduced) shakeStart = now;
      for (const c of cells) {
        if (c.mode === "empty") continue;
        if (reduced) {
          c.mode = "empty";
          c.alpha = AMBIENT_A;
          c.v = 0;
          normalize(c);
          c.dirty = true;
        } else {
          c.scrStart = now;
          c.mode = "scramble";
        }
      }
      wake();
    };

    engineRef.current = { type, clear, errorOut, wake };

    // -- init + observers ----------------------------------------------------
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(row);
    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) wake(); // ambient resumes on re-entry
    });
    io.observe(field);
    const mo = new MutationObserver(() => {
      derive(); // live theme re-derive on documentElement class flips
      for (const c of cells) c.dirty = true;
      wake();
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
      for (const t of timeouts) window.clearTimeout(t);
      timeouts.clear();
      row.style.transform = "";
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // wake the loop when re-enabled so ambient drift resumes
  useEffect(() => {
    if (!disabled) engineRef.current?.wake();
  }, [disabled]);

  // error rising edge: shake + scramble out, clear values, refocus
  const prevError = useRef(false);
  useEffect(() => {
    if (error && !prevError.current) {
      engineRef.current?.errorOut();
      setValues((prev) => prev.map(() => ""));
      inputRefs.current[0]?.focus();
    }
    prevError.current = error;
  }, [error]);

  // emit change/complete after state commits
  const emitted = useRef(false);
  useEffect(() => {
    const code = values.join("");
    if (!emitted.current) {
      emitted.current = true;
      return;
    }
    onChangeRef.current?.(code);
    if (values.length > 0 && values.every((v) => v !== "")) {
      onCompleteRef.current?.(code);
    }
  }, [values]);

  // -- interaction -----------------------------------------------------------
  const focusCell = (i: number) => {
    inputRefs.current[Math.max(0, Math.min(length - 1, i))]?.focus();
  };

  const commit = (i: number, d: string) => {
    setValues((prev) => {
      const next = [...prev];
      next[i] = d;
      return next;
    });
    engineRef.current?.type(i, Number(d), 0);
    if (i < length - 1) focusCell(i + 1); // auto-advance
  };

  const clearCell = (i: number) => {
    setValues((prev) => {
      if (!prev[i]) return prev;
      const next = [...prev];
      next[i] = "";
      return next;
    });
    engineRef.current?.clear(i);
  };

  const distribute = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, length);
    if (!digits) return;
    setValues(() => Array.from({ length }, (_, i) => digits[i] ?? ""));
    for (let i = 0; i < length; i++) {
      const d = digits[i];
      if (d !== undefined) {
        engineRef.current?.type(i, Number(d), i * STAGGER_MS);
      } else {
        engineRef.current?.clear(i);
      }
    }
    focusCell(Math.min(digits.length, length - 1));
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      commit(i, e.key);
      return;
    }
    if (e.key === "Backspace") {
      e.preventDefault();
      if (valuesRef.current[i]) {
        clearCell(i); // reverse-spin to blank, stay put
      } else if (i > 0) {
        clearCell(i - 1); // empty cell: move left and clear
        focusCell(i - 1);
      }
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusCell(i - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focusCell(i + 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusCell(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusCell(length - 1);
    }
  };

  const handleChange = (i: number, e: React.ChangeEvent<HTMLInputElement>) => {
    // mobile keyboards and SMS autofill land here (keydown path is prevented)
    const digits = e.target.value.replace(/\D/g, "");
    if (!digits) {
      if (valuesRef.current[i]) clearCell(i);
      return;
    }
    if (digits.length === 1) commit(i, digits);
    else distribute(digits);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLFieldSetElement>) => {
    e.preventDefault();
    distribute(e.clipboardData.getData("text"));
  };

  const complete = values.every((v) => v !== "");

  return (
    <fieldset
      ref={fieldRef}
      disabled={disabled}
      onPaste={handlePaste}
      className={`m-0 min-w-0 border-0 p-0 ${disabled ? "opacity-50" : ""} ${className}`}
    >
      <legend className="mb-3 block p-0 font-mono text-xs uppercase tracking-[0.18em] text-muted">
        {label}
      </legend>
      <div
        ref={rowRef}
        className="flex items-center font-mono will-change-transform"
      >
        {values.map((v, i) => (
          <div
            key={i}
            ref={(el) => {
              wrapRefs.current[i] = el;
            }}
            className={`relative h-14 w-11 overflow-hidden rounded-sm border border-border bg-background transition-[border-color,box-shadow] duration-150 hover:border-foreground/25 focus-within:border-accent/60 focus-within:ring-2 focus-within:ring-accent/30 ${
              i === 0 ? "" : i === Math.ceil(length / 2) ? "ml-4" : "ml-2"
            }`}
          >
            <canvas
              ref={(el) => {
                canvasRefs.current[i] = el;
              }}
              aria-hidden
              className="pointer-events-none absolute left-0 top-0"
            />
            <input
              ref={(el) => {
                inputRefs.current[i] = el;
              }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              maxLength={1}
              value={v}
              disabled={disabled}
              autoFocus={autoFocus && i === 0}
              aria-label={`Digit ${i + 1} of ${length}`}
              onChange={(e) => handleChange(i, e)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onFocus={(e) => e.currentTarget.select()}
              className="absolute inset-0 h-full w-full rounded-sm bg-transparent text-center text-transparent caret-transparent outline-none selection:bg-transparent selection:text-transparent disabled:cursor-not-allowed"
            />
          </div>
        ))}
      </div>
      <p
        aria-live="polite"
        className={`mt-3 min-h-[1.25rem] text-xs ${error ? "" : "text-muted"}`}
        style={error ? { color: "var(--error, #ea001d)" } : undefined}
      >
        {error ? errorMessage : complete ? "Code complete." : helperText}
      </p>
    </fieldset>
  );
}
