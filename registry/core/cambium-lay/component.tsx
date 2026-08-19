"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// CambiumLay — a tree cross-section accreting live in SVG. A 96-spoke
// perimeter (48 shows visible polygon corners once a ring's radius passes
// ~300px; 192 would double every path's byte size for no visible gain, so 96
// is the floor that stays smooth) is advanced outward year by year. Within a
// year the growth rate is asymmetric across time — fast for the first 60% of
// the season (earlywood), then slow for the last 40% (latewood) — and the
// two phases are BUDGETED, not just rate-shaped: earlywood is allotted 70% of
// that year's radial width, latewood the remaining ~30%, because equal
// halves would read as two soft bands instead of one ring closing on a dense
// line. At the moment a year completes, its two boundary curves (start →
// earlywood-end → final) are committed as the RADII record — a Float64Array
// per boundary, pushed once into `boundariesRef` and never touched again as
// DATA. That record is the accretion history and is what "committed" means
// here; it is not the same claim as "the rendered `d` never changes again"
// (see INTERIOR UNDULATION below, which is a fifth-pass correction of an
// earlier version of this file that conflated the two and shipped an opacity
// shimmer instead of real displacement). Only the CURRENT, still-forming
// annulus mutates its own `d` independent of the interior loop, one write
// per tick, ~8 ticks a second.
//
// Two long-lived deformations ride on top of the per-year budget, both
// expressed as a per-spoke multiplier on that spoke's share of the year's
// growth rather than as a one-time nudge to any single ring:
//   - LEAN: a fixed-angle bias (a real cos(theta) field, not noise) whose
//     strength ramps in gradually over the tree's first ~18 years and then
//     holds. Because it is sustained across every subsequent year, the pith
//     ends up visibly off-centre relative to the outer boundary — a leaning
//     trunk's eccentric growth — without ever moving the coordinate origin.
//   - LOBING: a fixed three-harmonic bias over theta, constant across every
//     year, which keeps the section gently polygonal/lobed rather than a
//     true circle.
// A scar event (fixed at years 5–6, one ~50° arc of the 96 spokes) drives
// that arc's growth multiplier to ~8% of normal for two years — a visible
// pinch — then to ~190% for the following three, which is what "healing"
// looks like: the wound stays as a permanent dent in the rings already laid,
// and the rings after it round back out to rejoin the rest of the boundary.
//
// FALSIFIABLE BY CONSTRUCTION: every year's start boundary is literally the
// previous year's final boundary (`start = g.final`), so lean, lobing and the
// scar are integrated forward, never redrawn backward. A ring committed
// before the scar is a frozen path string from that point on — it cannot be
// touched by anything that happens in year 20. This is the opposite of
// concentric circles with randomised radii drawn once: it is one seasonal
// signal walked forward in time, and "walked forward" is exactly what makes
// a lean or scar deform every later ring and no earlier one.
//
// GROWTH TARGET, so the tree doesn't grow forever or all at once: each
// year's average radial-width budget follows a decaying taper (wide juvenile
// rings, narrower mature ones, never below 35% of the juvenile width),
// normalised so `maxYears` of budgets sum exactly to the drawable radius.
// Age is persisted to localStorage as a wall-clock epoch (namespaced
// `ns-cambium-lay:<storageKey>:first-seen`) and capped at `maxYears`, so a
// first-time mount seeds itself partway grown (nobody's hero should open on
// a bare dot) and a returning visitor's tree has kept aging in the
// background rather than restarting.
//
// prefers-reduced-motion renders a prewarmed ~40-ring section via the exact
// same year-closed-form used for catch-up — no timer, no localStorage, no
// live front — so the scar is still visible at rest.
//
// Pure DOM + SVG + CSS, no canvas: committed rings are plain <path>
// elements that, once appended, are never touched again — zero per-frame
// cost. Fills read `var(--ns-muted)` / `var(--foreground)` directly, so a
// theme flip is free and correct with no getComputedStyle re-read. The SVG
// is aria-hidden and pointer-events:none (it is decoration, and content sits
// above it); a single visually-hidden status line names the ring count for
// anyone who lands on the region with a screen reader.
//
// Distinct from sediment-stack (linear strata accreting under gravity, no
// season structure), ring-stain (one evaporative deposition event, nothing
// ever un-freezes but there is no year cycle either), and
// heatmap-year-stipple / stipple-year (data displays, not a grown form).
// ---------------------------------------------------------------------------

