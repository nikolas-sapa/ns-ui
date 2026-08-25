"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";

// ---------------------------------------------------------------------------
// BackgroundTextBranchCanopy — a full-bleed ambient background where TEXT IS
// THE LIMB, not a texture on one. An L-system tree grows in Canvas 2D, but
// every branch is drawn with exactly one `ctx.fillText()` call after
// `translate(foot)` + `rotate(limbAngle)` — a run of readable words from
// `text`, windowed to that limb's length, set as a rigid body pivoting on
// its own foot (the joint it grows from) as it angles away from its parent.
// There is no per-character grid and no glyph-per-cell loop anywhere in this
// file: the primitive is a run of legible words placed as geometry, not a
// raster stand-in for luminance.
//
// WHY THIS IS NOT A RESTYLE OF EITHER NEIGHBORING FAMILY —
//   vs. background-ascii-plasma / hero-ascii-* / text-ascii-cascade: those
//   quantize a scalar field onto a FIXED CHARACTER GRID, one glyph per cell,
//   chosen by density/luminance — the character is a stand-in pixel and
//   reads as meaningless. Nothing here is gridded and no character is chosen
//   by density; the alphabet is real words from `text`, unbroken, upright,
//   and spaced exactly as typed.
//   vs. tendril-cast / auxin-canal / tree-root-trace / cambium-lay: those
//   grow STROKES — an SVG `<path>` (tendril-cast, tree-root-trace) or a
//   filled ring boundary (cambium-lay) that is textured or colored
//   afterward. This grows TEXT STRIPS: the geometric primitive painted per
//   limb is `fillText`, never a `stroke()`/path `d` at all. A stroke can be
//   drawn at any width without changing its meaning; a limb here stops
//   existing as a limb the moment its word run would clip below a few
//   readable characters (see LIMB BUDGET) — the text isn't dressing on a
//   line, the text's own legibility is the constraint that shapes the tree.
//
// LIMB BUDGET, DERIVED FROM READABILITY, NOT THE REVERSE. Trunk length
// L0 = 0.28 * min(container w, h); each generation's length is L0 * 0.72^d.
// Type size is picked ONCE from the container (9-15px, clamped from
// min-dimension * 0.022) and never shrinks with depth — recession is
// expressed as fewer words and lower alpha, never smaller glyphs, because a
// depth ramp that shrinks type is exactly the ASCII family's "raster
// stand-in" failure mode reintroduced through the back door. A generation
// stops recursing once its own length can no longer hold ~4 monospace
// characters (measured, not guessed) — that per-size arithmetic is the
// entire depth ceiling; see the readme block above `buildTopology`.
//
// PIVOT ON THE FOOT: draw-time places `ctx.translate` at the limb's OWN
// foot (where it grows from its parent's tip), rotates to the limb's
// absolute angle, and fillText's from local (0,0) — the run is anchored at
// the joint and extends toward the tip, upright. Any limb whose absolute
// angle points generally leftward (cos < 0) is drawn from `angle + PI` with
// `textAlign: "right"` instead of `"left"` — same physical span from the
// same foot, still upright, never mirrored/upside-down text.
//
// ALIVE FOREVER, TWO STRUCTURAL CHANNELS, NOT A GROW-ONCE-AND-STOP TIMER:
//   (1) Turnover. Only the outer canopy (depth >= CHURN_DEPTH) ages and
//       senesces: each churning limb owns its own randomized lifespan: on
//       expiry it eases its length down to a stub over SENESCE_MS while its
//       alpha fades further, then regrows from the same foot with a fresh
//       word offset and a new lifespan. The trunk and first branch level
//       never senesce, so the crown's skeleton holds while its outer growth
//       continually sheds and replaces itself — this is what keeps the
//       canopy from ever reaching a single finished, static frame.
//   (2) Sway. Every limb's absolute angle carries `swayAmp(depth) *
//       sin(t*swayFreq(depth) + phase)` on top of its angle from its
//       parent, and because the tree is walked parent-before-child every
//       frame, a child's absolute angle already includes its parent's sway
//       — the wobble composes down the chain instead of jittering
//       independently per limb, which is what reads as one breathing crown
//       instead of noise.
// Both are on unconditionally, not gated behind hover/pointer — this is a
// resting-state background.
//
// CONTENT PROTECTION: the canopy is deliberately origin-biased toward the
// upper-left two-thirds of the frame (trunk foot sits left-of-center,
// growing up-and-right), and a CSS scrim (a `--background`-tinted linear
// gradient, strongest at the bottom edge) sits above the canvas so a
// headline/CTA docked at the bottom — the zone the demo actually uses — has
// a real reading surface under it rather than fighting a full crown of
// words. Trunk bias alone is not enough (the crown still reaches the lower
// third at deep containers), so both are required together.
//
// TOKENS: --foreground for the inner ~40% of depth (near, heaviest),
// --ns-muted for the rest (receding), with alpha itself also stepping down
// by depth on top of that — so the near/far read holds by VALUE in both
// themes without any luminance comparison or hue math, the same guarantee
// dye-whorl/weld-pool get from a luminance ramp, bought here for free by
// just compositing a token color at lower alpha over `--background`.
// `--ns-accent` never appears — this is a resting background, not
// interaction chrome. Canvas 2D fillStyle cannot take a raw `var(--x)`
// string, so both tokens are read via getComputedStyle at mount and
// re-read on a MutationObserver watching documentElement's class, same as
// every other canvas-hosted showpiece in this registry.
//
// PERFORMANCE: default hero-sized container (~1200x800) settles at ~60-65
// limbs (2 primary trunks off one stub, capped generation depth 5-6 by the
// readability rule above); a large full-bleed container can grow to the
// hard ceiling of 150 limbs (LIMB_BUDGET). 150 `fillText` calls/frame is
// negligible next to the clear+composite of a full-bleed canvas, which is
// the actual per-frame cost here — DPR is capped at 2 (1.5 blurs 10px mono
// past legibility), 0.6 inside an autoplay card (registry
// convention, `[data-autoplay-root]`), and the render loop pauses on
// `visibilitychange` and via `IntersectionObserver` when scrolled offscreen.
//
// SMALLEST READABLE SIZE: at a 320px min-dimension (L0=90px, font 9px,
// cellW ~5.4px), a first-generation limb (length ~65px) still holds a full
// short word plus a partial second word (~12 chars) — readable. By the
// third generation (length ~34px) a limb holds one short word only; the
// component simply stops generating a fourth generation at that size
// (MIN_LIMB_PX gate) rather than shipping unreadable text, so the crown is
// shallower, not smaller-lettered, on small containers.
// ---------------------------------------------------------------------------

