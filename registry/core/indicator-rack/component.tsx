"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// IndicatorRack — a plan selector built on the indicator-tablet rack of a
// pre-electronic cash register (NCR, c. 1900-1950). Every possible reading
// is a separate printed tablet, permanently present, edge-on at the foot of
// its column; pressing a key springs one tablet up into the window while the
// tablet previously showing drops back onto the stack. Changing the reading
// is a SORT — two plates trade places and visibly cross — never a mutation
// of one glyph in place (that's split-flap-board's mechanism; see below).
//
// Four columns (tens / units / cents / term), ten tablets each (digits 0-9),
// all ten always mounted — nothing is created or destroyed on a change, only
// repositioned. Column geometry derives from the container's SMALLER
// dimension: lift = clamp(0.19 * min(w,h), 44, 96)px (the spec's reference
// figures assume a 62px lift). Selecting a plan or a billing term changes
// the digit shown in one or more columns; each changed column runs two
// independent WAAPI animations on its own tablet pair — a spring RAISE
// (40ms latch hold, 210ms lift with a 4px overshoot, 90ms settle = 340ms)
// starting immediately, and a gravity DROP (178ms fall with a 2px
// overshoot-past-rest bounce, 70ms damping = 248ms) starting 25ms later, so
// the latch's release of the old tablet visibly precedes the spring's
// release of the new one — the offset that makes the two plates cross mid
// column instead of trading places invisibly. A rapid re-selection cancels
// whatever is in flight on that column (reading its LIVE computed
// translateY first, so the interrupted plate keeps moving from wherever it
// actually is, never snapping) and re-targets from there; the real DOM
// price text and the aria-live announcement are never gated on the
// animation, they update the instant a selection commits.
//
// Idle, unconditional, always running (this is what keeps the control alive
// at rest with zero input): a 40px shop-light reflection band crosses the
// window every 6.00s; a pivoted "AMT" flag above the window swings ±1.2° on
// a 3.40s period and never damps; a drive-shaft pawl indexes the whole rack
// 0.5px sideways every 1.60s. All three are pure CSS `animation: infinite`
// loops, contrast-capped so none of them competes with the real price text
// sitting outside the window.
//
// prefers-reduced-motion freezes the DECORATIVE rack (aria-hidden) on one
// composed still frame — flag held at its +1.2° extreme, reflection held
// mid-window, and every column's selected tablet held mid-crossing (41px up)
// against a synthetic predecessor (the previous digit, cyclically) held
// mid-fall (22px down) — a pure function of the selected plan and a frozen
// clock, no PRNG, byte-stable over time. The real radios, the real price
// text and the aria-live region are unaffected: the CONTROL stays fully
// functional, only its illustration stops moving and stops literally
// tracking the animation curve.
//
// Distinct from split-flap-board: a flap cell MUTATES in place — one hinged
// leaf rotates through a glyph set, so values it isn't showing don't exist
// on screen. A tablet rack is a SORT — every value is a separate plate
// permanently in frame, and changing the reading costs the travel of two
// plates moving in opposite directions past each other. Distinct from
// counter-carry-ripple: that component is about a carry propagating between
// columns; here the four columns are mechanically independent and read that
// way, no carry ever crosses a column boundary.
// ---------------------------------------------------------------------------

export interface IndicatorRackPlan {
  /** stable identifier, used as the native radio's value */
  value: string;
  label: string;
}

export type IndicatorRackTerm = "monthly" | "annual";

