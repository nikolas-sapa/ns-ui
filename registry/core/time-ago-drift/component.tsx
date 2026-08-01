"use client";

import { useLayoutEffect, useRef, type CSSProperties } from "react";

// ---------------------------------------------------------------------------
// DriftStamp — a relative timestamp whose typography embodies its own age.
// "just now" renders heavy and tight; as the moment recedes, weight steps
// down (~650 -> 500 -> 400 -> 300 across 4 discrete buckets keyed off log-ish
// age ranges), letter-spacing opens 0 -> 0.04em, and ink steps from
// --foreground toward --muted — the drift is felt in the glyphs before the
// digits are read. Hover or focus crossfades (150ms, ease-out-expo) to the
// exact ISO moment in Geist Mono; both layers sit in the same CSS grid cell
// so the crossfade never reflows, and tabular-nums keeps every digit swap
// (the periodic re-tick, not just the crossfade) at a fixed width.
//
// Mechanism: a semantic <time datetime> is the only interactive node
// (tabIndex=0 — no separate control to reach). A recursive setTimeout (not
// setInterval) re-evaluates the age and reschedules itself at a delay that
// grows with the age — 1s while "just now", 15s through the minutes bucket,
// 5min through the hours bucket, 1hr once it's reading as a date — so a
// table of these costs almost nothing once its rows have aged past fresh.
// Direct DOM writes (textContent, style, attributes) on every tick, no React
// state on the hot path, the same pattern used elsewhere in this registry
// for per-row/per-instance tickers.
//
// Accessibility: the rendered relative text IS the accessible name
// (aria-label mirrors it exactly, updated on every tick) and the absolute
// moment lives in aria-description — both are always in the accessibility
// tree regardless of hover/focus state, which only changes what's painted.
// Aging is presentational only: weight/tracking/color never carry
// information the text doesn't already carry. prefers-reduced-motion swaps
// the 150ms crossfade for an instant opacity flip and drops the step/weight
// transition entirely.
//
// Differs from date-picker-moon: that component is a date ENTRY
// control (masked input + calendar popover) whose canvas moon-phases are
// decoration on top of a picker. DriftStamp has no input, no popover, no
// canvas — it is a pure display where elapsed time itself drives type, and
// the only affordance is "focus/hover to see the exact moment".
// ---------------------------------------------------------------------------

const CROSSFADE_MS = 150;
const STEP_MS = 550; // weight/tracking/color settle duration
const EASE_EXPO = "cubic-bezier(0.16, 1, 0.3, 1)";

type Step = { weight: number; tracking: number; mix: number };

// weight 650 -> 500 -> 400 -> 300, tracking 0 -> 0.04em, ink --foreground
// -> --muted (mix = % of --muted blended in), stepped across four buckets.
const STEPS: readonly Step[] = [
  { weight: 650, tracking: 0, mix: 0 },
  { weight: 500, tracking: 0.014, mix: 0.35 },
  { weight: 400, tracking: 0.026, mix: 0.7 },
  { weight: 300, tracking: 0.04, mix: 1 },
];

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function relativeParts(dateMs: number, nowMs: number): { label: string; step: number } {
  const ageSec = Math.max(0, (nowMs - dateMs) / 1000);
  if (ageSec < 45) return { label: "just now", step: 0 };
  if (ageSec < HOUR) return { label: `${Math.max(1, Math.round(ageSec / MINUTE))}m`, step: 1 };
  if (ageSec < DAY) return { label: `${Math.round(ageSec / HOUR)}h`, step: 2 };
  const d = new Date(dateMs);
  const now = new Date(nowMs);
  const label = d.toLocaleDateString(
    "en-US",
    d.getFullYear() === now.getFullYear()
      ? { month: "short", day: "numeric" }
      : { month: "short", day: "numeric", year: "numeric" }
  );
  return { label, step: 3 };
}

/** ms until the label is next worth re-checking — slows as age grows. */
function nextDelayMs(ageSec: number): number {
  if (ageSec < 45) return 1000;
  if (ageSec < HOUR) return 15_000;
  if (ageSec < DAY) return 5 * 60_000;
  return 60 * 60_000;
}

function isoDisplay(dateMs: number): string {
  // "2026-07-22 14:32:07Z" — literal ISO moment, tabular-mono, unambiguous.
  return new Date(dateMs).toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "Z");
}

