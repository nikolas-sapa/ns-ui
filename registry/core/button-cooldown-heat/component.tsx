"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// HeatSoak — a rate-limited button whose own body is the thermometer. A
// scalar `h` ("heat") accumulates +0.34 per press and decays exponentially
// (half-life 2.5s) in a single rAF loop, written straight onto the button as
// a `--heat` CSS custom property. All visual layers read that one property
// (clamped to 1 via CSS `min()` as `--h`, plus a `--warm` ramp that's 0 below
// h=0.7 and climbs 0->1 across 0.7-1.0): letter-spacing, scale and
// border-color dilate the button itself; a bottom-up fill layer reads --h
// directly so the accumulated heat has an actual gauge to point at, not just
// a swelling border; a soft haze band sweeps the surface at an opacity gated
// to --warm, so it's only visible once the button is genuinely close to (or
// still cooling from) the limit — never at rest. No progress bar, no digit:
// the fill and the shimmer *are* the gauge.
//
// Past a duty cycle (h >= 1.0) it "soaks": the flag latches (hysteresis —
// re-arms only once h decays back to <= 0.05, i.e. genuinely cooled, not
// merely below the limit again, so one press right after re-arming can't
// instantly punch it back over SOAK_AT and the lockout holds for the whole
// cooldown, not a sliver of it), the fill grows a diagonal hazard hatch and
// breathes gently — a distinct, unmissable "dead" read, not just the same
// warm tone held longer —
// and the label itself dims toward --ns-muted. Further presses no-op the actual
// action, instead getting a flat, dead 1px translateY dip that eases back
// with no spring overshoot — an "overdamped" non-response, not a bigger
// animation (the hazard breathing is a separate, deliberately ambient loop,
// not the dip's feedback). aria-disabled (never the native `disabled`
// attribute) keeps the button in the tab order and clickable the whole time;
// a visible Geist Mono caption under the button duplicates every thermal cue
// in words ("heat 62%", then "cooling down, ready in about 4s") so nothing
// here rides on motion alone, and a separate sr-only aria-live=polite span
// announces only the two discrete transitions (entered soak / re-armed)
// rather than re-reading a ticking countdown.
//
// The same fill and haze double as the cooldown display: nothing resets when
// soak ends, --h and --warm just keep draining as h decays, so the gauge
// that filled up on the way to the limit is the same gauge visibly emptying
// back out afterward.
//
// The countdown text recomputes from the live decay math (t = ln(h/REARM_AT)/k)
// but only commits to the DOM at most once a second, per the brief — the
// `--heat` variable itself still updates every rAF frame underneath it, so
// the visual swelling stays smooth while the words update at a sane pace.
//
// Reduced motion is a pure CSS override (`transform: none`, `letter-spacing:
// 0`, haze `display: none`, hazard breathing frozen at full opacity, all
// under the media query, `!important`) — synchronous at first paint, no JS
// race with a `matchMedia` effect. The fill and border stay fully legible
// without any motion; the caption and aria-live text are identical either
// way, already the non-motion channel for this state.
//
// Every color is a token: --border, --foreground and --ns-muted only, mixed
// with `color-mix()` — never --ns-accent (interaction-only, reserved for the
// focus ring), no hex, no canvas. DOM+CSS only.
// ---------------------------------------------------------------------------

const HEAT_PER_PRESS = 0.34;
const HALF_LIFE_S = 2.5;
const DECAY_K = Math.LN2 / HALF_LIFE_S; // per second
const SOAK_AT = 1.0;
// Re-arm near fully cooled, not near the limit: at 0.7 a single subsequent
// press (+0.34) instantly punched back over SOAK_AT, so the lockout was
// only ever honored for ~1.4s of an ~11s decay — a click "during cooldown"
// looked like it refilled because functionally it did. 0.05 forces the
// button to actually finish cooling (and keeps showing the soaked/hazard
// visual the whole time, since that reads off the same flag) before a press
// can do anything again.
const REARM_AT = 0.05;
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
  // other rAF-driven scalars (toast-undo-fuse's ember spring, etc).
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
.ns-button-cooldown-heat-btn{
  --h: min(var(--heat, 0), 1);
  /* warmup ramp: 0 until h=0.7, 0->1 across 0.7-1.0 — a "near the limit"
     glow, independent of the (much lower) re-arm point below. It fades out
     partway through the soak as h keeps decaying past 0.7; the hazard hatch
     and dimmed label (gated on aria-disabled, not --warm) are what stay on
     for the full lockout. Same scalar drives the shimmer intensity and the
     fill's hottest tone whether climbing toward the limit or draining
     through it. */
  --warm: max(0, min(1, calc((var(--heat, 0) - 0.7) * 3.3333)));
  position: relative;
  overflow: hidden;
  transform: translateY(calc(var(--dip, 0) * 1px)) scale(calc(1 + 0.02 * var(--h)));
  border-color: color-mix(in srgb, var(--border), var(--foreground) calc(var(--h) * 100%));
}
.ns-button-cooldown-heat-btn:hover{ background-color: color-mix(in srgb, var(--background), var(--foreground) 6%); }
.ns-button-cooldown-heat-btn[aria-disabled="true"]{ cursor: not-allowed; }