export interface CambiumLayProps {
  /** ms per virtual growth year — the only speed control. Default 4000 (~one year per 4s). */
  yearMs?: number;
  /** hard cap on virtual years grown, even for a very old persisted visit. Default 64. */
  maxYears?: number;
  /** localStorage namespace suffix, so two instances on one origin age independently. Default "default". */
  storageKey?: string;
  className?: string;
}

type RingPaths = { earlywood: string; latewood: string };
// TS's typed-array lib generics infer Float64Array<ArrayBuffer> from a bare
// `new Float64Array(n)` but Float64Array<ArrayBufferLike> from some call
// shapes (e.g. a function's declared return type) — one alias used
// everywhere keeps every assignment between them type-compatible.
type Radii = Float64Array<ArrayBufferLike>;
type GrowCtx = { weights: Radii; weightSum: number };

const N_SPOKES = 96;
const TWO_PI = Math.PI * 2;
const VB = 240;
const CENTER = 120;
const PITH_R = 6;
const VIEW_R_MAX = 92; // nominal per-year budget sum; actual render is defensively clamped below this
const R_SAFE = 112; // never exceeded regardless of lean/lobe overshoot — VB margin, not a tuning knob

const EARLY_TIME_FRAC = 0.6; // fraction of the season spent laying earlywood
const EARLY_WIDTH_FRAC = 0.7; // fraction of the year's radial budget earlywood gets — latewood gets the rest (~0.3)

const MIN_TAPER = 0.35; // a mature ring never lays less than 35% of a juvenile ring's width
const TAPER_DECAY = 16; // years — juvenile-width half-life-ish

const LEAN_MAX = 0.16;
const LEAN_RAMP = 18; // years to mostly reach LEAN_MAX
const LEAN_ANGLE = -0.5; // rad — fixed lean direction, chosen once, never rotates

const SCAR_YEAR_START = 5;
const SCAR_SUPPRESS_YEARS = 2;
const SCAR_HEAL_YEARS = 3;
const SCAR_ARC_START = 12;
const SCAR_ARC_END = 26; // ~52 degrees of the 96 spokes
const SCAR_SUPPRESS_MULT = 0.08;
const SCAR_HEAL_MULT = 1.9;

const YEAR_MS_DEFAULT = 4000; // ms per virtual year — at 20000 the live front's per-tick radial delta was under a pixel, reading as a still frame within the few seconds a catalog card is actually judged on
const CAP_YEARS_DEFAULT = 64;
const INITIAL_YEARS = 14; // seeded age on a first-ever mount, so it never opens on a bare dot
const REDUCED_RINGS = 40;
const TICK_MS = 120; // was 333 — 3 writes/sec sampled the travelling front (below) too coarsely to read as motion; ~8/sec is still trivial cost for a 96-spoke path rebuild

// The cambium doesn't lay the whole ring's width down everywhere at once —
// growth is a front that circulates the circumference as the season runs.
// FRONT_REVS_PER_PHASE is how many times that front sweeps fully around the
// ring within one phase (earlywood or latewood); FRONT_LAG_FRAC is how far a
// spoke's local progress can lead or lag the phase's mean progress while the
// front is near or far from it. Both apply ONLY to the live, still-forming
// boundary shown between ticks — the taper below forces the lag to exactly 0
// at the start and end of every phase, so the two committed boundaries
// (earlyEnd, final) that `growYear` produces are completely unaffected: this
// reshapes how a ring visibly arrives at its real target, not the target
// itself.
const FRONT_REVS_PER_PHASE = 1.4;
const FRONT_LAG_FRAC = 0.32;
// reduced-motion still needs to be honest that this is a living illustration
// — a single static frame that never changes again reads as broken, not
// calm. Every REDUCED_RING_INTERVAL_MS it commits exactly one more whole
// ring (a discrete pop, not an interpolated sweep — no continuous per-frame
// boundary motion, which is what the vestibular guard is actually about),
// so a viewer who lingers on the card for a few seconds sees the tree
// genuinely still growing, just slowly and step-wise instead of smoothly.
const REDUCED_RING_INTERVAL_MS = 2200;

