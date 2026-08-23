"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// RingGraze — fairy-ring annuli grown from a single consumable, recovering
// substrate field, not from stroked circles with collision masking.
//
// Two lattices at roughly 1/6 viewport resolution (coarsened further under a
// cell budget, see MAX_CELLS): S, a substrate concentration that recovers
// toward 1 on time constant `recovery` (the governing scalar — the whole
// piece's tempo lives on this one clock), and a pool of RINGS, each just an
// array of cell indices that make up its currently-active front shell.
//
// Every simulation tick, in order:
//
//   1. GROW — a shared growth budget accumulates FRONT_SPEED cells/s. Once
//      it banks a whole cell, every living ring's front shell dilates one
//      cell outward (8-connected): each current front cell tests its own
//      neighbours and claims any with S > ADVANCE_THRESHOLD (0.4), dropping
//      that neighbour's S to EATEN_LEVEL (0.05) the instant it's claimed.
//      The OLD front cells are not carried forward — they become the
//      ring's dead interior — so only the newest shell is ever drawn, which
//      is what makes the result a hollow annulus rather than a filled disc:
//      nothing here masks a filled circle, the interior really is just
//      substrate at 0.05 that nothing is currently consuming. A front cell
//      that claims zero neighbours (boundary, or every neighbour already
//      under 0.4 from its own past growth or another ring's) simply isn't
//      carried into the next shell — that's a ring dying locally, not a
//      collision test against another ring's geometry: it never compares
//      ring A to ring B, it only ever reads the one shared scalar field
//      both rings happen to have grazed. Two fronts advancing at each other
//      strand a seam of already-eaten ground between them that neither can
//      cross, which is the scalloped interlocking-arc boundary real fairy
//      rings show from the air. Because growth only ever dilates OUTWARD
//      from the current shell into cells the S check just verified are
//      still above threshold, and a ring's own past cells sit at 0.05 far
//      below that threshold, a ring can't claim a cell it has itself
//      already eaten — it structurally cannot re-cross its own past, with
//      or without recovery ever catching up (in practice a ring finishes
//      crossing the field, or dies at a boundary/seam, long before its own
//      early interior would recover back over threshold at any sane
//      `recovery`).
//   2. RECOVER — every cell's S relaxes toward 1 by (1-S) * dt/recovery.
//      `recovery` <= 0 turns this step off entirely: nothing ever climbs
//      back over the reseed threshold, so once every live ring has died out
//      the piece is provably, permanently still — no residual rAF work is
//      even doing anything, which is the falsifiable half of the design
//      (set recovery to 0 and the whole field stops advancing within about
//      two ring lifetimes, not asymptotically).
//   3. SEED — a second, far slower budget accumulates at 0.8 spores/min.
//      Once it banks one, a handful of random cells are sampled and the
//      first with S above RECOVER_THRESHOLD (substantially healed, not
//      merely un-eaten) germinates a brand new one-cell ring, which starts
//      the whole GROW cycle over from a point. Sampling only tests S, never
//      "is this ring-owned", because eaten ground already always reads
//      below threshold — the substrate field is the only bookkeeping this
//      component needs. No eligible cell this attempt just leaves the
//      budget banked for the next tick, so a starved field (or recovery=0)
//      spawns nothing rather than bursting once ground finally frees up.
//      A single ring crosses this whole lattice in ~8-10s at FRONT_SPEED —
//      faster than the 0.8/min clock could ever place a second one nearby
//      — so mount also scatters several nuclei at once via the same claim
//      rule (seedInitialRings), which collide with EACH OTHER short of any
//      edge and hand back the scalloped seam geometry immediately, while
//      this one-at-a-time path keeps reseeding for as long as the piece runs.
//
// RENDER: S is painted at grid resolution — a cell mixes --ns-muted (freshly
// eaten) toward --background (fully recovered) by its own value, so healed
// ground fades back toward invisible the way real grass regrowing over a
// scar would. Only cells still meaningfully depleted (well under half
// recovered) layer an ordered 4x4 Bayer dither toward --border on top, so a
// fresh scar reads as broken-up texture rather than a flat rectangle, while
// everything past that mid-recovery point is a smooth, dither-free ramp —
// the field isn't dot-patterned everywhere it's merely still healing. Every
// cell currently part of a live ring's front shell is then painted solid
// --foreground on top, a thin one-cell arc. The grid is upsampled onto the
// visible canvas (sized at devicePixelRatio, capped 2x) with a blur scaled
// to the actual device-pixel cell size — a fixed small blur only softens the
// dither at the source grid's own tiny scale and still reads as a crisp dot
// grid once upsampled — so it reads as soft aerial grain rather than visible
// grid cells. Tokens are read via getComputedStyle at mount and re-read on a
// documentElement class mutation (theme toggle).
//
// No pointer/keyboard interaction anywhere — this is a decorative backdrop
// meant for 404s, waitlist pages and long article footers: the canvas is
// aria-hidden and the whole point is a slow ambient process tuned to be
// glanced at across minutes, not watched. prefers-reduced-motion runs the
// tick function enough times to cover 90 simulated seconds synchronously at
// mount and paints one static aerial frame instead of ever scheduling a
// rAF loop.
// ---------------------------------------------------------------------------

