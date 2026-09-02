"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// RockerBlot — a waitlist capture built on a rocker blotter, not a toast.
//
// A curved rocker carrying blotting paper is rocked once across a fresh
// entry on submit; capillary action lifts a fraction of the entry's density
// (uptake = 0.62 * exp(-age/1.4), floored 0.04) and deposits a MIRRORED,
// partial impression on the sheet below. Successive blottings overlay into a
// palimpsest that never clears — this is deliberately the opposite of
// signature-consent (ink that stays where it's drawn) and streaming-ink-dry
// (ink that dries in place): the entire mechanic here is subtraction and
// transfer to a second surface, and the accumulated residue on that second
// surface IS the payoff, not a toast layered over the form.
//
// The readable <input> text is never touched by canvas. Two things ARE
// canvas ink: (a) a ruled entry stroke under the input whose length tracks
// the submitted string's measured width, lightened to (1 - uptake) once the
// sweep passes it, and (b) a one-shot raster of the submitted string,
// mirrored and composited onto the blotter as a ghost. Ambient ghosts (a
// seeded set of six, plus anything the sheet-change recycles) are procedural
// handwriting-like strokes, never invented customer text — only the user's
// own submission rasterizes real characters.
//
// The blotter sheet is a persistent second surface: it is seeded at mount
// with six ghosts at ages 0.4/3/9/22/60/140s so the component is mid-process
// on first paint, and it keeps aging unconditionally (blur toward 3.1px at
// tau 26s, alpha decaying 4%/min, 40 deterministic fibres feathering each
// ghost's edge to 9px at 1.6px/s) whether or not anyone ever submits. On a
// real submit, the ghost lands at a physically fixed queue slot
// (y = pitch * n, pitch ~28px at card scale, floored 16px) at raised
// contrast (uptake * 0.7 * 1.35, capped 0.62) with a 1px underline, and that
// slot is durable for the session — it is never cleared, and it survives the
// bounded-memory sheet-change (34% coverage -> 700ms slide) that only
// recycles the ambient layer. A referral (only if the consumer wires
// onReferral) lays a second, drier blot at the uptake floor: the same law,
// a different age, nothing new invented for the state.
// ---------------------------------------------------------------------------

const UPTAKE_MAX = 0.62;
const UPTAKE_TAU_S = 1.4;
const UPTAKE_FLOOR = 0.04;

const SWEEP_MS = 520;
const ARC_WIDTH_PX = 46;
const ROCKER_ROT_DEG = 11;
const CONTACT_LEAD_PX = 9;

const GHOST_PITCH_FACTOR = 0.055;
const GHOST_PITCH_FLOOR = 16;
const GHOST_JITTER_PX = 6;
// Deposit alpha = uptake * this. A blot that the eye cannot find is not
// social proof, and at 0.7 on a mid-grey panel the older half of the stack
// was under the visible threshold once blurred.
const DEPOSIT_ALPHA_FACTOR = 0.95;

const CAPILLARY_BLUR_START = 1.1;
// 3.1px dissolved an 18px-tall mark into the paper: an older blot has to stay
// READABLE as a blot, since the accumulated residue is this component's whole
// payoff. The curve shape and time-constant are unchanged.
const BLUR_ASYMPTOTE = 2.2;
const BLUR_TAU_S = 26;
const ALPHA_DECAY_PER_MIN = 0.04;

const FIBRE_COUNT = 40;
const FEATHER_RATE_PX_S = 1.6;
const FEATHER_MAX_PX = 9;

// Two independent axes, which the first cut conflated: how OLD the blot is
// (blur, feathering, the 4%/min fade) and how fresh the STROKE was when it
// was blotted (the uptake law, which sets how much ink it gave up). Seeding
// both from one age meant every mark older than ~3s was deposited at the
// 0.04 uptake floor and rendered invisible — a grey slab with correct
// physics. Eight marks, each a reasonably fresh stroke blotted at a
// different time in the past, is what a used blotter actually looks like.
const SEED_OWN_AGES_S = [1, 4, 9, 20, 42, 80, 150, 260];
const SEED_STROKE_AGES_S = [0.2, 0.9, 0.35, 1.6, 0.5, 2.4, 0.7, 1.2];

// A blotter over a live register keeps receiving other people's blottings —
// this is what keeps the sheet mid-process indefinitely instead of the six
// seeded ghosts going static once their own feathering caps out at 9px
// (seed ages 3/9/22/60/140 are already past that cap at t=0). One new
// ambient mark on a deterministic cadence is inside the metaphor, not an
// invented mechanic, and it's also what lets ink coverage ever reach the
// 34% sheet-change threshold without a visitor submitting anything.
const AMBIENT_ADD_INTERVAL_S = 6;

const QUEUE_PITCH_FACTOR = 0.09;
const QUEUE_PITCH_FLOOR = 22;

const SHEET_CHANGE_COVERAGE = 0.34;
const SHEET_SLIDE_MS = 700;

const ROCKER_IDLE_PERIOD_S = 2.9;
const ROCKER_IDLE_AMP_DEG = 3;
const ROCKER_IDLE_TRANSLATE_PX = 1;

const DURABLE_ALPHA_MULT = 1.35;
const DURABLE_ALPHA_CAP = 0.62;