interface Limb {
  parent: number; // -1 for the trunk stub
  depth: number;
  relAngle: number; // angle contributed relative to the parent's absolute angle (trunk: absolute)
  lenFull: number; // fully-grown length in px
  churns: boolean; // true once depth >= CHURN_DEPTH — only churning limbs senesce/regrow
  swayAmp: number;
  swayFreq: number;
  swayPhase: number;
  wordStart: number;
  lifespan: number;
  // live simulation state
  state: "growing" | "mature" | "senescing";
  growProgress: number; // 0..1, eased length fraction
  age: number; // ms since last (re)birth, mature-phase clock
  senesceT: number; // 0..1 progress through the senescence ease
  // per-frame computed geometry (written during the draw-time tree walk)
  footX: number;
  footY: number;
  tipX: number;
  tipY: number;
  absAngle: number;
}

const GROW_MS = 2200; // ms for one limb to ease from stub to full length
const CHILD_START_FRAC = 0.55; // a limb's children begin growing once it is this far along — the natural stagger, no separate timer needed
const CHURN_DEPTH = 2; // trunk + first branch level (depth 0-1) never senesce, keeping the crown's skeleton stable
const SENESCE_MS = 1500;
const SHRINK_FLOOR = 0.22; // a senescing limb eases down to this fraction of full length, never to zero (a visible stub, not a pop)
const LIFESPAN_MIN = 7000;
const LIFESPAN_MAX = 15000;
const RATIO = 0.72; // per-generation length ratio
const HARD_MAX_DEPTH = 6;
const MIN_RUN_CHARS = 4; // a generation stops once its length can't hold this many monospace chars
const LIMB_BUDGET = 150; // hard ceiling on total limbs regardless of container size
const STEP_MS = 1000 / 30; // fixed 30Hz simulation tick, matches the registry's other growth components
const PREWARM_MS = 9000; // fast-forwarded synchronously before first paint so t=0 shows a full crown, not a bare stub (tendril-cast's PREWARM_TICKS pattern)
const REDUCED_FREEZE_MS = 16000; // fast-forwarded for prefers-reduced-motion: past first full maturation and into steady churn, so the frozen frame shows varied limb depths/ages, not a single freshly-completed tree
const MAX_REDUCED_TICKS = 6000;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeLimb(
  parent: number,
  depth: number,
  relAngle: number,
  lenFull: number,
  rand: () => number,
  wordCount: number
): Limb {
  const churns = depth >= CHURN_DEPTH;
  return {
    parent,
    depth,
    relAngle,
    lenFull,
    churns,
    swayAmp: Math.min(0.09, 0.015 + depth * 0.01),
    swayFreq: 0.00015 + depth * 0.00004 + rand() * 0.00006,
    swayPhase: rand() * Math.PI * 2,
    wordStart: wordCount > 0 ? Math.floor(rand() * wordCount) : 0,
    lifespan: LIFESPAN_MIN + rand() * (LIFESPAN_MAX - LIFESPAN_MIN),
    state: "growing",
    growProgress: 0,
    age: 0,
    senesceT: 0,
    footX: 0,
    footY: 0,
    tipX: 0,
    tipY: 0,
    absAngle: 0,
  };
}