const CELL_BASE = 6; // 1/6 viewport resolution, before the cell budget below
const MAX_CELLS = 9000; // perf cap: cell size grows past CELL_BASE on big panes
const MAX_RINGS = 40;

const ADVANCE_THRESHOLD = 0.4; // a front can only claim ground above this
const EATEN_LEVEL = 0.05; // what a claimed cell drops to — the hollow interior
const RECOVER_THRESHOLD = 0.92; // how healed ground must be before it can reseed

const TICK_HZ = 15; // deliberately low — this piece is tuned for minutes, not motion
const TICK_STEP = 1 / TICK_HZ;
const MAX_TICKS_PER_FRAME = 6; // catch-up clamp after a stalled tab
const MAX_GROWTH_STEPS_PER_TICK = 8;

// cells/s. The number that decides whether this reads as a RING at all: the
// grazed interior heals on a `recovery`-second time constant, so the
// un-recovered band trailing the margin is recovery x FRONT_SPEED cells wide,
// and (for a fixed warmup duration in seconds) the warmed ring radius is
// FRONT_SPEED x warmup_seconds — so band/radius = recovery/warmup_seconds,
// independent of FRONT_SPEED alone. Raising FRONT_SPEED without touching
// `recovery` or the warmup duration scales BOTH the radius and the band by
// the same factor and preserves that ratio exactly (verified: the original
// 6 cells/s failure — a 270-cell band, wider than the lattice, every ring a
// solid grazed DISC — came from `recovery` being large relative to warmup
// time, not from FRONT_SPEED in isolation). What follows is a uniform 4x
// TIME COMPRESSION of the whole piece — FRONT_SPEED x4, `recovery` /4,
// warmup /4 — which cancels out of every spatial ratio and leaves the
// resting frame's geometry (ring radius, band width, ring count) identical
// to before, it just all happens 4x faster: at 0.18 cells/s the growth
// budget took ~5.5s to bank one front-dilation step, reading as still within
// the few seconds a catalog card is actually judged on; at 0.72 it banks a
// step roughly every 1.4s, with MAX_GROWTH_STEPS_PER_TICK still letting
// several bank in one frame after a stalled tab so a resumed tab catches up
// instead of visibly stair-stepping.
const FRONT_SPEED = 0.72;
const SPORE_RATE_PER_SEC = (1.6 / 60) * 4; // scaled with the same 4x time compression as FRONT_SPEED/recovery below
const SPAWN_BUDGET_CAP = 2; // don't let a long-starved field burst-spawn once ground frees up
const SPAWN_ATTEMPTS = 40; // random cells sampled per spawn opportunity