export function DriftStamp({
  date,
  className = "",
}: {
  /** the moment being aged — Date, ISO string, or epoch ms */
  date: Date | string | number;
  className?: string;
}) {
  const dateMs = date instanceof Date ? date.getTime() : new Date(date).getTime();
  const valid = !Number.isNaN(dateMs);

  const timeRef = useRef<HTMLTimeElement>(null);
  const relRef = useRef<HTMLSpanElement>(null);
  const isoRef = useRef<HTMLSpanElement>(null);
  const hoverRef = useRef(false);
  const focusRef = useRef(false);

  // Runs before paint so the very first frame already shows the true age
  // instead of a flash of the SSR-safe "just now" placeholder below.
  useLayoutEffect(() => {
    if (!valid) return;
    const time = timeRef.current;
    const rel = relRef.current;
    const isoEl = isoRef.current;
    if (!time || !rel || !isoEl) return;

    const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = reducedQuery.matches;

    let timer = 0;
    let lastLabel = "";

    // The demo (and any consumer that computes `date` from Date.now() at
    // render) legitimately differs between the server-rendered instant and
    // hydration; the spans carry suppressHydrationWarning, so React keeps the
    // server text — correct all date-derived output here, pre-paint, from the
    // client's own dateMs.
    time.dateTime = new Date(dateMs).toISOString();
    time.setAttribute("aria-description", isoDisplay(dateMs));
    isoEl.textContent = isoDisplay(dateMs);

    const applyStep = () => {
      const now = Date.now();
      const { label, step } = relativeParts(dateMs, now);
      const s = STEPS[step] ?? STEPS[STEPS.length - 1]!;
      if (label !== lastLabel) {
        lastLabel = label;
        rel.textContent = label;
        time.setAttribute("aria-label", label);
      }
      time.style.setProperty("--ds-wght", String(s.weight));
      time.style.letterSpacing = `${s.tracking}em`;
      time.style.color = `color-mix(in srgb, var(--foreground), var(--muted) ${Math.round(s.mix * 100)}%)`;
      const ageSec = Math.max(0, (now - dateMs) / 1000);
      timer = window.setTimeout(applyStep, nextDelayMs(ageSec));
    };

    const applyReveal = () => {
      const showIso = hoverRef.current || focusRef.current;
      const dur = reduced ? 0 : CROSSFADE_MS;
      rel.style.transitionDuration = `${dur}ms`;
      isoEl.style.transitionDuration = `${dur}ms`;
      rel.style.opacity = showIso ? "0" : "1";
      isoEl.style.opacity = showIso ? "1" : "0";
      // The faded-out layer must not swallow hit tests: opacity < 1 creates a
      // stacking context that paints above the normal-flow sibling, and an
      // opacity:0 element is still hit-testable.
      rel.style.pointerEvents = showIso ? "none" : "auto";
      isoEl.style.pointerEvents = showIso ? "auto" : "none";
    };

    const onReducedChange = () => {
      reduced = reducedQuery.matches;
      time.style.transitionDuration = reduced ? "0ms" : `${STEP_MS}ms`;
      applyReveal();
    };
    time.style.transitionDuration = reduced ? "0ms" : `${STEP_MS}ms`;
    reducedQuery.addEventListener("change", onReducedChange);

    const onEnter = () => {
      hoverRef.current = true;
      applyReveal();
    };
    const onLeave = () => {
      hoverRef.current = false;
      applyReveal();
    };
    const onFocus = () => {
      focusRef.current = true;
      applyReveal();
    };
    const onBlur = () => {
      focusRef.current = false;
      applyReveal();
    };

    time.addEventListener("pointerenter", onEnter);
    time.addEventListener("pointerleave", onLeave);
    time.addEventListener("focus", onFocus);
    time.addEventListener("blur", onBlur);

    applyStep();
    applyReveal();

    return () => {
      window.clearTimeout(timer);
      reducedQuery.removeEventListener("change", onReducedChange);
      time.removeEventListener("pointerenter", onEnter);
      time.removeEventListener("pointerleave", onLeave);
      time.removeEventListener("focus", onFocus);
      time.removeEventListener("blur", onBlur);
    };
  }, [dateMs, valid]);

  if (!valid) {
    return (
      <time className={`font-sans text-muted ${className}`} aria-label="invalid date">
        Invalid date
      </time>
    );
  }

  const iso = new Date(dateMs).toISOString();
  // SSR-safe initial paint: computed from dateMs alone (age forced to 0), so
  // server and client render identical markup before the layout effect above
  // corrects it to the real age pre-paint.
  const initialLabel = relativeParts(dateMs, dateMs).label;

  return (
    <time
      ref={timeRef}
      dateTime={iso}
      tabIndex={0}
      data-time-ago-drift
      aria-label={initialLabel}
      aria-description={isoDisplay(dateMs)}
      suppressHydrationWarning
      className={`ns-time-ago-drift inline-grid cursor-default rounded-sm font-sans align-baseline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${className}`}
      style={{ "--ds-wght": STEPS[0].weight } as CSSProperties}
    >
      <span
        ref={relRef}
        aria-hidden
        suppressHydrationWarning
        className="ns-time-ago-drift-layer ns-time-ago-drift-relative tabular-nums"
      >
        {initialLabel}
      </span>
      <span
        ref={isoRef}
        aria-hidden
        suppressHydrationWarning
        data-drift-face="exact"
        className="ns-time-ago-drift-layer pointer-events-none font-mono tabular-nums opacity-0"
      >
        {isoDisplay(dateMs)}
      </span>
      <style>{CSS}</style>
    </time>
  );
}

const CSS = `
.ns-time-ago-drift{
  position: relative;
  font-variation-settings: 'wght' var(--ds-wght, 650);
  font-weight: var(--ds-wght, 650);
  transition-property: font-variation-settings, letter-spacing, color;
  transition-duration: ${STEP_MS}ms;
  transition-timing-function: ${EASE_EXPO};
}
.ns-time-ago-drift-layer{
  grid-area: 1 / 1;
  transition-property: opacity;
  transition-duration: ${CROSSFADE_MS}ms;
  transition-timing-function: ${EASE_EXPO};
}
@media (prefers-reduced-motion: reduce){
  .ns-time-ago-drift{ transition-duration: 0ms !important; }
  .ns-time-ago-drift-layer{ transition-duration: 0ms !important; }
}
`;
