"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// SlateGauge — a testimonial wall built as double-lap slating. The wall's
// geometry never changes: five diminishing courses of slates are hung so
// each course laps the one below it, and the only part of any slate that is
// ever visible at rest is its computed GAUGE — the exposed margin a slater
// derives from the slate's own height, never chosen by hand:
//
//   gauge = (height - lap - head allowance) / 2
//
// Slates are rendered as absolutely positioned <button aria-expanded> shells
// (the click target) each wrapping an <article> (the visual face). At rest
// every course's article is exactly its own GAUGE tall — courses are laid
// edge to edge with no overlap, so the wall never needs a clip-path to hide
// the covered nine-tenths of each slate: it simply never paints it. Lifting
// a slate grows that one article, and only that one, from gauge to its true
// height and raises it above its neighbours (z-index), which is what reveals
// the rest of the quote and is also the only thing that ever overlaps in
// this layout. The quote text itself is never display:none at any height —
// the SHORT box just clips it, so a screen reader, Ctrl-F and text selection
// still reach the full sentence whether or not it is currently showing.
//
// Reading a slate rotates it about its NAIL LINE (18px below its head, i.e.
// near-top) to -34deg on an underdamped spring (k=210, c=19 — the spec's own
// physical numbers, not a hand-tuned easing curve), which is what produces
// both the fixed -34deg rest angle AND the single ~3deg overshoot as an
// emergent property of the spring rather than a hardcoded keyframe list; the
// same spring relaxes back to 0 on release, so "lift" and "return" are one
// mechanism read in two directions. Only one slate is ever lifted — lifting
// a second sets both aria-expanded values in the same state commit.
//
// TWO unforced processes keep the wall alive at rest without the wall's own
// layout ever moving (BUILDER's alive-at-rest test, and DECISIONS D3's ban on
// a moving band leaving its wake as a dead still image, though this
// component's band is a light/wind field over a STATIC lattice rather than a
// process it matures, so there is no "mature region" to freeze):
//   1. An idle gust 190px wide sweeps left-to-right on a 4.8s loop. A
//      deterministic 3-in-17 subset of slates is centre-nailed; whenever a
//      centre-nailed slate's tail sits inside the gust it lifts 2.5-5px on
//      its own short underdamped spring and clatters back.
//   2. A light azimuth swings +-14deg on a 22s cosine. It never touches any
//      slate's own face luminance — only the length and side of the cast
//      shadow at the top of the course below, via ONE root-level CSS custom
//      property every slate's box-shadow reads, so the whole wall's relief
//      inverts together without touching N individual DOM nodes per frame.
// ---------------------------------------------------------------------------

export interface SlateTestimonial {
  id: string;
  quote: string;
  name: string;
  role: string;
}

export interface SlateGaugeProps {
  /** Testimonials, filled row-major (course 1 left-to-right, then course 2, ...). */
  items?: SlateTestimonial[];
  /** Slates per course. @default 3 */
  columns?: number;
  /** Heading rendered above the wall. */
  heading?: string;
  className?: string;
}

// ---- geometry: exactly the spec's course table ---------------------------
// gauge = (h - LAP - HEAD) / 2, diminishing ~0.915x per course.
const LAP = 20;
const HEAD = 8;
const COURSE_H = [132, 120, 110, 101, 94];

// Type metrics, in the same unscaled design units as the course table — the
// quote is rendered at FONT_PX * scale with LINE_RATIO leading and PAD_Y *
// scale of padding, so a course's exposure can be expressed here once and
// then simply multiplied by the fit scale like every other box dimension.
const FONT_PX = 10;
const LINE_RATIO = 1.36;
const LINE_PX = FONT_PX * LINE_RATIO;
const PAD_Y = 6;

// A course's EXPOSURE is its computed gauge quantised down to a whole number
// of text lines. The gauge is what the slater derives; the quantisation is
// what stops the lap from falling through the middle of a line of type, which
// is the difference between reading as a slate lapping its neighbour and
// reading as a sentence that got cut off.
function exposureFor(gauge: number): number {
  // Only the HEAD padding is inside the exposure. Counting the foot padding
  // too left exactly one padding's worth of the next line showing through the
  // bottom of the strip — a sliced half-line of attribution, which is the one
  // thing that reads as broken rather than as lapped.
  const lines = Math.max(2, Math.floor((gauge - PAD_Y) / LINE_PX));
  return PAD_Y + lines * LINE_PX;
}

