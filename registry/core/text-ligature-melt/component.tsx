"use client";

import { useEffect, useId, useRef } from "react";

// ---------------------------------------------------------------------------
// LigatureMelt — a headline whose glyphs liquefy near the cursor. An SVG gooey
// filter (feGaussianBlur + alpha-threshold feColorMatrix) fuses overlapping
// glyph edges into temporary ligature necks; glyphs inside a Gaussian field
// swell and pull toward the cursor while out-of-field glyphs compress so the
// total line width stays constant (both ends pinned). Leaving snaps every
// ligature apart on an underdamped spring — visible surface-tension overshoot.
// At rest a faint synthetic field sweeps the line on its own (half the
// amplitude of a real hover) so the melt is visibly ambient, not something
// that only exists on hover; the goo blur itself ramps off that same field
// (near-zero away from it, up to `blur` inside it) instead of sitting at a
// constant blobby value, so idle text reads crisp except where it's melting.
// Real DOM text throughout: selectable, SEO-safe, the filter is visual only.
// Direct-DOM rAF loop — no React state on the hot path, pauses offscreen.
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
  /** feGaussianBlur stdDeviation at full field strength — ramps down to near-zero at rest */
  blur?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const lineRef = useRef<HTMLSpanElement>(null);
  const blurRef = useRef<SVGFEGaussianBlurElement>(null);
  const reactId = useId();
  const filterId = `lm-goo-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const glyphs = Array.from(text);
  const idleBlur = Math.min(0.6, blur * 0.1);

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
    let releasing = false;
    let visible = true;
    let raf = 0;
    let last = 0;
    let blurCur = idleBlur;
    let ambientElapsed = 0;

    const K = 170; // spring stiffness s^-2
    const C = 2 * 0.55 * Math.sqrt(K); // zeta 0.55 — one visible rebound
    const twoSigma2 = 2 * sigma * sigma;
    // ambient: a synthetic field sweeps the line on its own at rest, at half
    // the amplitude of a real hover, so the melt reads as the default look
    // rather than something only a pointer can trigger
    const AMBIENT_SWELL = swell * 0.5;
    const AMBIENT_PULL = pull * 0.5;
    const AMBIENT_PERIOD = 5200; // ms per back-and-forth sweep
    // the field's peak is ~1 almost continuously while ambient sweeps past
    // *some* glyph, so it can't drive the blur ramp at full strength without
    // recreating the old "always blobby" look — only hover earns full goo
    const AMBIENT_BLUR_SCALE = 0.22;

    const apply = () => {
      for (let i = 0; i < n; i++) {
        spans[i].style.transform =
          `translateX(${dx[i].toFixed(3)}px) scale(${sx[i].toFixed(4)}, ${sy[i].toFixed(4)})`;
      }
    };

    // writes tDx/tSx/tSy for a given field center + swell/pull amplitude,
    // returns the peak field value (drives the blur ramp)
    const computeTargets = (cx: number, swellAmt: number, pullAmt: number) => {
      // pass 1: gaussian field, swell scale, total induced width surplus
      let excess = 0;
      let wSum = 0;
      let maxG = 0;
      for (let i = 0; i < n; i++) {
        const d = cx - baseC[i];
        const gi = Math.exp(-(d * d) / twoSigma2);
        g[i] = gi;
        if (gi > maxG) maxG = gi;
        const s = 1 + swellAmt * gi;
        tSy[i] = s;
        excess += baseW[i] * (s - 1);
        wSum += baseW[i] * (1 - gi);
      }
      // pass 2: width conservation — the surplus is paid back by compressing
      // out-of-field glyphs (weighted by 1 - g), then a cumulative re-layout
      // keeps the line contiguous with both ends pinned. The field pull then
      // deliberately breaks contiguity near the field so edges overlap and goo.
      let x = lineLeft;
      for (let i = 0; i < n; i++) {
        const w =
          baseW[i] * tSy[i] -
          (wSum > 1e-3 ? (excess * baseW[i] * (1 - g[i])) / wSum : 0);
        tSx[i] = w / Math.max(1e-3, baseW[i]);
        const d = cx - baseC[i];
        tDx[i] = x + w / 2 - baseC[i] + pullAmt * g[i] * Math.tanh(d / 24);
        x += w + gaps[i];
      }
      return maxG;
    };

    // framerate-normalized lerp toward the current targets; velocity is
    // tracked so a leave mid-approach hands momentum to the release spring
    const approach = (dt: number, rate: number) => {
      const a = 1 - Math.pow(rate, dt * 60);
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
      }
    };

    // ambient field position: a slow cosine sweep between the line's ends
    const ambientCenter = (elapsedMs: number) => {
      const span = baseC[n - 1] - baseC[0] || 1;
      const t = (elapsedMs % AMBIENT_PERIOD) / AMBIENT_PERIOD;
      const f = (1 - Math.cos(t * Math.PI * 2)) / 2; // 0 -> 1 -> 0
      return baseC[0] + span * f;
    };

    const loop = (now: number) => {
      const dt = last === 0 ? 1 / 60 : Math.min(0.05, (now - last) / 1000);
      last = now;
      let fieldPeak = 0;

      if (hovered) {
        fieldPeak = computeTargets(cursorX, swell, pull);
        approach(dt, 0.85); // lerp ~0.15/frame — responsive to the real cursor
      } else if (releasing) {
        // release: every span snaps back on an underdamped spring — the
        // ligatures pinch apart with surface-tension overshoot
        let settled = true;
        let maxDeviation = 0;
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

          maxDeviation = Math.max(
            maxDeviation,
            Math.abs(dx[i]) / Math.max(1, pull),
            Math.abs(sy[i] - 1) / Math.max(1e-3, swell)
          );
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
        fieldPeak = Math.min(1, maxDeviation);
        if (settled) {
          for (let i = 0; i < n; i++) {
            dx[i] = 0;
            sx[i] = 1;
            sy[i] = 1;
            vDx[i] = 0;
            vSx[i] = 0;
            vSy[i] = 0;
          }
          releasing = false;
          ambientElapsed = 0;
        }
      } else {
        // ambient: no pointer involved — a faint field drifts on its own so
        // the melt is the resting look, not a hover-only trick
        ambientElapsed += dt * 1000;
        const ax = ambientCenter(ambientElapsed);
        fieldPeak = computeTargets(ax, AMBIENT_SWELL, AMBIENT_PULL) * AMBIENT_BLUR_SCALE;
        approach(dt, 0.965); // much slower lerp — a gentle breathing motion
      }

      apply();

      // goo blur ramps off the field itself — near-zero away from any
      // activity, up to `blur` at the field's peak — instead of sitting at a
      // constant blobby value the whole time. Ambient's peak is scaled down
      // (see AMBIENT_BLUR_SCALE) since the sweep sits near *some* glyph
      // almost continuously — full-strength blur there would just recreate
      // the old always-blobby look; only a real hover earns full goo.
      const targetBlur = idleBlur + (blur - idleBlur) * fieldPeak;
      blurCur += (targetBlur - blurCur) * Math.min(1, dt * 6);
      blurRef.current?.setAttribute("stdDeviation", blurCur.toFixed(3));

      raf = visible ? requestAnimationFrame(loop) : 0;
    };

    const wake = () => {
      if (!raf && visible) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    const onMove = (e: PointerEvent) => {
      cursorX = e.clientX - root.getBoundingClientRect().left;
      hovered = true;
      releasing = false;
      wake();
    };
    const onLeave = () => {
      if (!hovered) return;
      hovered = false;
      releasing = true;
      wake();
    };
    // keyboard/focus parity: a tab-focused line melts centered on itself,
    // same as a cursor parked mid-line — blur triggers the same release spring
    const onFocus = () => {
      cursorX = (baseC[0] + baseC[n - 1]) / 2;
      hovered = true;
      releasing = false;
      wake();
    };

    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerdown", onMove);
    root.addEventListener("pointerleave", onLeave);
    root.addEventListener("pointerup", onLeave);
    root.addEventListener("pointercancel", onLeave);
    root.addEventListener("focus", onFocus);
    root.addEventListener("blur", onLeave);
    const ro = new ResizeObserver(measure);
    ro.observe(line);
    // ambient motion never "settles", so sleeping means pausing offscreen
    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) wake();
      else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
        last = 0;
      }
    });
    io.observe(root);

    wake(); // ambient drift is the default look — start immediately

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerdown", onMove);
      root.removeEventListener("pointerleave", onLeave);
      root.removeEventListener("pointerup", onLeave);
      root.removeEventListener("pointercancel", onLeave);
      root.removeEventListener("focus", onFocus);
      root.removeEventListener("blur", onLeave);
      for (const el of spans) el.style.transform = "";
    };
  }, [text, sigma, swell, pull, blur, idleBlur]);

  return (
    <span
      ref={rootRef}
      role="button"
      tabIndex={0}
      className={`relative inline-block rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ns-accent ${className}`}
    >
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
            <feGaussianBlur
              ref={blurRef}
              in="SourceGraphic"
              stdDeviation={idleBlur}
              result="b"
            />
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