const STATIC_TIME_S = 1.9;
const STATIC_ROCKER_DEG = -7;
const STATIC_SWEEP_FRAC = 0.63;
const STATIC_GHOST_ALPHA = 0.44;
const STATIC_OLDER_BLURS = [1.9, 2.3, 2.7, 2.9, 3.1];

const DPR_CAP = 2;

function uptakeFor(ageSeconds: number): number {
  return Math.max(UPTAKE_FLOOR, UPTAKE_MAX * Math.exp(-ageSeconds / UPTAKE_TAU_S));
}

function blurFor(ownAgeSeconds: number): number {
  return BLUR_ASYMPTOTE - (BLUR_ASYMPTOTE - CAPILLARY_BLUR_START) * Math.exp(-ownAgeSeconds / BLUR_TAU_S);
}

function decayedAlpha(baseAlpha: number, ownAgeSeconds: number): number {
  return baseAlpha * Math.pow(1 - ALPHA_DECAY_PER_MIN, ownAgeSeconds / 60);
}

function featherFor(ownAgeSeconds: number): number {
  return Math.min(FEATHER_MAX_PX, FEATHER_RATE_PX_S * ownAgeSeconds);
}

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
  /** Ink must stay darker than paper in both themes — no glow inversion. In
   * light theme paper is --background and ink is --foreground; in dark
   * theme the relationship flips (paper reads lighter than page background,
   * ink is drawn as --background) so this is derived from which of fg/bg is
   * actually darker, never from a class name. */
  ink: string;
  paper: string;
}