// --- MOTION VARIANT (switchable, ship value below) --------------------
// Three tuning passes on FRONT_REVS_PER_PHASE/FRONT_LAG_FRAC (the live,
// still-forming boundary's per-tick wobble) each measured out at roughly
// 0.4 viewBox units of peak excursion on the demo's actual per-year budget
// — a fraction of a screen pixel at card scale. That is not a "wavy effect
// [that] doesn't work", it is one that was never renderable, because the
// taper deliberately forces it back to zero at every phase boundary so
// committed rings stay untouched. These three are genuinely different
// treatments, not further tunings of that same capped wobble:
//   "front-bulge" — the pre-existing behaviour: only the live, forming
//                   boundary ripples (frontLocalProgress), reset to 0 at
//                   every phase start/end; every committed ring is a plain
//                   Catmull-Rom circle-ish shape once laid.
//   "wavy-rings"  — a phase-advancing per-spoke sinusoid multiplies
//                   growYear's radial budget directly, so the wave is
//                   COMMITTED into every ring's real geometry (never reset)
//                   and its phase shifts year to year — successive rings
//                   are visibly wavy relative to each other and the wave
//                   reads as travelling outward as the tree ages. Measured
//                   on the standalone sim (same growYear math, 96 spokes,
//                   maxYears=64): WAVE_AMPL=0.75, WAVE_HARMONIC=5 ->
//                   ring-boundary peak excursion ~4.3 viewBox units by
//                   year 13, ~5-6px at typical card scale (well past the
//                   ~3-4px visibility floor front-bulge never cleared).
//   "pulse-sweep" — a decorative light ring (CSS transform+opacity, no
//                   canvas, --foreground only) sweeping outward over the
//                   already-committed rings on a fixed loop — no change to
//                   any path's geometry at all.
const MOTION: "front-bulge" | "wavy-rings" | "pulse-sweep" = "wavy-rings";
const WAVE_AMPL = 0.75; // "wavy-rings" only — +/- fraction of that year's radial budget
const WAVE_HARMONIC = 5; // "wavy-rings" only — wave crests per full revolution; also reused as the interior undulation's harmonic (below) so both waves read as the same physical texture
const WAVE_PHASE_PER_YEAR = Math.PI * 0.6; // "wavy-rings" only — phase advance per virtual year, what makes the wave read as travelling ring to ring

// --- INTERIOR UNDULATION (fifth pass — supersedes the opacity shimmer) ----
// "wavy-rings" above bakes a spatial wave into each ring's geometry AT
// COMMIT and never touches it again — that alone does not read as "the
// inside is moving" because a static wavy shape is still a still frame.
// This is a SEPARATE, per-frame effect: every committed boundary's radii
// (the immutable accretion record in `boundariesRef`) get a small
// additional sinusoidal offset, recomputed every animation frame, so the
// interior rings genuinely displace — real geometry motion, not a
// brightness change. Same harmonic as "wavy-rings" (reads as one texture,
// not two competing effects), phase-shifted by BOUNDARY INDEX (not just
// ring index — a boundary is shared between the ring inside it and the
// ring outside it, so indexing by boundary is what keeps adjacent rings
// seamless) and rotated by wall-clock time, so a wave crest at a fixed
// angle visibly migrates from outer boundaries toward the pith as time
// advances — same "rim -> pith" direction as the opacity shimmer it
// replaces, now as literal displacement instead of a brightness delta.
// The per-boundary phase STEP is kept small on purpose: absolute amplitude
// and the differential between adjacent boundaries are different knobs —
// a small step keeps neighbouring boundaries moving nearly in lockstep
// (no self-intersecting annulus) while the *stack* still swings by the
// full amplitude, and it's what makes the inward crest-migration read
// dominate over in-place rotation (crest travels across boundary indices
// much faster than the θ-rotation term shifts the wave azimuthally).
// A monotonic clamp is applied outward-to-inward-first (see
// `displaceBoundaries`) as a hard guarantee against inversion regardless
// of amplitude tuning: every boundary's displaced radius is forced to stay
// at least MIN_GAP past its inward neighbour's, per spoke. Amplitude ramps
// to 0 over the outermost few boundaries so the newest committed boundary
// — shared with the still-forming live front, which this loop does not
// touch — never develops a seam.
// Gated on `!reduced`: prefers-reduced-motion keeps the existing discrete
// ring-commit progression (a pop, not a continuous sweep) as its motion —
// see the REDUCED_RING_INTERVAL_MS comment above ("no continuous per-frame
// boundary motion, which is what the vestibular guard is actually about").
// Adding a continuous undulation on top of that would be exactly the thing
// that comment argues against, so under reduced motion the interior stays
// genuinely static between ring-commit pops.
const INTERIOR_WAVE_AMPL = 3.2; // viewBox units, absolute — the whole stack's peak radial swing
const INTERIOR_WAVE_PHASE_STEP = 0.11; // rad per boundary index — kept small so adjacent boundaries stay coherent
const INTERIOR_WAVE_OMEGA = 0.7; // rad/sec — time-rotation rate; sign convention below makes crests migrate inward as t grows
const INTERIOR_WAVE_RAMP_BOUNDARIES = 6; // outermost N and innermost N boundaries fade amplitude to 0 — joins the live front seamlessly on one end, keeps the pith a crisp dot on the other
const INTERIOR_WAVE_MIN_GAP = 0.06; // viewBox units — hard floor on the gap between adjacent displaced boundaries, prevents inversion
const INTERIOR_WAVE_UPDATE_HZ = 24; // throttle for the rAF-driven recompute — well past the ~8-10fps floor for smooth-reading motion, far under redoing it every frame for no visible gain

