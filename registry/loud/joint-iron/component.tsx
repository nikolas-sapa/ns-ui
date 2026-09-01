"use client";

import { useEffect, useId, useRef } from "react";

// ---------------------------------------------------------------------------
// JointIron — a footer whose top edge IS a book joint being formed,
// not a footer with an animation bolted onto it.
//
// Real mechanic: the building-in machine in edition binding. After a book is
// cased-in, it is clamped in a machine that presses heated brass joint irons
// into the hinge to set the French groove — the channel between the spine and
// the boards — under real dwell time, then releases with a measured 14%
// spring-back as the boards' elastic set partially relaxes. Three stations
// along the band run this five-phase cycle (index / iron descent / dwell /
// release / lift) independently, offset in phase, forever.
//
// The canvas is the full footer surface, not a strip above it — the DOM
// content (wordmark, sitemap, legal line) sits on the SAME "case" tone the
// groove is cut into, in a scrim panel below the forming zone. Delete the
// loop and the footer loses its material, not a decoration: this is the
// thing that keeps it from being footing-course.
//
// One height field per station, g(x) — a cosine bump centred on the station,
// with half-width hw = 1.44 * depth on each side (so the groove's WIDTH
// shrinks with depth, not just its floor). The two facet walls are lit with
// a single-lamp Lambert-style term derived from the bump's own slope
// (-sin(pi*d/hw)), so depth is legible three ways at once — floor depth,
// facet width, facet contrast — which is what makes the 14% spring-back
// (2.6px of floor movement at card scale) visible at all: on its own it is
// below the perceptual floor, but the paired 7.5px facet-width narrowing and
// the ~0.035L contrast step read as a real event over the 170ms it happens
// in.
//
// Tokens only: --background, --foreground, --ns-muted, --border, --ns-accent
// read via getComputedStyle + a MutationObserver on documentElement's class.
// --ns-accent never touches the joint (only the newsletter submit and focus
// rings). The heated iron — this component's one climactic moment — is
// solved by value alone: a solid --foreground silhouette whose underside
// gets a shadowBlur glow (still just the --foreground token, no hue) for its
// 700ms post-lift shimmer, which is the theme-agnostic way to "brighten" a
// silhouette that is already at the bright extreme of its palette in dark
// theme and the dark extreme in light theme.
// ---------------------------------------------------------------------------

const CYCLE = 7.4; // one station's full sequence, seconds
const P_INDEX = 0.85;
const P_DESCENT = 0.62;
const P_DWELL = 3.6;
const P_RELEASE = 0.45;
// P_LIFT = CYCLE - (P_INDEX + P_DESCENT + P_DWELL + P_RELEASE) = 1.88
const T1 = P_INDEX;
const T2 = T1 + P_DESCENT;
const T3 = T2 + P_DWELL;
const T4 = T3 + P_RELEASE;

const DESCENT_TC = 0.28; // first-order approach time constant, descent
const DWELL_TC = 1.4; // first-order approach time constant, dwell creep
const RELEASE_SPRING_T = 0.17; // spring-back happens in the first 170ms of release
const RELEASE_DROP = 0.14; // 14% of set depth recovered on release
const LIFT_DUR = 0.3; // iron travel time within the 1.88s lift+dwell-out phase
const SHIMMER_S = 0.7; // heat-shimmer duration after lift begins

// STATION_OFFSET is a deliberate 2.6s (not an exact CYCLE/3 = 2.467) — tuned
// so the reduced-motion STATIC_TIME below lands one station mid-release, one
// mid-dwell and one mid-index simultaneously, matching the spec's
// non-t0 freeze-frame requirement without relying on luck.
const STATION_OFFSET = 2.6;
const STATIC_TIME = 2.62;
const STATION_COUNT_FULL = 3;
const STATION_COUNT_SHORT = 2;
const MIN_HB_FOR_GRAIN_AND_3RD = 88; // px; below this, drop to 2 stations, drop grain