function relLuminance(css: string): number {
  const probe = document.createElement("span");
  probe.style.color = css;
  probe.style.display = "none";
  document.body.appendChild(probe);
  const rgb = getComputedStyle(probe).color;
  document.body.removeChild(probe);
  const m = rgb.match(/[\d.]+/g);
  if (!m) return 0;
  const [r, g, b] = m.map(Number);
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function resolveRGB(css: string): [number, number, number] {
  const probe = document.createElement("span");
  probe.style.color = css;
  probe.style.display = "none";
  document.body.appendChild(probe);
  const rgb = getComputedStyle(probe).color;
  document.body.removeChild(probe);
  const m = rgb.match(/[\d.]+/g);
  if (!m) return [0, 0, 0];
  return [Number(m[0]), Number(m[1]), Number(m[2])];
}

function mixCss(a: string, b: string, t: number): string {
  const [ar, ag, ab] = resolveRGB(a);
  const [br, bg2, bb] = resolveRGB(b);
  return `rgb(${Math.round(ar + (br - ar) * t)}, ${Math.round(ag + (bg2 - ag) * t)}, ${Math.round(ab + (bb - ab) * t)})`;
}

function readTokens(): Tokens | null {
  if (typeof document === "undefined") return null;
  const cs = getComputedStyle(document.documentElement);
  const fg = cs.getPropertyValue("--foreground").trim();
  const bg = cs.getPropertyValue("--background").trim();
  const muted = cs.getPropertyValue("--ns-muted").trim();
  if (!fg || !bg || !muted) return null; // stylesheet not applied yet — paint nothing
  const dark = relLuminance(bg) < relLuminance(fg);
  // dark theme: the register paper reads as the lighter --ns-muted panel and
  // the ink is drawn as --background so it stays the darker of the pair.
  // Dark theme: the panel is --ns-muted pulled halfway back toward
  // --background. Bare --ns-muted is a near-white slab in a dark card — it
  // read as a broken image rather than as paper, and it still clears the ink
  // (--background) by a wide margin at this mix.
  return { fg, bg, muted, ink: dark ? bg : fg, paper: dark ? mixCss(muted, bg, 0.26) : mixCss(bg, fg, 0.04) };
}

// A one-shot raster of a mark, built once per ghost and composited (mirrored,
// blurred, alpha'd) every frame rather than re-drawn from scratch. Real
// submissions rasterize the actual typed characters; ambient marks are a
// deterministic handwriting-like squiggle so nothing that looks like another
// person's data is invented.
function buildTextRaster(text: string, fg: string): HTMLCanvasElement {
  const measurer = document.createElement("canvas").getContext("2d")!;
  measurer.font = "13px ui-monospace, SFMono-Regular, monospace";
  const width = Math.max(24, Math.min(220, measurer.measureText(text).width + 8));
  const c = document.createElement("canvas");
  c.width = Math.ceil(width);
  c.height = 20;
  const ctx = c.getContext("2d")!;
  ctx.font = "13px ui-monospace, SFMono-Regular, monospace";
  ctx.fillStyle = fg;
  ctx.textBaseline = "middle";
  ctx.fillText(text, 4, 11);
  return c;
}

function buildSquiggleRaster(seed: number, fg: string): HTMLCanvasElement {
  const rand = mulberry32(seed);
  const width = 60 + rand() * 90;
  const c = document.createElement("canvas");
  c.width = Math.ceil(width);
  c.height = 18;
  const ctx = c.getContext("2d")!;
  ctx.strokeStyle = fg;
  ctx.lineWidth = 1.3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  let x = 2;
  let y = 9 + (rand() - 0.5) * 4;
  ctx.moveTo(x, y);
  while (x < width - 4) {
    const segLen = 6 + rand() * 8;
    x += segLen;
    y = 9 + (rand() - 0.5) * 9;
    const cpx = x - segLen / 2;
    const cpy = y + (rand() - 0.5) * 10;
    ctx.quadraticCurveTo(cpx, cpy, x, y);
  }
  ctx.stroke();
  return c;
}

interface Ghost {
  id: number;
  persistent: boolean;
  ownAgeAtCreateSec: number;
  createdAtMs: number;
  baseAlpha: number;
  raster: HTMLCanvasElement;
  // enough to rebuild `raster` against a freshly-read ink token after a
  // theme flip, since the raster bakes fg in as pixels rather than re-tinting.
  rasterText: string | null; // set for a real submission's raster, else null (squiggle)
  rasterSeed: number;
  queueIndex: number | null;
  underline: boolean;
  jitterX: number;
  jitterY: number;
  fibreSeed: number;
}

export interface RockerBlotProps {
  /** Label text for the email field. Default "Email address". */
  label?: string;
  /** Submit button copy. Default "Join the list". */
  buttonLabel?: string;
  /** Announced + shown copy on a successful submit. Placeholder only. */
  confirmationMessage?: string;
  /** Inline validation copy on an invalid email. Placeholder only. */
  errorMessage?: string;
  /** Called once with the submitted email when the entry validates. */
  onSubmit?: (email: string) => void;
  /**
   * When provided, a "log a referral" affordance appears after submission.
   * Each call lays a second, drier blot (uptake floor) using the same
   * uptake law at a later age — the referral state, not a new mechanic.
   */
  onReferral?: (count: number) => void;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function RockerBlot({
  label = "Email address",
  buttonLabel = "Join the list",
  confirmationMessage = "Placeholder confirmation message.",
  errorMessage = "Placeholder validation message.",
  onSubmit,
  onReferral,
  className = "",
}: RockerBlotProps) {
  const autoId = useId().replace(/:/g, "");
  const inputId = `rocker-blot-email-${autoId}`;
  const errorId = `rocker-blot-error-${autoId}`;

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [referralCount, setReferralCount] = useState(0);

  const lastKeystrokeRef = useRef(performance.now());
  const queueCounterRef = useRef(0);
  const measurerRef = useRef<CanvasRenderingContext2D | null>(null);

  // Imperative engine handle populated by the mount effect; queueSubmit /
  // queueReferral / setEntryWidth bridge React events into the rAF-driven
  // ink model without putting per-frame state into React.
  const engineRef = useRef<{
    queueSubmit: (text: string, ageSeconds: number) => number;
    queueReferral: () => void;
    setEntryWidth: (px: number) => void;
  } | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let disposed = false;
    let tokens: Tokens | null = null;
    let dpr = 1;
    let w = 0;
    let h = 0;
    let sized = false;
    let visible = true;
    let raf = 0;
    let tokenWaitRaf = 0;
    let staticFrame = false;
    let mountedAtMs = performance.now();

    let ghosts: Ghost[] = [];
    let nextGhostId = 0;
    let nextAmbientSeed = 30000;
    let nextAmbientDueMs = 0;

    let sweep: {
      startMs: number;
      uptake: number;
      strokeWidthPx: number;
    } | null = null;

    let entryStrokeWidthPx = 0; // measured width of the value currently in the field
    let liftedDensity: number | null = null; // (1 - uptake) once a real sweep has passed; null = not yet submitted

    let sheetSlide: { startMs: number } | null = null;
    let staticNowMs = 0; // frozen clock the reduced-motion frame reads instead of performance.now()

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
      sized = true;
    };

    const minDim = () => Math.min(w, h);
    const sweepTravel = () => Math.min(0.62 * w, 2.4 * minDim());
    const ghostPitch = () => Math.max(GHOST_PITCH_FLOOR, GHOST_PITCH_FACTOR * minDim());
    // The queue lattice (durable/referral ghosts) is a separate stack from
    // the ambient scatter — a wider pitch and its own column, so "your
    // position in the queue" reads as a distinct list of slots rather than
    // one more mark lost in the palimpsest.
    const queuePitch = () => Math.max(QUEUE_PITCH_FLOOR, QUEUE_PITCH_FACTOR * minDim());

    // The sheet is a sheet: inset from the canvas on all four sides with its
    // own rounded edge, so it reads as a piece of blotting paper lying under
    // the form rather than as a full-bleed grey fill (which read as a broken
    // image).
    const layout = () => {
      const entryY = 16;
      const sheetTop = 30;
      const sheetX = 12;
      const sheetW = Math.max(40, w - 24);
      const sheetH = Math.max(40, h - sheetTop - 12);
      const rockerParkX = sheetX + sheetW - 34;
      return { entryY, sheetTop, sheetX, sheetW, sheetH, rockerParkX };
    };

    const seedGhosts = () => {
      ghosts = [];
      nextGhostId = 0;
      nextAmbientDueMs = mountedAtMs + AMBIENT_ADD_INTERVAL_S * 1000;
      if (!tokens) return;
      SEED_OWN_AGES_S.forEach((age, i) => {
        const rand = mulberry32(9000 + i * 17);
        const uptake = uptakeFor(SEED_STROKE_AGES_S[i] ?? 1);
        ghosts.push({
          id: nextGhostId++,
          persistent: false,
          ownAgeAtCreateSec: age,
          createdAtMs: mountedAtMs,
          baseAlpha: uptake * DEPOSIT_ALPHA_FACTOR,
          raster: buildSquiggleRaster(4200 + i * 31, tokens!.ink),
          rasterText: null,
          rasterSeed: 4200 + i * 31,
          queueIndex: null,
          underline: false,
          jitterX: (rand() - 0.5) * GHOST_JITTER_PX * 2,
          jitterY: (rand() - 0.5) * GHOST_JITTER_PX * 2,
          fibreSeed: 5100 + i * 53,
        });
      });
    };

    // Unforced, unconditional: a fresh ambient mark lands on a fixed cadence
    // whether or not anyone has ever touched the form, which is what keeps
    // the sheet mid-process past the point every seeded ghost's own
    // feathering has capped out (see AMBIENT_ADD_INTERVAL_S above).
    const addAmbientGhost = (nowMs: number) => {
      if (!tokens) return;
      const seed = nextAmbientSeed++;
      const rand = mulberry32(seed);
      ghosts.push({
        id: nextGhostId++,
        persistent: false,
        ownAgeAtCreateSec: 0,
        createdAtMs: nowMs,
        baseAlpha: uptakeFor(0) * DEPOSIT_ALPHA_FACTOR,
        raster: buildSquiggleRaster(seed, tokens.ink),
        rasterText: null,
        rasterSeed: seed,
        queueIndex: null,
        underline: false,
        jitterX: (rand() - 0.5) * GHOST_JITTER_PX * 2,
        jitterY: (rand() - 0.5) * GHOST_JITTER_PX * 2,
        fibreSeed: 40000 + seed,
      });
    };

    const inkCoverage = (nowMs: number) => {
      const area = Math.max(1, w * (h - 34));
      let sum = 0;
      for (const g of ghosts) {
        const alpha = decayedAlpha(g.baseAlpha, (nowMs - g.createdAtMs) / 1000 + g.ownAgeAtCreateSec);
        sum += g.raster.width * g.raster.height * Math.max(0, alpha);
      }
      return sum / area;
    };

    const maybeTriggerSheetChange = (nowMs: number) => {
      if (sheetSlide || staticFrame) return;
      if (inkCoverage(nowMs) > SHEET_CHANGE_COVERAGE) {
        sheetSlide = { startMs: nowMs };
      }
    };

    const recycleAmbient = () => {
      // Bounded memory: only the ambient layer resets. Persistent ghosts
      // (the visitor's own mark and any referrals) are never touched — the
      // durable session artefact survives a sheet change.
      const persistentGhosts = ghosts.filter((g) => g.persistent);
      ghosts = persistentGhosts;
      SEED_OWN_AGES_S.slice(0, 3).forEach((age: number, i: number) => {
        const rand = mulberry32(7700 + i * 19);
        const uptake = uptakeFor(SEED_STROKE_AGES_S[i] ?? 1);
        ghosts.push({
          id: nextGhostId++,
          persistent: false,
          ownAgeAtCreateSec: age,
          createdAtMs: performance.now(),
          baseAlpha: uptake * DEPOSIT_ALPHA_FACTOR,
          raster: buildSquiggleRaster(6600 + i * 41, tokens!.ink),
          rasterText: null,
          rasterSeed: 6600 + i * 41,
          queueIndex: null,
          underline: false,
          jitterX: (rand() - 0.5) * GHOST_JITTER_PX * 2,
          jitterY: (rand() - 0.5) * GHOST_JITTER_PX * 2,
          fibreSeed: 8300 + i * 61,
        });
      });
    };

    // Cosine, not sine: spec names the idle rocker at +3deg at t=0 (mount),
    // which is the amplitude peak, not the zero-crossing.
    const rockerIdleAngle = (nowMs: number) => {
      const t = ((nowMs - mountedAtMs) / 1000) % ROCKER_IDLE_PERIOD_S;
      return Math.cos((t / ROCKER_IDLE_PERIOD_S) * Math.PI * 2) * ROCKER_IDLE_AMP_DEG;
    };

    const drawFibres = (g: Ghost, cx: number, cy: number, alpha: number, ownAge: number) => {
      const len = featherFor(ownAge);
      if (len <= 0.05) return;
      const rand = mulberry32(g.fibreSeed);
      const rw = g.raster.width;
      const rh = g.raster.height;
      ctx.save();
      // no ctx.filter here: 40 filtered hairline strokes per ghost per frame
      // forces an offscreen blur pass per stroke, and at low alpha on 0.5px
      // lines the blur is imperceptible anyway.
      ctx.strokeStyle = tokens!.ink;
      ctx.lineWidth = 0.5;
      for (let i = 0; i < FIBRE_COUNT; i++) {
        const edge = rand();
        const along = rand();
        const px = edge < 0.5 ? cx - rw / 2 + along * rw : cx - rw / 2 + (edge < 0.75 ? 0 : rw);
        const py = edge < 0.5 ? cy - rh / 2 + (edge < 0.25 ? -rh * 0.02 : rh * 1.02) : cy - rh / 2 + along * rh;
        const angle = rand() * Math.PI * 2;
        ctx.globalAlpha = alpha * (0.25 + rand() * 0.3);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.cos(angle) * len, py + Math.sin(angle) * len);
        ctx.stroke();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    };

    const drawGhost = (g: Ghost, nowMs: number) => {
      const ownAge = (nowMs - g.createdAtMs) / 1000 + g.ownAgeAtCreateSec;
      const blur = blurFor(ownAge);
      const alpha = Math.max(0, decayedAlpha(g.baseAlpha, ownAge));
      if (alpha <= 0.002) return;
      const { sheetTop } = layout();
      let cx: number;
      let cy: number;
      const { sheetX, sheetW, sheetH } = layout();
      if (g.queueIndex != null) {
        // queue lattice: its own right-hand column, its own (wider) pitch —
        // deliberately separated from the ambient scatter's column so a
        // visitor's own slots read as a stack, not more residue.
        const pitch = queuePitch();
        cx = sheetX + sheetW * 0.72 + g.jitterX;
        cy = sheetTop + 18 + g.queueIndex * pitch + g.jitterY;
      } else {
        // ambient scatter: its own column, spread down the whole sheet so the
        // residue reads as an accumulation rather than a huddle in one corner.
        const pitch = Math.max(ghostPitch(), (sheetH - 30) / 7);
        cx = sheetX + sheetW * (0.42 + 0.1 * ((g.id % 3) - 1)) + g.jitterX;
        cy = sheetTop + 18 + (g.id % 8) * pitch + g.jitterY;
      }

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.filter = `blur(${blur.toFixed(2)}px)`;
      ctx.translate(cx, cy);
      ctx.scale(-1, 1); // mirrored impression
      ctx.drawImage(g.raster, -g.raster.width / 2, -g.raster.height / 2);
      ctx.restore();
      ctx.globalAlpha = 1;
      ctx.filter = "none";

      if (g.underline) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, alpha + 0.1);
        ctx.strokeStyle = tokens!.ink;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - g.raster.width / 2, cy + g.raster.height / 2 + 2);
        ctx.lineTo(cx + g.raster.width / 2, cy + g.raster.height / 2 + 2);
        ctx.stroke();
        ctx.restore();
        ctx.globalAlpha = 1;
      }

      drawFibres(g, cx, cy, alpha, ownAge);
    };

    // Drawn OUTSIDE the sheet's translate — it sits under the input, not on
    // the sheet, so it must not slide with a sheet-change. Takes nowMs
    // explicitly (never reads the clock itself) so the reduced-motion frame
    // can drive it with a frozen time instead of the real one.
    const drawEntryStroke = (nowMs: number) => {
      const { entryY } = layout();
      if (entryStrokeWidthPx <= 0) return;
      const x0 = 4;
      ctx.save();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = tokens!.ink;
      if (sweep) {
        const frac = Math.min(1, (nowMs - sweep.startMs) / SWEEP_MS);
        const boundaryX = x0 + entryStrokeWidthPx * frac;
        ctx.globalAlpha = 1 - sweep.uptake;
        ctx.beginPath();
        ctx.moveTo(x0, entryY);
        ctx.lineTo(boundaryX, entryY);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.moveTo(boundaryX, entryY);
        ctx.lineTo(x0 + entryStrokeWidthPx, entryY);
        ctx.stroke();
      } else {
        // liftedDensity == null: nothing has been blotted yet, so the entry
        // reads as fresh wet ink. Once set (post-submit) it stays at
        // (1 - uptake) permanently — the standing evidence ink moved to the
        // sheet, never fully invisible.
        ctx.globalAlpha = liftedDensity != null ? liftedDensity : 0.9;
        ctx.beginPath();
        ctx.moveTo(x0, entryY);
        ctx.lineTo(x0 + entryStrokeWidthPx, entryY);
        ctx.stroke();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    };

    /** The rocker itself: a curved blotting-paper shoe with a handle above
     * it. Two bare arcs read as a stray scratch on the still; a body with a
     * grip reads as the tool that made the marks. */
    const drawRockerBody = () => {
      const halfW = ARC_WIDTH_PX / 2;
      ctx.beginPath();
      ctx.moveTo(-halfW, 0);
      ctx.quadraticCurveTo(0, -11, halfW, 0);
      ctx.lineTo(halfW - 3, -13);
      ctx.lineTo(-halfW + 3, -13);
      ctx.closePath();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = tokens!.paper;
      ctx.fill();
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = tokens!.muted;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // the contact arc: the edge that actually touches the sheet
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-halfW, 0);
      ctx.quadraticCurveTo(0, -11, halfW, 0);
      ctx.stroke();

      // handle
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(-9, -22, 18, 9, 3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-4, -13);
      ctx.lineTo(-4, -22);
      ctx.moveTo(4, -13);
      ctx.lineTo(4, -22);
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    const drawRocker = (nowMs: number) => {
      const { sheetTop, rockerParkX } = layout();
      const travel = sweepTravel();
      let x: number;
      let angle: number;
      let sweeping = false;
      if (sweep) {
        const frac = Math.min(1, (nowMs - sweep.startMs) / SWEEP_MS);
        x = 16 + travel * frac;
        angle = -ROCKER_ROT_DEG + Math.sin(frac * Math.PI) * (ROCKER_ROT_DEG * 2);
        sweeping = true;
        if (frac >= 1) sweep = null;
      } else {
        x = rockerParkX;
        angle = rockerIdleAngle(nowMs);
      }
      const y = sheetTop + 32; // parked ON the sheet, handle and all
      ctx.save();
      ctx.translate(x + (sweeping ? CONTACT_LEAD_PX : 0), y + (sweeping ? 0 : ROCKER_IDLE_TRANSLATE_PX * Math.sin((nowMs / 1000 / ROCKER_IDLE_PERIOD_S) * Math.PI * 2)));
      ctx.rotate((angle * Math.PI) / 180);
      drawRockerBody();
      ctx.restore();
      ctx.globalAlpha = 1;
    };

    /** The sheet's own outline — also the clip for everything blotted onto
     * it, so no mark can run off the paper. */
    const sheetPath = () => {
      const { sheetTop, sheetX, sheetW, sheetH } = layout();
      ctx.beginPath();
      ctx.roundRect(sheetX + 0.5, sheetTop + 0.5, sheetW - 1, sheetH - 1, 5);
    };

    const drawSheetPanel = () => {
      const { sheetTop, sheetX, sheetW, sheetH } = layout();
      ctx.save();
      // register paper: --background in light theme, an --ns-muted panel
      // (lighter than the page) in dark theme — see readTokens().
      sheetPath();
      ctx.fillStyle = tokens!.paper;
      ctx.fill();

      // Paper, not a filled rectangle: a deterministic fibre speckle plus the
      // shading the rocker bar casts along the top edge. Both are drawn from
      // the same seed every frame, so the reduced-motion still is stable.
      ctx.save();
      sheetPath();
      ctx.clip();
      const grain = mulberry32(77);
      ctx.fillStyle = tokens!.ink;
      for (let i = 0; i < 220; i++) {
        ctx.globalAlpha = 0.015 + grain() * 0.03;
        const gx = sheetX + grain() * sheetW;
        const gy = sheetTop + grain() * sheetH;
        ctx.fillRect(gx, gy, 1, 1);
      }
      ctx.globalAlpha = 1;
      const shade = ctx.createLinearGradient(0, sheetTop, 0, sheetTop + 14);
      shade.addColorStop(0, tokens!.ink);
      shade.addColorStop(1, tokens!.paper);
      ctx.globalAlpha = 0.09;
      ctx.fillStyle = shade;
      ctx.fillRect(sheetX, sheetTop, sheetW, 14);
      ctx.restore();

      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = tokens!.muted;
      ctx.lineWidth = 1;
      sheetPath();
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1;
    };

    const draw = (nowMs: number) => {
      if (!tokens || !sized) return;
      ctx.clearRect(0, 0, w, h);

      let sheetOffset = 0;
      if (sheetSlide) {
        const frac = Math.min(1, (nowMs - sheetSlide.startMs) / SHEET_SLIDE_MS);
        sheetOffset = -w * frac;
        if (frac >= 1) {
          sheetSlide = null;
          recycleAmbient();
          sheetOffset = 0;
        }
      }

      ctx.save();
      ctx.translate(sheetOffset, 0);
      drawSheetPanel();
      ctx.save();
      sheetPath();
      ctx.clip();
      for (const g of ghosts) drawGhost(g, nowMs);
      ctx.restore();
      ctx.restore();

      // outside the sheet's translate: the ruled stroke sits under the
      // input, not on the sheet, so it must not slide with a sheet-change.
      drawEntryStroke(nowMs);
      drawRocker(nowMs);
    };

    // -- reduced-motion freeze: a demonstration blot mid-sweep, deliberately
    // not t0, so the before/after ink boundary and the accumulated ghost
    // stack are both legible in one still frame. Every ghost's age and the
    // sweep fraction are computed against a single FROZEN clock (staticNowMs)
    // rather than performance.now(), so the frame is byte-stable across
    // mounts, resizes and theme flips, not just for the first ~190ms. -------
    const buildStaticFrame = () => {
      if (!tokens) return;
      staticNowMs = performance.now();
      ghosts = [];
      nextGhostId = 0;
      STATIC_OLDER_BLURS.forEach((targetBlur, i) => {
        // solve the age that produces the named blur under blurFor(), so the
        // frozen frame carries the exact numbers the spec names.
        const ratio = (BLUR_ASYMPTOTE - targetBlur) / (BLUR_ASYMPTOTE - CAPILLARY_BLUR_START);
        const age = -Math.log(Math.max(0.0001, ratio)) * BLUR_TAU_S;
        ghosts.push({
          id: nextGhostId++,
          persistent: false,
          ownAgeAtCreateSec: age,
          createdAtMs: staticNowMs, // ownAge at staticNowMs collapses to `age` exactly
          baseAlpha: uptakeFor(age) * DEPOSIT_ALPHA_FACTOR,
          raster: buildSquiggleRaster(4200 + i * 31, tokens!.ink),
          rasterText: null,
          rasterSeed: 4200 + i * 31,
          queueIndex: null,
          underline: false,
          jitterX: 0,
          jitterY: 0,
          fibreSeed: 5100 + i * 53,
        });
      });
      // the fresh mirrored ghost landing under the rocker, at the named
      // freeze-frame alpha, on top of the five older ones.
      ghosts.push({
        id: nextGhostId++,
        persistent: false,
        ownAgeAtCreateSec: 0,
        createdAtMs: staticNowMs,
        baseAlpha: STATIC_GHOST_ALPHA,
        raster: buildTextRaster("name@example.com", tokens.ink),
        rasterText: "name@example.com",
        rasterSeed: 0,
        queueIndex: null,
        underline: false,
        jitterX: 0,
        jitterY: 0,
        fibreSeed: 9100,
      });
      entryStrokeWidthPx = 96;
      // pin the sweep fraction exactly rather than letting the clock drive it
      sweep = {
        startMs: staticNowMs - SWEEP_MS * STATIC_SWEEP_FRAC,
        uptake: uptakeFor(0.6),
        strokeWidthPx: entryStrokeWidthPx,
      };
    };

    const drawStatic = () => {
      ctx.clearRect(0, 0, w, h);
      drawSheetPanel();
      ctx.save();
      sheetPath();
      ctx.clip();
      for (const g of ghosts) drawGhost(g, staticNowMs);
      ctx.restore();
      drawEntryStroke(staticNowMs);
      const { sheetTop } = layout();
      const travel = sweepTravel();
      const x = 16 + travel * STATIC_SWEEP_FRAC;
      ctx.save();
      ctx.translate(x + CONTACT_LEAD_PX, sheetTop - 6);
      ctx.rotate((STATIC_ROCKER_DEG * Math.PI) / 180);
      ctx.strokeStyle = tokens!.muted;
      drawRockerBody();
      ctx.restore();
      ctx.globalAlpha = 1;
    };

    const loop = (nowMs: number) => {
      if (disposed) return;
      if (!visible) {
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(loop);
      if (!sized || !tokens) return;
      if (nowMs >= nextAmbientDueMs) {
        addAmbientGhost(nowMs);
        nextAmbientDueMs = nowMs + AMBIENT_ADD_INTERVAL_S * 1000;
      }
      maybeTriggerSheetChange(nowMs);
      draw(nowMs);
    };

    let started = false;
    const kick = () => {
      if (started || disposed || !tokens || !sized) return;
      started = true;
      if (reduced) {
        staticFrame = true;
        buildStaticFrame();
        drawStatic();
        return; // one composed still frame; no rAF loop, no observers driving motion
      }
      raf = requestAnimationFrame(loop);
    };

    const boot = () => {
      if (disposed) return;
      tokens = readTokens();
      if (!tokens) {
        tokenWaitRaf = requestAnimationFrame(boot);
        return;
      }
      resize();
      seedGhosts();
      kick();
    };

    const ro = new ResizeObserver(() => {
      if (!tokens) return;
      resize();
      if (staticFrame) drawStatic();
      kick();
    });
    ro.observe(wrap);

    const mo = new MutationObserver(() => {
      const next = readTokens();
      if (!next) return;
      tokens = next;
      // rasters bake fg in as pixels rather than re-tinting live, so a theme
      // flip has to rebuild them against the freshly-read ink colour.
      for (const g of ghosts) {
        g.raster = g.rasterText != null ? buildTextRaster(g.rasterText, tokens.ink) : buildSquiggleRaster(g.rasterSeed, tokens.ink);
      }
      if (staticFrame) {
        buildStaticFrame();
        drawStatic();
      } else if (sized) {
        draw(performance.now());
      }
      kick();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const io = new IntersectionObserver((entries) => {
      const wasVisible = visible;
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && !wasVisible && !reduced && tokens && !raf) {
        tokens = readTokens() ?? tokens;
        resize();
        raf = requestAnimationFrame(loop);
      }
    });
    io.observe(wrap);

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      } else if (visible && !reduced && tokens && !raf) {
        tokens = readTokens() ?? tokens;
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    boot();

    engineRef.current = {
      setEntryWidth: (px: number) => {
        entryStrokeWidthPx = Math.max(0, Math.min(px, w - 8));
        if (staticFrame || (!raf && sized)) draw(performance.now());
      },
      queueSubmit: (text: string, ageSeconds: number) => {
        if (!tokens) return 0;
        const uptake = uptakeFor(ageSeconds);
        entryStrokeWidthPx = entryStrokeWidthPx || 96;
        sweep = { startMs: performance.now(), uptake, strokeWidthPx: entryStrokeWidthPx };
        const queueIndex = queueCounterRef.current++;
        const baseAlpha = Math.min(DURABLE_ALPHA_CAP, uptake * 0.7 * DURABLE_ALPHA_MULT);
        ghosts.push({
          id: nextGhostId++,
          persistent: true,
          ownAgeAtCreateSec: 0,
          createdAtMs: performance.now(),
          baseAlpha,
          raster: buildTextRaster(text, tokens.ink),
          rasterText: text,
          rasterSeed: 0,
          queueIndex,
          underline: true,
          jitterX: 0,
          jitterY: (queueIndex % 3) * 1.5,
          fibreSeed: 12000 + queueIndex * 7,
        });
        // permanent standing evidence that ink moved to the sheet — never
        // fully invisible, always exactly (1 - uptake).
        liftedDensity = 1 - uptake;
        if (staticFrame) draw(performance.now());
        else if (!raf && sized) raf = requestAnimationFrame(loop);
        return queueIndex + 1; // 1-based position for display
      },
      queueReferral: () => {
        if (!tokens) return;
        const age = 5 + queueCounterRef.current * 2; // later, drier — same law, older stroke
        const uptake = uptakeFor(age);
        const queueIndex = queueCounterRef.current++;
        ghosts.push({
          id: nextGhostId++,
          persistent: true,
          ownAgeAtCreateSec: 0,
          createdAtMs: performance.now(),
          baseAlpha: Math.max(UPTAKE_FLOOR * 0.7, uptake * 0.7),
          raster: buildSquiggleRaster(20000 + queueIndex * 13, tokens.ink),
          rasterText: null,
          rasterSeed: 20000 + queueIndex * 13,
          queueIndex,
          underline: false,
          jitterX: 0,
          jitterY: 0,
          fibreSeed: 15000 + queueIndex * 11,
        });
        if (staticFrame) draw(performance.now());
        else if (!raf && sized) raf = requestAnimationFrame(loop);
      },
    };

    return () => {
      disposed = true;
      engineRef.current = null;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(tokenWaitRaf);
      ro.disconnect();
      mo.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validate = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setValue(next);
    lastKeystrokeRef.current = performance.now();
    if (invalid) setInvalid(false);
    // ruled entry stroke tracks the CURRENT string's measured width, using
    // the input's own computed font so it lines up under the real text.
    if (inputRef.current) {
      if (!measurerRef.current) {
        measurerRef.current = document.createElement("canvas").getContext("2d");
      }
      const measurer = measurerRef.current;
      if (measurer) {
        measurer.font = getComputedStyle(inputRef.current).font;
        engineRef.current?.setEntryWidth(next ? measurer.measureText(next).width : 0);
      }
    }
  }, [invalid]);

  const handleSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitted) return;
    const email = value.trim();
    if (!validate(email)) {
      // the shared aria-live region is reserved for the success payoff — the
      // error is announced by its own role="alert" paragraph instead.
      setInvalid(true);
      return;
    }
    const ageSeconds = Math.max(0, (performance.now() - lastKeystrokeRef.current) / 1000);
    const position = engineRef.current?.queueSubmit(email, ageSeconds) ?? 1;
    setSubmitted(true);
    setInvalid(false);
    setQueuePosition(position);
    setAnnounce(`${confirmationMessage} Position ${position} in the queue.`);
    onSubmit?.(email);
  }, [confirmationMessage, errorMessage, onSubmit, submitted, value]);

  const handleReferral = useCallback(() => {
    engineRef.current?.queueReferral();
    setReferralCount((c) => {
      const next = c + 1;
      onReferral?.(next);
      return next;
    });
  }, [onReferral]);

  return (
    <div
      ref={wrapRef}
      className={`relative w-full max-w-md overflow-hidden rounded-[12px] border border-border bg-background ${className}`}
    >
      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announce}
      </span>

      <form onSubmit={handleSubmit} noValidate className="px-5 pt-5">
        <label htmlFor={inputId} className="mb-2 block font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
          {label}
        </label>
        <div className="flex items-stretch gap-2">
          <input
            ref={inputRef}
            id={inputId}
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            readOnly={submitted}
            value={value}
            onChange={handleChange}
            aria-invalid={invalid}
            aria-describedby={errorId}
            placeholder="you@example.com"
            className="min-w-0 flex-1 rounded-[6px] border border-border bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-ns-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent read-only:cursor-default"
          />
          <button
            type="submit"
            disabled={submitted}
            aria-label={submitted ? "Submitted — placeholder submitted state" : buttonLabel}
            className="shrink-0 rounded-[6px] bg-ns-accent px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-ns-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-ns-muted disabled:opacity-60"
          >
            {submitted ? "Placeholder submitted state" : buttonLabel}
          </button>
        </div>
        {/* always mounted — a freshly-inserted role="alert" node is
            unreliably announced by some screen readers, so the element
            exists from the start and only its content toggles. */}
        <p id={errorId} role="alert" className="mt-2 min-h-[1em] font-mono text-xs text-foreground">
          {invalid ? errorMessage : ""}
        </p>
        {submitted && queuePosition != null && (
          <p className="mt-2 font-mono text-xs text-ns-muted">
            Position <span className="text-foreground">{queuePosition}</span> in the queue.
          </p>
        )}
      </form>

      <div className="relative mt-3 h-48 w-full">
        <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />
      </div>

      {submitted && onReferral && (
        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
          <p className="font-mono text-xs text-ns-muted">Referrals logged: {referralCount}</p>
          <button
            type="button"
            onClick={handleReferral}
            className="rounded-[6px] border border-border px-3 py-1.5 font-mono text-xs text-foreground hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            Log a placeholder referral
          </button>
        </div>
      )}
    </div>
  );
}

export default RockerBlot;
