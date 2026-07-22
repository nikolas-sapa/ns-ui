"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// HeatSoak — a rate-limited button whose own body is the thermometer. A
// scalar `h` ("heat") accumulates +0.34 per press and decays exponentially
// (half-life 2.5s) in a single rAF loop, written straight onto the button as
// a `--heat` CSS custom property. Three `calc()`/`color-mix()` expressions —
// letter-spacing, scale, border-color — all read that one property, clamped
// to 1 via CSS `min()`, so the button visibly dilates under repeated presses
// and relaxes on its own the moment they stop. No progress bar, no digit: the
// swelling and the border brightening toward --foreground *are* the gauge.
//
// Past a duty cycle (h >= 1.0) it "soaks": the flag latches (hysteresis —
// re-arms only once h decays back to <= 0.7, so it never flickers at either
// boundary) and further presses no-op the actual action, instead getting a
// flat, dead 1px translateY dip that eases back with no spring overshoot —
// an "overdamped" non-response, not a bigger animation. aria-disabled (never
// the native `disabled` attribute) keeps the button in the tab order and
// clickable the whole time; a visible Geist Mono caption under the button
// duplicates every thermal cue in words ("heat 62%", then "cooling down,
// ready in about 4s") so nothing here rides on motion alone, and a separate
// sr-only aria-live=polite span announces only the two discrete transitions
// (entered soak / re-armed) rather than re-reading a ticking countdown.
//
// The countdown text recomputes from the live decay math (t = ln(h/0.7)/k)
// but only commits to the DOM at most once a second, per the brief — the
// `--heat` variable itself still updates every rAF frame underneath it, so
// the visual swelling stays smooth while the words update at a sane pace.
//
// Reduced motion is a pure CSS override (`transform: none`, `letter-spacing:
// 0` under the media query, `!important`) — synchronous at first paint, no
// JS race with a `matchMedia` effect. The caption and aria-live text are
// identical either way, already the non-motion channel for this state.
//
// Every color is a token: --border and --foreground only, mixed with
// `color-mix()` — no hex, no canvas. DOM+CSS only.
// ---------------------------------------------------------------------------

const HEAT_PER_PRESS = 0.34;
const HALF_LIFE_S = 2.5;
const DECAY_K = Math.LN2 / HALF_LIFE_S; // per second
const SOAK_AT = 1.0;
const REARM_AT = 0.7;
const DIP_FALL_S = 0.18; // linear, no bounce — "overdamped"
const CAPTION_MIN_INTERVAL_MS = 1000;

function clampDt(dt: number) {
  // guards against a huge dt after a backgrounded tab / dropped frames
  return Math.max(0, Math.min(dt, 0.1));
}

function etaSeconds(h: number) {
  if (h <= REARM_AT) return 0;
  return Math.max(1, Math.ceil(Math.log(h / REARM_AT) / DECAY_K));
}

function captionFor(h: number, soaked: boolean) {
  if (soaked) return `cooling down, ready in about ${etaSeconds(h)}s`;
  if (h <= 0.01) return "ready";
  return `heat ${Math.round(Math.min(h, 1) * 100)}%`;
}

export interface HeatSoakProps {
  /** Visible label — also the button's accessible name. */
  children: ReactNode;
  /** Fires on every press that isn't soaked — the actual rate-limited action. */
  onPress?: () => void;
  className?: string;
}

export function HeatSoak({ children, onPress, className = "" }: HeatSoakProps) {
  const uid = useId();
  const btnRef = useRef<HTMLButtonElement>(null);

  const hRef = useRef(0);
  const dipRef = useRef(0);
  const soakedRef = useRef(false);
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);
  const lastCaptionTsRef = useRef(0);
  const wakeRef = useRef<() => void>(() => {});

  const [soaked, setSoaked] = useState(false);
  const [caption, setCaption] = useState("ready");
  const [announce, setAnnounce] = useState("");

  const descId = `${uid}-desc`;

  // -- rAF loop: decays h and the dip, writes --heat/--dip, watches the
  // re-arm edge, and throttles the caption's own re-renders. Sleeps once
  // both scalars settle and the flag is clear, exactly like this registry's
  // other rAF-driven scalars (short-fuse's ember spring, etc).
  useEffect(() => {
    const tick = (now: number) => {
      const dt = clampDt((now - lastTsRef.current) / 1000);
      lastTsRef.current = now;

      let h = hRef.current;
      if (h > 0) {
        h = h * Math.exp(-DECAY_K * dt);
        if (h < 1e-3) h = 0;
      }
      hRef.current = h;

      let d = dipRef.current;
      if (d > 0) {
        d = Math.max(0, d - dt / DIP_FALL_S);
        dipRef.current = d;
      }

      const btn = btnRef.current;
      if (btn) {
        btn.style.setProperty("--heat", h.toFixed(4));
        btn.style.setProperty("--dip", d.toFixed(4));
      }

      if (soakedRef.current && h <= REARM_AT) {
        soakedRef.current = false;
        setSoaked(false);
        setAnnounce("Re-armed — ready to press again.");
        lastCaptionTsRef.current = now;
        setCaption(captionFor(h, false));
      } else if (now - lastCaptionTsRef.current >= CAPTION_MIN_INTERVAL_MS) {
        lastCaptionTsRef.current = now;
        setCaption((prev) => {
          const next = captionFor(h, soakedRef.current);
          return next === prev ? prev : next;
        });
      }

      if (h > 0 || d > 0 || soakedRef.current) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = 0;
      }
    };

    wakeRef.current = () => {
      if (!rafRef.current) {
        lastTsRef.current = performance.now();
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, []);

  const wakeLoop = () => wakeRef.current();

  const handleClick = () => {
    if (soakedRef.current) {
      // dead press: flat feedback only, no heat, no action
      dipRef.current = 1;
      wakeLoop();
      return;
    }

    hRef.current += HEAT_PER_PRESS;
    onPress?.();

    if (hRef.current >= SOAK_AT) {
      soakedRef.current = true;
      setSoaked(true);
      setAnnounce(
        `Soaked — cooling down, ready in about ${etaSeconds(hRef.current)}s.`
      );
    }
    lastCaptionTsRef.current = 0; // force an immediate caption refresh
    wakeLoop();
  };

  return (
    <div className={className}>
      <style>{`
.ns-heat-soak-btn{
  transform: translateY(calc(var(--dip, 0) * 1px)) scale(calc(1 + 0.02 * min(var(--heat, 0), 1)));
  border-color: color-mix(in srgb, var(--border), var(--foreground) calc(min(var(--heat, 0), 1) * 100%));
}
.ns-heat-soak-btn:hover{ background-color: color-mix(in srgb, var(--background), var(--foreground) 6%); }
.ns-heat-soak-btn[aria-disabled="true"]{ cursor: not-allowed; }
.ns-heat-soak-label{
  letter-spacing: calc(min(var(--heat, 0), 1) * 0.06em);
}
@media (prefers-reduced-motion: reduce){
  .ns-heat-soak-btn{ transform: none !important; }
  .ns-heat-soak-label{ letter-spacing: 0 !important; }
}
`}</style>

      <button
        ref={btnRef}
        type="button"
        aria-disabled={soaked ? "true" : undefined}
        aria-describedby={descId}
        onClick={handleClick}
        className="ns-heat-soak-btn inline-flex items-center justify-center rounded-sm border bg-background px-5 py-2.5 text-sm font-medium text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span className="ns-heat-soak-label">{children}</span>
      </button>

      <p id={descId} className="mt-1.5 font-mono text-[11px] text-muted">
        {caption}
      </p>

      <span role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </div>
  );
}
