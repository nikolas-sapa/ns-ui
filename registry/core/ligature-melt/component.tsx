"use client";

import { useEffect, useId, useRef } from "react";

// ---------------------------------------------------------------------------
// LigatureMelt — a headline whose glyphs liquefy near the cursor. An SVG gooey
// filter (feGaussianBlur + alpha-threshold feColorMatrix) fuses overlapping
// glyph edges into temporary ligature necks; glyphs inside a Gaussian field
// swell and pull toward the cursor while out-of-field glyphs compress so the
// total line width stays constant (both ends pinned). Leaving snaps every
// ligature apart on an underdamped spring — visible surface-tension overshoot.
// Real DOM text throughout: selectable, SEO-safe, the filter is visual only.
// Direct-DOM rAF loop — no React state on the hot path, sleeps when settled.
// ---------------------------------------------------------------------------
export function LigatureMelt({
  text = "SURFACE TENSION",
  sigma = 70,
  swell = 0.35,
  pull = 6,
  blur = 6,
  className = "",
}: {
  /** headline text — rendered as real, selectable DOM glyphs */
  text?: string;
  /** gaussian falloff radius of the melt field in px */
  sigma?: number;
  /** max extra scale at zero distance (0.35 → 1.35x) */
  swell?: number;
  /** max translation toward the cursor in px — creates the overlap that goos */
  pull?: number;
  /** feGaussianBlur stdDeviation — thickness of the metaball necks */
  blur?: number;
  className?: string;
}) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const lineRef = useRef<HTMLSpanElement>(null);
  const reactId = useId();
  const filterId = `lm-goo-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const glyphs = Array.from(text);

  useEffect(() => {
    const root = rootRef.current;
    const line = lineRef.current;
    if (!root || !line) return;

    // reduced motion: crisp static text — filter off, no listeners, no loop
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      line.style.filter = "none";
      return () => {
        line.style.filter = "";
      };
    }

    const spans = Array.from(line.children) as HTMLElement[];
    const n = spans.length;
    if (n === 0) return;

    // layout metrics — offset* ignores transforms, so remeasuring is safe live
    const baseC = new Float64Array(n); // glyph center, relative to root
    const baseW = new Float64Array(n);
    const gaps = new Float64Array(n); // kerning/tracking gap after glyph i
    let lineLeft = 0;
    const measure = () => {
      for (let i = 0; i < n; i++) {
        baseW[i] = spans[i].offsetWidth;
        baseC[i] = spans[i].offsetLeft + spans[i].offsetWidth / 2;
      }
      for (let i = 0; i < n - 1; i++) {
        gaps[i] = spans[i + 1].offsetLeft - (spans[i].offsetLeft + baseW[i]);
      }
      gaps[n - 1] = 0;
      lineLeft = spans[0].offsetLeft;
    };
    measure();

    // hot-path state — plain arrays only, the rAF loop is the sole DOM writer
    const g = new Float64Array(n);
    const dx = new Float64Array(n);
    const sx = new Float64Array(n).fill(1);
    const sy = new Float64Array(n).fill(1);
    const vDx = new Float64Array(n);
    const vSx = new Float64Array(n);
    const vSy = new Float64Array(n);
    const tDx = new Float64Array(n);
    const tSx = new Float64Array(n).fill(1);
    const tSy = new Float64Array(n).fill(1);

    let cursorX = 0;
    let hovered = false;
    let raf = 0;
    let last = 0;

    const K = 170; // spring stiffness s^-2
    const C = 2 * 0.55 * Math.sqrt(K); // zeta 0.55 — one visible rebound
    const twoSigma2 = 2 * sigma * sigma;

    const apply = () => {
      for (let i = 0; i < n; i++) {
        spans[i].style.transform =
          `translateX(${dx[i].toFixed(3)}px) scale(${sx[i].toFixed(4)}, ${sy[i].toFixed(4)})`;
      }
    };

    const computeTargets = () => {
      // pass 1: gaussian field, swell scale, total induced width surplus
      let excess = 0;
      let wSum = 0;
      for (let i = 0; i < n; i++) {
        const d = cursorX - baseC[i];
        const gi = Math.exp(-(d * d) / twoSigma2);
        g[i] = gi;
        const s = 1 + swell * gi;
        tSy[i] = s;
        excess += baseW[i] * (s - 1);
        wSum += baseW[i] * (1 - gi);
      }
      // pass 2: width conservation — the surplus is paid back by compressing
      // out-of-field glyphs (weighted by 1 - g), then a cumulative re-layout
      // keeps the line contiguous with both ends pinned. The cursor pull then
      // deliberately breaks contiguity near the field so edges overlap and goo.
      let x = lineLeft;
      for (let i = 0; i < n; i++) {
        const w =
          baseW[i] * tSy[i] -
          (wSum > 1e-3 ? (excess * baseW[i] * (1 - g[i])) / wSum : 0);
        tSx[i] = w / Math.max(1e-3, baseW[i]);
        const d = cursorX - baseC[i];
        tDx[i] = x + w / 2 - baseC[i] + pull * g[i] * Math.tanh(d / 24);
        x += w + gaps[i];
      }
    };

    const loop = (now: number) => {
      const dt = last === 0 ? 1 / 60 : Math.min(0.05, (now - last) / 1000);
      last = now;
      let settled = true;

      if (hovered) {
        computeTargets();
        // approach: lerp 0.15/frame, framerate-normalized; velocity is
        // tracked so a leave mid-approach hands momentum to the spring
        const a = 1 - Math.pow(0.85, dt * 60);
        for (let i = 0; i < n; i++) {
          const ndx = dx[i] + (tDx[i] - dx[i]) * a;
          const nsx = sx[i] + (tSx[i] - sx[i]) * a;
          const nsy = sy[i] + (tSy[i] - sy[i]) * a;
          vDx[i] = (ndx - dx[i]) / dt;
          vSx[i] = (nsx - sx[i]) / dt;
          vSy[i] = (nsy - sy[i]) / dt;
          dx[i] = ndx;
          sx[i] = nsx;
          sy[i] = nsy;
          if (
            Math.abs(tDx[i] - dx[i]) > 0.02 ||
            Math.abs(tSx[i] - sx[i]) > 0.002 ||
            Math.abs(tSy[i] - sy[i]) > 0.002
          ) {
            settled = false;
          }
        }
      } else {
        // release: every span snaps back on an underdamped spring — the
        // ligatures pinch apart with surface-tension overshoot
        for (let i = 0; i < n; i++) {
          let v = vDx[i];
          let p = dx[i];
          v += (-K * p - C * v) * dt;
          p += v * dt;
          vDx[i] = v;
          dx[i] = p;

          v = vSx[i];
          let s = sx[i];
          v += (-K * (s - 1) - C * v) * dt;
          s += v * dt;
          vSx[i] = v;
          sx[i] = s;

          v = vSy[i];
          s = sy[i];
          v += (-K * (s - 1) - C * v) * dt;
          s += v * dt;
          vSy[i] = v;
          sy[i] = s;

          if (
            Math.abs(dx[i]) > 0.02 ||
            Math.abs(vDx[i]) > 0.5 ||
            Math.abs(sx[i] - 1) > 0.002 ||
            Math.abs(vSx[i]) > 0.05 ||
            Math.abs(sy[i] - 1) > 0.002 ||
            Math.abs(vSy[i]) > 0.05
          ) {
            settled = false;
          }
        }
        if (settled) {
          for (let i = 0; i < n; i++) {
            dx[i] = 0;
            sx[i] = 1;
            sy[i] = 1;
            vDx[i] = 0;
            vSx[i] = 0;
            vSy[i] = 0;
          }
        }
      }

      apply();
      if (settled) {
        raf = 0;
        last = 0;
      } else {
        raf = requestAnimationFrame(loop);
      }
    };

    const wake = () => {
      if (!raf) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    const onMove = (e: PointerEvent) => {
      cursorX = e.clientX - root.getBoundingClientRect().left;
      hovered = true;
      wake();
    };
    const onLeave = () => {
      hovered = false;
      wake();
    };

    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerdown", onMove);
    root.addEventListener("pointerleave", onLeave);
    const ro = new ResizeObserver(measure);
    ro.observe(line);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerdown", onMove);
      root.removeEventListener("pointerleave", onLeave);
      for (const el of spans) el.style.transform = "";
    };
  }, [text, sigma, swell, pull]);

  return (
    <span ref={rootRef} className={`relative inline-block ${className}`}>
      {/* blur + alpha threshold: overlapping glyph edges fuse into necks */}
      <svg aria-hidden focusable="false" className="absolute h-0 w-0">
        <defs>
          <filter
            id={filterId}
            x="-30%"
            y="-60%"
            width="160%"
            height="220%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="b" />
            <feColorMatrix
              in="b"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"
            />
          </filter>
        </defs>
      </svg>
      <span
        ref={lineRef}
        role="text"
        aria-label={text}
        className="inline-block whitespace-pre"
        style={{ filter: `url(#${filterId})` }}
      >
        {glyphs.map((c, i) => (
          <span key={i} aria-hidden className="inline-block will-change-transform">
            {c}
          </span>
        ))}
      </span>
    </span>
  );
}