// normal-motion mount warmup, ~25s of sim time at the 4x-compressed clock —
// same ~18-cell ring radius trailing an ~8-cell grazed band as the original
// ~100s warmup at 0.18 cells/s (radius and band both scale with FRONT_SPEED,
// warmup time scales inversely, so the resting geometry is unchanged). An
// 18-cell radius is small enough that several rings fit in one pane; ~40
// cells gave one scalloped edge crossing the whole viewport with no ring
// readable anywhere.
const PREWARM_TICKS = 375;
const REDUCED_SECONDS = 25; // reduced-motion: prewarm to this much simulated time, arcs still live — same 4x compression, same resting geometry as before
const REDUCED_TICKS = REDUCED_SECONDS * TICK_HZ;
// After the prewarm, reduced motion keeps living in slow discrete pulses
// rather than freezing forever — see reducedPulse() below.
const REDUCED_LIVE_INTERVAL_MS = 2400;
const REDUCED_LIVE_TICKS = 6;

const NX = [-1, 0, 1, -1, 1, -1, 0, 1];
const NY = [-1, -1, -1, 0, 0, 1, 1, 1];
// von-Neumann half of the alternating dilation kernel — see growOnce()
const N4X = [0, -1, 1, 0];
const N4Y = [-1, 0, 0, 1];

// row-major, values 0-15 out of a possible 16 — standard ordered dither
const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

type RGB = [number, number, number];