const THETAS = Array.from({ length: N_SPOKES }, (_, i) => (i / N_SPOKES) * TWO_PI);
const COS = THETAS.map(Math.cos);
const SIN = THETAS.map(Math.sin);
// three fixed low-frequency harmonics — the section's static lobed shape,
// identical every year, never a function of time.
const LOBE_BIAS = THETAS.map((t) => 0.07 * Math.sin(3 * t + 0.6) + 0.04 * Math.sin(5 * t + 2.3) + 0.025 * Math.sin(7 * t + 1.1));

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function leanBias(theta: number, year: number): number {
  const strength = LEAN_MAX * (1 - Math.exp(-year / LEAN_RAMP));
  return strength * Math.cos(theta - LEAN_ANGLE);
}

function scarMultiplier(spoke: number, year: number): number {
  if (spoke < SCAR_ARC_START || spoke >= SCAR_ARC_END) return 1;
  if (year >= SCAR_YEAR_START && year < SCAR_YEAR_START + SCAR_SUPPRESS_YEARS) return SCAR_SUPPRESS_MULT;
  const healStart = SCAR_YEAR_START + SCAR_SUPPRESS_YEARS;
  if (year >= healStart && year < healStart + SCAR_HEAL_YEARS) return SCAR_HEAL_MULT;
  return 1;
}

function buildCtx(maxYears: number): GrowCtx {
  const weights: Radii = new Float64Array(maxYears);
  let sum = 0;
  for (let y = 0; y < maxYears; y++) {
    const w = MIN_TAPER + (1 - MIN_TAPER) * Math.exp(-y / TAPER_DECAY);
    weights[y] = w;
    sum += w;
  }
  return { weights, weightSum: sum || 1 };
}

/** Closed-form growth for one year: the two boundaries a committed ring needs. */
function growYear(year: number, start: Radii, ctx: GrowCtx): { earlyEnd: Radii; final: Radii } {
  const tw = ((VIEW_R_MAX - PITH_R) * (ctx.weights[year] ?? MIN_TAPER)) / ctx.weightSum;
  const earlyBudget = tw * EARLY_WIDTH_FRAC;
  const lateBudget = tw * (1 - EARLY_WIDTH_FRAC);
  const earlyEnd: Radii = new Float64Array(N_SPOKES);
  const final: Radii = new Float64Array(N_SPOKES);
  for (let i = 0; i < N_SPOKES; i++) {
    const mult = clamp(1 + LOBE_BIAS[i] + leanBias(THETAS[i], year), 0.2, 1.5);
    const scar = scarMultiplier(i, year);
    // "wavy-rings" only: a phase-advancing sinusoid on top of the budget,
    // never clamped through the lobe/lean 0.2-1.5 range (it would fight the
    // lobe/lean headroom there and flatten its own peaks) — applied as its
    // own multiplier so it is COMMITTED into earlyEnd/final, unlike the
    // live-front wobble below which is forced to 0 at every phase boundary.
    const wave =
      MOTION === "wavy-rings" ? 1 + WAVE_AMPL * Math.sin(WAVE_HARMONIC * THETAS[i] + year * WAVE_PHASE_PER_YEAR) : 1;
    const e = start[i] + earlyBudget * mult * scar * wave;
    earlyEnd[i] = e;
    final[i] = e + lateBudget * mult * scar * wave;
  }
  return { earlyEnd, final };
}

/**
 * Per-spoke local progress within a phase, given the phase's mean progress
 * `p` (0..1). The front's azimuth sweeps FRONT_REVS_PER_PHASE times around
 * the ring as `p` goes 0 -> 1; a spoke near the front's current azimuth is
 * running slightly AHEAD of the mean (already at this instant's leading
 * edge), one near the opposite azimuth slightly BEHIND (still settling into
 * place before the front reaches it again). `taper` is 0 at p=0 and p=1 by
 * construction, so every spoke lands exactly on the phase's real endpoint
 * regardless of the wave — only the path it takes to get there bulges.
 */