const GROOVE_CENTER_FRAC = 0.14; // groove's resting line, fraction of Hb below top edge
const GROOVE_CENTER_MAX_PX = 56; // clamp so the DOM scrim (below it) can never bury the groove
const G_MAX_FRAC = 0.055; // g_max as a fraction of M = min(bandW, bandH)
const FACET_WIDTH_MULT = 1.44; // facet half-width = 1.44 * current depth
const FACET_BRIGHT_L = 0.15; // spine-side facet peak contrast, spec's real number
const FACET_DARK_L = 0.17; // board-side facet peak contrast, spec's real number
const FACET_BRIGHT_ALPHA = 0.34; // canvas overlay alpha budgeted for the bright peak
// dark alpha derived from the bright budget scaled by the spec's own L ratio,
// so the 0.15 / 0.17 asymmetry (and the 14%-release drop of both) survives
// the translation into canvas alpha rather than being re-guessed.
const FACET_DARK_ALPHA = FACET_BRIGHT_ALPHA * (FACET_DARK_L / FACET_BRIGHT_L);

const THERMOSTAT_CYCLE = 2.1;
const THERMOSTAT_AMP_ALPHA = 0.05; // iron fill-alpha ripple standing in for +/-0.04L hunting

const CASE_ALPHA_LIGHT = 0.16;
const CASE_ALPHA_DARK = 0.22;
const IRON_BASE_ALPHA = 0.86; // headroom below solid fg so the shimmer has somewhere to go

const GRAIN_AMP_ALPHA = 0.05; // canvas overlay alpha standing in for +/-0.02L board grain
const GRAIN_FEATURE_FRAC = 0.006; // grain feature size, fraction of M
const DPR_CAP = 2;
const SLOW_FRAME_MS = 33; // ~30fps budget
const SLOW_SUSTAIN_MS = 1500; // sustained slow window before quality drops

function mod(a: number, n: number) {
  return ((a % n) + n) % n;
}
function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}
function easeOutCubic(t: number) {
  const u = 1 - clamp01(t);
  return 1 - u * u * u;
}

// deterministic, seeded — no Math.random anywhere in the render path, so the
// reduced-motion frame (and every ordinary frame, given the same t) is
// byte-stable.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Tokens {
  fg: string;
  bg: string;
  muted: string;
  border: string;
}

function readTokens(): Tokens | null {
  if (typeof document === "undefined") return null;
  const cs = getComputedStyle(document.documentElement);
  const fg = cs.getPropertyValue("--foreground").trim();
  const bg = cs.getPropertyValue("--background").trim();
  const muted = cs.getPropertyValue("--ns-muted").trim();
  const border = cs.getPropertyValue("--border").trim();
  if (!fg || !bg) return null;
  return { fg, bg, muted, border };
}

// -- the joint's phase machine — a pure function of local (station) time ---
type Phase = "index" | "descent" | "dwell" | "release" | "lift";
interface StationFrame {
  phase: Phase;
  depthFrac: number; // 0..1 of gMax, the groove floor's current depth
  contrastMult: number; // multiplies FACET_*_L, folds in shoulder-rounding on release
  ironFrac: number; // 0 (up) .. 1 (down)
  indexProgress: number; // 0..1 while phase === "index", else 0
  shimmerT: number | null; // seconds into the post-lift shimmer, else null
}

// depth fraction reached at the end of descent / dwell, and the held depth
// after release — computed once, reused every cycle (the process is
// periodic: every book gets the same result).
const DESCENT_END_FRAC = 1 - Math.exp(-P_DESCENT / DESCENT_TC);
const DWELL_END_FRAC = 1 - 0.11 * Math.exp(-P_DWELL / DWELL_TC);
const HOLD_FRAC = DWELL_END_FRAC * (1 - RELEASE_DROP);

function indexEase(p: number) {
  // easeOutCubic with a small, quickly-damped overshoot standing in for the
  // spec's "3% overshoot damped in 140ms" spring settle.
  const base = easeOutCubic(p);
  const overshoot = 0.03 * Math.exp(-p * 9) * Math.sin(p * Math.PI * 2.2);
  return base + overshoot;
}

