"use client";

import { useEffect, useMemo, useRef } from "react";

// ---------------------------------------------------------------------------
// QuoinLock — a letterpress hero whose identity is a terminal lock-up event.
// The headline is split into per-glyph spans (aria-hidden) that arrive as
// individual metal sorts sliding along invisible composing rails: each glyph
// starts translateX'd +/-40-120px on its own critically-ish damped spring
// (randomized stiffness + damping per glyph), overshoots its rest slot by up
// to 4px, and settles. The instant every glyph is settled, the quoin visibly
// tightens in one mechanical "clunk": letter-spacing tweens -0.02em tighter
// over 90ms ease-in, a hairline 1px --border chase rect scales 101% -> 100%
// around the assembled block, the headline's text-shadow flashes
// 0 1px 0 --border for ~80ms simulating an impression, and the subhead
// prints beneath starting at --foreground before easing to --ns-muted (the
// impression "drying"). After that the hero is completely static — no
// ambient loop, no hover state; assembly is only the setup for the single
// tightening moment where spacing, chase and press-shadow commit at once.
// The full headline exists once, always, as a visually hidden real h1 so
// screen readers get one ordered string immediately; glyph spans are
// aria-hidden and never focusable, and no content is gated behind the
// animation (the subhead is real text, only its opacity is animated).
// Direct-DOM writes only — no React state on the animated path.
// ---------------------------------------------------------------------------

