"use client";

import { useEffect, useId, useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// BrineFloat — a pricing section built as one shallow tank. A single SVG
// water line runs behind the whole tier row (a low-amplitude two-segment
// sine path that slowly morphs between itself and its mirror over 10s); each
// tier card is a hydrometer float riding in it. Buoyancy, not the beam or
// lever metaphor: every card gets its own fixed "weight class" (cheaper
// tiers are heavier and sit lower, the recommended tier is deliberately the
// lightest so it rides highest regardless of price rank) and the billing
// toggle changes the brine's density — every float eases to a new
// equilibrium on a spring curve with one visible overshoot (~600ms
// back-out), so a price change is FELT as buoyancy rather than read as a
// number swap. Two nested transforms per card: an outer wrapper carries the
// equilibrium position (transitions on billing change and on hover, both
// through the same spring easing) and an inner wrapper carries a small
// continuous idle bob (±3px, per-card duration/delay so phases never lock).
// Both are transform-only and pure CSS — no rAF loop, no canvas. The billing
// switch is a native role=switch; its aria-checked announcement plus the
// visible price text carries the change, so nothing needs a live region.
// ---------------------------------------------------------------------------

export type BrineTier = {
  name: string;
  tagline: string;
  /** USD per month at monthly billing */
  monthlyPrice: number;
  cta: string;
  features: string[];
  /**
   * Buoyancy weight class, 0..1. 1 = heaviest (sinks lowest), 0 = lightest
   * (rides highest). Cheaper tiers are conventionally heavier; the
   * recommended tier is given the lowest weight of the three so it always
   * rides above the others regardless of where its price falls.
   */
  weight: number;
  recommended?: boolean;
};

const DEFAULT_TIERS: BrineTier[] = [
  {
    name: "Starter",
    tagline: "Dip a toe in",
    monthlyPrice: 9,
    cta: "Start free",
    weight: 1,
    features: ["1 workspace", "Community support", "3 day history"],
  },
  {
    name: "Crew",
    tagline: "For teams that ship weekly",
    monthlyPrice: 29,
    cta: "Start Crew",
    weight: 0.12,
    recommended: true,
    features: ["Unlimited workspaces", "Priority support", "90 day history"],
  },
  {
    name: "Fleet",
    tagline: "Every seat, every project",
    monthlyPrice: 79,
    cta: "Talk to sales",
    weight: 0.55,
    features: ["Unlimited seats", "SSO + audit log", "Unlimited history"],
  },
];

// -- tank geometry (px) ------------------------------------------------------
const SINK_MIN = -14; // px — most a float can ride above the baseline
const SINK_SPAN = 40; // px — full weight-class travel at monthly density
const DENSITY: Record<"monthly" | "annual", number> = {
  monthly: 1,
  annual: 0.55, // annual = cheaper effective price = thinner brine = everything lighter
};

function equilibriumPx(weight: number, billing: "monthly" | "annual") {
  return SINK_MIN + weight * DENSITY[billing] * SINK_SPAN;
}

// -- SVG water line: a two-segment cubic-bezier sine approximation, morphed
// between itself and its vertical mirror over a 10s loop ------------------
const WAVE_W = 100;
const WAVE_MID = 12;
const WAVE_AMP = 3.2;

function wavePath(amp: number) {
  const w = WAVE_W;
  const m = WAVE_MID;
  return `M0,${m} C${w * 0.25},${m - amp} ${w * 0.25},${m - amp} ${w * 0.5},${m} C${w * 0.75},${m + amp} ${w * 0.75},${m + amp} ${w},${m}`;
}

const WAVE_A = wavePath(WAVE_AMP);
const WAVE_B = wavePath(-WAVE_AMP);

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

// per-card bob timing — fixed, distinct values so the three phases never lock
const BOB = [
  { dur: 4.4, delay: 0 },
  { dur: 5.6, delay: 0.9 },
  { dur: 5.1, delay: 1.7 },
];

export function BrineFloat({
  tiers = DEFAULT_TIERS,
  annualMultiplier = 0.8,
  className = "",
}: {
  tiers?: BrineTier[];
  /** annual billing price multiplier applied to the monthly-equivalent shown, 0.8 = 20% off */
  annualMultiplier?: number;
  className?: string;
}) {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const reduced = useReducedMotion();
  const switchId = useId();
  const annual = billing === "annual";

  const priceOf = (t: BrineTier) =>
    annual ? Math.round(t.monthlyPrice * annualMultiplier) : t.monthlyPrice;

  const wave = useMemo(
    () => (reduced ? WAVE_A : `${WAVE_A};${WAVE_B};${WAVE_A}`),
    [reduced]
  );

  return (
    <div className={`relative w-full ${className}`}>
      <style>{CSS}</style>

      <div className="mb-10 flex items-center justify-center gap-3">
        <span
          id={`${switchId}-monthly`}
          className={`font-mono text-xs uppercase tracking-widest transition-colors duration-150 ${
            !annual ? "text-foreground" : "text-ns-muted"
          }`}
        >
          Monthly
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={annual}
          aria-labelledby={`${switchId}-monthly ${switchId}-annual`}
          onClick={() => setBilling(annual ? "monthly" : "annual")}
          className="bf-track relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-border bg-background transition-colors duration-150 hover:border-foreground/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
        >
          <span
            aria-hidden="true"
            className="bf-thumb block h-4 w-4 rounded-full bg-foreground"
            style={{ transform: annual ? "translateX(21px)" : "translateX(3px)" }}
          />
        </button>
        <span
          id={`${switchId}-annual`}
          className={`font-mono text-xs uppercase tracking-widest transition-colors duration-150 ${
            annual ? "text-foreground" : "text-ns-muted"
          }`}
        >
          Annual <span className="text-foreground">−{Math.round((1 - annualMultiplier) * 100)}%</span>
        </span>
      </div>

      <div className="relative pt-6 pb-12">
        <svg
          aria-hidden="true"
          preserveAspectRatio="none"
          viewBox={`0 0 ${WAVE_W} 24`}
          className="pointer-events-none absolute inset-x-0 top-1/2 h-12 w-full -translate-y-1/2 text-border"
        >
          <path d={WAVE_A} fill="none" stroke="currentColor" strokeWidth={0.6} vectorEffect="non-scaling-stroke">
            {!reduced ? (
              <animate
                attributeName="d"
                values={wave}
                dur="10s"
                repeatCount="indefinite"
                calcMode="spline"
                keyTimes="0;0.5;1"
                keySplines="0.42 0 0.58 1;0.42 0 0.58 1"
              />
            ) : null}
          </path>
        </svg>

        <div className="relative flex justify-center gap-5 overflow-x-auto px-1">
          {tiers.map((tier, i) => {
            const bob = BOB[i % BOB.length]!;
            const price = priceOf(tier);
            return (
              <div
                key={tier.name}
                className="bf-eq shrink-0"
                style={{ "--eq": `${equilibriumPx(tier.weight, billing)}px` } as React.CSSProperties}
              >
                <div
                  className="bf-bob"
                  style={{ "--bob-dur": `${bob.dur}s`, "--bob-delay": `${bob.delay}s` } as React.CSSProperties}
                >
                  <article className="flex w-64 flex-col gap-4 rounded-md border border-border bg-background p-5">
                    <header>
                      <div className="flex items-center gap-2">
                        <h3 className="font-mono text-xs uppercase tracking-widest text-foreground">
                          {tier.name}
                        </h3>
                        {tier.recommended ? (
                          <span className="rounded-full border border-foreground/30 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-foreground">
                            Recommended
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-ns-muted">{tier.tagline}</p>
                    </header>
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-semibold tracking-tight tabular-nums text-foreground">
                          ${price}
                        </span>
                        <span className="text-sm text-ns-muted">/mo</span>
                      </div>
                      <p className="mt-1 h-3.5 font-mono text-[10px] uppercase tracking-widest text-ns-muted">
                        {annual ? "billed annually" : "billed monthly"}
                      </p>
                    </div>
                    <ul className="flex flex-col gap-1.5">
                      {tier.features.map((f) => (
                        <li key={f} className="text-[13px] text-ns-muted">
                          {f}
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      aria-label={`${tier.cta} — ${tier.name}`}
                      className={
                        tier.recommended
                          ? "mt-1 rounded-sm bg-ns-accent px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-ns-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
                          : "mt-1 rounded-sm border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors duration-200 hover:border-foreground/25 hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
                      }
                    >
                      {tier.cta}
                    </button>
                  </article>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const CSS = `
.bf-eq {
  transform: translateY(calc(var(--eq) + var(--bf-hover, 0px)));
  transition: transform 600ms cubic-bezier(0.34, 1.56, 0.64, 1);
  will-change: transform;
}
.bf-eq:hover,
.bf-eq:focus-within {
  --bf-hover: 4px;
}
.bf-bob {
  animation: bf-bob-kf var(--bob-dur, 5s) ease-in-out var(--bob-delay, 0s) infinite;
}
@keyframes bf-bob-kf {
  0%, 100% { transform: translateY(0px); }
  25% { transform: translateY(-3px); }
  75% { transform: translateY(3px); }
}
.bf-thumb {
  transition: transform 600ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
@media (prefers-reduced-motion: reduce) {
  .bf-eq { transition: none; }
  .bf-bob { animation: none !important; transform: none !important; }
  .bf-thumb { transition: none !important; }
}
`;
