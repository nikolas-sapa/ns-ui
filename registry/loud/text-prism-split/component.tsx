"use client";

import { useEffect, useRef } from "react";

// A frosted prism strip rides the cursor across a headline. Text behind the
// strip magnifies about the strip center and tears into offset RGB channel
// slices (screen-blended clones) proportional to drag velocity — light
// through cut glass, spatial and physical, not a global hover filter. Each
// glyph snaps back with spring overshoot as the strip clears it. Manual
// spring integrator on a direct-DOM rAF loop; no React state on the hot
// path; the loop sleeps when settled.
export function PrismDragSplit({
  text = "REFRACTION",
  stripWidth = 120,
  stiffness = 300,
  damping = 24,
  mass = 1,
  dispersionGain = 0.018,
  maxDispersion = 14,
  magnify = 1.06,
  className = "",
}: {
  text?: string;
  /** prism strip width in px */
  stripWidth?: number;
  /** spring stiffness (N/m-ish, px units) */
  stiffness?: number;
  /** spring damping coefficient */
  damping?: number;
  /** spring mass */
  mass?: number;
  /** px of red-channel offset per px/s of strip velocity */
  dispersionGain?: number;
  /** channel offset clamp in px */
  maxDispersion?: number;
  /** scale of the refracted clones inside the strip */
  magnify?: number;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLSpanElement>(null);
  const redRef = useRef<HTMLDivElement>(null);
  const greenRef = useRef<HTMLDivElement>(null);
  const blueRef = useRef<HTMLDivElement>(null);
  const charRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const glyphs = Array.from(text);

  useEffect(() => {
    const container = containerRef.current;
    const strip = stripRef.current;
    const base = baseRef.current;
    const red = redRef.current;
    const green = greenRef.current;
    const blue = blueRef.current;
    if (!container || !strip || !base || !red || !green || !blue) return;

    const chars = charRefs.current
      .slice(0, Array.from(text).length)
      .filter((el): el is HTMLSpanElement => el !== null);
    const channels: [HTMLDivElement, number][] = [
      [red, 1],
      [green, 0],
      [blue, -1],
    ];

    let width = 0;
    let baseX = 0;
    let centers: number[] = [];

    // untransformed offsets — clones are pinned to the base headline's box so
    // the counter-translate keeps glyphs registered regardless of padding
    const measure = () => {
      width = container.offsetWidth;
      baseX = base.offsetLeft;
      const baseY = base.offsetTop;
      centers = chars.map((el) => el.offsetLeft + el.offsetWidth / 2);
      for (const [el] of channels) {
        el.style.left = `${baseX}px`;
        el.style.top = `${baseY}px`;
      }
    };

    // strip at x; clones counter-translated by -x and scaled about the strip
    // center so the glyph under the center stays registered while neighbors
    // bulge outward — a lens, not a sticker
    const apply = (x: number, dx: number) => {
      strip.style.transform = `translate3d(${x}px,0,0)`;
      const origin = `${x + stripWidth / 2 - baseX}px 50%`;
      for (const [el, sign] of channels) {
        el.style.transform = `translateX(${-x + dx * sign}px) scale(${magnify})`;
        el.style.transformOrigin = origin;
      }
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // no rAF: strip pinned at 38% with fixed channel offsets — the frozen
      // dispersion still reads as the concept
      const place = () => {
        measure();
        apply(width * 0.38, 6);
      };
      place();
      const ro = new ResizeObserver(place);
      ro.observe(container);
      return () => ro.disconnect();
    }

    measure();
    let x = width / 2 - stripWidth / 2;
    let v = 0;
    let target = x;
    let raf = 0;
    let last = 0;
    let covered = centers.map((c) => c > x && c < x + stripWidth);
    apply(x, 0);

    const loop = (now: number) => {
      const dt = Math.min(0.032, Math.max(0.001, (now - last) / 1000));
      last = now;
      // semi-implicit Euler spring integrator
      const accel = (stiffness * (target - x) - damping * v) / mass;
      v += accel * dt;
      x += v * dt;
      // velocity-proportional dispersion: stationary = converged near-white,
      // dragging tears the channels apart
      const dx = Math.max(-maxDispersion, Math.min(maxDispersion, v * dispersionGain));

      // glyph snap-back the instant the strip clears a char center
      for (let i = 0; i < centers.length; i++) {
        const inside = centers[i] > x && centers[i] < x + stripWidth;
        if (covered[i] && !inside) {
          const el = chars[i];
          el.style.setProperty("--nsui-psd-dx", `${v >= 0 ? 6 : -6}px`);
          el.classList.remove("nsui-psd-snap");
          void el.offsetWidth; // restart the overshoot animation
          el.classList.add("nsui-psd-snap");
        }
        covered[i] = inside;
      }

      if (Math.abs(v) < 2 && Math.abs(target - x) < 0.25) {
        x = target;
        v = 0;
        apply(x, 0);
        raf = 0; // sleep
      } else {
        apply(x, dx);
        raf = requestAnimationFrame(loop);
      }
    };

    const wake = () => {
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };
    const clampTarget = (t: number) =>
      Math.min(width - stripWidth / 2, Math.max(-stripWidth / 2, t));

    const onMove = (e: PointerEvent) => {
      const left = container.getBoundingClientRect().left;
      target = clampTarget(e.clientX - left - stripWidth / 2);
      wake();
    };
    const onLeave = () => {
      target = width / 2 - stripWidth / 2; // spring back to center rest
      wake();
    };
    const ro = new ResizeObserver(() => {
      measure();
      target = clampTarget(target);
      covered = centers.map((c) => c > x && c < x + stripWidth);
      apply(x, 0);
    });

    ro.observe(container);
    container.addEventListener("pointermove", onMove);
    container.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      container.removeEventListener("pointermove", onMove);
      container.removeEventListener("pointerleave", onLeave);
    };
  }, [text, stripWidth, stiffness, damping, mass, dispersionGain, maxDispersion, magnify]);

  return (
    <div
      ref={containerRef}
      className={`relative inline-block cursor-ew-resize touch-none select-none font-sans font-semibold text-foreground ${className}`}
      // kerning/ligatures off so the per-char base and the continuous-text
      // clones produce byte-identical layout — registration depends on it
      style={{
        fontKerning: "none",
        fontVariantLigatures: "none",
        fontFeatureSettings: '"liga" 0, "kern" 0',
      }}
    >
      <style>{`@keyframes nsui-psd-snap{from{transform:translateX(var(--nsui-psd-dx,6px))}to{transform:translateX(0)}}.nsui-psd-snap{animation:nsui-psd-snap 350ms cubic-bezier(0.34,1.56,0.64,1)}`}</style>

      {/* base headline, split per-char for the snap-back */}
      <span ref={baseRef} aria-label={text} role="text" className="whitespace-pre">
        {glyphs.map((g, i) => (
          <span
            key={i}
            aria-hidden
            ref={(el) => {
              charRefs.current[i] = el;
            }}
            className="inline-block will-change-transform"
          >
            {g === " " ? " " : g}
          </span>
        ))}
      </span>

      {/* prism strip: frosted slab that occludes the base beneath it */}
      <div
        ref={stripRef}
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 isolate overflow-hidden border-x border-black/10 dark:border-white/10 bg-background/85 backdrop-blur-md will-change-transform shadow-[inset_0_1px_0_0_rgba(0,0,0,0.06),inset_0_-1px_0_0_rgba(0,0,0,0.03),0_8px_24px_-8px_rgba(0,0,0,0.25)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),inset_0_-1px_0_0_rgba(255,255,255,0.06),0_8px_24px_-8px_rgba(0,0,0,0.5)]"
        style={{ width: stripWidth }}
      >
        {/* refracted content, edge-faded so glyphs melt in instead of hard-clipping.
            Forced dark tint (not theme-token-driven) so the mix-blend-screen RGB
            clones always pop against a near-black backdrop — screen blending
            against a near-white light-mode background would wash channel text
            out to invisible. */}
        <div className="absolute inset-0 bg-[#0a0a0a]/90 [mask-image:linear-gradient(to_right,transparent,black_12px,black_calc(100%-12px),transparent)]">
          {(
            [
              [redRef, "#ff0000"],
              [greenRef, "#00ff00"],
              [blueRef, "#0000ff"],
            ] as const
          ).map(([ref, color]) => (
            <div
              key={color}
              ref={ref}
              className="absolute left-0 top-0 whitespace-pre mix-blend-screen will-change-transform"
              style={{ color }}
            >
              {text.replace(/ /g, " ")}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
