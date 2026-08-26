"use client";

import { useLayoutEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// KelvinWake — a real site nav whose active-item indicator is a point source
// drifting along the link row, trailing a genuine KELVIN SHIP WAKE beneath
// it: a V-shaped envelope of transverse + diverging waves held at a
// CONSTANT half-angle of arcsin(1/3) ≈ 19.4712°, independent of how fast the
// source is moving — Lord Kelvin's 1887 result for a point disturbance on
// deep water, and the one truly speed-invariant fact about a ship's wake.
//
// Distinct from hero-vortex-street (also in this registry): that component
// sheds a von Karman vortex street — a cursor-driven point vortex spawning
// alternating-sign rotational eddies that drift downstream and DECAY on
// their own clock, advected/summed via the Biot–Savart-style Lamb-Oseen
// velocity field. This component has no rotation, no decay and no summed
// velocity field at all — it is a STEADY dispersive-wave interference
// pattern that reattaches, whole, to wherever the source currently is and
// however it is currently heading. Different physics entirely: vortex
// shedding (rotational, unsteady, dissipative) vs. surface-wave dispersion
// (irrotational, a fixed geometric envelope that is exactly the same shape
// at every instant regardless of speed).
//
// GEOMETRIC MODEL (a practical, honestly-approximate implementation, not a
// numerical solve of Kelvin's exact stationary-phase integral — see below
// for the two constants that ARE exact and load-bearing). Each transverse
// wave crest n (n = 1, 2, 3…) is drawn as a circular arc of radius
// n·WAVELEN centered ON THE SOURCE, spanning the angular cone
// ±arcsin(1/3) around the "directly behind" heading — i.e. concentric
// wavefronts trailing the source, clipped to Kelvin's cone. Each arc's two
// endpoints are, by construction, cusp points sitting exactly on the
// envelope line, so the crests visibly nest inside a V that never changes
// angle no matter how fast the source is currently travelling. From each
// cusp a short DIVERGING wave segment continues outward along the local
// tangent (perpendicular to the arc's radius, chosen to point forward and
// away from the centerline) — the two systems meeting exactly where the
// real Kelvin pattern's transverse and diverging waves meet: at the
// envelope itself. The two lines of the envelope are also drawn directly,
// so the constant angle is legible on sight, not just implied by where the
// crests happen to end.
//
// The wake is redrawn fresh every frame from the source's CURRENT position
// and heading only — it carries no history of past positions or past
// speeds. That is a deliberate simplification (the real wake has a finite
// relaxation time after a genuine speed change), but it is exact for the
// one claim this component exists to demonstrate: Kelvin's angle is a
// property of deep-water dispersion alone, true instant-by-instant,
// completely independent of the source's current speed.
//
// ALIVE AT REST: the source never stops. With no interaction it patrols the
// full width of the rail on a slow ping-pong sweep (~11s per leg); a real
// click/keyboard-activation of a nav link eases the source, faster, to that
// link's measured center, holds there briefly, then resumes the patrol from
// wherever it ended up — one continuous easing target, exactly the pattern
// hero-vortex-street uses for its pointer-vs-idle-orbit driver, applied here
// to click-vs-patrol. Both speeds leave the same 19.4712° V.
//
// A NAV IS A REAL NAV: real <a> links in a <ul>, aria-current="page" on the
// active one, full keyboard/focus-visible support, normal tab order — none
// of it depends on the canvas. The wake strip is aria-hidden decoration
// layered underneath.
//
// House idiom duplicated on purpose (no shared helpers, per project
// convention): tokens read via getComputedStyle + a MutationObserver on
// documentElement's class, resolved in useLayoutEffect before first paint so
// nothing ever draws with an empty ink string; one rAF loop paused on both
// document visibilitychange and an IntersectionObserver (threshold 0) on
// the strip itself; DPR-capped(2) backing store with a zero-size guard.
//
// prefers-reduced-motion: no rAF loop at all. One static frame is drawn
// with the source parked at 62% along the rail (not 0% or 100%, where the
// wake would either be barely formed or already clipped off the trailing
// edge) so both wave systems and the full envelope read clearly at a glance.
// ---------------------------------------------------------------------------

export interface KelvinWakeLink {
  href: string;
  label: string;
}

export interface KelvinWakeProps {
  /** brand text on the left */
  wordmark?: string;
  /** nav links, in order */
  links?: KelvinWakeLink[];
  /** href of the initially active link (defaults to the first) */
  defaultActiveHref?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

const DEFAULT_LINKS: KelvinWakeLink[] = [
  { href: "#work", label: "Work" },
  { href: "#process", label: "Process" },
  { href: "#pricing", label: "Pricing" },
  { href: "#contact", label: "Contact" },
];

// The one exact, speed-independent constant this whole component exists to
// show: Kelvin's 1887 half-angle, arcsin(1/3) ≈ 19.4712°.
const PHI_MAX = Math.asin(1 / 3);

const EASE_RATE = 3.4; // 1/s, exponential approach of the driver toward its current target
const PATROL_PERIOD_S = 11; // s per idle leg of the ping-pong sweep — slow, deliberate
const CLICK_HOLD_S = 2.1; // s the driver's target stays pinned to a clicked link
const PATROL_MARGIN = 20; // px inset from each rail edge for the idle sweep
const SOURCE_R = 4; // px, the active-indicator dot
const STATIC_FRACTION = 0.62; // reduced-motion freeze position, see comment above

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

// Triangle wave: 0 -> 1 -> 0 over one period — a ping-pong sweep, not a
// snap-back sawtooth.
function triangle(t: number): number {
  const p = t * 2;
  return p > 1 ? 2 - p : p;
}

function centerXFor(el: HTMLElement, canvasRect: DOMRect): number {
  const r = el.getBoundingClientRect();
  return r.left + r.width / 2 - canvasRect.left;
}

export function KelvinWake({
  wordmark = "ns-ui",
  links = DEFAULT_LINKS,
  defaultActiveHref,
  className = "",
}: KelvinWakeProps) {
  const [activeHref, setActiveHref] = useState(
    () => defaultActiveHref ?? links[0]?.href ?? ""
  );

  const navRef = useRef<HTMLElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const linkRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());
  const clickTimeRef = useRef(-Infinity); // performance.now() ms of the last activation
  const clickTargetXRef = useRef(0);
  const activeHrefRef = useRef(activeHref);
  activeHrefRef.current = activeHref;

  // token derive happens in useLayoutEffect, before first paint, so no rAF /
  // resize / reduced-motion branch can draw with an empty ink string
  useLayoutEffect(() => {
    const strip = stripRef.current;
    const canvas = canvasRef.current;
    if (!strip || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let fg = "";
    let muted = "";
    let accent = "";
    const readTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      fg = cs.getPropertyValue("--foreground").trim();
      muted = cs.getPropertyValue("--ns-muted").trim();
      accent = cs.getPropertyValue("--ns-accent").trim();
    };
    readTokens();

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let disposed = false;
    let raf = 0;
    let running = false;
    let visible = true;
    let cssW = 0;
    let cssH = 0;
    let driverX = 0;
    let driverInit = false;
    let lastDriverX = 0;
    let heading = 1; // +1 = rightward, -1 = leftward; held across zero-velocity frames

    const recomputeLinkCenters = () => {
      const canvasRect = canvas.getBoundingClientRect();
      const el = linkRefs.current.get(activeHrefRef.current);
      if (!el) return;
      clickTargetXRef.current = centerXFor(el, canvasRect);
    };

    const patrolX = (nowS: number) => {
      const span = Math.max(1, cssW - PATROL_MARGIN * 2);
      const phase = (nowS % PATROL_PERIOD_S) / PATROL_PERIOD_S;
      return PATROL_MARGIN + triangle(phase) * span;
    };

    const drawWake = (sourceX: number, headingSign: number) => {
      const cy = cssH / 2;
      ctx.clearRect(0, 0, cssW, cssH);
      if (cssW <= 0 || cssH <= 0) return;

      const halfH = cssH / 2;
      // WAVE_MARGIN keeps the whole pattern — envelope, crests AND the
      // diverging tails — inside a budget short of the strip's own edges,
      // so ink never touches the frame and never hard-clips against the
      // canvas bitmap mid-stroke. Budget is in the same lateral units the
      // envelope angle produces (R·sin(PHI_MAX)), so it bounds every drawn
      // element the same way, not just the crest arcs.
      const WAVE_MARGIN = 0.82;
      const budget = halfH * WAVE_MARGIN;
      // WAVELEN scales with the strip's own height, never a fixed px
      // constant, so crest spacing stays proportional at any rail scale.
      // The 0.38 multiplier (down from a naive 0.5) is chosen so that,
      // combined with WAVE_MARGIN above, three rings still fit the budget
      // instead of collapsing to the documented floor of two.
      const wavelen = clamp(cssH * 0.38, 8, 26);
      // sin(PHI_MAX) = 1/3 exactly: k·wavelen·sin(PHI_MAX) is crest k's
      // lateral reach, so the largest k that still fits inside budget is
      // budget / (wavelen·sin(PHI_MAX)) — the exact invariant stays
      // load-bearing here rather than hardcoding 3.
      const n = clamp(Math.floor(budget / (wavelen * Math.sin(PHI_MAX))), 2, 6);

      const behindAngle = headingSign > 0 ? Math.PI : 0;

      // the envelope itself — drawn directly so the constant angle reads at
      // a glance, not only implied by where crests happen to cusp. Length is
      // capped at the same budget (physically correct: the real wake DOES
      // grow taller the further back you draw it, so the strip's height is
      // exactly what limits how far behind the source it can be legibly
      // drawn before it would exceed the frame).
      const envLen = budget / Math.sin(PHI_MAX);
      ctx.strokeStyle = muted || "currentColor";
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.34;
      for (const sign of [-1, 1]) {
        const ang = behindAngle + sign * PHI_MAX;
        ctx.beginPath();
        ctx.moveTo(sourceX, cy);
        ctx.lineTo(sourceX + Math.cos(ang) * envLen, cy + Math.sin(ang) * envLen);
        ctx.stroke();
      }

      // transverse crests (concentric arcs, source-centered) + the diverging
      // segment that continues tangentially from each cusp
      for (let k = n; k >= 1; k--) {
        const r = k * wavelen;
        const t = 1 - (k - 1) / n; // 1 = nearest/freshest crest, fading with k
        const alpha = 0.18 + 0.42 * t;
        ctx.strokeStyle = t > 0.55 ? fg || "currentColor" : muted || "currentColor";
        ctx.lineWidth = 1.15;
        ctx.globalAlpha = alpha;

        const angleA = behindAngle - PHI_MAX;
        const angleB = behindAngle + PHI_MAX;
        ctx.beginPath();
        ctx.arc(sourceX, cy, r, angleA, angleB);
        ctx.stroke();

        // cusp k already sits at k·wavelen·sin(PHI_MAX) of the budget; each
        // ring's diverging tail is clamped to whatever budget remains
        // beyond its own cusp, so the outermost ring's tail shortens
        // instead of shooting past the frame and hard-clipping.
        const cuspLateral = r * Math.sin(PHI_MAX);
        const headroom = Math.max(0, budget - cuspLateral);
        const divLen = Math.min(wavelen * 1.6, headroom / Math.cos(PHI_MAX));
        for (const ang of [angleA, angleB]) {
          const cuspX = sourceX + Math.cos(ang) * r;
          const cuspY = cy + Math.sin(ang) * r;
          // tangent to the arc at the cusp — pick whichever perpendicular
          // points forward (with the current heading) and away from the
          // centerline, the direction a real diverging crest sweeps.
          const p1x = -Math.sin(ang);
          const p1y = Math.cos(ang);
          const forward1 = p1x * headingSign > 0;
          const dx = forward1 ? p1x : -p1x;
          const dy = forward1 ? p1y : -p1y;
          ctx.beginPath();
          ctx.moveTo(cuspX, cuspY);
          ctx.lineTo(cuspX + dx * divLen, cuspY + dy * divLen);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      // the source itself — the active-indicator dot. Legitimate
      // interaction chrome, so --ns-accent is correct here (unlike the
      // wave field above, which is ambient and stays --foreground/--ns-muted).
      ctx.beginPath();
      ctx.fillStyle = accent || "currentColor";
      ctx.arc(sourceX, cy, SOURCE_R, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawStatic = () => {
      recomputeLinkCenters();
      const x = PATROL_MARGIN + STATIC_FRACTION * Math.max(1, cssW - PATROL_MARGIN * 2);
      drawWake(x, 1);
    };

    let last = 0;
    const loop = (ts: number) => {
      if (disposed) return;
      const dt = Math.min((ts - (last || ts)) / 1000, 1 / 30);
      last = ts;
      const nowS = ts / 1000;

      const sinceClick = performance.now() - clickTimeRef.current;
      const target =
        sinceClick < CLICK_HOLD_S * 1000 ? clickTargetXRef.current : patrolX(nowS);

      if (!driverInit) {
        driverX = target;
        lastDriverX = target;
        driverInit = true;
      }
      const ease = 1 - Math.exp(-EASE_RATE * dt);
      driverX += (target - driverX) * ease;

      const delta = driverX - lastDriverX;
      if (Math.abs(delta) > 0.01) heading = delta > 0 ? 1 : -1;
      lastDriverX = driverX;

      drawWake(driverX, heading);
      raf = requestAnimationFrame(loop);
    };

    const wake = () => {
      if (running || reduced) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(loop);
    };
    const sleep = () => {
      cancelAnimationFrame(raf);
      running = false;
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) return; // zero-size guard
      cssW = rect.width;
      cssH = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      recomputeLinkCenters();
      if (reduced) drawStatic();
    };

    const ro = new ResizeObserver(resize);
    ro.observe(strip);
    for (const el of linkRefs.current.values()) ro.observe(el);

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[entries.length - 1]?.isIntersecting ?? true;
        if (!reduced) {
          if (visible) wake();
          else sleep();
        }
      },
      { threshold: 0 }
    );
    io.observe(strip);

    const themeObserver = new MutationObserver(() => {
      readTokens();
      if (reduced) drawStatic();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const onVis = () => {
      if (reduced) return;
      if (document.hidden) sleep();
      else if (visible) wake();
    };
    document.addEventListener("visibilitychange", onVis);

    resize();
    if (!reduced) wake();
    else drawStatic();

    return () => {
      disposed = true;
      ro.disconnect();
      io.disconnect();
      themeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      sleep();
    };
    // re-run only when the link set itself changes; activeHref is read via
    // activeHrefRef so a click never tears down and restarts the driver —
    // that would snap the source to its target instead of easing to it
  }, [links]);

  return (
    <nav
      ref={navRef}
      aria-label="Primary"
      className={`relative w-full border-b border-border bg-background pb-2 ${className}`}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 pt-4">
        <a
          href="#top"
          className="shrink-0 rounded-sm font-mono text-[15px] font-semibold tracking-tight text-foreground transition-colors duration-150 hover:text-ns-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ns-accent"
        >
          {wordmark}
        </a>
        <ul className="flex items-center gap-7">
          {links.map((link) => {
            const isActive = link.href === activeHref;
            return (
              <li key={link.href}>
                <a
                  ref={(el) => {
                    if (el) linkRefs.current.set(link.href, el);
                    else linkRefs.current.delete(link.href);
                  }}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  onClick={(e) => {
                    // this embed has no real #process section to land on; the
                    // wake/active-link response below is the entire effect of
                    // a click, so stop the browser's own fragment navigation
                    // (matters for autoplay's synthetic clicks on a timer)
                    e.preventDefault();
                    setActiveHref(link.href);
                    const canvas = canvasRef.current;
                    if (canvas) {
                      clickTargetXRef.current = centerXFor(
                        e.currentTarget,
                        canvas.getBoundingClientRect()
                      );
                    }
                    clickTimeRef.current = performance.now();
                  }}
                  className={`rounded-sm text-sm transition-colors duration-150 hover:text-foreground focus-visible:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ns-accent ${
                    isActive ? "text-foreground" : "text-ns-muted"
                  }`}
                >
                  {link.label}
                </a>
              </li>
            );
          })}
        </ul>
      </div>

      {/* decorative wake strip beneath the real link row — aria-hidden. It
          illustrates which item is active (the source parks over it after a
          click) and that the rail is alive at rest (the idle patrol); it
          never carries navigation semantics of its own. */}
      <div ref={stripRef} aria-hidden="true" className="relative mx-auto mt-2 h-9 w-full max-w-6xl px-6">
        <canvas ref={canvasRef} className="block h-full w-full" />
      </div>
    </nav>
  );
}