function parseHex(raw: string): RGB | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw.trim());
  if (!m) return null;
  let h = m[1]!;
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixRGB(a: RGB, b: RGB, t: number): RGB {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  return [
    Math.round(a[0] + (b[0] - a[0]) * k),
    Math.round(a[1] + (b[1] - a[1]) * k),
    Math.round(a[2] + (b[2] - a[2]) * k),
  ];
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// xorshift32 — deterministic across mounts, unlike Math.random, so the
// shipped resting frame doesn't differ screenshot to screenshot
function makeRng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

interface RingSlot {
  alive: boolean;
  front: number[];
}

export interface RingGrazeProps {
  /** Substrate recovery time constant, in seconds — the governing scalar that sets the whole piece's tempo. 0 turns recovery off permanently: every live ring eventually dies at a boundary or a shared seam and the field goes provably still within about two ring lifetimes. @default 11 */
  recovery?: number;
  /** Global simulation speed multiplier. @default 1 */
  speed?: number;
  /** Freezes the field on its current frame without unmounting. */
  paused?: boolean;
  /** Rendered in the DOM over the field — this layer alone is aria-hidden. */
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function RingGraze({
  recovery = 11,
  speed = 1,
  paused = false,
  children,
  className = "",
  style,
}: RingGrazeProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // read live every render, consulted inside the effect via .current — none
  // of these should tear down and reseed the field just because a prop
  // changed
  const recoveryRef = useRef(recovery);
  recoveryRef.current = recovery;
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = mq.matches;

    let cssW = 0;
    let cssH = 0;
    let dpr = 1;
    let cols = 0;
    let rows = 0;
    let cellSize = CELL_BASE;

    // --- lattices -------------------------------------------------------
    let S = new Float32Array(0);
    let rng = makeRng(0x2b3f1e91);
    let ringPool: RingSlot[] = [];
    let growthBudget = 0;
    let spawnBudget = 0;

    const idx = (x: number, y: number) => y * cols + x;

    // A single ring, unobstructed, crosses this whole lattice in well under a
    // minute at FRONT_SPEED (half the smaller grid dimension / 1.5
    // cells-per-second) — faster than the organic spore clock could place a second
    // one nearby. Left to the steady-state spawn path alone, the mount frame
    // (and most of the piece's life) would show either one ring mid-flight
    // or a field that already fully swept and is just waiting to recover,
    // never the scalloped ring-meets-ring seams the brief is about. So mount
    // scatters several nuclei at once — same claim rule, same RECOVER_THRESHOLD
    // gate, nothing special-cased — which collide with EACH OTHER well short
    // of any edge and hands back exactly the interlocking-arc geometry this
    // component exists to show, while the ordinary trySpawn() below keeps
    // reseeding one at a time at the documented rate for as long as it runs.
    const seedInitialRings = () => {
      // few and widely spaced — a ring only reads as a ring while it still has
      // room to expand, and a crowded mount annihilates every front early
      const count = Math.max(4, Math.min(8, Math.round((cols * rows) / 1800)));
      let seeded = 0;
      let guard = 0;
      while (seeded < count && guard < count * 25) {
        guard++;
        const slot = ringPool.findIndex((r) => !r.alive);
        if (slot === -1) break;
        const cell = Math.floor(rng() * S.length);
        if (S[cell]! > RECOVER_THRESHOLD) {
          S[cell] = EATEN_LEVEL;
          ringPool[slot]!.alive = true;
          ringPool[slot]!.front = [cell];
          seeded++;
        }
      }
    };

    const trySpawn = () => {
      let slot = -1;
      for (let r = 0; r < ringPool.length; r++) {
        if (!ringPool[r]!.alive) {
          slot = r;
          break;
        }
      }
      if (slot === -1) return; // pool full — retain budget, retry later
      for (let a = 0; a < SPAWN_ATTEMPTS; a++) {
        const cell = Math.floor(rng() * S.length);
        if (S[cell]! > RECOVER_THRESHOLD) {
          S[cell] = EATEN_LEVEL;
          ringPool[slot]!.alive = true;
          ringPool[slot]!.front = [cell];
          spawnBudget -= 1;
          return;
        }
      }
      // no eligible cell this attempt — budget stays banked
    };

    let growStep = 0;
    const growOnce = () => {
      growStep++;
      for (let r = 0; r < ringPool.length; r++) {
        const ring = ringPool[r]!;
        if (!ring.alive) continue;
        const cur = ring.front;
        const next: number[] = [];
        for (let ci = 0; ci < cur.length; ci++) {
          const i = cur[ci]!;
          const x = i % cols;
          const y = (i / cols) | 0;
          // Alternating von-Neumann (4) / Moore (8) dilation. A pure Moore
          // dilation grows in the Chebyshev metric, so every "ring" is a
          // literal expanding SQUARE — which is what the first screenshots
          // showed. Alternating the two kernels step to step approximates a
          // Euclidean disc (an octagon), at no cost to the claim rule: it
          // only changes WHICH neighbours are offered, never how a claim is
          // decided, so annihilation and no-self-recrossing still fall out
          // of the shared S > ADVANCE_THRESHOLD test alone.
          const kMax = growStep % 2 === 0 ? 8 : 4;
          for (let k = 0; k < kMax; k++) {
            const nx = x + (kMax === 8 ? NX[k]! : N4X[k]!);
            const ny = y + (kMax === 8 ? NY[k]! : N4Y[k]!);
            if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
            const ni = ny * cols + nx;
            // S is mutated immediately on claim, so a later front cell in
            // this same pass (this ring or — impossible, rings never share
            // a front array — a later ring) sees the drop already applied;
            // that's the whole annihilation mechanism, not a special case.
            if (S[ni]! > ADVANCE_THRESHOLD) {
              S[ni] = EATEN_LEVEL;
              next.push(ni);
            }
          }
        }
        ring.front = next;
        if (next.length === 0) ring.alive = false;
      }
    };

    const tick = () => {
      const spd = Math.max(0, speedRef.current);
      growthBudget += FRONT_SPEED * TICK_STEP * spd;
      let guard = 0;
      while (growthBudget >= 1 && guard < MAX_GROWTH_STEPS_PER_TICK) {
        growOnce();
        growthBudget -= 1;
        guard++;
      }

      const rec = recoveryRef.current;
      if (rec > 0) {
        const rate = (TICK_STEP * spd) / rec;
        for (let i = 0; i < S.length; i++) {
          const s = S[i]!;
          if (s < 1) S[i] = s + (1 - s) * rate;
        }
      }

      spawnBudget = Math.min(SPAWN_BUDGET_CAP, spawnBudget + SPORE_RATE_PER_SEC * TICK_STEP * spd);
      if (spawnBudget >= 1) trySpawn();
    };

    // --- palette ----------------------------------------------------------
    let bg: RGB = [10, 10, 10];
    let muted: RGB = [79, 79, 79];
    let border: RGB = [46, 46, 46];
    let fg: RGB = [237, 237, 237];
    const readColors = () => {
      const cs = getComputedStyle(document.documentElement);
      bg = parseHex(cs.getPropertyValue("--background")) ?? bg;
      muted = parseHex(cs.getPropertyValue("--ns-muted")) ?? muted;
      border = parseHex(cs.getPropertyValue("--border")) ?? border;
      fg = parseHex(cs.getPropertyValue("--foreground")) ?? fg;
    };
    readColors();

    // --- offscreen grid canvas, upsampled + blurred onto the visible one --
    let off: HTMLCanvasElement | null = null;
    let offCtx: CanvasRenderingContext2D | null = null;
    let img: ImageData | null = null;

    const buildOffscreen = () => {
      off = document.createElement("canvas");
      off.width = cols;
      off.height = rows;
      offCtx = off.getContext("2d");
      img = offCtx ? offCtx.createImageData(cols, rows) : null;
    };

    const render = () => {
      if (!offCtx || !img || cols <= 0 || rows <= 0) return;
      const data = img.data;
      for (let i = 0, p = 0; i < S.length; i++, p += 4) {
        const s = S[i]!;
        // Recovered ground (s -> 1) fades toward --background — a healed
        // lawn should all but disappear, matching the "greens back" brief —
        // freshly-grazed ground (s -> EATEN_LEVEL) sits at --ns-muted.
        const base = mixRGB(muted, bg, s);
        const depletion = 1 - s;
        // Dither only kicks in on genuinely fresh scar tissue (s well under
        // half-recovered); anything past that fades through the smooth
        // muted->background ramp above with no texture at all, so the field
        // isn't dot-patterned everywhere it's merely mid-recovery.
        const density = smoothstep(0.55, 0.95, depletion);
        let c = base;
        if (density > 0.02) {
          const x = i % cols;
          const y = (i / cols) | 0;
          const threshold = BAYER4[y & 3]![x & 3]! / 16;
          if (threshold < density) c = mixRGB(base, border, 0.3 + density * 0.4);
        }
        data[p] = c[0];
        data[p + 1] = c[1];
        data[p + 2] = c[2];
        data[p + 3] = 255;
      }
      for (let r = 0; r < ringPool.length; r++) {
        const ring = ringPool[r]!;
        if (!ring.alive) continue;
        for (let ci = 0; ci < ring.front.length; ci++) {
          const p = ring.front[ci]! * 4;
          data[p] = fg[0];
          data[p + 1] = fg[1];
          data[p + 2] = fg[2];
          data[p + 3] = 255;
        }
      }
      // PREVIEW BLEND — the discrete dilation in growOnce() only fires once
      // growthBudget banks a whole cell (~every 1.4s at FRONT_SPEED), so
      // without this the front edge held dead still between steps and then
      // popped a whole cellSize outward in one frame — reads as a stepped
      // jump, not growth. This paints the cells the NEXT growOnce() call
      // would claim (same alternating von-Neumann/Moore kernel, same S >
      // ADVANCE_THRESHOLD test, read-only — nothing here mutates S or the
      // ring's actual front) at partial opacity equal to the banked
      // fraction of growthBudget, so the edge visibly brightens/advances
      // continuously across the ~1.4s between real claims instead of
      // sitting frozen and popping. Purely cosmetic: the falsifiable
      // claim/no-self-recrossing mechanism is untouched, this only softens
      // how the same discrete steps get painted.
      const previewAlpha = Math.max(0, Math.min(1, growthBudget));
      if (previewAlpha > 0.01) {
        const kMaxPreview = (growStep + 1) % 2 === 0 ? 8 : 4;
        for (let r = 0; r < ringPool.length; r++) {
          const ring = ringPool[r]!;
          if (!ring.alive) continue;
          for (let ci = 0; ci < ring.front.length; ci++) {
            const i = ring.front[ci]!;
            const x = i % cols;
            const y = (i / cols) | 0;
            for (let k = 0; k < kMaxPreview; k++) {
              const nx = x + (kMaxPreview === 8 ? NX[k]! : N4X[k]!);
              const ny = y + (kMaxPreview === 8 ? NY[k]! : N4Y[k]!);
              if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
              const ni = ny * cols + nx;
              if (S[ni]! <= ADVANCE_THRESHOLD) continue;
              const p = ni * 4;
              data[p] = Math.round(data[p]! + (fg[0] - data[p]!) * previewAlpha);
              data[p + 1] = Math.round(data[p + 1]! + (fg[1] - data[p + 1]!) * previewAlpha);
              data[p + 2] = Math.round(data[p + 2]! + (fg[2] - data[p + 2]!) * previewAlpha);
            }
          }
        }
      }
      offCtx.putImageData(img, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = true;
      // The dither above is a hard per-cell on/off pattern; a fixed small
      // blur only softens it at the SOURCE grid's own tiny pixel scale, so
      // after upsampling to device pixels each cell still reads as a crisp,
      // isolated dot (measured — a flat 1.2px here left every dither cell
      // legible as its own square at typical dpr). Scaling the blur to the
      // actual device-pixel cell size is what turns that into grain.
      const devCell = Math.max(1, cellSize * dpr);
      ctx.filter = `blur(${(devCell * 0.45).toFixed(2)}px)`;
      ctx.drawImage(off!, 0, 0, cols, rows, 0, 0, canvas.width, canvas.height);
      ctx.filter = "none";
    };

    // --- sizing -------------------------------------------------------------
    const rebuild = () => {
      if (cssW < 2 || cssH < 2) return;
      cellSize = CELL_BASE;
      let c = Math.max(4, Math.ceil(cssW / cellSize));
      let r = Math.max(4, Math.ceil(cssH / cellSize));
      while (c * r > MAX_CELLS) {
        cellSize++;
        c = Math.max(4, Math.ceil(cssW / cellSize));
        r = Math.max(4, Math.ceil(cssH / cellSize));
      }
      cols = c;
      rows = r;
      const n = cols * rows;
      S = new Float32Array(n).fill(1);
      ringPool = Array.from({ length: MAX_RINGS }, () => ({ alive: false, front: [] as number[] }));
      rng = makeRng(0x2b3f1e91);
      growthBudget = 0;
      spawnBudget = 0; // the organic 0.8/min clock starts fresh after the burst below
      seedInitialRings();
      buildOffscreen();
      const warm = reduced ? REDUCED_TICKS : PREWARM_TICKS;
      for (let i = 0; i < warm; i++) tick();
      render();
    };

    const applyBacking = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(cssW * dpr));
      canvas.height = Math.max(1, Math.round(cssH * dpr));
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
    };

    let rebuildTimer = 0;
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      const changed = Math.abs(rect.width - cssW) > 0.5 || Math.abs(rect.height - cssH) > 0.5;
      cssW = rect.width;
      cssH = rect.height;
      applyBacking();
      if (changed) {
        if (cols === 0) {
          rebuild();
        } else {
          window.clearTimeout(rebuildTimer);
          rebuildTimer = window.setTimeout(rebuild, 260);
        }
      } else {
        render();
      }
    };

    // --- loop -----------------------------------------------------------
    let raf = 0;
    let last = 0;
    let acc = 0;
    let visible = true;
    // "paused" (explicit prop) is a hard freeze. "reduced" is not — a field
    // that never changes again for the life of the mount reads as broken,
    // not calm. Reduced motion instead advances via a slow plain-timeout
    // pulse (never rAF, so there's no continuous per-frame motion) rather
    // than freezing outright, same treatment as lamina-dome/cambium-lay.
    let reducedTimer = 0;

    const loop = (now: number) => {
      const dt = last === 0 ? 1 / 60 : Math.min(0.1, (now - last) / 1000);
      last = now;
      acc += dt;
      let ran = 0;
      while (acc >= TICK_STEP && ran < MAX_TICKS_PER_FRAME) {
        tick();
        acc -= TICK_STEP;
        ran++;
      }
      if (ran > 0) render();
      if (visible && !document.hidden && !reduced && !pausedRef.current) {
        raf = requestAnimationFrame(loop);
      } else {
        raf = 0;
      }
    };

    const wake = () => {
      if (raf || reduced || pausedRef.current || !visible || document.hidden) return;
      last = 0;
      raf = requestAnimationFrame(loop);
    };
    const sleep = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    const reducedPulse = () => {
      reducedTimer = 0;
      for (let i = 0; i < REDUCED_LIVE_TICKS; i++) tick();
      render();
      wakeReduced();
    };
    const wakeReduced = () => {
      if (reducedTimer || !reduced || pausedRef.current || !visible || document.hidden) return;
      reducedTimer = window.setTimeout(reducedPulse, REDUCED_LIVE_INTERVAL_MS);
    };
    const sleepReduced = () => {
      if (reducedTimer) window.clearTimeout(reducedTimer);
      reducedTimer = 0;
    };

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries.some((e) => e.isIntersecting);
        if (visible) {
          wake();
          wakeReduced();
        } else {
          sleep();
          sleepReduced();
        }
      },
      { threshold: 0 }
    );
    io.observe(wrap);

    const onVis = () => {
      if (document.hidden) {
        sleep();
        sleepReduced();
      } else {
        wake();
        wakeReduced();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    // the REDUCED_TICKS prewarm only ever ran under the reduced-motion value
    // seen at mount; a LIVE flip just freezes/resumes wherever the field
    // currently is, same as toggling `paused`
    const applyMode = () => {
      if (pausedRef.current) {
        sleep();
        sleepReduced();
      } else if (reduced) {
        sleep();
        wakeReduced();
      } else {
        sleepReduced();
        wake();
      }
    };
    const onMq = () => {
      reduced = mq.matches;
      applyMode();
    };
    mq.addEventListener("change", onMq);

    let lastPolledPaused = pausedRef.current;
    let poll = 0;
    const pollPaused = () => {
      if (pausedRef.current !== lastPolledPaused) {
        lastPolledPaused = pausedRef.current;
        applyMode();
      }
      poll = window.setTimeout(pollPaused, 150);
    };
    pollPaused();

    const themeObserver = new MutationObserver(() => {
      readColors();
      render();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    applyMode();

    return () => {
      sleep();
      sleepReduced();
      ro.disconnect();
      io.disconnect();
      themeObserver.disconnect();
      mq.removeEventListener("change", onMq);
      document.removeEventListener("visibilitychange", onVis);
      window.clearTimeout(rebuildTimer);
      window.clearTimeout(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={wrapRef}
      className={`relative isolate h-full w-full overflow-hidden bg-background ${className}`}
      style={style}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 block h-full w-full" />
      {children ? <div className="relative z-[1] h-full w-full">{children}</div> : null}
    </div>
  );
}

RingGraze.displayName = "RingGraze";
