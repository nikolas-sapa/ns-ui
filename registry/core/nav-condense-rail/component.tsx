"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// NavCondenseRail — a full-width site nav that condenses in place as the page
// scrolls: roomy at the top (tall padding, full-size wordmark and links) and
// a dense pinned rail once you've moved past it (tight padding, smaller type,
// tighter gaps). Unlike a scroll-position hack keyed to an arbitrary pixel
// constant, the travel distance the condense happens over is the *measured*
// difference between the nav's own roomy height and its own dense height —
// two off-screen probes render the real markup at each extreme and report
// their heights via ResizeObserver, so the transition is always exactly as
// long as the nav's own vertical shrink, on any wordmark, any font, any
// viewport. Everything that changes every scroll frame (height, padding,
// wordmark scale, link size/gap, border/background opacity) is written
// straight to refs' inline styles inside one rAF loop; React state only holds
// the two measured heights (set once, rarely) and reduced-motion.
// ---------------------------------------------------------------------------

export interface NavCondenseRailLink {
  href: string;
  label: string;
}

export interface NavCondenseRailProps {
  wordmark?: string;
  links?: NavCondenseRailLink[];
  cta?: NavCondenseRailLink;
  className?: string;
}

const DEFAULT_LINKS: NavCondenseRailLink[] = [
  { href: "#work", label: "Work" },
  { href: "#process", label: "Process" },
  { href: "#pricing", label: "Pricing" },
  { href: "#contact", label: "Contact" },
];

const DEFAULT_CTA: NavCondenseRailLink = { href: "#start", label: "Start a project" };

// Style pairs interpolated between the roomy (progress 0) and dense
// (progress 1) ends. Heights are never guessed here — they come from the
// measured probes below.
const ROOMY = { padY: 28, logoScale: 1, linkSize: 15, gap: 32, ctaPadX: 18, ctaPadY: 10 };
const DENSE = { padY: 12, logoScale: 0.82, linkSize: 13, gap: 22, ctaPadX: 14, ctaPadY: 7 };
const LERP_RATE = 14; // 1/s — exponential approach toward the scroll-derived target
const FALLBACK_TRAVEL = 40; // px, used only for the handful of frames before probes report in

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// The nav's real inner markup, shared between the live bar and the two
// measurement probes so a probe's height is never anything other than the
// height the actual bar would take at that padding/font size.
function NavInner({
  wordmark,
  links,
  cta,
  padY,
  linkSize,
  gap,
  ctaPadX,
  ctaPadY,
  wordmarkRef,
  linksContainerRef,
}: {
  wordmark: string;
  links: NavCondenseRailLink[];
  cta?: NavCondenseRailLink;
  padY: number;
  linkSize: number;
  gap: number;
  ctaPadX: number;
  ctaPadY: number;
  wordmarkRef?: (el: HTMLSpanElement | null) => void;
  linksContainerRef?: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      className="mx-auto flex w-full max-w-6xl items-center justify-between px-6"
      style={{ paddingTop: padY, paddingBottom: padY }}
    >
      <a
        href="#top"
        className="shrink-0 rounded-sm font-mono font-semibold tracking-tight text-foreground transition-colors duration-150 hover:text-ns-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ns-accent"
        style={{ fontSize: 17 }}
      >
        <span ref={wordmarkRef} className="inline-block origin-left">
          {wordmark}
        </span>
      </a>

      <div ref={linksContainerRef} className="flex items-center" style={{ gap }}>
        {links.map((l) => (
          <a
            key={l.href}
            href={l.href}
            className="whitespace-nowrap rounded-sm text-ns-muted transition-colors duration-150 hover:text-foreground focus-visible:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ns-accent"
            style={{ fontSize: linkSize }}
          >
            {l.label}
          </a>
        ))}
        {cta && (
          <a
            href={cta.href}
            className="shrink-0 whitespace-nowrap rounded-sm bg-ns-accent font-medium text-white transition-colors duration-150 hover:bg-ns-accent-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ns-accent"
            style={{ fontSize: linkSize, paddingInline: ctaPadX, paddingBlock: ctaPadY }}
          >
            {cta.label}
          </a>
        )}
      </div>
    </div>
  );
}