function stationFrame(localT: number): StationFrame {
  if (localT < T1) {
    const p = localT / P_INDEX;
    return { phase: "index", depthFrac: 0, contrastMult: 0, ironFrac: 0, indexProgress: indexEase(p), shimmerT: null };
  }
  if (localT < T2) {
    const t = localT - T1;
    const depthFrac = 1 - Math.exp(-t / DESCENT_TC);
    return { phase: "descent", depthFrac, contrastMult: depthFrac, ironFrac: clamp01(depthFrac / DESCENT_END_FRAC), indexProgress: 0, shimmerT: null };
  }
  if (localT < T3) {
    const t = localT - T2;
    const depthFrac = 1 - 0.11 * Math.exp(-t / DWELL_TC);
    return { phase: "dwell", depthFrac, contrastMult: depthFrac, ironFrac: 1, indexProgress: 0, shimmerT: null };
  }
  if (localT < T4) {
    const t = localT - T3;
    const springP = clamp01(t / RELEASE_SPRING_T);
    const springEase = easeOutCubic(springP);
    const depthFrac = DWELL_END_FRAC * (1 - RELEASE_DROP * springEase);
    const shoulderRound = 1 - 0.09 * springEase; // extra rounding beyond pure depth ratio
    return { phase: "release", depthFrac, contrastMult: depthFrac * shoulderRound, ironFrac: 1, indexProgress: 0, shimmerT: null };
  }
  const t = localT - T4;
  const ironFrac = Math.max(0, 1 - t / LIFT_DUR);
  return {
    phase: "lift",
    depthFrac: HOLD_FRAC,
    contrastMult: HOLD_FRAC,
    ironFrac,
    indexProgress: 0,
    shimmerT: t < SHIMMER_S ? t : null,
  };
}

export interface JointIronLink {
  label: string;
  href: string;
}
export interface JointIronColumn {
  heading: string;
  links: JointIronLink[];
}

export interface JointIronProps {
  /** wordmark on the case */
  brand?: string;
  /** short line under the wordmark */
  tagline?: string;
  /** sitemap columns */
  columns?: JointIronColumn[];
  /** legal / copyright line; year is appended automatically */
  legal?: string;
  /** newsletter field placeholder */
  newsletterPlaceholder?: string;
  /** called with the entered email on submit; default is a no-op (demo-safe) */
  onSubscribe?: (email: string) => void;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

const DEFAULT_COLUMNS: JointIronColumn[] = [
  {
    heading: "Product",
    links: [
      { label: "Overview", href: "#overview" },
      { label: "Pricing", href: "#pricing" },
      { label: "Changelog", href: "#changelog" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Docs", href: "#docs" },
      { label: "Guides", href: "#guides" },
      { label: "API", href: "#api" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "#about" },
      { label: "Blog", href: "#blog" },
      { label: "Careers", href: "#careers" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy", href: "#privacy" },
      { label: "Terms", href: "#terms" },
    ],
  },
];

export function JointIron({
  brand = "ns-ui",
  tagline = "Bound the way it's built.",
  columns = DEFAULT_COLUMNS,
  legal = "All rights reserved.",
  newsletterPlaceholder = "you@company.com",
  onSubscribe,
  className = "",
}: JointIronProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const emailId = useId();

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let disposed = false;
    let tokens: Tokens | null = null;
    let isDark = false;
    let dpr = 1;
    let w = 0;
    let h = 0;
    let sized = false;
    // the loop only runs when BOTH are true — an intersecting-but-hidden-tab
    // footer (or a visible-tab-but-scrolled-off footer) must stay paused
    let inView = false;
    let pageVisible = document.visibilityState !== "hidden";
    let columnStep = 1; // widened under sustained slowness

    let raf = 0;
    let tokenWaitRaf = 0;
    let slowSince: number | null = null;

    // -- static seeded board-grain, baked to an offscreen tile at resize ---
    let grain: HTMLCanvasElement | null = null;
    const bakeGrain = (caseTop: number, m: number) => {
      const feature = Math.max(1, m * GRAIN_FEATURE_FRAC);
      const tile = document.createElement("canvas");
      tile.width = Math.max(1, Math.round(w));
      tile.height = Math.max(1, Math.round(h - caseTop));
      const tctx = tile.getContext("2d");
      if (!tctx || !tokens) {
        grain = tile;
        return;
      }
      const rand = mulberry32(20260901);
      const cols = Math.max(1, Math.ceil(tile.width / feature));
      const rows = Math.max(1, Math.ceil(tile.height / feature));
      tctx.fillStyle = tokens.fg;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const v = rand();
          if (v < 0.5) continue; // sparse — grain is a texture, not a wash
          tctx.globalAlpha = (v - 0.5) * 2 * GRAIN_AMP_ALPHA;
          tctx.fillRect(c * feature, r * feature, feature, feature);
        }
      }
      tctx.globalAlpha = 1;
      grain = tile;
    };

    // -- layout ---------------------------------------------------------
    const layout = () => {
      const m = Math.min(w, h);
      const stationCount = h >= MIN_HB_FOR_GRAIN_AND_3RD ? STATION_COUNT_FULL : STATION_COUNT_SHORT;
      // clamped so the groove zone always clears the DOM scrim's top offset
      // (pt-20/pt-24 in the markup below) even on a very tall footer
      const grooveCenterY = Math.min(GROOVE_CENTER_FRAC * h, GROOVE_CENTER_MAX_PX);
      const gMax = G_MAX_FRAC * m;
      const slotW = w / stationCount;
      const stations = Array.from({ length: stationCount }, (_, i) => ({
        cx: slotW * i + slotW / 2,
        slotX0: slotW * i,
        slotX1: slotW * (i + 1),
      }));
      return { m, stationCount, grooveCenterY, gMax, slotW, stations, showGrain: h >= MIN_HB_FOR_GRAIN_AND_3RD };
    };

    const fitCanvas = () => {
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) {
        sized = false;
        return;
      }
      dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
      w = rect.width;
      h = rect.height;
      fitCanvas();
      columnStep = 1;
      slowSince = null;
      const { grooveCenterY, showGrain } = layout();
      if (showGrain) bakeGrain(grooveCenterY, Math.min(w, h));
      else grain = null;
      sized = true;
    };