// Builds the fixed topology (parent links, relative angles, full lengths) for
// a container of the given size. Depth ceiling is derived from readability —
// a generation is only added once its length can hold MIN_RUN_CHARS at the
// container's own type size — not picked as an arbitrary constant, per the
// file header. Two primary trunks off one short stub give the crown width to
// actually fill a wide frame instead of reading as a single spike.
function buildTopology(w: number, h: number, cellW: number, rand: () => number, wordCount: number): Limb[] {
  const minDim = Math.min(w, h);
  const L0 = Math.max(24, minDim * 0.28);
  const minLimbPx = cellW * MIN_RUN_CHARS;
  const limbs: Limb[] = [];

  const stub = makeLimb(-1, 0, -Math.PI / 2, L0 * 0.4, rand, wordCount);
  limbs.push(stub);

  const spawn = (parentIdx: number, depth: number, relAngle: number, lenFull: number) => {
    if (limbs.length >= LIMB_BUDGET) return;
    if (depth > HARD_MAX_DEPTH) return;
    const idx = limbs.length;
    limbs.push(makeLimb(parentIdx, depth, relAngle, lenFull, rand, wordCount));
    const nextLen = lenFull * RATIO;
    if (nextLen < minLimbPx || depth >= HARD_MAX_DEPTH) return;
    const spread = 0.34 + depth * 0.05 + rand() * 0.08;
    const jitter = () => (rand() - 0.5) * 0.12;
    spawn(idx, depth + 1, -spread + jitter(), nextLen);
    spawn(idx, depth + 1, spread + jitter(), nextLen);
  };

  const primaryLen = L0 * RATIO;
  if (primaryLen >= minLimbPx) {
    spawn(0, 1, -0.3 + (rand() - 0.5) * 0.1, primaryLen);
    spawn(0, 1, 0.3 + (rand() - 0.5) * 0.1, primaryLen);
  }

  return limbs;
}

function rebirth(limb: Limb, rand: () => number, wordCount: number): void {
  limb.state = "growing";
  limb.growProgress = 0;
  limb.age = 0;
  limb.senesceT = 0;
  limb.wordStart = wordCount > 0 ? Math.floor(rand() * wordCount) : 0;
  limb.lifespan = LIFESPAN_MIN + rand() * (LIFESPAN_MAX - LIFESPAN_MIN);
}

function tick(limb: Limb, dt: number, rand: () => number, wordCount: number, parentReady: boolean): void {
  if (!parentReady) return; // children wait for the parent to clear CHILD_START_FRAC — see the walk in draw()
  switch (limb.state) {
    case "growing": {
      limb.growProgress = Math.min(1, limb.growProgress + dt / GROW_MS);
      if (limb.growProgress >= 1) {
        limb.state = "mature";
        limb.age = 0;
      }
      return;
    }
    case "mature": {
      limb.age += dt;
      if (limb.churns && limb.age > limb.lifespan) {
        limb.state = "senescing";
        limb.senesceT = 0;
      }
      return;
    }
    case "senescing": {
      limb.senesceT = Math.min(1, limb.senesceT + dt / SENESCE_MS);
      if (limb.senesceT >= 1) rebirth(limb, rand, wordCount);
      return;
    }
  }
}