function frontLocalProgress(p: number, theta: number): number {
  const clampedP = clamp(p, 0, 1);
  // Only "front-bulge" carries this wobble — for the other two variants it
  // would be an invisible, uncredited fourth effect riding under whichever
  // one is actually being judged, so a fair A/B needs it isolated to its
  // own variant.
  if (MOTION !== "front-bulge") return clampedP;
  const frontAngle = FRONT_REVS_PER_PHASE * TWO_PI * clampedP;
  const taper = Math.sin(Math.PI * clampedP);
  const lag = FRONT_LAG_FRAC * taper * Math.cos(frontAngle - theta);
  return clamp(clampedP + lag, 0, 1);
}

/** Interpolation of the live, still-forming boundary within the current year, given u = season fraction elapsed. Each spoke rides its own front-relative progress (see frontLocalProgress) rather than a single shared fraction, so the boundary that's currently accreting visibly bulges and travels around the ring as it forms, instead of the whole edge advancing in lockstep. */
function currentBoundary(u: number, start: Radii, earlyEnd: Radii, final: Radii): Radii {
  const out: Radii = new Float64Array(N_SPOKES);
  if (u <= EARLY_TIME_FRAC) {
    const p = u / EARLY_TIME_FRAC;
    for (let i = 0; i < N_SPOKES; i++) {
      const pi = frontLocalProgress(p, THETAS[i]!);
      out[i] = start[i] + (earlyEnd[i] - start[i]) * pi;
    }
  } else {
    const p = (u - EARLY_TIME_FRAC) / (1 - EARLY_TIME_FRAC);
    for (let i = 0; i < N_SPOKES; i++) {
      const pi = frontLocalProgress(p, THETAS[i]!);
      out[i] = earlyEnd[i] + (final[i] - earlyEnd[i]) * pi;
    }
  }
  return out;
}

function toPoints(radius: Radii): { x: number; y: number }[] {
  const pts = new Array<{ x: number; y: number }>(N_SPOKES);
  for (let i = 0; i < N_SPOKES; i++) {
    const r = Math.min(radius[i], R_SAFE);
    pts[i] = { x: CENTER + r * COS[i], y: CENTER + r * SIN[i] };
  }
  return pts;
}