    // -- drawing ----------------------------------------------------------
    const drawStation = (
      station: { cx: number; slotX0: number; slotX1: number },
      frame: StationFrame,
      grooveCenterY: number,
      gMax: number,
      brightToken: string,
      darkToken: string,
      t: number,
    ) => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(station.slotX0, 0, station.slotX1 - station.slotX0, h);
      ctx.clip();

      // the groove is carried entirely by the two facets' Lambert-style
      // shade, never by swapping in raw --background — a pressed groove is
      // still case material, just recessed and lit, not a hole cut through
      // it. AMBIENT sinks the whole notch a little below the flat case (so
      // the floor, where wallFactor -> 0, still reads as a shadowed recess
      // rather than vanishing back to the flat case tone) and each column's
      // shaded rect extends from the resting line down by `bump`, so depth
      // is legible as the shaded region's own height as well as its width
      // (hw = 1.44*depth) and its contrast (contrastMult) — all three
      // collapse together on the 14% release.
      const AMBIENT = -0.35;
      const drawNotch = (cx: number, depthFrac: number, contrastMult: number) => {
        const depth = depthFrac * gMax;
        if (depth < 0.3) return;
        const hw = FACET_WIDTH_MULT * depth;
        const x0 = Math.max(station.slotX0, Math.round(cx - hw));
        const x1 = Math.min(station.slotX1, Math.round(cx + hw));
        for (let x = x0; x <= x1; x += columnStep) {
          const d = x - cx;
          const bump = depth * 0.5 * (1 + Math.cos((Math.PI * d) / hw));
          if (bump <= 0.15) continue;
          const wallFactor = -Math.sin((Math.PI * d) / hw);
          const shade = Math.max(-1, Math.min(1, AMBIENT + wallFactor));
          const wallH = Math.max(2, bump);
          if (shade >= 0) {
            ctx.globalAlpha = FACET_BRIGHT_ALPHA * shade * contrastMult;
            ctx.fillStyle = brightToken;
          } else {
            ctx.globalAlpha = FACET_DARK_ALPHA * -shade * contrastMult;
            ctx.fillStyle = darkToken;
          }
          ctx.fillRect(x, grooveCenterY, columnStep, wallH);
        }
        ctx.globalAlpha = 1;
      };