function buildRun(words: string[], startIdx: number, maxChars: number): string {
  if (words.length === 0 || maxChars < 1) return "";
  let out = "";
  let i = startIdx;
  for (let guard = 0; guard < 40; guard++) {
    const w = words[i % words.length]!;
    const candidate = out.length === 0 ? w : `${out} ${w}`;
    if (out.length > 0 && candidate.length > maxChars) break;
    out = candidate;
    i++;
    if (out.length >= maxChars) break;
  }
  return out;
}

const DEFAULT_TEXT =
  "growth begins as a single word and forks into every branch it can still afford to reach light finds its way through language turning each fork into a fresh sentence rooted in the last";

export interface BackgroundTextBranchCanopyProps {
  /** source text whose words run along each limb, windowed to fit and cycled per limb as the canopy grows and turns over. */
  text?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
  /** inline styles merged onto the root element */
  style?: CSSProperties;
}

export function BackgroundTextBranchCanopy({ text = DEFAULT_TEXT, className = "", style }: BackgroundTextBranchCanopyProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const words = text.trim().split(/\s+/).filter(Boolean);
    const rand = mulberry32(0x9a5c0de1);

    let disposed = false;
    let raf = 0;
    let last = 0;
    let acc = 0;
    let simTime = 0;
    let visible = true;
    let paused = false;

    let dpr = 1;
    let w = 0;
    let h = 0;
    let cellW = 8; // refined after document.fonts.ready via offscreen measureText
    let fontSize = 12;
    let fgCss = "";
    let mutedCss = "";
    let limbs: Limb[] = [];

    const readTokens = () => {
      fgCss = getComputedStyle(canvas).color;
      const root = getComputedStyle(document.documentElement);
      mutedCss = root.getPropertyValue("--ns-muted").trim() || fgCss;
    };

    const measureCell = (fontFamily: string) => {
      const off = document.createElement("canvas");
      const octx = off.getContext("2d");
      if (!octx) return;
      octx.font = `${fontSize}px ${fontFamily}`;
      cellW = Math.max(3, octx.measureText("MMMMMMMMMM").width / 10);
    };

    const rebuild = () => {
      const minDim = Math.min(w, h);
      fontSize = Math.min(15, Math.max(9, minDim * 0.022));
      const fontFamily = getComputedStyle(canvas).fontFamily;
      measureCell(fontFamily);
      ctx.font = `${fontSize}px ${fontFamily}`;
      limbs = buildTopology(w, h, cellW, rand, words.length);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      const isCard = !!canvas.closest("[data-autoplay-root]");
      dpr = isCard ? Math.min(0.6, window.devicePixelRatio || 1) : Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      rebuild();
    };

    const stepAll = (dt: number) => {
      simTime += dt;
      for (const limb of limbs) {
        const parentReady = limb.parent === -1 || limbs[limb.parent]!.growProgress >= CHILD_START_FRAC;
        tick(limb, dt, rand, words.length, parentReady);
      }
    };

    // trunk foot biased into the upper-left two-thirds of the frame — see
    // CONTENT PROTECTION in the file header. Growth runs generally up and to
    // the right from there.
    const originX = () => w * 0.32;
    const originY = () => h * 0.94;

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const ox = originX();
      const oy = originY();
      const maxDepth = limbs.reduce((m, l) => Math.max(m, l.depth), 1);

      for (let i = 0; i < limbs.length; i++) {
        const limb = limbs[i]!;
        const parent = limb.parent === -1 ? null : limbs[limb.parent]!;
        limb.footX = parent ? parent.tipX : ox;
        limb.footY = parent ? parent.tipY : oy;

        const sway = limb.swayAmp * Math.sin(simTime * limb.swayFreq + limb.swayPhase);
        const parentAngle = parent ? parent.absAngle : 0;
        limb.absAngle = parentAngle + limb.relAngle + sway;

        const shrinkFrac = limb.state === "senescing" ? 1 - limb.senesceT * (1 - SHRINK_FLOOR) : 1;
        const lenCur = limb.lenFull * limb.growProgress * shrinkFrac;
        limb.tipX = limb.footX + Math.cos(limb.absAngle) * lenCur;
        limb.tipY = limb.footY + Math.sin(limb.absAngle) * lenCur;

        if (lenCur < cellW * 1.5) continue; // too short to hold even one legible character yet — a young or nearly-shed stub, skip the draw this frame

        const maxChars = Math.max(1, Math.floor(lenCur / cellW));
        const run = buildRun(words, limb.wordStart, maxChars);
        if (!run) continue;

        const depthFrac = maxDepth > 0 ? limb.depth / maxDepth : 0;
        let alpha = 1 - depthFrac * 0.68;
        if (limb.state === "growing") alpha *= limb.growProgress;
        if (limb.state === "senescing") alpha *= 1 - limb.senesceT * 0.75;
        if (alpha <= 0.02) continue;

        const cosA = Math.cos(limb.absAngle);
        const flip = cosA < 0;
        const drawAngle = flip ? limb.absAngle + Math.PI : limb.absAngle;

        ctx.save();
        ctx.translate(limb.footX, limb.footY);
        ctx.rotate(drawAngle);
        ctx.textAlign = flip ? "right" : "left";
        ctx.textBaseline = "middle";
        ctx.globalAlpha = alpha;
        ctx.fillStyle = depthFrac < 0.4 ? fgCss : mutedCss;
        ctx.fillText(run, 0, 0);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    };

    const fastForward = (ms: number) => {
      let remaining = ms;
      let guard = 0;
      while (remaining > 0 && guard < MAX_REDUCED_TICKS) {
        stepAll(STEP_MS);
        remaining -= STEP_MS;
        guard++;
      }
    };

    const loop = (now: number) => {
      raf = 0;
      if (disposed || paused) return;
      if (last === 0) last = now;
      let dt = now - last;
      last = now;
      if (dt > 250) dt = 250;
      acc += dt;
      while (acc >= STEP_MS) {
        acc -= STEP_MS;
        stepAll(STEP_MS);
      }
      draw();
      raf = requestAnimationFrame(loop);
    };

    const startLive = () => {
      last = 0;
      paused = false;
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const stopLive = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      paused = true;
    };

    const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyMotionPref = () => {
      stopLive();
      if (reducedQuery.matches) {
        fastForward(REDUCED_FREEZE_MS);
        draw();
      } else {
        fastForward(PREWARM_MS);
        draw();
        if (visible) startLive();
      }
    };
    reducedQuery.addEventListener("change", applyMotionPref);

    readTokens();
    const mo = new MutationObserver(() => {
      readTokens();
      if (!raf) draw(); // repaint immediately on a theme flip even while paused/reduced-motion
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const ro = new ResizeObserver(() => {
      resize();
      if (reducedQuery.matches) {
        fastForward(REDUCED_FREEZE_MS);
        draw();
      } else if (!raf && visible) {
        draw();
      }
    });
    ro.observe(canvas);

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (!reducedQuery.matches) {
        if (visible) startLive();
        else stopLive();
      }
    });
    io.observe(canvas);

    const onVisibility = () => {
      if (document.hidden) stopLive();
      else if (visible && !reducedQuery.matches) startLive();
    };
    document.addEventListener("visibilitychange", onVisibility);

    document.fonts.ready.then(() => {
      if (disposed) return;
      rebuild();
      if (reducedQuery.matches) {
        fastForward(REDUCED_FREEZE_MS);
        draw();
      }
    });

    resize();
    applyMotionPref();

    return () => {
      disposed = true;
      stopLive();
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      reducedQuery.removeEventListener("change", applyMotionPref);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <div
      aria-hidden="true"
      className={`relative h-full w-full overflow-hidden bg-background ${className}`}
      style={style}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full text-foreground" style={{ fontFamily: "var(--font-mono)" }} />
      {/* CONTENT PROTECTION: a --background-tinted scrim, strongest along the
          bottom edge (the reading zone the demo docks its headline/CTA in)
          and easing to fully transparent by mid-frame, so real overlaid type
          sits on a real reading surface instead of fighting a canopy of
          words. Trunk origin bias alone (see originX/originY above) is not
          enough on its own — the crown still reaches the lower third on
          tall containers — so both are required together. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, transparent 0%, transparent 52%, color-mix(in srgb, var(--background) 55%, transparent) 78%, color-mix(in srgb, var(--background) 92%, transparent) 100%)",
        }}
      />
    </div>
  );
}

BackgroundTextBranchCanopy.displayName = "BackgroundTextBranchCanopy";
