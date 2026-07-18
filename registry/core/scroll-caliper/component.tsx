"use client";

import { useEffect, useRef, type ReactNode } from "react";

const W = 48; // instrument width in px

// ---------------------------------------------------------------------------
// damped spring integrator — k in s^-2, zeta dimensionless (1 = critical)
// ---------------------------------------------------------------------------
type Spring = { x: number; v: number; t: number };
function stepSpring(s: Spring, k: number, zeta: number, dt: number) {
  const c = 2 * zeta * Math.sqrt(k);
  s.v += (k * (s.t - s.x) - c * s.v) * dt;
  s.x += s.v * dt;
}
function isSettled(s: Spring) {
  return Math.abs(s.x - s.t) < 0.05 && Math.abs(s.v) < 0.05;
}

// bare-usage fallback content: three short measured sections
function FallbackSections() {
  const blocks: [string, string][] = [
    [
      "Datum",
      "Every measurement starts from a reference surface. The caliper treats the top of each section as its datum and closes the opposing jaw on the far edge.",
    ],
    [
      "Extent",
      "The jaw opening reads the section's visible span in pixels. Scroll and the blades chase the new edges with near-critical spring damping, a hair of lag by design.",
    ],
    [
      "Runout",
      "Stop scrolling and the needle over-settles with a visible wobble before locking, the way a real dial indicator bleeds off its last few microns of momentum.",
    ],
  ];
  return (
    <div className="space-y-12 p-8">
      {blocks.map(([title, copy]) => (
        <section key={title} data-section className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-sm leading-relaxed text-muted">{copy}</p>
          <p className="text-sm leading-relaxed text-muted">{copy}</p>
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ScrollCaliper — a vernier caliper pinned to the right edge of a bounded
// scroll container. Its jaws close over the active [data-section]'s vertical
// extent (spring k=120 s^-2, zeta=0.9), a font-mono readout ticks px/percent
// on a softer spring (k=90, zeta=0.55) so it wobbles when scrolling stops,
// and the tick scale streaks with velocity-scaled motion blur. SVG + direct-
// DOM rAF, refs only; the loop sleeps 150ms after the last scroll once every
// spring settles. All ink is currentColor via token classes (text-border /
// text-foreground / text-accent), so theme flips restyle the SVG live with
// no numeric getComputedStyle reads to re-derive.
// ---------------------------------------------------------------------------
export function ScrollCaliper({
  children,
  sectionSelector = "[data-section]",
  jawStiffness = 120,
  jawDamping = 0.9,
  needleStiffness = 90,
  needleDamping = 0.55,
  className = "h-[480px]",
}: {
  /** scrollable content; sections are matched via sectionSelector */
  children?: ReactNode;
  /** selector for measurable sections inside the scroller */
  sectionSelector?: string;
  /** jaw spring stiffness in s^-2 (near-critical chase) */
  jawStiffness?: number;
  /** jaw damping ratio (1 = critical) */
  jawDamping?: number;
  /** readout needle stiffness in s^-2 (softer, visible over-settle) */
  needleStiffness?: number;
  /** readout needle damping ratio */
  needleDamping?: number;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tickRef = useRef<SVGGElement>(null);
  const minorRef = useRef<SVGPathElement>(null);
  const majorRef = useRef<SVGPathElement>(null);
  const echoRef = useRef<SVGGElement>(null);
  const echoMinorRef = useRef<SVGPathElement>(null);
  const echoMajorRef = useRef<SVGPathElement>(null);
  const spineRef = useRef<SVGPathElement>(null);
  const regionRef = useRef<SVGRectElement>(null);
  const topJawRef = useRef<SVGGElement>(null);
  const botJawRef = useRef<SVGGElement>(null);
  const markerRef = useRef<SVGGElement>(null);
  const chipLabelRef = useRef<HTMLDivElement>(null);
  const chipPxRef = useRef<HTMLSpanElement>(null);
  const chipPctRef = useRef<HTMLSpanElement>(null);
  const liveRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroller = scrollerRef.current;
    const svg = svgRef.current;
    const tickG = tickRef.current;
    const minorPath = minorRef.current;
    const majorPath = majorRef.current;
    const echoG = echoRef.current;
    const echoMinor = echoMinorRef.current;
    const echoMajor = echoMajorRef.current;
    const spine = spineRef.current;
    const region = regionRef.current;
    const topJaw = topJawRef.current;
    const botJaw = botJawRef.current;
    const marker = markerRef.current;
    const chipLabel = chipLabelRef.current;
    const chipPx = chipPxRef.current;
    const chipPct = chipPctRef.current;
    const live = liveRef.current;
    if (
      !scroller || !svg || !tickG || !minorPath || !majorPath || !echoG ||
      !echoMinor || !echoMajor || !spine || !region || !topJaw || !botJaw ||
      !marker || !chipLabel || !chipPx || !chipPct || !live
    )
      return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const sections = Array.from(
      scroller.querySelectorAll<HTMLElement>(sectionSelector)
    );
    const total = sections.length;

    // hot-path state — closure locals only, never React state
    const jawTop: Spring = { x: 0, v: 0, t: 0 };
    const jawBot: Spring = { x: 0, v: 0, t: 0 };
    const needle: Spring = { x: 0, v: 0, t: 0 }; // percent through section
    let H = 0;
    let raf = 0;
    let running = false;
    let last = 0;
    let primed = false;
    let lastScrollT = 0; // performance.now() of last scroll event
    let prevScroll = scroller.scrollTop;
    let vSmooth = 0; // px/s, exponentially smoothed (alpha 0.2)
    let activeIdx = -1;
    let prevPxText = "";
    let prevPctText = "";
    let lastAnnounce = 0;
    let flashTimer: ReturnType<typeof setTimeout> | undefined;
    let announceTimer: ReturnType<typeof setTimeout> | undefined;
    const visiblePx = new Map<Element, number>();

    // tick scale: minor every 2px, major every 8px, long major every 40px —
    // rebuilt on resize only; per-frame motion is a translate of the group
    const rebuild = () => {
      H = scroller.clientHeight;
      if (H <= 0) return; // zero-size container guard
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      let minor = "";
      let major = "";
      for (let y = -8; y <= H + 8; y += 2) {
        if (y % 40 === 0) major += `M${W - 16} ${y}h16`;
        else if (y % 8 === 0) major += `M${W - 10} ${y}h10`;
        else minor += `M${W - 5} ${y}h5`;
      }
      minorPath.setAttribute("d", minor);
      majorPath.setAttribute("d", major);
      echoMinor.setAttribute("d", minor);
      echoMajor.setAttribute("d", major);
      spine.setAttribute("d", `M${W - 0.75} 0V${H}`);
    };
    rebuild();

    // map the active section's extent to container-space jaw targets;
    // needle target = percent of the section swept past the container center
    const measure = () => {
      if (H <= 0) return;
      const cRect = scroller.getBoundingClientRect();
      const el = activeIdx >= 0 ? sections[activeIdx] : undefined;
      if (el) {
        const r = el.getBoundingClientRect();
        jawTop.t = Math.min(H, Math.max(0, r.top - cRect.top));
        jawBot.t = Math.min(H, Math.max(0, r.bottom - cRect.top));
        // zero-height section guard: never divide by a degenerate extent
        needle.t =
          r.height > 0.5
            ? Math.min(1, Math.max(0, (cRect.top + H / 2 - r.top) / r.height)) *
              100
            : 0;
      } else {
        jawTop.t = 0;
        jawBot.t = H;
        const range = scroller.scrollHeight - H;
        needle.t = range > 0 ? (scroller.scrollTop / range) * 100 : 0;
      }
    };

    const loop = (now: number) => {
      const dt = last === 0 ? 1 / 60 : Math.min(0.05, (now - last) / 1000);
      last = now;
      const sc = scroller.scrollTop;
      vSmooth += 0.2 * ((sc - prevScroll) / dt - vSmooth);
      prevScroll = sc;

      measure();
      if (reduced || !primed) {
        // reduced motion snaps every frame; first frame snaps to avoid a
        // mount sweep from zero
        jawTop.x = jawTop.t;
        jawBot.x = jawBot.t;
        needle.x = needle.t;
        jawTop.v = jawBot.v = needle.v = 0;
        primed = true;
      } else {
        stepSpring(jawTop, jawStiffness, jawDamping, dt);
        stepSpring(jawBot, jawStiffness, jawDamping, dt);
        stepSpring(needle, needleStiffness, needleDamping, dt);
      }

      // writes — direct DOM, no React
      const phase = -(sc % 8);
      tickG.style.transform = `translateY(${phase.toFixed(2)}px)`;
      topJaw.style.transform = `translateY(${jawTop.x.toFixed(2)}px)`;
      botJaw.style.transform = `translateY(${jawBot.x.toFixed(2)}px)`;
      const gap = Math.max(0, jawBot.x - jawTop.x);
      region.setAttribute("y", jawTop.x.toFixed(2));
      region.setAttribute("height", gap.toFixed(2));
      const pct = Math.min(100, Math.max(0, needle.x));
      marker.style.transform = `translateY(${(jawTop.x + (pct / 100) * gap).toFixed(2)}px)`;

      // motion-blur echo: duplicated tick layer trailing the scroll direction
      if (!reduced) {
        const speed = Math.abs(vSmooth);
        const o = Math.min(0.6, speed / 3000);
        const len = Math.min(10, speed / 200);
        if (o > 0.02) {
          echoG.style.opacity = o.toFixed(3);
          echoG.style.transform = `translateY(${(phase + Math.sign(vSmooth) * len).toFixed(2)}px)`;
          echoG.style.filter = `blur(${(len / 2).toFixed(2)}px)`;
        } else {
          echoG.style.opacity = "0";
          echoG.style.filter = "none";
        }
      }

      const pxText = gap.toFixed(1);
      if (pxText !== prevPxText) {
        chipPx.textContent = pxText;
        prevPxText = pxText;
      }
      const pctText = String(Math.round(pct));
      if (pctText !== prevPctText) {
        chipPct.textContent = pctText;
        prevPctText = pctText;
      }

      // sleep: 150ms since last scroll AND every spring inside the epsilon
      if (
        now - lastScrollT > 150 &&
        isSettled(jawTop) &&
        isSettled(jawBot) &&
        isSettled(needle)
      ) {
        echoG.style.opacity = "0"; // blur layer removed at rest for crispness
        echoG.style.filter = "none";
        vSmooth = 0;
        running = false;
        return;
      }
      raf = requestAnimationFrame(loop);
    };

    const wake = () => {
      if (!running) {
        running = true;
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    const onScroll = () => {
      lastScrollT = performance.now();
      wake();
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });

    // 200ms accent flash of the readout label on section change
    const flash = () => {
      chipLabel.textContent = `SEC ${activeIdx + 1}/${total}`;
      chipLabel.classList.remove("text-muted");
      chipLabel.classList.add("text-accent");
      if (flashTimer) clearTimeout(flashTimer);
      flashTimer = setTimeout(() => {
        chipLabel.classList.remove("text-accent");
        chipLabel.classList.add("text-muted");
      }, 200);
    };

    // throttled live region: 'Section 2 of 4, 38%'
    const announce = () => {
      const fire = () => {
        lastAnnounce = performance.now();
        live.textContent = `Section ${activeIdx + 1} of ${total}, ${Math.round(
          Math.min(100, Math.max(0, needle.t))
        )}%`;
      };
      if (announceTimer) clearTimeout(announceTimer);
      const since = performance.now() - lastAnnounce;
      if (since > 1200) fire();
      else announceTimer = setTimeout(fire, 1200 - since);
    };

    // active section = the one with the most visible pixels in the scroller
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          visiblePx.set(e.target, e.isIntersecting ? e.intersectionRect.height : 0);
        }
        let best = -1;
        let bestH = 0;
        sections.forEach((s, i) => {
          const h = visiblePx.get(s) ?? 0;
          if (h > bestH) {
            bestH = h;
            best = i;
          }
        });
        if (best >= 0 && best !== activeIdx) {
          activeIdx = best;
          flash();
          announce();
          wake();
        }
      },
      { root: scroller, threshold: [0, 0.2, 0.4, 0.6, 0.8, 1] }
    );
    sections.forEach((s) => io.observe(s));

    const ro = new ResizeObserver(() => {
      rebuild();
      wake();
    });
    ro.observe(scroller);

    if (total === 0) chipLabel.textContent = "SEC —";
    wake(); // one primed frame, then immediate sleep until scroll

    return () => {
      cancelAnimationFrame(raf);
      running = false;
      io.disconnect();
      ro.disconnect();
      scroller.removeEventListener("scroll", onScroll);
      if (flashTimer) clearTimeout(flashTimer);
      if (announceTimer) clearTimeout(announceTimer);
    };
  }, [
    sectionSelector,
    jawStiffness,
    jawDamping,
    needleStiffness,
    needleDamping,
  ]);

  return (
    <div ref={rootRef} className={`relative w-full overflow-hidden ${className}`}>
      <div
        ref={scrollerRef}
        className="h-full overflow-y-auto overscroll-contain pr-16 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children ?? <FallbackSections />}
      </div>

      {/* instrument overlay — read-only, decorative; the live region below
          carries the accessible signal */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <svg
          ref={svgRef}
          className="absolute inset-y-0 right-0 h-full w-12"
          viewBox={`0 0 ${W} 1`}
          preserveAspectRatio="none"
          fill="none"
        >
          {/* motion-blur echo of the tick scale (opacity/blur driven by
              scroll velocity, removed at rest) */}
          <g ref={echoRef} opacity={0}>
            <path
              ref={echoMinorRef}
              className="text-border"
              stroke="currentColor"
              strokeWidth={1}
            />
            <path
              ref={echoMajorRef}
              className="text-foreground/60"
              stroke="currentColor"
              strokeWidth={1}
            />
          </g>
          {/* main tick scale — translated by -(scrollTop % 8) per frame */}
          <g ref={tickRef}>
            <path
              ref={minorRef}
              className="text-border"
              stroke="currentColor"
              strokeWidth={1}
            />
            <path
              ref={majorRef}
              className="text-foreground/60"
              stroke="currentColor"
              strokeWidth={1}
            />
          </g>
          {/* beam spine */}
          <path
            ref={spineRef}
            className="text-border"
            stroke="currentColor"
            strokeWidth={1.5}
          />
          {/* measured span tint between the jaws */}
          <rect
            ref={regionRef}
            x={2}
            y={0}
            width={W - 4}
            height={0}
            className="text-foreground"
            fill="currentColor"
            opacity={0.05}
          />
          {/* top jaw blade */}
          <g ref={topJawRef} className="text-foreground">
            <path d={`M3 0H${W}`} stroke="currentColor" strokeWidth={1.5} />
            <path d="M3 0V-14" stroke="currentColor" strokeWidth={2.5} />
            <path d="M3 0l12 -5v5z" fill="currentColor" />
          </g>
          {/* bottom jaw blade + vernier subscale */}
          <g ref={botJawRef} className="text-foreground">
            <path d={`M3 0H${W}`} stroke="currentColor" strokeWidth={1.5} />
            <path d="M3 0V14" stroke="currentColor" strokeWidth={2.5} />
            <path d="M3 0l12 5v-5z" fill="currentColor" />
            <path
              d="M30 4h8M30 7.5h8M30 11h8M30 14.5h8"
              stroke="currentColor"
              strokeWidth={1}
              opacity={0.45}
            />
          </g>
          {/* active-value marker — the only accent ink on the instrument */}
          <g ref={markerRef} className="text-accent">
            <path d={`M${W - 22} 0H${W}`} stroke="currentColor" strokeWidth={1.5} />
            <path d={`M${W - 22} 0l-5 -3.5v7z`} fill="currentColor" />
          </g>
        </svg>

        {/* digital readout chip */}
        <div className="absolute bottom-3 right-14 rounded-sm border border-foreground/20 bg-surface px-2.5 py-1.5 font-mono text-[10px] leading-snug shadow-sm">
          <div
            ref={chipLabelRef}
            className="tracking-widest text-muted transition-colors duration-200"
          >
            SEC —/—
          </div>
          <div className="tabular-nums text-foreground">
            <span ref={chipPxRef}>0.0</span>
            <span className="text-muted"> PX · </span>
            <span ref={chipPctRef}>0</span>
            <span className="text-muted">%</span>
          </div>
        </div>
      </div>

      {/* accessible signal — throttled section announcements */}
      <div ref={liveRef} role="status" aria-live="polite" className="sr-only" />
    </div>
  );
}