      if (frame.phase === "index") {
        // the previous, fully-formed groove slides out of this slot while
        // this station stays otherwise unformed (depth 0 draws nothing) —
        // clipped to the slot, so nothing bleeds into the neighbour.
        const offset = (station.slotX1 - station.slotX0) * frame.indexProgress;
        drawNotch(station.cx - offset, HOLD_FRAC, HOLD_FRAC);
      } else {
        drawNotch(station.cx, frame.depthFrac, frame.contrastMult);
      }

      // -- iron + platen -----------------------------------------------
      const ironUpY = grooveCenterY - gMax * 3.2;
      const ironDownY = grooveCenterY - gMax * 0.35;
      const ironY = ironUpY + (ironDownY - ironUpY) * frame.ironFrac;
      const ironW = FACET_WIDTH_MULT * gMax * 2;
      const ironH = Math.max(4, gMax * 0.9);
      // thermostat hunting is a pure function of t (not wall-clock), so the
      // reduced-motion frame stays byte-stable across re-renders.
      const thermostat = 1 + THERMOSTAT_AMP_ALPHA * Math.sin((t / THERMOSTAT_CYCLE) * Math.PI * 2);
      ctx.globalAlpha = clamp01(IRON_BASE_ALPHA * thermostat);
      ctx.fillStyle = tokens!.fg;
      ctx.fillRect(station.cx - ironW / 2, ironY, ironW, ironH);
      ctx.globalAlpha = 1;

      if (frame.shimmerT != null) {
        const shimmerEase = 1 - frame.shimmerT / SHIMMER_S;
        ctx.save();
        ctx.shadowColor = tokens!.fg;
        ctx.shadowBlur = shimmerEase * gMax * 1.4;
        ctx.fillStyle = tokens!.fg;
        ctx.globalAlpha = 0.9 * shimmerEase;
        ctx.fillRect(station.cx - ironW / 2, ironY + ironH - 1.5, ironW, 1.5);
        ctx.restore();
      }