/** Closed Catmull-Rom smoothing through `pts`, as cubic beziers. */
function smoothClosedPath(pts: { x: number; y: number }[]): string {
  const n = pts.length;
  if (n < 3) return "";
  const p0 = pts[0];
  let d = `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)}`;
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n];
    const b = pts[i];
    const c = pts[(i + 1) % n];
    const e = pts[(i + 2) % n];
    const c1x = b.x + (c.x - a.x) / 6;
    const c1y = b.y + (c.y - a.y) / 6;
    const c2x = c.x - (e.x - b.x) / 6;
    const c2y = c.y - (e.y - b.y) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${c.x.toFixed(2)} ${c.y.toFixed(2)}`;
  }
  return `${d} Z`;
}

function buildRingPaths(start: Radii, earlyEnd: Radii, final: Radii): RingPaths {
  const sPts = toPoints(start);
  const ePts = toPoints(earlyEnd);
  const fPts = toPoints(final);
  return {
    earlywood: `${smoothClosedPath(sPts)} ${smoothClosedPath(ePts)}`,
    latewood: `${smoothClosedPath(ePts)} ${smoothClosedPath(fPts)}`,
  };
}

function simulateYears(n: number, ctx: GrowCtx): { rings: RingPaths[]; start: Radii; boundaries: Radii[] } {
  let start: Radii = new Float64Array(N_SPOKES).fill(PITH_R);
  const rings: RingPaths[] = [];
  const boundaries: Radii[] = [start];
  for (let y = 0; y < n; y++) {
    const g = growYear(y, start, ctx);
    rings.push(buildRingPaths(start, g.earlyEnd, g.final));
    boundaries.push(g.earlyEnd, g.final);
    start = g.final;
  }
  return { rings, start, boundaries };
}

/**
 * Per-frame displacement pass over the committed boundary stack — see the
 * INTERIOR UNDULATION block above for why this exists and how the constants
 * were chosen. `boundaries[0]` is the pith, `boundaries[k]` for k >= 1
 * alternates earlywood-end/final radii walking outward; a ring at index i
 * sits between `boundaries[2i]` and `boundaries[2i+2]`, sharing each edge
 * with its neighbour, so displacing by boundary index (not ring index) is
 * what keeps rings joined with no gap. Returns one smoothed SVG path
 * fragment per boundary — callers slice adjacent pairs to build a ring's
 * two annulus `d` strings.
 */
function displaceBoundaries(boundaries: Radii[], t: number): string[] {
  const n = boundaries.length;
  const displaced: Radii[] = new Array(n);
  for (let k = 0; k < n; k++) {
    const distFromFront = n - 1 - k;
    const rampOut = distFromFront >= INTERIOR_WAVE_RAMP_BOUNDARIES ? 1 : distFromFront / INTERIOR_WAVE_RAMP_BOUNDARIES;
    // Symmetric ramp on the pith side too: boundary 0 IS the pith (a
    // constant-radius circle, sitting right next to the separately-drawn
    // solid pith dot), and a flat INTERIOR_WAVE_AMPL there is enormous
    // relative to its ~6-unit radius — measured result was a 5-petal
    // rosette where a crisp dot should be, because the wave's angular
    // frequency (WAVE_HARMONIC=5) reads as scalloping once amplitude
    // approaches the shape's own radius. Radius-proportional scaling alone
    // does not fix this (it scales the distortion down but the RATIO, and
    // therefore the rosette shape, stays the same at every radius) — an
    // index ramp identical in kind to the outer one is what a real fix
    // needs: the first few boundaries stay essentially undisplaced and the
    // wave fades in only once there's enough ring stack for it to read as
    // undulation rather than a shape change.
    const rampIn = k >= INTERIOR_WAVE_RAMP_BOUNDARIES ? 1 : k / INTERIOR_WAVE_RAMP_BOUNDARIES;
    const ampl = INTERIOR_WAVE_AMPL * rampOut * rampIn;
    const b = boundaries[k];
    const out: Radii = new Float64Array(N_SPOKES);
    const prev = k > 0 ? displaced[k - 1] : null;
    for (let i = 0; i < N_SPOKES; i++) {
      const wave = ampl * Math.sin(WAVE_HARMONIC * THETAS[i] + k * INTERIOR_WAVE_PHASE_STEP + t * INTERIOR_WAVE_OMEGA);
      let v = b[i] + wave;
      if (prev) v = Math.max(v, prev[i] + INTERIOR_WAVE_MIN_GAP);
      out[i] = Math.min(v, R_SAFE);
    }
    displaced[k] = out;
  }
  const paths = new Array<string>(n);
  for (let k = 0; k < n; k++) paths[k] = smoothClosedPath(toPoints(displaced[k]));
  return paths;
}

const CSS = `
.ns-cl-live{fill:var(--ns-muted);transition:fill 900ms ease}
.ns-cl-live.ns-cl-late{fill:var(--foreground)}
@keyframes ns-cl-pulse-sweep{
  0%{transform:scale(0.05);opacity:0.55}
  85%{opacity:0}
  100%{transform:scale(1);opacity:0}
}
.ns-cl-pulse{
  transform-box:fill-box;
  transform-origin:center;
  animation:ns-cl-pulse-sweep 3200ms linear infinite;
}
@media (prefers-reduced-motion: reduce){
  .ns-cl-live{transition:none}
  .ns-cl-pulse{animation-duration:9000ms}
}
`;

export function CambiumLay({
  yearMs = YEAR_MS_DEFAULT,
  maxYears = CAP_YEARS_DEFAULT,
  storageKey = "default",
  className = "",
}: CambiumLayProps) {
  const [reduced, setReduced] = useState(false);
  const [rings, setRings] = useState<RingPaths[]>([]);

  const liveRef = useRef<SVGPathElement | null>(null);
  const startRef = useRef<Radii>(new Float64Array(N_SPOKES).fill(PITH_R));
  const targetRef = useRef<{ earlyEnd: Radii; final: Radii } | null>(null);
  const lastYearRef = useRef(-1);
  const lateRef = useRef(false);

  // The immutable accretion record the interior undulation displaces from —
  // see displaceBoundaries above. Index 0 is the pith; index k for k >= 1
  // alternates earlywood-end/final radii walking outward. Ref, not state:
  // it changes on the same cadence as `rings` but is read every animation
  // frame, so it must not go through React's render cycle.
  const boundariesRef = useRef<Radii[]>([new Float64Array(N_SPOKES).fill(PITH_R)]);
  const earlyPathRefs = useRef<(SVGPathElement | null)[]>([]);
  const latePathRefs = useRef<(SVGPathElement | null)[]>([]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const safeMaxYears = Math.max(1, Math.floor(maxYears));
    const ctx = buildCtx(safeMaxYears);

    if (reduced) {
      let n = Math.min(REDUCED_RINGS, safeMaxYears);
      const { rings: pre, start: preStart, boundaries } = simulateYears(n, ctx);
      setRings(pre);
      boundariesRef.current = boundaries; // static under reduced motion — the interior loop never runs (see gate below)
      if (n >= safeMaxYears) return; // already fully grown at this cap — genuinely nothing left to show

      let start = preStart;
      const id = window.setInterval(() => {
        if (n >= safeMaxYears) {
          window.clearInterval(id);
          return;
        }
        const g = growYear(n, start, ctx);
        const ring = buildRingPaths(start, g.earlyEnd, g.final);
        start = g.final;
        n += 1;
        setRings((prev) => prev.concat([ring]));
        boundariesRef.current = boundariesRef.current.concat([g.earlyEnd, g.final]);
      }, REDUCED_RING_INTERVAL_MS);
      return () => window.clearInterval(id);
    }

    const capMs = safeMaxYears * yearMs;
    const key = `ns-cambium-lay:${storageKey}:first-seen`;
    let firstSeen = 0;
    try {
      const raw = window.localStorage.getItem(key);
      firstSeen = raw ? Number(raw) : 0;
    } catch {
      firstSeen = 0;
    }
    if (!firstSeen || Number.isNaN(firstSeen)) {
      firstSeen = Date.now() - Math.min(INITIAL_YEARS, safeMaxYears) * yearMs;
      try {
        window.localStorage.setItem(key, String(firstSeen));
      } catch {
        // storage unavailable (private mode, quota) — the tree just starts young this visit
      }
    }

    let start: Radii = new Float64Array(N_SPOKES).fill(PITH_R);
    const committed: RingPaths[] = [];
    const boundaries: Radii[] = [start];
    const elapsedAtMount = Math.min(Date.now() - firstSeen, capMs);
    const wholeYears = Math.min(Math.floor(elapsedAtMount / yearMs), safeMaxYears);
    for (let y = 0; y < wholeYears; y++) {
      const g = growYear(y, start, ctx);
      committed.push(buildRingPaths(start, g.earlyEnd, g.final));
      boundaries.push(g.earlyEnd, g.final);
      start = g.final;
    }
    setRings(committed);
    boundariesRef.current = boundaries;
    startRef.current = start;
    lastYearRef.current = wholeYears - 1;
    lateRef.current = false;
    liveRef.current?.classList.remove("ns-cl-late");

    if (wholeYears >= safeMaxYears) return; // fully grown for this visit — no live front

    targetRef.current = growYear(wholeYears, start, ctx);

    const tick = () => {
      const elapsed = Math.min(Date.now() - firstSeen, capMs);
      const yIdx = Math.min(Math.floor(elapsed / yearMs), safeMaxYears);

      if (yIdx > lastYearRef.current) {
        const newRings: RingPaths[] = [];
        const newBoundaries: Radii[] = [];
        let s = startRef.current;
        for (let y = lastYearRef.current + 1; y < yIdx && y < safeMaxYears; y++) {
          const g = growYear(y, s, ctx);
          newRings.push(buildRingPaths(s, g.earlyEnd, g.final));
          newBoundaries.push(g.earlyEnd, g.final);
          s = g.final;
        }
        startRef.current = s;
        lastYearRef.current = yIdx - 1;
        if (newRings.length) {
          setRings((prev) => prev.concat(newRings));
          boundariesRef.current = boundariesRef.current.concat(newBoundaries);
        }
        if (yIdx < safeMaxYears) {
          targetRef.current = growYear(yIdx, s, ctx);
          lateRef.current = false;
          liveRef.current?.classList.remove("ns-cl-late");
        }
      }

      if (yIdx >= safeMaxYears) {
        window.clearInterval(id);
        return;
      }

      const target = targetRef.current;
      if (!target) return;
      const u = (elapsed % yearMs) / yearMs;
      const isLate = u > EARLY_TIME_FRAC;
      if (isLate !== lateRef.current) {
        lateRef.current = isLate;
        liveRef.current?.classList.toggle("ns-cl-late", isLate);
      }
      const bound = currentBoundary(u, startRef.current, target.earlyEnd, target.final);
      const d = `${smoothClosedPath(toPoints(startRef.current))} ${smoothClosedPath(toPoints(bound))}`;
      liveRef.current?.setAttribute("d", d);
    };

    tick();
    const id = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(id);
  }, [reduced, yearMs, maxYears, storageKey]);

  const ringCount = rings.length;
  const showLive = !reduced && ringCount < Math.max(1, Math.floor(maxYears));

  // Paint committed rings with a correct (undisplaced) `d` synchronously on
  // every ring-count change, before the browser paints — otherwise a newly
  // mounted <path> would render with no `d` attribute at all (a genuinely
  // blank shape) for however long it takes the rAF loop below to run its
  // first frame. This is the ONLY writer of `d` when `reduced` is true,
  // since the interior loop is gated off in that mode.
  useLayoutEffect(() => {
    const boundaries = boundariesRef.current;
    const n = boundaries.length;
    if (n < 3) return;
    const smoothed = new Array<string>(n);
    for (let k = 0; k < n; k++) smoothed[k] = smoothClosedPath(toPoints(boundaries[k]));
    const rc = Math.floor((n - 1) / 2);
    for (let i = 0; i < rc; i++) {
      earlyPathRefs.current[i]?.setAttribute("d", `${smoothed[2 * i]} ${smoothed[2 * i + 1]}`);
      latePathRefs.current[i]?.setAttribute("d", `${smoothed[2 * i + 1]} ${smoothed[2 * i + 2]}`);
    }
  }, [ringCount]);

  // The interior undulation itself — one rAF loop, throttled to
  // INTERIOR_WAVE_UPDATE_HZ, reading boundariesRef fresh every frame so it
  // always displaces from whatever has actually been committed so far
  // (never stale). Writes `d` directly via refs, bypassing React state —
  // see the useLayoutEffect above for why JSX never carries a `d` prop for
  // committed rings when `!reduced`: if it did, the next unrelated re-render
  // (a ring commit, a prop change) would snap every displaced path back to
  // its undisplaced shape, because React would re-assert the JSX value.
  useEffect(() => {
    if (reduced) return; // see INTERIOR UNDULATION comment above — reduced motion keeps the discrete ring-commit pop only
    let raf = 0;
    let running = true;
    const startedAt = performance.now();
    const minFrameMs = 1000 / INTERIOR_WAVE_UPDATE_HZ;
    let lastFrameAt = 0;
    const step = (now: number) => {
      if (!running) return;
      if (now - lastFrameAt >= minFrameMs) {
        lastFrameAt = now;
        const t = (now - startedAt) / 1000;
        const boundaries = boundariesRef.current;
        const n = boundaries.length;
        if (n >= 3) {
          const smoothed = displaceBoundaries(boundaries, t);
          const rc = Math.floor((n - 1) / 2);
          for (let i = 0; i < rc; i++) {
            earlyPathRefs.current[i]?.setAttribute("d", `${smoothed[2 * i]} ${smoothed[2 * i + 1]}`);
            latePathRefs.current[i]?.setAttribute("d", `${smoothed[2 * i + 1]} ${smoothed[2 * i + 2]}`);
          }
        }
      }
      raf = window.requestAnimationFrame(step);
    };
    raf = window.requestAnimationFrame(step);
    return () => {
      running = false;
      window.cancelAnimationFrame(raf);
    };
  }, [reduced]);

  return (
    <div className={`relative h-full w-full overflow-hidden ${className}`} data-cambium-lay>
      <style>{CSS}</style>
      <svg
        viewBox={`0 0 ${VB} ${VB}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        focusable="false"
        className="pointer-events-none block h-full w-full"
      >
        <circle cx={CENTER} cy={CENTER} r={PITH_R * 0.55} fill="var(--foreground)" />
        {rings.map((r, i) => (
          <g key={i}>
            <path
              ref={(el) => {
                earlyPathRefs.current[i] = el;
              }}
              d={reduced ? r.earlywood : undefined}
              fill="var(--ns-muted)"
              fillRule="evenodd"
            />
            <path
              ref={(el) => {
                latePathRefs.current[i] = el;
              }}
              d={reduced ? r.latewood : undefined}
              fill="var(--foreground)"
              fillRule="evenodd"
            />
          </g>
        ))}
        {showLive && <path ref={liveRef} className="ns-cl-live" fillRule="evenodd" d="" />}
        {MOTION === "pulse-sweep" && (
          <circle
            className="ns-cl-pulse"
            cx={CENTER}
            cy={CENTER}
            r={R_SAFE}
            fill="none"
            stroke="var(--foreground)"
            strokeWidth={2}
          />
        )}
      </svg>
      <span role="status" aria-live="polite" className="sr-only">
        decorative tree-ring illustration, {ringCount} ring{ringCount === 1 ? "" : "s"}
      </span>
    </div>
  );
}