export function NavCondenseRail({
  wordmark = "ns-ui",
  links = DEFAULT_LINKS,
  cta = DEFAULT_CTA,
  className = "",
}: NavCondenseRailProps) {
  const navRef = useRef<HTMLDivElement | null>(null);
  const spacerRef = useRef<HTMLDivElement | null>(null);
  const wordmarkRef = useRef<HTMLSpanElement | null>(null);
  const linksRef = useRef<HTMLDivElement | null>(null);
  const roomyProbeRef = useRef<HTMLDivElement | null>(null);
  const denseProbeRef = useRef<HTMLDivElement | null>(null);

  const [reduced, setReduced] = useState(false);
  const [roomyH, setRoomyH] = useState<number | null>(null);
  const [denseH, setDenseH] = useState<number | null>(null);

  // ---- reduced motion ---------------------------------------------------
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // ---- measure the real roomy/dense heights off-screen -------------------
  useEffect(() => {
    const roomy = roomyProbeRef.current;
    const dense = denseProbeRef.current;
    if (!roomy || !dense) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
        if (entry.target === roomy) setRoomyH(h);
        else if (entry.target === dense) setDenseH(h);
      }
    });
    ro.observe(roomy);
    ro.observe(dense);
    return () => ro.disconnect();
  }, [wordmark, links, cta]);

  const travel =
    roomyH != null && denseH != null && roomyH - denseH > 1 ? roomyH - denseH : FALLBACK_TRAVEL;

  const applyFrame = useCallback(
    (p: number) => {
      const nav = navRef.current;
      const spacer = spacerRef.current;
      const wm = wordmarkRef.current;
      const linksEl = linksRef.current;
      if (!nav) return;

      const padY = lerp(ROOMY.padY, DENSE.padY, p);
      const logoScale = lerp(ROOMY.logoScale, DENSE.logoScale, p);
      const linkSize = lerp(ROOMY.linkSize, DENSE.linkSize, p);
      const gap = lerp(ROOMY.gap, DENSE.gap, p);

      nav.style.paddingTop = `${padY}px`;
      nav.style.paddingBottom = `${padY}px`;
      nav.style.backgroundColor =
        p > 0.02
          ? `color-mix(in srgb, var(--background) ${lerp(0, 100, clamp01(p / 0.3))}%, transparent)`
          : "transparent";
      nav.style.borderBottomWidth = "1px";
      nav.style.borderBottomColor = `color-mix(in srgb, var(--border) ${Math.round(clamp01(p / 0.15) * 100)}%, transparent)`;
      nav.style.backdropFilter = p > 0.05 ? "blur(10px)" : "none";

      if (wm) wm.style.transform = `scale(${logoScale})`;
      if (linksEl) {
        linksEl.style.gap = `${gap}px`;
        for (const child of Array.from(linksEl.children)) {
          (child as HTMLElement).style.fontSize = `${linkSize}px`;
          if ((child as HTMLElement).tagName === "A" && child === linksEl.lastElementChild && cta) {
            (child as HTMLElement).style.paddingInline = `${lerp(ROOMY.ctaPadX, DENSE.ctaPadX, p)}px`;
            (child as HTMLElement).style.paddingBlock = `${lerp(ROOMY.ctaPadY, DENSE.ctaPadY, p)}px`;
          }
        }
      }

      const h = lerp(roomyH ?? ROOMY.padY * 2 + 24, denseH ?? DENSE.padY * 2 + 24, clamp01(p));
      if (spacer) spacer.style.height = `${h}px`;
    },
    [cta, roomyH, denseH]
  );

  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    let last = performance.now();
    let current = 0;

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const target = clamp01(window.scrollY / travel);
      current = lerp(current, target, 1 - Math.exp(-LERP_RATE * dt));
      applyFrame(current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced, travel, applyFrame]);

  // reduced motion: two discrete states, no interpolation, boundary sits at
  // the midpoint of the measured travel distance (not an arbitrary constant)
  useEffect(() => {
    if (!reduced) return;
    const apply = () => applyFrame(window.scrollY > travel / 2 ? 1 : 0);
    apply();
    window.addEventListener("scroll", apply, { passive: true });
    return () => window.removeEventListener("scroll", apply);
  }, [reduced, travel, applyFrame]);

  return (
    <>
      <div
        ref={navRef}
        role="navigation"
        aria-label="Primary"
        className={`fixed inset-x-0 top-0 z-40 border-b ${className}`}
        style={{ borderBottomColor: "transparent", transitionProperty: "none" }}
      >
        <NavInner
          wordmark={wordmark}
          links={links}
          cta={cta}
          padY={ROOMY.padY}
          linkSize={ROOMY.linkSize}
          gap={ROOMY.gap}
          ctaPadX={ROOMY.ctaPadX}
          ctaPadY={ROOMY.ctaPadY}
          wordmarkRef={(el) => {
            wordmarkRef.current = el;
          }}
          linksContainerRef={(el) => {
            linksRef.current = el;
          }}
        />
      </div>

      {/* Reserves the fixed bar's current height in normal flow so the page
          never jumps as it condenses; height is written every frame above. */}
      <div ref={spacerRef} aria-hidden="true" style={{ height: ROOMY.padY * 2 + 24 }} />

      {/* Off-screen measurement probes: real markup at each extreme, never
          painted, purely so the travel distance is a measured fact rather
          than a guessed pixel constant. */}
      <div
        ref={roomyProbeRef}
        aria-hidden="true"
        className="pointer-events-none fixed left-[-99999px] top-0 w-full"
        style={{ visibility: "hidden" }}
      >
        <NavInner
          wordmark={wordmark}
          links={links}
          cta={cta}
          padY={ROOMY.padY}
          linkSize={ROOMY.linkSize}
          gap={ROOMY.gap}
          ctaPadX={ROOMY.ctaPadX}
          ctaPadY={ROOMY.ctaPadY}
        />
      </div>
      <div
        ref={denseProbeRef}
        aria-hidden="true"
        className="pointer-events-none fixed left-[-99999px] top-0 w-full"
        style={{ visibility: "hidden" }}
      >
        <NavInner
          wordmark={wordmark}
          links={links}
          cta={cta}
          padY={DENSE.padY}
          linkSize={DENSE.linkSize}
          gap={DENSE.gap}
          ctaPadX={DENSE.ctaPadX}
          ctaPadY={DENSE.ctaPadY}
        />
      </div>
    </>
  );
}