      ctx.restore();
    };

    const draw = (t: number) => {
      if (!tokens || !sized) return;
      const { grooveCenterY, gMax, stations, showGrain } = layout();
      const caseAlpha = isDark ? CASE_ALPHA_DARK : CASE_ALPHA_LIGHT;
      const brightToken = isDark ? tokens.fg : tokens.bg;
      const darkToken = isDark ? tokens.bg : tokens.fg;

      // page bg, then the case as an fg-over-bg wash held clearly off the
      // page in both themes
      ctx.fillStyle = tokens.bg;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = caseAlpha;
      ctx.fillStyle = tokens.fg;
      ctx.fillRect(0, grooveCenterY, w, h - grooveCenterY);
      ctx.globalAlpha = 1;

      if (showGrain && grain) {
        ctx.drawImage(grain, 0, grooveCenterY);
      }

      // hairline between the band and the page above
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = tokens.border;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 0.5);
      ctx.lineTo(w, 0.5);
      ctx.stroke();
      ctx.globalAlpha = 1;

      for (let i = 0; i < stations.length; i++) {
        const localT = mod(t + i * STATION_OFFSET, CYCLE);
        const frame = stationFrame(localT);
        drawStation(stations[i]!, frame, grooveCenterY, gMax, brightToken, darkToken, t);
      }
    };

    const loop = (nowMs: number) => {
      if (disposed) return;
      if (!inView || !pageVisible) {
        raf = 0; // re-armed by whichever of IO / visibilitychange flips back first
        return;
      }
      raf = requestAnimationFrame(loop);
      if (!sized || !tokens) return;

      const frameStart = performance.now();
      draw(nowMs / 1000);
      const frameMs = performance.now() - frameStart;
      if (frameMs > SLOW_FRAME_MS) {
        if (slowSince == null) slowSince = nowMs;
        else if (nowMs - slowSince > SLOW_SUSTAIN_MS) columnStep = 2;
      } else {
        slowSince = null;
      }
    };

    const drawStatic = () => {
      draw(STATIC_TIME);
    };

    const rebakeGrainIfNeeded = () => {
      const { grooveCenterY, showGrain, m } = layout();
      if (showGrain) bakeGrain(grooveCenterY, m);
      else grain = null;
    };

    const resumeLoop = () => {
      if (!reduced && tokens && sized && inView && pageVisible && !raf) {
        raf = requestAnimationFrame(loop);
      }
    };

    let started = false;
    const kick = () => {
      if (started || disposed || !tokens || !sized) return;
      started = true;
      if (reduced) {
        drawStatic();
        return;
      }
      if (inView && pageVisible) raf = requestAnimationFrame(loop);
    };

    const boot = () => {
      if (disposed) return;
      tokens = readTokens();
      if (!tokens) {
        tokenWaitRaf = requestAnimationFrame(boot);
        return;
      }
      isDark = document.documentElement.classList.contains("dark");
      resize();
      kick();
    };

    const ro = new ResizeObserver(() => {
      if (!tokens) return;
      resize();
      if (reduced) drawStatic();
      kick();
    });
    ro.observe(wrap);

    const mo = new MutationObserver(() => {
      tokens = readTokens();
      isDark = document.documentElement.classList.contains("dark");
      if (!tokens) return;
      if (sized) rebakeGrainIfNeeded(); // stale-theme grain tile would otherwise persist
      if (reduced) drawStatic();
      else if (sized) draw(performance.now() / 1000);
      kick();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const io = new IntersectionObserver((entries) => {
      inView = entries[0]?.isIntersecting ?? true;
      if (inView) {
        tokens = readTokens() ?? tokens; // pick up a theme flip that happened while offscreen
        isDark = document.documentElement.classList.contains("dark");
        resumeLoop();
      }
    });
    io.observe(wrap);

    const onVisibility = () => {
      pageVisible = document.visibilityState !== "hidden";
      if (pageVisible) resumeLoop();
    };
    document.addEventListener("visibilitychange", onVisibility);

    boot();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(tokenWaitRaf);
      ro.disconnect();
      mo.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.elements.namedItem("email") as HTMLInputElement | null;
    onSubscribe?.(input?.value ?? "");
    form.reset();
  };

  return (
    <footer
      data-joint-iron
      ref={wrapRef}
      className={`relative w-full min-h-[320px] overflow-hidden ${className}`}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />

      <div className="relative z-10 mx-auto max-w-5xl px-4 pt-20 pb-10 sm:px-6 sm:pt-24">
        <div className="rounded-md bg-background/70 px-5 py-6 backdrop-blur-sm sm:px-8 sm:py-8">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-xs">
              <p className="font-mono text-sm font-semibold tracking-tight text-foreground">{brand}</p>
              <p className="mt-2 text-sm leading-relaxed text-ns-muted">{tagline}</p>
              <form onSubmit={handleSubmit} className="mt-4 flex max-w-xs gap-2">
                <label htmlFor={emailId} className="sr-only">
                  Email address
                </label>
                <input
                  id={emailId}
                  name="email"
                  type="email"
                  required
                  placeholder={newsletterPlaceholder}
                  className="w-full min-w-0 rounded-sm bg-background/60 px-2.5 py-1.5 text-sm text-foreground placeholder:text-ns-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-sm bg-ns-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-ns-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
                >
                  Subscribe
                </button>
              </form>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
              {columns.map((col, i) => (
                // the sitemap's own column rule — one of the two places
                // --border is allowed as a stroke (section 9)
                <div key={col.heading} className={i === 0 ? "" : "border-l border-border pl-6"}>
                  <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.15em] text-foreground">
                    {col.heading}
                  </h2>
                  <ul className="mt-3 flex flex-col gap-2">
                    {col.links.map((link) => (
                      <li key={link.href}>
                        <a
                          href={link.href}
                          className="rounded-sm text-sm text-ns-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
                        >
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 border-t border-border pt-4">
            <p className="font-mono text-xs text-ns-muted">
              © {new Date().getFullYear()} {brand} — {legal}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