const COURSES = COURSE_H.map((h) => {
  const gauge = (h - LAP - HEAD) / 2;
  return { h, gauge, exposure: exposureFor(gauge) };
});
const SLATE_W = 168;
const COL_OFFSET = SLATE_W / 2; // half a slate — breaks the side lap
const NAIL_Y = 18; // rotation origin, below the head
const MIN_HIT = 44; // WCAG minimum, padded upward into transparent space only
const SCALE_MIN = MIN_HIT / Math.min(...COURSES.map((c) => c.h)); // floor: smallest course never drops under 44px
const SCALE_MAX = 1.6;

const GUST_PERIOD = 4.8; // s — spec's 260px/s at the 1200px reference wall
const GUST_WIDTH = 190; // px
const AZIMUTH_PERIOD = 22.0; // s
const AZIMUTH_DEG = 14;
// reduced-motion freeze frame is spec'd at t=7.40s; the composed values below
// (azimuth -6deg, one slate at max gust-lift, one fully read) are that frame
// baked in directly rather than evaluated from the continuous functions, so
// the still is exact and never depends on the (paused) clock.

const LIFT_TARGET = -34; // deg
const LIFT_K = 210;
const LIFT_C = 19;
const GUST_LIFT_K = 1200;
const GUST_LIFT_C = 24;

function isCentreNailed(index: number) {
  return index % 17 < 3;
}

// deterministic 0..1 hash, seeded by index — used for riven banding and gust
// lift amplitude so both are byte-stable across renders without a stored RNG
function hash(seed: number): number {
  let x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  x -= Math.floor(x);
  return x;
}

function springStep(
  value: number,
  velocity: number,
  target: number,
  k: number,
  c: number,
  dt: number
): [number, number] {
  const accel = -k * (value - target) - c * velocity;
  const nv = velocity + accel * dt;
  return [value + nv * dt, nv];
}