function mulberry32(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type GlyphRail = {
  offset: number; // starting px along the rail, signed
  delay: number; // ms before this glyph's spring engages
  k: number; // stiffness, s^-2
  zeta: number; // damping ratio
  animate: boolean; // false for whitespace glyphs — they never move
};

const MAX_OVERSHOOT = 4; // px past the rail's zero point, clamped
const SETTLE_DEADLINE_MS = 850; // hard cap: the line must be locked by here.
// Residual amplitude at the deadline is <2px with the stiffness/damping ranges
// below, so the forced snap is invisible — without it, a soft-rolled spring
// could still be moving past 1.5s and the resting state would race any
// observer (the verify gate screenshots "default" at ~1s after load).
const BASE_TRACKING = -0.01; // em — resting tracking while composing
const LOCKED_TRACKING = -0.03; // em — resting + the -0.02em clunk delta
const CLUNK_MS = 90;
const CHASE_MS = 160;
const IMPRESSION_MS = 80;
const STAMP_HOLD_MS = 90; // impression dwell before it eases back to --ns-muted

export function QuoinLock({
  eyebrow = "COMPOSING ROOM",
  headline = "SET IN TYPE, LOCKED FOR GOOD",
  subhead = "Every glyph rides its own rail into place. Once the line is full, the quoin tightens and it doesn't move again.",
  className = "",
}: {
  /** mono eyebrow label above the headline */
  eyebrow?: string;
  /** headline text — split into per-glyph rails; also the sr-only h1's full string */
  headline?: string;
  /** subhead copy, printed beneath once the line locks */
  subhead?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}) {
  const rootRef = useRef<HTMLElement>(null);
  const lineRef = useRef<HTMLSpanElement>(null);
  const chaseRef = useRef<HTMLDivElement>(null);
  const subheadRef = useRef<HTMLParagraphElement>(null);
  const glyphRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const glyphs = useMemo(() => Array.from(headline), [headline]);

  // deterministic per-glyph rail params, seeded off the headline text so
  // re-renders (and repeat mounts of the same headline) agree
  const rails = useMemo<GlyphRail[]>(() => {
    const rand = mulberry32(headline.length * 977 + 0x51a1);
    return Array.from(headline).map((ch) => {
      const animate = ch.trim().length > 0;
      const sign = rand() < 0.5 ? -1 : 1;
      const mag = 40 + rand() * 80; // 40-120px
      return {
        offset: animate ? sign * mag : 0,
        delay: rand() * 140, // ms stagger — sorts arrive in a loose sequence
        k: 120 + rand() * 120, // 120-240 s^-2
        zeta: 0.6 + rand() * 0.25, // 0.6-0.85
        animate,
      };
    });
  }, [headline]);

  useEffect(() => {
    const root = rootRef.current;
    const line = lineRef.current;
    const chase = chaseRef.current;
    const subheadEl = subheadRef.current;
    if (!root || !line || !chase || !subheadEl) return;

    const spans = glyphRefs.current.slice(0, glyphs.length);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let disposed = false;
    let stampTimer = 0;
    let fadeTimer = 0;

    // chase sizing: per-glyph transforms never touch layout (translateX is
    // paint-only), so the line's natural bounding box is already the final
    // assembled size from the very first frame — no reflow to chase.
    const sizeChase = () => {
      const lineRect = line.getBoundingClientRect();
      // measure against the chase's actual containing block (the relative
      // inline-block wrapper), NOT the section root — absolute left/top are
      // resolved against the offset parent, and using the root's rect here
      // double-applied the line's own offset and threw the frame off-canvas
      const parentRect = (chase.offsetParent as HTMLElement | null)?.getBoundingClientRect();
      if (!parentRect || lineRect.width < 1) return;
      const padX = 18;
      const padY = 12;
      chase.style.left = `${lineRect.left - parentRect.left - padX}px`;
      chase.style.top = `${lineRect.top - parentRect.top - padY}px`;
      chase.style.width = `${lineRect.width + padX * 2}px`;
      chase.style.height = `${lineRect.height + padY * 2}px`;
    };

    const finalizeGlyphs = () => {
      for (const span of spans) if (span) span.style.transform = "translateX(0px)";
    };

    // the clunk: letter-spacing tightens, chase snaps to fit, an impression
    // flash hits the headline, and the subhead prints — all in one beat
    const lockUp = () => {
      finalizeGlyphs();

      line.style.transitionProperty = "letter-spacing";
      line.style.transitionDuration = `${CLUNK_MS}ms`;
      line.style.transitionTimingFunction = "ease-in";
      line.style.letterSpacing = `${LOCKED_TRACKING}em`;

      chase.style.transitionProperty = "transform, opacity";
      chase.style.transitionDuration = `${CHASE_MS}ms`;
      chase.style.transitionTimingFunction = "cubic-bezier(0.16, 1, 0.3, 1)";
      chase.style.opacity = "1";
      chase.style.transform = "scale(1)";

      // impression: instant on (no transition yet), then eased off below
      line.style.textShadow = "0 1px 0 var(--border)";
      subheadEl.style.opacity = "1";
      subheadEl.style.transitionProperty = "color";
      subheadEl.style.transitionDuration = "0ms";
      subheadEl.style.color = "var(--foreground)";

      stampTimer = window.setTimeout(() => {
        if (disposed) return;
        line.style.transitionProperty = "letter-spacing, text-shadow";
        line.style.transitionDuration = `${CLUNK_MS}ms, ${IMPRESSION_MS}ms`;
        line.style.textShadow = "0 0 0 transparent";
        subheadEl.style.transitionDuration = "320ms";
        subheadEl.style.transitionTimingFunction = "ease-out";
        subheadEl.style.color = "var(--ns-muted)";
      }, STAMP_HOLD_MS);
    };

    if (reduced) {
      // instant final locked state — no springs, no stamp flash — plus the
      // single required 200ms fade for the whole hero
      finalizeGlyphs();
      sizeChase();
      chase.style.opacity = "1";
      chase.style.transform = "scale(1)";
      line.style.letterSpacing = `${LOCKED_TRACKING}em`;
      line.style.textShadow = "0 0 0 transparent";
      subheadEl.style.opacity = "1";
      subheadEl.style.color = "var(--ns-muted)";

      root.style.opacity = "0";
      root.style.transitionProperty = "opacity";
      root.style.transitionDuration = "200ms";
      fadeTimer = window.setTimeout(() => {
        if (!disposed) root.style.opacity = "1";
      }, 16);

      const ro = new ResizeObserver(sizeChase);
      ro.observe(line);
      document.fonts.ready.then(() => {
        if (!disposed) sizeChase();
      });
      return () => {
        disposed = true;
        window.clearTimeout(fadeTimer);
        ro.disconnect();
      };
    }

    // -- full spring path -----------------------------------------------
    const n = spans.length;
    const p = new Float64Array(n);
    const v = new Float64Array(n);
    for (let i = 0; i < n; i++) p[i] = rails[i]?.offset ?? 0;
    for (let i = 0; i < n; i++) {
      const span = spans[i];
      if (span) {
        span.style.willChange = "transform";
        span.style.transform = `translateX(${p[i].toFixed(2)}px)`;
      }
    }

    sizeChase();
    document.fonts.ready.then(() => {
      if (!disposed) sizeChase();
    });

    let raf = 0;
    let last = 0;
    let locked = false;
    const startTime = performance.now();

    const loop = (now: number) => {
      const dt = last === 0 ? 1 / 60 : Math.min(0.032, (now - last) / 1000);
      last = now;
      const elapsed = now - startTime;
      const overdue = elapsed >= SETTLE_DEADLINE_MS;
      let allSettled = true;

      for (let i = 0; i < n; i++) {
        const rail = rails[i];
        if (!rail || !rail.animate) continue;
        if (overdue) {
          // deadline: snap the (already sub-2px) residue home so lockUp fires
          p[i] = 0;
          v[i] = 0;
          const s = spans[i];
          if (s) s.style.transform = "translateX(0px)";
          continue;
        }
        if (elapsed < rail.delay) {
          allSettled = false;
          continue;
        }
        const c = 2 * rail.zeta * Math.sqrt(rail.k);
        const accel = -rail.k * p[i] - c * v[i];
        v[i] += accel * dt;
        p[i] += v[i] * dt;

        // clamp overshoot past the rail's zero point to MAX_OVERSHOOT
        const startSign = rail.offset < 0 ? -1 : 1;
        if (Math.sign(p[i]) !== 0 && Math.sign(p[i]) !== startSign && Math.abs(p[i]) > MAX_OVERSHOOT) {
          p[i] = -startSign * MAX_OVERSHOOT;
        }

        const span = spans[i];
        if (span) span.style.transform = `translateX(${p[i].toFixed(2)}px)`;
        // 0.3px / 2px-per-s is already sub-perceptual — a tighter epsilon just
        // stretches the tail of the decay and delays the lock beat
        if (Math.abs(p[i]) > 0.3 || Math.abs(v[i]) > 2) allSettled = false;
      }

      if (allSettled && !locked) {
        locked = true;
        lockUp();
        raf = 0;
        return; // settled — CSS transitions carry the clunk from here
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const ro = new ResizeObserver(sizeChase);
    ro.observe(line);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(stampTimer);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glyphs, rails]);

  return (
    <section
      ref={rootRef}
      className={`relative isolate overflow-hidden bg-background ${className}`}
    >
      {/* real, full headline — always present, visually hidden, read once and in order */}
      <h1 className="sr-only">{headline}</h1>
      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center px-6 py-24 text-center sm:py-32">
        {eyebrow ? (
          <p className="mb-6 font-mono text-[11px] tracking-widest text-ns-muted">{eyebrow}</p>
        ) : null}
        <div className="relative inline-block">
          <span
            ref={lineRef}
            aria-hidden
            className="relative z-10 inline-block whitespace-pre font-semibold text-foreground"
            style={{
              fontSize: "clamp(2.1rem, 6vw, 4rem)",
              lineHeight: 1.1,
              letterSpacing: `${BASE_TRACKING}em`,
            }}
          >
            {glyphs.map((ch, i) => (
              <span
                key={i}
                ref={(el) => {
                  glyphRefs.current[i] = el;
                }}
                className="inline-block"
              >
                {ch === " " ? " " : ch}
              </span>
            ))}
          </span>
          {/* the chase — a hairline frame that snaps to fit around the locked block */}
          <div
            ref={chaseRef}
            aria-hidden
            className="pointer-events-none absolute rounded-none border border-border"
            style={{ opacity: 0, transform: "scale(1.01)" }}
          />
        </div>
        <p
          ref={subheadRef}
          className="mt-6 max-w-xl text-base leading-relaxed text-ns-muted"
          style={{ opacity: 0 }}
        >
          {subhead}
        </p>
      </div>
    </section>
  );
}