/* accumulated-heat fill: a bottom-up band reading the same --h the border
   and scale already use, so the gauge is legible even where the swelling
   is subtle. Tone shifts from --ns-muted (cool) toward --foreground (hot) as
   --warm rises, never toward --ns-accent — thermal state, not an affordance. */
.ns-button-cooldown-heat-fill{
  position: absolute;
  inset: 0;
  background-image: linear-gradient(to top,
    color-mix(in srgb, var(--ns-muted), var(--foreground) calc(var(--warm) * 45%)) 0%,
    color-mix(in srgb, var(--ns-muted), var(--foreground) calc(var(--warm) * 45%)) calc(var(--h) * 100%),
    transparent calc(var(--h) * 100%),
    transparent 100%);
  opacity: calc(0.16 + var(--warm) * 0.16);
  transition: opacity 200ms ease-out;
}
/* soaked (over-limit): the fill grows a hazard hatch and breathes — a
   distinct, unmissable "dead" read, still no color outside the palette. */
.ns-button-cooldown-heat-btn[aria-disabled="true"] .ns-button-cooldown-heat-fill{
  background-image:
    repeating-linear-gradient(135deg,
      color-mix(in srgb, var(--foreground) 22%, transparent) 0 1px,
      transparent 1px 6px),
    linear-gradient(to top,
      color-mix(in srgb, var(--ns-muted), var(--foreground) 45%) 0%,
      color-mix(in srgb, var(--ns-muted), var(--foreground) 45%) calc(var(--h) * 100%),
      transparent calc(var(--h) * 100%),
      transparent 100%);
  animation: ns-button-cooldown-heat-hazard 1.6s ease-in-out infinite;
}
.ns-button-cooldown-heat-btn[aria-disabled="true"] .ns-button-cooldown-heat-label{
  color: color-mix(in srgb, var(--foreground), var(--ns-muted) 35%);
}

/* heat shimmer/haze: a soft band sweeping the surface, opacity gated to
   --warm so it's invisible until the button is genuinely close to (or
   still cooling from) the limit — never at rest, never mid-warmup. */
.ns-button-cooldown-heat-haze{
  position: absolute;
  inset: 0;
  background-image: linear-gradient(100deg,
    transparent 30%,
    color-mix(in srgb, var(--ns-muted), var(--foreground) 30%) 50%,
    transparent 70%);
  background-size: 220% 100%;
  opacity: calc(var(--warm) * 0.35);
  animation: ns-button-cooldown-heat-shimmer 2.4s linear infinite;
}

.ns-button-cooldown-heat-label{
  position: relative;
  z-index: 1;
  letter-spacing: calc(var(--h) * 0.06em);
  transition: color 200ms ease-out;
}

@keyframes ns-button-cooldown-heat-shimmer{
  0%{ background-position: 130% 0; }
  100%{ background-position: -30% 0; }
}
@keyframes ns-button-cooldown-heat-hazard{
  0%, 100%{ opacity: 0.6; }
  50%{ opacity: 1; }
}

@media (prefers-reduced-motion: reduce){
  .ns-button-cooldown-heat-btn{ transform: none !important; }
  .ns-button-cooldown-heat-label{ letter-spacing: 0 !important; transition: none !important; }
  .ns-button-cooldown-heat-fill{ transition: none !important; }
  .ns-button-cooldown-heat-haze{ display: none !important; }
  .ns-button-cooldown-heat-btn[aria-disabled="true"] .ns-button-cooldown-heat-fill{
    animation: none !important;
    opacity: 1 !important;
  }
}
`}</style>

      <button
        ref={btnRef}
        type="button"
        aria-disabled={soaked ? "true" : undefined}
        aria-describedby={descId}
        onClick={handleClick}
        className="ns-button-cooldown-heat-btn inline-flex items-center justify-center rounded-sm border bg-background px-5 py-2.5 text-sm font-medium text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
      >
        <span aria-hidden="true" className="ns-button-cooldown-heat-fill" />
        <span aria-hidden="true" className="ns-button-cooldown-heat-haze" />
        <span className="ns-button-cooldown-heat-label">{children}</span>
      </button>

      <p id={descId} className="mt-1.5 font-mono text-[11px] text-ns-muted">
        {caption}
      </p>

      <span role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </div>
  );
}