// ---- token colour derivation (5 tokens only, HSL-lightness math) ---------

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [128, 128, 128];
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t0: number) => {
    let t = t0;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [
    Math.round(hue2rgb(h + 1 / 3) * 255),
    Math.round(hue2rgb(h) * 255),
    Math.round(hue2rgb(h - 1 / 3) * 255),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Reuses a token's own hue/saturation but forces a target HSL lightness —
 * every derived colour below still traces back to a token read, never a
 * literal, but section 6's L values are what actually place it. */
function withLightness(hex: string, l: number): string {
  const [r, g, b] = hexToRgb(hex);
  const [h, s] = rgbToHsl(r, g, b);
  return rgbToHex(...hslToRgb(h, s, Math.max(0, Math.min(1, l))));
}

function shiftLightness(hex: string, delta: number): string {
  const [r, g, b] = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  return rgbToHex(...hslToRgb(h, s, Math.max(0, Math.min(1, l + delta))));
}

function lightnessOf(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHsl(r, g, b)[2];
}

interface Tokens {
  face: string;
  margin: string;
  shadow: string;
  edge: string;
  backing: string;
  riven: string;
  ink: string;
  inkMuted: string;
}

function readTokens(): Tokens {
  const cs = getComputedStyle(document.documentElement);
  const bg = cs.getPropertyValue("--background").trim() || "#ffffff";
  const fg = cs.getPropertyValue("--foreground").trim() || "#171717";
  const dark = lightnessOf(bg) < 0.5;

  // Section 6, retuned for card scale. The wall is a mid-value stone that
  // sits BELOW the page in dark and ABOVE the page in light — a dark stone
  // on a white page read as one undifferentiated slab, because every
  // internal step (margin, lap shadow, arris) had to fit under the face's
  // own lightness. Each theme therefore gets its own absolute lightness
  // ladder rather than a shared set of deltas.
  const L = dark
    ? { face: 0.44, margin: 0.53, shadow: 0.19, edge: 0.72, backing: 0.2, ink: 0.08, inkMuted: 0.22 }
    : { face: 0.66, margin: 0.76, shadow: 0.5, edge: 0.9, backing: 0.46, ink: 0.14, inkMuted: 0.32 };

  const face = withLightness(fg, L.face);
  const margin = withLightness(fg, L.margin);
  // the lap shadow carries the whole image in a monochrome wall: measured at
  // -0.10L it was invisible at card scale and the courses read as one slab
  const shadow = withLightness(fg, L.shadow);
  const edge = withLightness(fg, L.edge);
  // the batten behind the wall: the half-slate stagger leaves a gap at the
  // start of every other course, and against the page background those gaps
  // read as missing tiles rather than as the wall carrying on behind
  const backing = withLightness(fg, L.backing);
  const riven = shiftLightness(face, 0.03);
  const ink = withLightness(fg, L.ink);
  const inkMuted = withLightness(fg, L.inkMuted);
  return { face, margin, shadow, edge, backing, riven, ink, inkMuted };
}

// ---- default placeholder content ------------------------------------------

// Illustrative placeholder quotes: deliberately generic, attributed to a role
// rather than to any person or company, so nothing here reads as a real
// customer claim. Swap `items` for your own.
const DEFAULT_QUOTES: { quote: string; name: string; role: string }[] = [
  { quote: "We moved the whole team across in one afternoon.", name: "Engineering lead", role: "platform" },
  { quote: "It replaced four tools we were stitching together.", name: "Product manager", role: "growth" },
  { quote: "The defaults are sensible enough to ship on.", name: "Founder", role: "two-person studio" },
  { quote: "Onboarding takes a morning, not a fortnight.", name: "Head of design", role: "in-house team" },
  { quote: "Nobody argues about which copy is current now.", name: "Operations lead", role: "support" },
  { quote: "Tickets about the old export flow stopped.", name: "Customer success", role: "EMEA" },
  { quote: "It fits how we already work, not the reverse.", name: "Staff engineer", role: "infrastructure" },
  { quote: "The audit trail answered a question we dreaded.", name: "Security lead", role: "compliance" },
  { quote: "Rolling a mistake back is a single click.", name: "Tech lead", role: "web" },
  { quote: "Design and engineering read the same source.", name: "Design engineer", role: "design systems" },
  { quote: "We stopped keeping a spreadsheet nobody trusted.", name: "Analytics lead", role: "data" },
  { quote: "Quiet, fast, and it has never lost our work.", name: "Principal engineer", role: "core services" },
  { quote: "The migration was the boring part of the quarter.", name: "Delivery manager", role: "programmes" },
  { quote: "It is the first internal tool people ask for.", name: "Chief of staff", role: "operations" },
  { quote: "Two years in, we have not outgrown it.", name: "Director of engineering", role: "product" },
  { quote: "Handover notes write themselves now.", name: "Programme lead", role: "delivery" },
  { quote: "Nothing about it has surprised us badly.", name: "Platform architect", role: "reliability" },
  { quote: "The people who resisted it use it most.", name: "Team lead", role: "customer platform" },
];

const DEFAULT_ITEMS: SlateTestimonial[] = DEFAULT_QUOTES.map((q, i) => ({
  id: `slate-${i + 1}`,
  ...q,
}));

interface Slate {
  index: number;
  row: number;
  col: number;
  x: number; // design px, unscaled
  top: number; // design px, unscaled — top of this course's exposed gauge
  h: number;
  gauge: number;
  exposure: number;
  centreNailed: boolean;
}

function layout(items: SlateTestimonial[], columns: number): { slates: Slate[]; naturalW: number; naturalH: number } {
  const cols = Math.max(1, columns);
  const rows = Math.ceil(items.length / cols);
  const courseTop: number[] = [0];
  for (let r = 0; r < rows; r++) courseTop.push(courseTop[r] + COURSES[r % COURSES.length].exposure);

  const slates: Slate[] = items.map((_, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const course = COURSES[row % COURSES.length];
    const offset = row % 2 === 1 ? COL_OFFSET : 0;
    return {
      index: i,
      row,
      col,
      x: col * SLATE_W + offset,
      top: courseTop[row],
      h: course.h,
      gauge: course.gauge,
      exposure: course.exposure,
      centreNailed: isCentreNailed(i),
    };
  });

  const naturalW = cols * SLATE_W + COL_OFFSET;
  const naturalH = courseTop[rows]; // sum of every course's exposure — the last course's excess is trimmed
  return { slates, naturalW, naturalH };
}

export function SlateGauge({
  items = DEFAULT_ITEMS,
  columns = 3,
  heading = "What teams say",
  className = "",
}: SlateGaugeProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const wallRef = useRef<HTMLDivElement>(null);
  const slateFaceRefs = useRef<Record<number, HTMLElement | null>>({});
  const rivenRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [liftedIndex, setLiftedIndex] = useState<number | null>(null);
  const [scale, setScale] = useState(1);
  const liftedRef = useRef<number | null>(null);
  liftedRef.current = liftedIndex;

  const { slates, naturalW, naturalH } = useMemo(() => layout(items, columns), [items, columns]);

  // reduced-motion picks one representative slate to hold lifted and one
  // centre-nailed slate near the frozen gust to hold mid-clatter, so the
  // single composed frame shows every state the wall has at once (spec §5)
  const staticPicks = useMemo(() => {
    const gustCol = Math.min(1, Math.max(0, columns - 1));
    const lifted = Math.min(2, slates.length - 1);
    const near = slates.find((s) => s.centreNailed && s.col === gustCol) ?? slates.find((s) => s.centreNailed);
    return { lifted, microLift: near?.index ?? null };
  }, [slates, columns]);

  const rivenBg = useMemo(() => {
    // deterministic per-slate band pattern (spacing only — colours are
    // re-applied on token read) computed once so it is byte-stable forever
    const maps: Record<number, { start: number; end: number }[]> = {};
    for (const s of slates) {
      const bands: { start: number; end: number }[] = [];
      let y = 0;
      let seed = s.index * 97 + 11;
      while (y < s.h) {
        const w = 3 + hash(seed) * 6; // 3-9px
        bands.push({ start: y, end: Math.min(s.h, y + w) });
        y += w;
        seed += 1;
      }
      maps[s.index] = bands;
    }
    return maps;
  }, [slates]);

  // ---- token read, geometry fit, and the whole idle loop -----------------
  useLayoutEffect(() => {
    const host = hostRef.current;
    const wall = wallRef.current;
    if (!host || !wall) return;

    // token read happens before anything paints — see the class comment
    let tokens = readTokens();
    const applyTokens = () => {
      wall.style.setProperty("--slate-face", tokens.face);
      wall.style.setProperty("--slate-margin", tokens.margin);
      wall.style.setProperty("--slate-shadow-color", tokens.shadow);
      wall.style.setProperty("--slate-edge", tokens.edge);
      wall.style.setProperty("--slate-backing", tokens.backing);
      wall.style.setProperty("--slate-riven", tokens.riven);
      wall.style.setProperty("--slate-ink", tokens.ink);
      wall.style.setProperty("--slate-ink-muted", tokens.inkMuted);
      // repaint riven band gradients with the fresh colour pair — percentage
      // stops (of the slate's own full height) so the pattern never needs to
      // be re-scaled when the fit scale or the lift height changes
      for (const s of slates) {
        const el = rivenRefs.current[s.index];
        if (!el) continue;
        const stops = rivenBg[s.index]
          .map((b, i) => {
            // ±0.03L fracture banding (section 6) — a texture on the stone
            // itself, distinct from the sky-lit margin tint layered above it
            const c = i % 2 === 0 ? tokens.face : tokens.riven;
            return `${c} ${(b.start / s.h) * 100}%, ${c} ${(b.end / s.h) * 100}%`;
          })
          .join(", ");
        el.style.backgroundImage = `linear-gradient(to bottom, ${stops})`;
      }
    };
    applyTokens();

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const fit = () => {
      const rect = host.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) return;
      const s = Math.max(SCALE_MIN, Math.min(SCALE_MAX, Math.min(rect.width / naturalW, rect.height / naturalH)));
      setScale(s);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(host);

    if (reduced) {
      // one composed still frame, byte-stable: no loop, no listeners
      wall.style.setProperty("--wall-azimuth", "-6");
      if (staticPicks.microLift != null) {
        const el = slateFaceRefs.current[staticPicks.microLift];
        if (el) el.style.setProperty("--gust-lift", "5");
      }
      setLiftedIndex(staticPicks.lifted);
      const liftedEl = slateFaceRefs.current[staticPicks.lifted];
      if (liftedEl) liftedEl.style.transform = `rotate(${LIFT_TARGET}deg)`;
      return () => ro.disconnect();
    }

    // ---- continuous idle loop: gust field + light azimuth + micro-lifts --
    let raf = 0;
    let running = false;
    let last = performance.now();
    let t = 0;
    const liftState = new Map<number, { v: number; vel: number; target: number }>();
    let readLift = { v: 0, vel: 0 };

    // the slate currently returning after release is tracked separately from
    // the one actively held, since liftedIndex can flip to null the instant
    // a pointer leaves — the spring still needs a face to write to
    let lastHeld: number | null = null;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      t += dt;

      const azimuth = AZIMUTH_DEG * Math.cos((2 * Math.PI * t) / AZIMUTH_PERIOD);
      wall.style.setProperty("--wall-azimuth", azimuth.toFixed(2));

      // gust math stays entirely in natural (unscaled) design units, the same
      // space slate.x already lives in — the fit `scale` only ever touches
      // the JSX render, never this comparison
      const span = naturalW + GUST_WIDTH * 2;
      const frac = (t % GUST_PERIOD) / GUST_PERIOD;
      const gustX = -GUST_WIDTH + frac * span;

      for (const s of slates) {
        if (!s.centreNailed) continue;
        const el = slateFaceRefs.current[s.index];
        if (!el) continue;
        const centerX = s.x + SLATE_W / 2;
        const inGust = Math.abs(centerX - gustX) < GUST_WIDTH / 2;
        const amp = 2.5 + hash(s.index * 31 + 7) * 2.5;
        let st = liftState.get(s.index);
        if (!st) {
          st = { v: 0, vel: 0, target: 0 };
          liftState.set(s.index, st);
        }
        st.target = inGust ? amp : 0;
        const [nv, nvel] = springStep(st.v, st.vel, st.target, GUST_LIFT_K, GUST_LIFT_C, dt);
        st.v = nv;
        st.vel = nvel;
        el.style.setProperty("--gust-lift", st.v.toFixed(2));
      }

      const held = liftedRef.current;
      const activeIndex = held ?? lastHeld;
      if (held != null) lastHeld = held;
      if (activeIndex != null) {
        const el = slateFaceRefs.current[activeIndex];
        const target = held != null ? LIFT_TARGET : 0;
        const [nv, nvel] = springStep(readLift.v, readLift.vel, target, LIFT_K, LIFT_C, dt);
        readLift = { v: nv, vel: nvel };
        if (el) el.style.transform = nv === 0 ? "" : `rotate(${nv.toFixed(2)}deg)`;
        if (held == null && Math.abs(nv) < 0.02 && Math.abs(nvel) < 0.02) {
          if (el) el.style.transform = "";
          lastHeld = null;
          readLift = { v: 0, vel: 0 };
        }
      }
    };
    running = true;
    raf = requestAnimationFrame(tick);

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((e) => e.isIntersecting);
        if (visible && !running) {
          running = true;
          last = performance.now();
          raf = requestAnimationFrame(tick);
        } else if (!visible && running) {
          running = false;
          cancelAnimationFrame(raf);
        }
      },
      { threshold: 0 }
    );
    io.observe(host);

    const onVis = () => {
      if (document.hidden && running) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!document.hidden && !running) {
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    const mo = new MutationObserver(() => {
      tokens = readTokens();
      applyTokens();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      mo.disconnect();
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slates, naturalW, naturalH, rivenBg, staticPicks]);

  const toggle = (index: number) => {
    setLiftedIndex((prev) => (prev === index ? null : index));
  };

  return (
    <div ref={hostRef} className={`relative flex h-full w-full flex-col items-center justify-center gap-4 overflow-hidden bg-background p-4 ${className}`}>
      <p className="font-mono text-xs tracking-widest text-ns-muted">{heading}</p>
      <div
        ref={wallRef}
        className="relative shrink-0"
        // the eaves rail occupies its own band below the last course rather
        // than overlaying it — laid on top it clipped the foot course's last
        // line, which is the exact fault it exists to prevent
        style={{ width: naturalW * scale, height: naturalH * scale + Math.max(4, 6 * scale) }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 rounded-[1px]"
          style={{ backgroundColor: "var(--slate-backing)" }}
        />
        {/* The eaves. Every interior course is cut off by the slate lapping
            over it, which is what reads as overlap; the bottom course has
            nothing above it, so without a rail its cut edge reads as
            truncated text instead of as the foot of the wall. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 z-[1001]"
          style={{
            bottom: 0,
            height: Math.max(4, 6 * scale),
            backgroundColor: "var(--slate-shadow-color)",
            boxShadow: [
              `inset 0 ${Math.max(1, scale)}px 0 0 var(--slate-edge)`,
              `0 ${-3 * scale}px ${8 * scale}px ${-2 * scale}px var(--slate-shadow-color)`,
            ].join(", "),
          }}
        />
        {slates.map((s) => {
          const isLifted = liftedIndex === s.index;
          const padAbove = Math.max(0, MIN_HIT - s.exposure * scale);
          return (
            <button
              key={items[s.index].id}
              type="button"
              aria-expanded={isLifted}
              data-expanded={isLifted}
              data-slate-lift
              aria-label={`${isLifted ? "Collapse" : "Read"} testimonial from ${items[s.index].name}`}
              onClick={() => toggle(s.index)}
              onBlur={() => {
                if (liftedRef.current === s.index) setLiftedIndex(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape" && liftedRef.current === s.index) {
                  setLiftedIndex(null);
                  (e.currentTarget as HTMLElement).blur();
                }
              }}
              className="group absolute cursor-pointer appearance-none border-0 bg-transparent p-0 text-left"
              style={{
                left: s.x * scale,
                top: s.top * scale - padAbove,
                width: SLATE_W * scale,
                height: s.exposure * scale + padAbove,
                // resting bands never overlap (each course occupies exactly
                // its own gauge, edge to edge), so z only has to win once a
                // slate is lifted and needs to paint over the course below it
                zIndex: isLifted ? 1000 : 1,
              }}
            >
              <article
                ref={(el) => {
                  slateFaceRefs.current[s.index] = el;
                }}
                data-slate-face
                className="absolute overflow-hidden rounded-[1px] border-0 bg-[var(--slate-face)] group-focus-visible:ring-2 group-focus-visible:ring-ns-accent group-focus-visible:ring-offset-1"
                style={{
                  top: padAbove,
                  left: 0,
                  width: SLATE_W * scale,
                  // at rest the face IS its gauge — only the exposed margin
                  // is ever painted; lifting grows it to the slate's real
                  // height, which is what reveals the rest of the quote
                  height: (isLifted ? s.h : s.exposure) * scale,
                  transformOrigin: `50% ${NAIL_Y * scale}px`,
                  // no colour fallback here on purpose: before the token read
                  // commits (useLayoutEffect, pre-paint) --slate-shadow-color
                  // is unset, which makes the whole box-shadow invalid and
                  // therefore simply not painted, rather than painted with a
                  // literal placeholder colour
                  // one cast shadow onto the course below (this is what makes
                  // the lap read as a slate sitting OVER its neighbour rather
                  // than as text truncated at a hard edge), one inset seam,
                  // and a sky-lit top arris. All three swing with the single
                  // root-level azimuth property.
                  boxShadow: [
                    `0 ${-1 * Math.max(1, scale)}px 0 0 var(--slate-shadow-color)`,
                    `0 ${-3 * scale}px ${7 * scale}px ${-1 * scale}px var(--slate-shadow-color)`,
                    `inset calc(var(--wall-azimuth, 0) * 0.4px) ${3 * scale}px ${5 * scale}px ${-1 * scale}px var(--slate-shadow-color)`,
                    `inset 0 ${Math.max(1, scale)}px 0 0 var(--slate-edge)`,
                  ].join(", "),
                  translate: `0 calc(var(--gust-lift, 0) * -1px)`,
                }}
              >
                {/* riven texture: a separate layer fixed at the slate's FULL
                    design height regardless of the article's current (gauge
                    or lifted) height, so its percentage-based band stops
                    always land at the same physical position on the stone —
                    the article's own overflow-hidden is what crops it to
                    whichever margin is currently showing */}
                <div
                  ref={(el) => {
                    rivenRefs.current[s.index] = el;
                  }}
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0"
                  style={{ height: s.h * scale }}
                />
                {/* the exposed margin is sky-lit relative to the rest of the
                    stone (section 6, +0.06/+0.05L) — a fixed-height tint over
                    exactly the gauge strip, independent of the article's own
                    current (gauge or lifted) height */}
                <div
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 bg-[var(--slate-margin)] opacity-40"
                  style={{ height: s.exposure * scale }}
                />
                <div
                  className="relative flex h-full flex-col"
                  style={{
                    color: "var(--slate-ink)",
                    padding: `${PAD_Y * scale}px ${8 * scale}px`,
                    // type is scaled with the wall, not left at a fixed pixel
                    // size — a fixed 10px against a gauge that grows with the
                    // fit scale is what left a half line at every lap
                    fontSize: `${FONT_PX * scale}px`,
                    lineHeight: LINE_RATIO,
                  }}
                >
                  {/* always full text in the DOM, never display:none — the
                      gauge-height article above is what occludes it visually */}
                  <blockquote className="m-0">&ldquo;{items[s.index].quote}&rdquo;</blockquote>
                  <footer
                    className="m-0 font-medium"
                    style={{ color: "var(--slate-ink-muted)", fontSize: `${FONT_PX * scale}px` }}
                  >
                    {items[s.index].name} &middot; {items[s.index].role}
                  </footer>
                </div>
              </article>
            </button>
          );
        })}
      </div>
    </div>
  );
}

SlateGauge.displayName = "SlateGauge";

export default SlateGauge;