export interface IndicatorRackProps {
  /** accessible name for the plan radiogroup. @default "Plan" */
  label?: string;
  /** the plan options. @default three placeholder plans, Plan A/B/C */
  plans?: IndicatorRackPlan[];
  /** controlled selected plan value */
  value?: string;
  /** initial plan when uncontrolled. @default plans[0]?.value */
  defaultValue?: string;
  /** called with the new plan value when a different plan is selected */
  onValueChange?: (value: string) => void;
  /** controlled billing term */
  term?: IndicatorRackTerm;
  /** initial billing term when uncontrolled. @default "monthly" */
  defaultTerm?: IndicatorRackTerm;
  /** called with the new term when it changes */
  onTermChange?: (term: IndicatorRackTerm) => void;
  /** shared `name` for the plan radios. @default a generated id */
  name?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

type Vars = React.CSSProperties & Record<`--${string}`, string | number>;

const DEFAULT_PLANS: IndicatorRackPlan[] = [
  { value: "a", label: "Plan A" },
  { value: "b", label: "Plan B" },
  { value: "c", label: "Plan C" },
];

// Column digits are an abstract 0-9 alphabet chosen for visual spread, not a
// price — see meta.json / spec §8. Deliberately not 0/1/2 repeats: a rack
// with every column landing on the same digit would read as a fake counter,
// not a mechanism with four independent columns.
const PLAN_DIGITS: Record<string, [number, number, number]> = {
  a: [0, 4, 2],
  b: [1, 9, 7],
  c: [2, 5, 0],
};
const FALLBACK_DIGITS: [number, number, number] = [0, 0, 0];
const TERM_DIGIT: Record<IndicatorRackTerm, number> = { monthly: 0, annual: 1 };

const COLUMN_LABELS = ["TENS", "UNITS", "CENTS", "TERM"] as const;
const TABLET_COUNT = 10;
const STACK_BAND_H = 30; // px — fixed, not derived (spec §3)
const PITCH = 3; // px — fixed pitch between down-stacked tablet edges
const LIFT_RATIO = 0.19;
const LIFT_MIN = 44;
const LIFT_MAX = 96;

const RAISE_LATCH_MS = 40;
const RAISE_SPRING_MS = 210;
const RAISE_SETTLE_MS = 90;
const RAISE_TOTAL_MS = RAISE_LATCH_MS + RAISE_SPRING_MS + RAISE_SETTLE_MS; // 340
const RAISE_OVERSHOOT_PX = 4;
const RAISE_DELAY_MS = 0;

const DROP_FALL_MS = 178;
const DROP_BOUNCE_MS = 70;
const DROP_TOTAL_MS = DROP_FALL_MS + DROP_BOUNCE_MS; // 248
const DROP_BOUNCE_PX = 2;
const DROP_DELAY_MS = 25; // the offset that makes the plates cross

const ANNOUNCE_DEBOUNCE_MS = 350;

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** Reads the tablet's LIVE on-screen translateY (px) from its computed
 * transform matrix, so an interrupted animation can be re-targeted from
 * where the plate actually is rather than snapping to its rest style. */
function readTranslateY(el: HTMLElement): number {
  const t = getComputedStyle(el).transform;
  if (!t || t === "none") return 0;
  const m = t.match(/matrix\(([^)]+)\)/);
  if (!m) return 0;
  const parts = m[1]!.split(",").map((n) => parseFloat(n.trim()));
  return parts[5] ?? 0;
}

function restY(digit: number, lift: number): number {
  return lift + digit * PITCH;
}

interface ColumnHandle {
  tablets: (HTMLDivElement | null)[];
  anims: (Animation | null)[];
  digit: number;
}

function makeColumn(digit: number): ColumnHandle {
  return {
    tablets: new Array(TABLET_COUNT).fill(null),
    anims: new Array(TABLET_COUNT).fill(null),
    digit,
  };
}

