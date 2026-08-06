"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// CounterpoiseTiers — two pricing tiers rendered as the pans of a literal
// balance scale. A Canvas 2D layer draws the fulcrum, beam, and chains as 2px
// strokes; the pans are real DOM pricing cards hung from the beam ends and
// positioned every frame via offset transforms from the container center.
// Billing toggle and feature checkboxes add weight (weight = price/10 +
// enabled feature count); the beam angle integrates a torque spring
// (θ'' = -42(θ - θ_target) - 5.5θ') for exactly one visible overshoot, with a
// hard 2s forced-settle deadline so stacked rapid toggles always resolve.
// Idle default look is a ±0.4° ambient sway (~6s period, jittered per mount
// plus a slow secondary harmonic so it never reads as a metronome), suppressed
// for 4s after any interaction. A mono verdict caption under the fulcrum updates
// on settle, never mid-swing. Direct-DOM rAF hot path, refs only.
// ---------------------------------------------------------------------------

export type CounterpoiseFeature = { label: string; included: boolean };

export type CounterpoiseTier = {
  name: string;
  tagline: string;
  /** USD per month at monthly billing */
  monthlyPrice: number;
  cta: string;
  /** primary tier gets the --ns-accent CTA; accent appears nowhere else */
  primary?: boolean;
  features: CounterpoiseFeature[];
};

const STARTER: CounterpoiseTier = {
  name: "Starter",
  tagline: "For weekend projects",
  monthlyPrice: 19,
  cta: "Start free",
  features: [
    { label: "3 projects", included: true },
    { label: "Community support", included: true },
    { label: "1 GB storage", included: true },
    { label: "Custom domain", included: false },
    { label: "API access", included: false },
    { label: "Usage analytics", included: false },
  ],
};

const PRO: CounterpoiseTier = {
  name: "Pro",
  tagline: "For teams with deadlines",
  monthlyPrice: 49,
  cta: "Go Pro",
  primary: true,
  features: [
    { label: "Unlimited projects", included: true },
    { label: "Priority support", included: true },
    { label: "100 GB storage", included: true },
    { label: "Custom domains", included: true },
    { label: "API access", included: true },
    { label: "SSO + audit log", included: false },
  ],
};

// -- physics + geometry constants -------------------------------------------
const STIFF = 42; // s^-2 — spring stiffness
const DAMP = 5.5; // s^-1 — one visible overshoot, settle < 1.4s
const DEADLINE_MS = 2000; // forced-settle snap
const MAX_TILT = (9 * Math.PI) / 180; // tilt clamp ±9°
const TILT_PER_UNIT = 0.028; // rad per weight unit of imbalance
const AMB_AMP = (0.4 * Math.PI) / 180; // idle sway ±0.4°
const AMB_PERIOD = 6000; // base sway period (jittered per mount, see engine)
const SUPPRESS_MS = 4000; // sway suppressed after any interaction
const OMEGA_EPS = 0.001; // rad/s sleep threshold
const THETA_EPS = 0.0008; // rad — "at target" threshold
const PIVOT_Y = 46; // beam pivot y inside the stage
const CHAIN = 46; // chain length from beam end to card top
const LAG_GAIN = 0.3; // pan swing lag vs angular velocity (level at rest)
const LAG_MAX = 0.09; // rad — pan lag clamp during hard swings