export function IndicatorRack({
  label = "Plan",
  plans = DEFAULT_PLANS,
  value,
  defaultValue,
  onValueChange,
  term,
  defaultTerm = "monthly",
  onTermChange,
  name,
  className = "",
}: IndicatorRackProps) {
  const generatedName = useId();
  const groupName = name ?? generatedName;

  const isPlanControlled = value !== undefined;
  const [internalPlan, setInternalPlan] = useState(
    () => defaultValue ?? plans[0]?.value ?? ""
  );
  const committedPlan = isPlanControlled ? (value as string) : internalPlan;
  const activePlan = plans.find((p) => p.value === committedPlan) ?? plans[0];

  const isTermControlled = term !== undefined;
  const [internalTerm, setInternalTerm] = useState<IndicatorRackTerm>(defaultTerm);
  const committedTerm = isTermControlled ? (term as IndicatorRackTerm) : internalTerm;

  const reducedMotion = useReducedMotion();

  const commitPlan = useCallback(
    (v: string) => {
      if (!isPlanControlled) setInternalPlan(v);
      if (v !== committedPlan) onValueChange?.(v);
    },
    [isPlanControlled, committedPlan, onValueChange]
  );
  const commitTerm = useCallback(
    (t: IndicatorRackTerm) => {
      if (!isTermControlled) setInternalTerm(t);
      if (t !== committedTerm) onTermChange?.(t);
    },
    [isTermControlled, committedTerm, onTermChange]
  );

  // -- geometry: derived from the container's smaller dimension -----------
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [lift, setLift] = useState(62);
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box) return;
      const next = clamp(LIFT_RATIO * Math.min(box.width, box.height), LIFT_MIN, LIFT_MAX);
      setLift(next);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const columnWidth = clamp(lift * 0.62, 28, 64);

  // -- rack digits for the current plan + term -----------------------------
  const [tens, units, cents] = PLAN_DIGITS[activePlan?.value ?? ""] ?? FALLBACK_DIGITS;
  const termDigit = TERM_DIGIT[committedTerm];
  const digits = useMemo(() => [tens, units, cents, termDigit], [tens, units, cents, termDigit]);

  const columnsRef = useRef<ColumnHandle[]>(digits.map((d) => makeColumn(d)));

  // -- raise/drop: one column at a time, cancel-and-retarget on interrupt --
  useLayoutEffect(() => {
    if (reducedMotion) {
      columnsRef.current.forEach((col, ci) => {
        col.anims.forEach((a) => a?.cancel());
        col.anims.fill(null);
        col.digit = digits[ci]!;
      });
      return;
    }

    digits.forEach((targetDigit, ci) => {
      const col = columnsRef.current[ci];
      if (!col || col.digit === targetDigit) return;
      const outgoing = col.digit;
      const incoming = targetDigit;
      const outEl = col.tablets[outgoing];
      const inEl = col.tablets[incoming];
      col.digit = targetDigit;

      if (outEl) {
        const fromY = col.anims[outgoing] ? readTranslateY(outEl) : -lift;
        col.anims[outgoing]?.cancel();
        const toRestY = restY(outgoing, lift);
        const anim = outEl.animate(
          [
            { transform: `translateY(${fromY}px)`, offset: 0 },
            {
              transform: `translateY(${toRestY + DROP_BOUNCE_PX}px)`,
              offset: DROP_FALL_MS / DROP_TOTAL_MS,
              easing: "cubic-bezier(0.55,0,1,0.45)",
            },
            { transform: `translateY(${toRestY}px)`, offset: 1, easing: "ease-out" },
          ],
          { duration: DROP_TOTAL_MS, delay: DROP_DELAY_MS, fill: "forwards", easing: "linear" }
        );
        col.anims[outgoing] = anim;
        anim.onfinish = () => {
          if (col.anims[outgoing] === anim) col.anims[outgoing] = null;
        };
      }

      if (inEl) {
        const fromY = col.anims[incoming] ? readTranslateY(inEl) : restY(incoming, lift);
        col.anims[incoming]?.cancel();
        const anim = inEl.animate(
          [
            { transform: `translateY(${fromY}px)`, offset: 0 },
            { transform: `translateY(${fromY}px)`, offset: RAISE_LATCH_MS / RAISE_TOTAL_MS },
            {
              transform: `translateY(${-(lift + RAISE_OVERSHOOT_PX)}px)`,
              offset: (RAISE_LATCH_MS + RAISE_SPRING_MS) / RAISE_TOTAL_MS,
              easing: "cubic-bezier(0.34,1.56,0.64,1)",
            },
            { transform: `translateY(${-lift}px)`, offset: 1, easing: "ease-out" },
          ],
          { duration: RAISE_TOTAL_MS, delay: RAISE_DELAY_MS, fill: "forwards", easing: "linear" }
        );
        col.anims[incoming] = anim;
        anim.onfinish = () => {
          if (col.anims[incoming] === anim) col.anims[incoming] = null;
        };
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits, lift, reducedMotion]);

  useEffect(() => {
    return () => {
      columnsRef.current.forEach((col) => col.anims.forEach((a) => a?.cancel()));
    };
  }, []);

  // -- aria-live: announce on commit only, debounced -----------------------
  const [announceText, setAnnounceText] = useState("");
  const announceTimerRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    window.clearTimeout(announceTimerRef.current);
    announceTimerRef.current = window.setTimeout(() => {
      const billed = committedTerm === "annual" ? "annually" : "monthly";
      setAnnounceText(`${activePlan?.label}, PRICE PLACEHOLDER per month, billed ${billed}.`);
    }, ANNOUNCE_DEBOUNCE_MS);
    return () => window.clearTimeout(announceTimerRef.current);
  }, [activePlan, committedTerm]);

  // -- Home/End roving to the rails (arrows + Space are native on radios) --
  const planInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const termInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const railKeyDown = useCallback(
    (
      e: React.KeyboardEvent<HTMLInputElement>,
      refs: React.MutableRefObject<(HTMLInputElement | null)[]>,
      commit: (v: string) => void,
      values: string[]
    ) => {
      if (e.key !== "Home" && e.key !== "End") return;
      e.preventDefault();
      const idx = e.key === "Home" ? 0 : refs.current.length - 1;
      const el = refs.current[idx];
      if (el) {
        el.focus();
        el.checked = true;
        commit(values[idx]!);
      }
    },
    []
  );

  const billedLabel = committedTerm === "annual" ? "billed annually" : "billed monthly";

  return (
    <div
      ref={rootRef}
      className={`ns-ir-root ${className}`}
      style={{ "--fr-lift": `${lift}px`, "--fr-col-w": `${columnWidth}px` } as Vars}
    >
      <style>{CSS}</style>

      <div className="ns-ir-rack" aria-hidden="true" data-reduced={reducedMotion || undefined}>
        <div className="ns-ir-window">
          {digits.map((selectedDigit, ci) => {
            const predecessor = (selectedDigit + TABLET_COUNT - 1) % TABLET_COUNT;
            return (
              <div className="ns-ir-column" key={ci}>
                <div className="ns-ir-stack">
                  {Array.from({ length: TABLET_COUNT }, (_, digit) => {
                    let reducedTransform: string | undefined;
                    if (reducedMotion) {
                      if (digit === selectedDigit) {
                        reducedTransform = `translateY(${-(41 / 62) * lift}px)`;
                      } else if (digit === predecessor) {
                        reducedTransform = `translateY(${restY(digit, lift) + (22 / 62) * lift}px)`;
                      } else {
                        reducedTransform = `translateY(${restY(digit, lift)}px)`;
                      }
                    }
                    return (
                      <div
                        key={digit}
                        ref={(el) => {
                          columnsRef.current[ci].tablets[digit] = el;
                        }}
                        className="ns-ir-tablet"
                        style={{
                          transform:
                            reducedTransform ??
                            `translateY(${digit === selectedDigit ? -lift : restY(digit, lift)}px)`,
                        }}
                      >
                        <span>{digit}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div className="ns-ir-reflection" />
        </div>
        <div className="ns-ir-flag" />
        <div className="ns-ir-labels">
          {COLUMN_LABELS.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
      </div>

      <div className="ns-ir-controls">
        <div role="radiogroup" aria-label={label} className="ns-ir-radiogroup">
          {plans.map((p, i) => (
            <label key={p.value} className="ns-ir-option">
              <input
                ref={(el) => {
                  planInputRefs.current[i] = el;
                }}
                type="radio"
                className="ns-ir-input"
                name={groupName}
                value={p.value}
                checked={p.value === committedPlan}
                onChange={() => commitPlan(p.value)}
                onKeyDown={(e) =>
                  railKeyDown(e, planInputRefs, commitPlan, plans.map((o) => o.value))
                }
              />
              <span className="ns-ir-option-face">{p.label}</span>
            </label>
          ))}
        </div>

        <div role="radiogroup" aria-label="Billing term" className="ns-ir-radiogroup ns-ir-radiogroup-term">
          {(["monthly", "annual"] as IndicatorRackTerm[]).map((t, i) => (
            <label key={t} className="ns-ir-option ns-ir-option-term">
              <input
                ref={(el) => {
                  termInputRefs.current[i] = el;
                }}
                type="radio"
                className="ns-ir-input"
                name={`${groupName}-term`}
                value={t}
                checked={t === committedTerm}
                onChange={() => commitTerm(t)}
                onKeyDown={(e) =>
                  railKeyDown(e, termInputRefs, (v) => commitTerm(v as IndicatorRackTerm), ["monthly", "annual"])
                }
              />
              <span className="ns-ir-option-face">{t === "monthly" ? "Monthly" : "Annual"}</span>
            </label>
          ))}
        </div>

        <p className="ns-ir-price">
          <span className="ns-ir-price-plan">{activePlan?.label}</span>
          <span className="ns-ir-price-word">PRICE</span>
          <span className="ns-ir-price-meta">per month, {billedLabel}</span>
        </p>

        <div className="ns-ir-actions">
          <button type="button" className="ns-ir-cta">
            Primary action
          </button>
          <button type="button" className="ns-ir-link">
            Secondary link
          </button>
        </div>
      </div>

      <div role="status" aria-live="polite" aria-atomic="true" className="ns-ir-sr-only">
        {announceText}
      </div>
    </div>
  );
}

const CSS = `
.ns-ir-root{
  display:flex;
  flex-direction:column;
  gap:16px;
  container-type:inline-size;
}
.ns-ir-sr-only{
  position:absolute;
  width:1px;height:1px;
  padding:0;margin:-1px;
  overflow:hidden;
  clip:rect(0,0,0,0);
  white-space:nowrap;
  border:0;
}
.ns-ir-rack{
  position:relative;
  align-self:flex-start;
  padding:10px 10px 4px;
  border:1px solid var(--border);
  border-radius:8px;
  background:var(--background);
}
.ns-ir-window{
  position:relative;
  display:flex;
  gap:calc(var(--fr-col-w) * 0.14);
  height:calc(var(--fr-lift) + ${STACK_BAND_H}px);
  overflow:hidden;
  border-radius:4px;
}
.ns-ir-column{
  position:relative;
  width:var(--fr-col-w);
  height:100%;
  overflow:hidden;
  border-left:1px solid color-mix(in oklab, var(--ns-muted) 30%, transparent);
}
.ns-ir-column:first-child{ border-left:none; }
.ns-ir-stack{
  position:relative;
  width:100%;
  height:100%;
}
.ns-ir-tablet{
  position:absolute;
  top:0;
  left:0;
  width:100%;
  height:var(--fr-lift);
  display:flex;
  align-items:flex-start;
  justify-content:center;
  padding-top:4px;
  box-sizing:border-box;
  background:var(--background);
  color:var(--foreground);
  border-top:1px solid color-mix(in oklab, var(--ns-muted) 55%, transparent);
  border-bottom:1px solid color-mix(in oklab, var(--ns-muted) 40%, transparent);
  font-family:var(--font-geist-mono, ui-monospace, monospace);
  font-size:calc(var(--fr-col-w) * 0.42);
  font-variant-numeric:tabular-nums;
  will-change:transform;
}
.ns-ir-reflection{
  position:absolute;
  top:0;
  left:-40px;
  width:40px;
  height:100%;
  background:linear-gradient(
    90deg,
    transparent,
    color-mix(in oklab, var(--background) 90%, var(--foreground) 10%),
    transparent
  );
  mix-blend-mode:overlay;
  opacity:0.35;
  pointer-events:none;
  animation:ns-ir-reflect 6s linear infinite;
}
.dark .ns-ir-reflection{
  background:linear-gradient(
    90deg,
    transparent,
    color-mix(in oklab, var(--foreground) 90%, var(--background) 10%),
    transparent
  );
}
@keyframes ns-ir-reflect{
  from{ transform:translateX(0); }
  to{ transform:translateX(196px); }
}
.ns-ir-flag{
  position:absolute;
  top:-6px;
  right:14px;
  width:2px;
  height:16px;
  background:var(--ns-muted);
  transform-origin:top center;
  animation:ns-ir-flag 3.4s ease-in-out infinite;
}
@keyframes ns-ir-flag{
  0%,100%{ transform:rotate(1.2deg); }
  50%{ transform:rotate(-1.2deg); }
}
.ns-ir-rack:not([data-reduced]) .ns-ir-window{
  animation:ns-ir-tick 3.2s ease-in-out infinite;
}
@keyframes ns-ir-tick{
  0%,7%{ transform:translateX(0); }
  50%{ transform:translateX(0.5px); }
  57%,100%{ transform:translateX(0.5px); }
}
.ns-ir-rack[data-reduced] .ns-ir-reflection{
  animation:none;
  transform:translateX(9px);
  opacity:0.35;
}
.ns-ir-rack[data-reduced] .ns-ir-flag{
  animation:none;
  transform:rotate(1.2deg);
}
.ns-ir-rack[data-reduced] .ns-ir-window{
  animation:none;
}
.ns-ir-labels{
  display:flex;
  gap:calc(var(--fr-col-w) * 0.14);
  margin-top:4px;
}
.ns-ir-labels span{
  width:var(--fr-col-w);
  font-family:var(--font-geist-mono, ui-monospace, monospace);
  font-size:8px;
  letter-spacing:0.1em;
  text-align:center;
  color:var(--ns-muted);
}

.ns-ir-controls{
  display:flex;
  flex-direction:column;
  gap:12px;
}
.ns-ir-radiogroup{
  display:flex;
  gap:6px;
  flex-wrap:wrap;
}
.ns-ir-option{
  position:relative;
  cursor:pointer;
  -webkit-tap-highlight-color:transparent;
}
.ns-ir-input{
  position:absolute;
  width:1px;height:1px;
  padding:0;margin:-1px;
  overflow:hidden;
  clip:rect(0,0,0,0);
  white-space:nowrap;
  border:0;
}
.ns-ir-option-face{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-height:36px;
  padding:6px 14px;
  border:1px solid var(--border);
  border-radius:6px;
  font-size:0.8125rem;
  color:var(--ns-muted);
  transition:color 140ms ease, border-color 140ms ease, background-color 140ms ease;
}
.ns-ir-input:checked + .ns-ir-option-face{
  color:var(--foreground);
  border-color:var(--foreground);
  background:color-mix(in oklab, var(--foreground) 5%, transparent);
}
.ns-ir-input:focus-visible + .ns-ir-option-face{
  outline:2px solid var(--ns-accent);
  outline-offset:2px;
}
.ns-ir-option-term .ns-ir-option-face{ min-height:32px; padding:5px 12px; font-size:0.75rem; }

.ns-ir-price{
  display:flex;
  align-items:baseline;
  gap:8px;
  margin:0;
}
.ns-ir-price-plan{
  font-size:0.75rem;
  color:var(--ns-muted);
}
.ns-ir-price-word{
  font-family:var(--font-geist-mono, ui-monospace, monospace);
  font-size:1.05rem;
  font-weight:500;
  color:var(--foreground);
  letter-spacing:0.04em;
}
.ns-ir-price-meta{
  font-size:0.75rem;
  color:var(--ns-muted);
}

.ns-ir-actions{
  display:flex;
  align-items:center;
  gap:14px;
}
.ns-ir-cta{
  min-height:40px;
  padding:0 18px;
  border:1px solid var(--ns-accent);
  border-radius:6px;
  background:var(--ns-accent);
  color:var(--background);
  font-size:0.8125rem;
  font-weight:500;
  cursor:pointer;
}
.ns-ir-cta:focus-visible{
  outline:2px solid var(--ns-accent);
  outline-offset:2px;
}
.ns-ir-link{
  border:none;
  background:none;
  padding:0;
  font-size:0.8125rem;
  color:var(--ns-muted);
  text-decoration:underline;
  text-underline-offset:3px;
  cursor:pointer;
}
.ns-ir-link:focus-visible{
  outline:2px solid var(--ns-accent);
  outline-offset:2px;
}

@media (prefers-reduced-motion: reduce){
  .ns-ir-tablet{ transition:none !important; }
}
`;