type Model = { wL: number; wR: number; verdict: string };
type Engine = { retarget: () => void; setBias: (bias: number) => void };

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function CounterpoiseTiers({
  left = STARTER,
  right = PRO,
  annualMultiplier = 0.8,
  className = "",
}: {
  /** tier hung from the left pan */
  left?: CounterpoiseTier;
  /** tier hung from the right pan */
  right?: CounterpoiseTier;
  /** annual billing price multiplier (0.8 = 20% off) */
  annualMultiplier?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}) {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [checkedL, setCheckedL] = useState<boolean[]>(() =>
    left.features.map((f) => f.included)
  );
  const [checkedR, setCheckedR] = useState<boolean[]>(() =>
    right.features.map((f) => f.included)
  );

  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapLRef = useRef<HTMLDivElement>(null);
  const wrapRRef = useRef<HTMLDivElement>(null);
  const cardLRef = useRef<HTMLDivElement>(null);
  const cardRRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLParagraphElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const modelRef = useRef<Model>({ wL: 0, wR: 0, verdict: "" });

  const priceOf = (t: CounterpoiseTier) =>
    billing === "annual"
      ? Math.round(t.monthlyPrice * annualMultiplier)
      : t.monthlyPrice;
  const pL = priceOf(left);
  const pR = priceOf(right);

  // weight = monthlyPrice/10 + enabled feature count — the beam's whole truth
  const model = useMemo<Model>(() => {
    const cL = checkedL.filter(Boolean).length;
    const cR = checkedR.filter(Boolean).length;
    const wL = pL / 10 + cL;
    const wR = pR / 10 + cR;
    const d = wL - wR;
    let verdict: string;
    if (Math.abs(d) < 0.05) {
      verdict = `${left.name} and ${right.name} are perfectly balanced`;
    } else {
      const heavy = d > 0 ? left : right;
      const light = d > 0 ? right : left;
      const featDiff = d > 0 ? cL - cR : cR - cL;
      const priceDiff = d > 0 ? pL - pR : pR - pL;
      verdict =
        featDiff > 0
          ? `${heavy.name} outweighs ${light.name} by ${featDiff} feature${featDiff === 1 ? "" : "s"}`
          : `${heavy.name} outweighs ${light.name} by $${priceDiff}/mo of heft`;
    }
    return { wL, wR, verdict };
  }, [checkedL, checkedR, pL, pR, left, right]);
  modelRef.current = model;

  // any weight change re-targets the beam through the same spring
  useEffect(() => {
    engineRef.current?.retarget();
  }, [model]);

  // -- engine: canvas + spring + ambient sway, all outside React -------------
  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    const wrapL = wrapLRef.current;
    const wrapR = wrapRRef.current;
    const cardL = cardLRef.current;
    const cardR = cardRRef.current;
    const caption = captionRef.current;
    if (!stage || !canvas || !wrapL || !wrapR || !cardL || !cardR || !caption)
      return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // -- inks parsed from tokens at mount, re-derived live on theme flip -----
    let inkFg = "#ededed";
    let inkBorder = "#2e2e2e";
    const derive = () => {
      const cs = getComputedStyle(document.documentElement);
      const pick = (name: string, fb: string) => {
        const v = cs.getPropertyValue(name).trim();
        return v || fb;
      };
      inkFg = pick("--foreground", "#ededed");
      inkBorder = pick("--border", "#2e2e2e");
    };
    derive();

    // -- geometry (recomputed on resize, guarded against zero size) ----------
    let w = 0;
    let h = 0;
    let dpr = 1;
    let cx = 0;
    let armL = 0; // beam half-span
    let cardW = 0;
    let groundY = 0;
    let sized = false;

    const resize = () => {
      const rect = stage.getBoundingClientRect();
      if (rect.width < 40) {
        sized = false; // zero-size guard — loop no-ops until real
        return;
      }
      const nw = rect.width;
      const nCardW = Math.round(clamp((nw - 90) / 2, 150, 288));
      // conditional writes only — keeps the ResizeObserver from looping
      if (wrapL.style.width !== `${nCardW}px`) {
        wrapL.style.width = `${nCardW}px`;
        wrapR.style.width = `${nCardW}px`;
      }
      const cardH = Math.max(cardL.offsetHeight, cardR.offsetHeight);
      const nArm = Math.min((nw - nCardW) / 2 - 6, nCardW / 2 + 40);
      const maxDrop = nArm * Math.sin(MAX_TILT);
      const nGroundY = Math.round(PIVOT_Y + maxDrop + CHAIN + cardH + 14);
      const nh = nGroundY + 40;
      w = nw;
      h = nh;
      cardW = nCardW;
      armL = nArm;
      groundY = nGroundY;
      cx = w / 2;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      const heightPx = `${h}px`;
      if (stage.style.height !== heightPx) stage.style.height = heightPx;
      caption.style.top = `${groundY + 12}px`;
      // canvas is a replaced element: explicit style w/h + dpr backing store
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      wrapL.style.transformOrigin = `50% ${-CHAIN}px`;
      wrapR.style.transformOrigin = `50% ${-CHAIN}px`;
      sized = true;
    };
    resize();

    // -- full clear + restroke every tick: no accumulation compositing -------
    const render = (thVis: number) => {
      if (!sized) return;
      const cos = Math.cos(thVis);
      const sin = Math.sin(thVis);
      // pans counter-rotate against the beam to hang level; angular velocity
      // adds a clamped pendulum lag so the swing reads as inertia
      const rotDeg =
        (-clamp(om * LAG_GAIN, -LAG_MAX, LAG_MAX) * 180) / Math.PI;

      // pan cards: OFFSET transforms from the container center, never
      // absolute canvas coordinates
      const ends: [number, number][] = [];
      const tops: [number, number][] = [];
      for (const s of [-1, 1] as const) {
        const ex = cx + s * armL * cos;
        const ey = PIVOT_Y + s * armL * sin;
        const x = ex - cardW / 2;
        const y = ey + CHAIN;
        ends.push([ex, ey]);
        tops.push([x, y]);
        const wrap = s === -1 ? wrapL : wrapR;
        wrap.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${rotDeg}deg)`;
        if (wrap.style.opacity !== "1") wrap.style.opacity = "1";
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 2;
      ctx.lineCap = "round";

      // fulcrum column + base + hatch — --border ink
      ctx.strokeStyle = inkBorder;
      ctx.beginPath();
      ctx.moveTo(cx - 5, PIVOT_Y + 8);
      ctx.lineTo(cx - 15, groundY);
      ctx.moveTo(cx + 5, PIVOT_Y + 8);
      ctx.lineTo(cx + 15, groundY);
      ctx.moveTo(cx - 44, groundY);
      ctx.lineTo(cx + 44, groundY);
      for (let i = 0; i < 7; i++) {
        const hx = cx - 38 + i * 12;
        ctx.moveTo(hx + 8, groundY + 1);
        ctx.lineTo(hx, groundY + 9);
      }
      // chains: beam end down to the pan card's top corners
      for (const s of [0, 1] as const) {
        const [ex, ey] = ends[s]!;
        const [tx, ty] = tops[s]!;
        ctx.moveTo(ex, ey + 3);
        ctx.lineTo(tx + 14, ty + 2);
        ctx.moveTo(ex, ey + 3);
        ctx.lineTo(tx + cardW - 14, ty + 2);
      }
      ctx.stroke();

      // beam + pivot + end hooks — --foreground ink
      ctx.strokeStyle = inkFg;
      ctx.beginPath();
      ctx.moveTo(ends[0]![0], ends[0]![1]);
      ctx.lineTo(ends[1]![0], ends[1]![1]);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, PIVOT_Y, 4.5, 0, Math.PI * 2);
      ctx.stroke();
      for (const [ex, ey] of ends) {
        ctx.beginPath();
        ctx.arc(ex, ey + 1, 2.5, 0, Math.PI * 2);
        ctx.stroke();
      }
    };

    // -- spring state: locals only, never React state ------------------------
    let th = 0;
    let om = 0;
    let bias = 0; // hover preview tilt bias, ±0.3°
    let target = 0;
    let raf = 0;
    let last = 0;
    let onscreen = true;
    let pendingSettle = true;
    let interactionAt = performance.now();
    let deadlineAt = interactionAt + DEADLINE_MS;
    let ramp = 0; // ambient sway ramp 0..1
    let wakeTimer = 0;
    // ambient sway jitter — randomized once per mount so the idle sway never
    // reads as a metronomic, perfectly-repeating cycle
    const ambPeriod = AMB_PERIOD * (0.9 + Math.random() * 0.2); // 5400-6600ms
    const ambPhase = Math.random() * Math.PI * 2;
    const amb2Period = ambPeriod * 2.37; // slow secondary harmonic, non-integer ratio
    const amb2Phase = Math.random() * Math.PI * 2;

    const computeTarget = () => {
      const m = modelRef.current;
      return clamp(
        (m.wR - m.wL) * TILT_PER_UNIT + bias,
        -MAX_TILT,
        MAX_TILT
      );
    };

    const setCaption = () => {
      caption.textContent = modelRef.current.verdict;
    };

    const loop = (now: number) => {
      raf = 0;
      if (!onscreen || document.hidden || !sized) {
        last = 0;
        return; // paused offscreen/hidden — observers wake us
      }
      const dt = last === 0 ? 1 / 60 : Math.min(0.033, (now - last) / 1000);
      last = now;
      const suppressed = now - interactionAt < SUPPRESS_MS;

      // beam torque spring, semi-implicit Euler
      om += (-STIFF * (th - target) - DAMP * om) * dt;
      th += om * dt;
      // forced-settle deadline: stacked rapid toggles always resolve
      if (pendingSettle && now >= deadlineAt) {
        th = target;
        om = 0;
      }
      const settled =
        Math.abs(om) < OMEGA_EPS && Math.abs(th - target) < THETA_EPS;
      if (pendingSettle && settled) {
        pendingSettle = false;
        setCaption(); // verdict lands on settle, never mid-swing
      }

      // ambient sway: the default look, suppressed 4s after any interaction
      ramp = suppressed
        ? Math.max(0, ramp - dt / 0.4)
        : Math.min(1, ramp + dt / 1.5);
      const sway =
        (Math.sin((now / ambPeriod) * Math.PI * 2 + ambPhase) +
          0.35 * Math.sin((now / amb2Period) * Math.PI * 2 + amb2Phase)) /
        1.35;
      const thVis = th + ramp * AMB_AMP * sway;
      render(thVis);

      // sleep: settled, no pending target, and sway suppressed — schedule a
      // timed wake for when the suppression window ends
      if (!pendingSettle && settled && suppressed && ramp === 0) {
        const remain = SUPPRESS_MS - (now - interactionAt);
        window.clearTimeout(wakeTimer);
        wakeTimer = window.setTimeout(wake, Math.max(16, remain + 30));
        last = 0;
        return; // raf stays 0 — genuinely asleep
      }
      raf = requestAnimationFrame(loop);
    };

    const wake = () => {
      if (!raf && !reduced) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    const retarget = () => {
      target = computeTarget();
      interactionAt = performance.now();
      deadlineAt = interactionAt + DEADLINE_MS;
      pendingSettle = true;
      if (reduced) {
        // discrete: beam rendered instantly at the settled angle, no sway
        th = target;
        om = 0;
        pendingSettle = false;
        render(th);
        setCaption();
        return;
      }
      wake();
    };

    engineRef.current = {
      retarget,
      setBias: (b: number) => {
        bias = b;
        retarget();
      },
    };

    // initial state
    target = computeTarget();
    if (reduced) {
      th = target;
      pendingSettle = false;
      render(th);
      setCaption();
    } else {
      render(0); // hung level, then the spring swings it to the verdict
      wake();
    }

    // -- observers -----------------------------------------------------------
    const ro = new ResizeObserver(() => {
      resize();
      render(th);
    });
    ro.observe(stage);
    ro.observe(cardL);
    ro.observe(cardR);
    const io = new IntersectionObserver((entries) => {
      onscreen = entries[0]?.isIntersecting ?? true;
      if (onscreen) wake();
    });
    io.observe(stage);
    const mo = new MutationObserver(() => {
      derive(); // live theme re-derive
      render(th);
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
      raf = 0;
      window.clearTimeout(wakeTimer);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      engineRef.current = null;
    };
    // geometry + physics are prop-independent; weights flow through modelRef
  }, []);

  const discountLabel = `−${Math.round((1 - annualMultiplier) * 100)}%`;

  const segClass = (active: boolean) =>
    active
      ? "rounded-[4px] border border-border bg-background px-3 py-1.5 font-mono text-[11px] tracking-widest text-foreground transition-colors duration-150 hover:border-foreground/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
      : "rounded-[4px] border border-transparent px-3 py-1.5 font-mono text-[11px] tracking-widest text-ns-muted transition-colors duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent";

  const renderCard = (side: "left" | "right") => {
    const tier = side === "left" ? left : right;
    const checked = side === "left" ? checkedL : checkedR;
    const setChecked = side === "left" ? setCheckedL : setCheckedR;
    const price = side === "left" ? pL : pR;
    const weight = side === "left" ? model.wL : model.wR;
    const wrapRef = side === "left" ? wrapLRef : wrapRRef;
    const cardRef = side === "left" ? cardLRef : cardRRef;
    // hover previews a +0.3° tilt bias toward this pan
    const hoverBias = (side === "left" ? -1 : 1) * (0.3 * Math.PI) / 180;

    return (
      <div
        ref={wrapRef}
        className="absolute left-0 top-0 will-change-transform"
        style={{ opacity: 0 }}
      >
        <div
          ref={cardRef}
          onPointerEnter={() => engineRef.current?.setBias(hoverBias)}
          onPointerLeave={() => engineRef.current?.setBias(0)}
          className="flex flex-col gap-4 rounded-md border border-border bg-surface p-5 transition-[translate,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-lg hover:shadow-black/25"
        >
          <header className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-mono text-xs tracking-widest text-foreground uppercase">
                {tier.name}
              </h3>
              <p className="mt-1 text-xs text-ns-muted">{tier.tagline}</p>
            </div>
            <span className="rounded-sm border border-border px-1.5 py-0.5 font-mono text-[10px] tabular-nums tracking-wider text-ns-muted">
              wt {weight.toFixed(1)}
            </span>
          </header>
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-semibold tracking-tight tabular-nums text-foreground">
                ${price}
              </span>
              <span className="text-sm text-ns-muted">/mo</span>
            </div>
            <p className="mt-1 h-3.5 font-mono text-[10px] tracking-widest text-ns-muted uppercase">
              {billing === "annual" ? "billed annually" : "billed monthly"}
            </p>
          </div>
          <ul className="flex flex-col gap-2.5">
            {tier.features.map((f, i) => (
              <li key={f.label}>
                <label className="group flex cursor-pointer items-center gap-2.5">
                  <span className="relative inline-flex h-4 w-4 shrink-0">
                    <input
                      type="checkbox"
                      checked={checked[i] ?? false}
                      onChange={() =>
                        setChecked((prev) => {
                          const next = [...prev];
                          next[i] = !next[i];
                          return next;
                        })
                      }
                      className="peer h-4 w-4 cursor-pointer appearance-none rounded-[4px] border border-border bg-transparent transition-colors duration-150 checked:border-foreground checked:bg-foreground hover:border-foreground/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
                    />
                    <svg
                      aria-hidden
                      viewBox="0 0 12 12"
                      fill="none"
                      className="pointer-events-none absolute inset-0 m-auto h-3 w-3 text-background opacity-0 transition-opacity duration-150 peer-checked:opacity-100"
                    >
                      <path
                        d="M2.5 6.5 5 9l4.5-5.5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span
                    className={`text-[13px] transition-colors duration-150 ${
                      checked[i] ? "text-foreground" : "text-ns-muted"
                    }`}
                  >
                    {f.label}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {tier.primary ? (
            <button
              type="button"
              className="mt-1 rounded-sm bg-ns-accent px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-ns-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
            >
              {tier.cta}
            </button>
          ) : (
            <button
              type="button"
              className="mt-1 rounded-sm border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors duration-200 hover:border-foreground/25 hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
            >
              {tier.cta}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`relative w-full ${className}`}>
      <div className="mb-8 flex justify-center">
        <div
          role="group"
          aria-label="Billing period"
          className="inline-flex items-center gap-0.5 rounded-sm border border-border bg-surface p-0.5"
        >
          <button
            type="button"
            aria-pressed={billing === "monthly"}
            onClick={() => setBilling("monthly")}
            className={segClass(billing === "monthly")}
          >
            MONTHLY
          </button>
          <button
            type="button"
            aria-pressed={billing === "annual"}
            onClick={() => setBilling("annual")}
            className={segClass(billing === "annual")}
          >
            ANNUAL {discountLabel}
          </button>
        </div>
      </div>
      <div ref={stageRef} className="relative" style={{ height: 560 }}>
        <canvas
          ref={canvasRef}
          aria-hidden
          className="pointer-events-none absolute left-0 top-0"
        />
        {renderCard("left")}
        {renderCard("right")}
        <p
          ref={captionRef}
          aria-live="polite"
          className="absolute left-1/2 max-w-full -translate-x-1/2 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[11px] tracking-widest text-ns-muted uppercase"
        />
      </div>
    </div>
  );
}
