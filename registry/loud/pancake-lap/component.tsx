"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";

// ---------------------------------------------------------------------------
// PancakeLap — a full-bleed ambient background modeling REAL pancake sea-ice
// formation (WMO sea-ice nomenclature; marginal-ice-zone wave/ice field
// studies, e.g. Doble & Wadhams on pancake formation timescales). In cold,
// wave-agitated open water a solid sheet can't form — wave action keeps
// breaking any nascent film apart — so ice instead nucleates as small
// circular discs ("pans") that grow at their edges. Repeated wave-driven
// collisions between pans grind slush onto each pan's rim, building the
// diagnostic RAISED BUMPER EDGE that gives pancake ice its name. As pans
// crowd together under continued wave forcing, they don't just settle into a
// packed arrangement — one pan's edge periodically rides up and OVER a
// neighbour's rim (rafting/overriding), leaving a locally doubled, thicker
// weld at the overlap that can go on to fuse into a larger composite floe.
//
// This is a discrete-event field sim, not a circle-packing relaxation (that
// territory belongs to a Lloyd-relaxation / floret-pack style component) —
// the whole point is that the field never reaches a jammed, static state:
// pans nucleate, grow, drift, occasionally raft (rise/cross/settle over one
// another), and exit the frame to be replaced by fresh small pans at the
// entry edge, forever.
//
// REAL NUMBERS (compressed where the real rate would alias, held near 1:1
// where it's already human-scale, per the round-9 legibility rule):
//   - growth-to-stable-size: real ~20-40min under active wave forcing,
//     compressed ~250x to 6-9s render time per pan.
//   - swell/collision cycle: real marginal-ice-zone wave period ~4-8s,
//     rendered near 1:1 (~5s) as gentle per-pan bobbing — the one sub-rate
//     intentionally left untouched because it's already legible.
//   - rafting/lap event: fires somewhere in the field every 1.8-2.5s,
//     ~700ms door-to-door (rise ~250ms, cross/settle ~450ms) — the ONE thing
//     a viewer should be able to follow, at a cadence slow enough to track.
//   - ambient drift: pans translate ~4px/s toward the frame's trailing edge;
//     exiting pans are replaced by fresh small pans at the entry edge, so
//     field composition continuously turns over.
//
// TOKENS: --background is the base water tone; --ns-muted is mixed into it
// (never mixed with --ns-accent) to lift open water off the raw background
// value in light theme without ever going flat pale-on-pale; pan tops and
// rims are both derived from --foreground mixed toward the water color at
// different ratios — pan top brighter (closer to --foreground's contrast
// against water), rim a step DOWN in luminance from the pan top, same
// directional relationship (ice brighter than water) held in both themes by
// bias/mix ratio, never a color swap. --ns-accent never appears — there is
// no interaction moment here, rafting is wave-driven, not pointer-driven.
// Every color is computed at runtime by parsing token hex values read via
// getComputedStyle and lerping RGB channels by hand (canvas fillStyle does
// not reliably parse color-mix() across engines, and a failed parse fails
// silently); no literal color appears anywhere in this file. Tokens are
// read once document.fonts.ready resolves (before first paint) and
// re-read on a MutationObserver watching documentElement's class; no path
// (ResizeObserver, IntersectionObserver, reduced-motion) can paint before
// that first read.
// ---------------------------------------------------------------------------

const TAU = Math.PI * 2;

type RGB = readonly [number, number, number];

// Parses a computed --token value (hex, or rgb()/rgba()) into RGB channels.
// Canvas fillStyle does not reliably parse color-mix() across engines, so
// every mixed tone in this component is computed here in RGB space instead.
function parseColor(raw: string): RGB | null {
  const s = raw.trim();
  if (!s) return null;
  if (s.startsWith("#")) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return Number.isNaN(r + g + b) ? null : [r, g, b];
    }
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return Number.isNaN(r + g + b) ? null : [r, g, b];
    }
    return null;
  }
  const m = s.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function lerpRGB(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function rgbString(c: RGB): string {
  return `rgb(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])})`;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface RaftEvent {
  partnerId: number;
  phase: "rise" | "cross";
  t0: number; // sim time the event started
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

interface Pan {
  id: number;
  x: number;
  y: number;
  r: number; // current radius, px
  maxR: number; // stable radius, px
  bornAt: number; // sim time
  growTau: number; // s, growth time constant
  vx: number;
  vy: number;
  wobblePhase: number;
  wobbleFreq: number; // rad/s, swell bobbing
  raft: RaftEvent | null;
  weldedWith: number | null; // pan id this pan is permanently overlapping
}

const RISE_MS = 250;
const CROSS_MS = 450;
const RAFT_MS = RISE_MS + CROSS_MS;
const RAFT_MIN_GAP = 1.8; // s between rafting events, field-wide
const RAFT_MAX_GAP = 2.5;
const GROW_MIN = 6; // s
const GROW_MAX = 9;
const DRIFT_PX_S = 4;
const SWELL_PERIOD = 5; // s, near real marginal-ice-zone wave period
const WARM_SECONDS = 14; // sim time run before first paint
const WARM_DT = 1 / 30;
const SEP_STRENGTH = 0.12; // soft-push fraction per resolve pass

export interface PancakeLapProps {
  /** pan footprint as a fraction of the container's smaller dimension. @default 0.09 */
  panRatio?: number;
  /** freeze the field at its warm-start frame. @default false */
  paused?: boolean;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function PancakeLap({
  panRatio = 0.09,
  paused = false,
  children,
  className = "",
  style,
}: PancakeLapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Token-derived color strings, built only after the first read — nothing
    // paints before `ready` is true, so nothing here needs a literal
    // fallback. Canvas fillStyle parsing of color-mix() is uneven across
    // engines and fails silently (leaves the previous fillStyle in place),
    // so colors are mixed by hand in parsed RGB space and emitted as rgb()
    // strings, the same approach used elsewhere in this registry's canvas
    // components (e.g. hero-faraday-wave-cell's lerpRGB/parseColor).
    let waterColor = "";
    let panTopColor = "";
    let rimColor = "";
    let weldColor = "";
    const readTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      const bg = parseColor(cs.getPropertyValue("--background"));
      const muted = parseColor(cs.getPropertyValue("--ns-muted"));
      const fg = parseColor(cs.getPropertyValue("--foreground"));
      if (!bg || !muted || !fg) return;
      // open water: background lifted slightly toward --ns-muted so it never
      // sits flat-identical to the page background (catches the light-theme
      // pale-on-pale failure mode).
      const water = lerpRGB(bg, muted, 0.12);
      // pan top: foreground mixed toward water — bright ice against darker
      // water, same direction in both themes.
      const panTop = lerpRGB(water, fg, 0.46);
      // rim: a step DOWN in luminance from the pan top, back toward water —
      // the raised, wave-ground bumper edge. Never --border (a separator
      // token, not a fill/stroke here).
      const rim = lerpRGB(water, panTop, 0.62);
      // weld: the doubled-ice overlap left by a completed raft — brighter
      // than a normal pan top, the one deliberately "thicker-reading" tone.
      const weld = lerpRGB(water, fg, 0.6);
      waterColor = rgbString(water);
      panTopColor = rgbString(panTop);
      rimColor = rgbString(rim);
      weldColor = rgbString(weld);
    };

    let dpr = 1;
    let width = 0;
    let height = 0;
    let sized = false;
    let ready = false;
    let disposed = false;
    let visible = true;
    let raf = 0;
    let last = 0;
    let simTime = 0;

    let pans: Pan[] = [];
    let nextId = 0;
    let nextRaftAt = 0;
    let minDim = 100;
    let maxPanR = 30;
    let rng = mulberry32(0x51ed270b);

    const spawn = (x: number, y: number, r0Fraction: number) => {
      const id = nextId++;
      pans.push({
        id,
        x,
        y,
        r: maxPanR * r0Fraction,
        maxR: maxPanR * (0.72 + rng() * 0.28),
        bornAt: simTime,
        growTau: (GROW_MIN + rng() * (GROW_MAX - GROW_MIN)) / 2.4,
        vx: DRIFT_PX_S * (0.7 + rng() * 0.6),
        vy: 0,
        wobblePhase: rng() * TAU,
        wobbleFreq: TAU / (SWELL_PERIOD * (0.85 + rng() * 0.3)),
        raft: null,
        weldedWith: null,
      });
    };

    const seedField = () => {
      pans = [];
      nextId = 0;
      const area = width * height;
      const footprint = Math.PI * (maxPanR * 0.7) ** 2;
      const target = Math.max(40, Math.min(70, Math.round(area / (footprint * 3.1))));
      for (let i = 0; i < target; i++) {
        const x = rng() * width;
        const y = rng() * height;
        // mixed maturity at seed: some near-mature, some freshly nucleated.
        spawn(x, y, 0.18 + rng() * 0.82);
        pans[pans.length - 1].bornAt = simTime - rng() * GROW_MAX * 1.4;
      }
      nextRaftAt = RAFT_MIN_GAP + rng() * (RAFT_MAX_GAP - RAFT_MIN_GAP);
    };

    // Spatial hash keyed on the current frame's pan positions — rebuilt every
    // step since pans drift continuously.
    const cellOf = (x: number, y: number, cell: number) =>
      `${Math.floor(x / cell)},${Math.floor(y / cell)}`;

    const buildHash = (cell: number) => {
      const grid = new Map<string, number[]>();
      for (let i = 0; i < pans.length; i++) {
        const p = pans[i];
        const k = cellOf(p.x, p.y, cell);
        const bucket = grid.get(k);
        if (bucket) bucket.push(i);
        else grid.set(k, [i]);
      }
      return grid;
    };

    const neighborsOf = (grid: Map<string, number[]>, cell: number, p: Pan) => {
      const cx = Math.floor(p.x / cell);
      const cy = Math.floor(p.y / cell);
      const out: number[] = [];
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const bucket = grid.get(`${cx + dx},${cy + dy}`);
          if (bucket) out.push(...bucket);
        }
      }
      return out;
    };

    const startRaft = (rider: Pan, partner: Pan) => {
      // rider's post-lap resting spot: overlapping the partner's rim by
      // roughly 45% of their combined radius, on the line between centers.
      const dx = partner.x - rider.x;
      const dy = partner.y - rider.y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const targetDist = (rider.r + partner.r) * 0.55;
      const ux = dx / dist;
      const uy = dy / dist;
      const endX = partner.x - ux * targetDist;
      const endY = partner.y - uy * targetDist;
      rider.raft = {
        partnerId: partner.id,
        phase: "rise",
        t0: simTime,
        startX: rider.x,
        startY: rider.y,
        endX,
        endY,
      };
    };

    const cell = () => Math.max(24, minDim / 12);

    const tryStartRaftEvent = () => {
      if (pans.length < 2) return;
      const c = cell();
      const grid = buildHash(c);
      // scan a handful of random pans for a free, close neighbor pair.
      for (let attempt = 0; attempt < 10; attempt++) {
        const rider = pans[Math.floor(rng() * pans.length)];
        if (rider.raft || rider.weldedWith !== null) continue;
        const cand = neighborsOf(grid, c, rider);
        let best: Pan | null = null;
        let bestDist = Infinity;
        for (const idx of cand) {
          const other = pans[idx];
          if (other.id === rider.id || other.raft || other.weldedWith === rider.id) continue;
          const d = Math.hypot(other.x - rider.x, other.y - rider.y);
          const touchDist = rider.r + other.r;
          if (d < touchDist * 1.15 && d < bestDist) {
            best = other;
            bestDist = d;
          }
        }
        if (best) {
          startRaft(rider, best);
          return;
        }
      }
    };

    const step = (dt: number) => {
      simTime += dt;

      if (simTime >= nextRaftAt) {
        tryStartRaftEvent();
        nextRaftAt = simTime + RAFT_MIN_GAP + rng() * (RAFT_MAX_GAP - RAFT_MIN_GAP);
      }

      for (const p of pans) {
        // growth: real ice slows as it grows — an exponential approach to
        // the stable pan size reads that deceleration honestly.
        const age = simTime - p.bornAt;
        p.r = p.maxR * (1 - Math.exp(-Math.max(0, age) / p.growTau));

        if (p.raft) {
          const elapsedMs = (simTime - p.raft.t0) * 1000;
          if (elapsedMs < RISE_MS) {
            p.raft.phase = "rise";
          } else if (elapsedMs < RAFT_MS) {
            p.raft.phase = "cross";
            const crossT = (elapsedMs - RISE_MS) / CROSS_MS;
            const eased = crossT < 0.5 ? 2 * crossT * crossT : 1 - Math.pow(-2 * crossT + 2, 2) / 2;
            p.x = p.raft.startX + (p.raft.endX - p.raft.startX) * eased;
            p.y = p.raft.startY + (p.raft.endY - p.raft.startY) * eased;
          } else {
            // settle: lock in the overlap as a permanent weld. The pair now
            // travels as one composite piece, so the rider inherits the
            // partner's drift speed rather than slowly separating from it.
            p.x = p.raft.endX;
            p.y = p.raft.endY;
            p.weldedWith = p.raft.partnerId;
            const partner = pans.find((q) => q.id === p.raft!.partnerId);
            if (partner) p.vx = partner.vx;
            p.raft = null;
          }
        }

        if (!p.raft || p.raft.phase !== "cross") {
          // a welded pair keeps its own drift speed — both pans were already
          // moving together when the lap happened, so no extra coupling is
          // needed to keep the weld visually intact as they travel.
          p.x += p.vx * dt;
          p.y += Math.sin(p.wobblePhase + simTime * p.wobbleFreq) * 0.6 * dt * 6;
        }
      }

      // soft separation so non-rafting pans don't sit stacked — skipped for
      // the pan currently mid-cross (it is SUPPOSED to overlap its partner)
      // and for an already-welded pair (their overlap is the whole point).
      const c = cell();
      const grid = buildHash(c);
      for (let i = 0; i < pans.length; i++) {
        const p = pans[i];
        if (p.raft && p.raft.phase === "cross") continue;
        const cand = neighborsOf(grid, c, p);
        for (const idx of cand) {
          if (idx === i) continue;
          const o = pans[idx];
          if (o.raft && o.raft.phase === "cross") continue;
          if (p.weldedWith === o.id || o.weldedWith === p.id) continue;
          const dx = o.x - p.x;
          const dy = o.y - p.y;
          const d = Math.hypot(dx, dy) || 0.001;
          const minD = p.r + o.r;
          if (d < minD) {
            const push = ((minD - d) / d) * SEP_STRENGTH;
            p.x -= dx * push;
            p.y -= dy * push;
          }
        }
      }

      // turnover: pans that drift past the trailing edge are removed and
      // replaced by a fresh small pan nucleating at the leading edge.
      const survivors: Pan[] = [];
      for (const p of pans) {
        if (p.x - p.r > width + maxPanR * 0.5) {
          spawn(-maxPanR * 0.3 + rng() * maxPanR * 0.4, rng() * height, 0.12);
        } else {
          survivors.push(p);
        }
      }
      // drop welded references to pans that no longer exist.
      const liveIds = new Set(survivors.map((p) => p.id));
      for (const p of survivors) {
        if (p.weldedWith !== null && !liveIds.has(p.weldedWith)) p.weldedWith = null;
      }
      pans = survivors;
    };

    const draw = () => {
      if (!sized) return;
      ctx.fillStyle = waterColor;
      ctx.fillRect(0, 0, width, height);

      // draw order: growing/settled pans first, rafting riders last so a
      // pan mid-lap always renders visibly on top of the neighbor it crosses.
      const ordered = [...pans].sort((a, b) => {
        const aTop = a.raft ? 1 : 0;
        const bTop = b.raft ? 1 : 0;
        return aTop - bTop;
      });

      for (const p of ordered) {
        if (p.r < 0.5) continue;
        const rimW = Math.max(1, p.r * 0.12);

        // rise phase: a soft shadow lens beneath the rider, and a slight
        // scale-up, reads as the pan's edge lifting off the water before it
        // crosses onto the neighbor.
        let drawR = p.r;
        let drawY = p.y;
        if (p.raft && p.raft.phase === "rise") {
          const t = Math.min(1, ((simTime - p.raft.t0) * 1000) / RISE_MS);
          const lift = t * t * (3 - 2 * t); // smoothstep
          drawR = p.r * (1 + 0.1 * lift);
          drawY = p.y - p.r * 0.12 * lift;
          ctx.globalAlpha = 0.28 * lift;
          ctx.fillStyle = rimColor;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y + p.r * 0.15, p.r * 0.9, p.r * 0.4, 0, 0, TAU);
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        ctx.fillStyle = panTopColor;
        ctx.beginPath();
        ctx.arc(p.x, drawY, Math.max(0.5, drawR - rimW * 0.5), 0, TAU);
        ctx.fill();

        ctx.strokeStyle = rimColor;
        ctx.lineWidth = rimW;
        ctx.beginPath();
        ctx.arc(p.x, drawY, Math.max(0.5, drawR - rimW * 0.5), 0, TAU);
        ctx.stroke();

        // the permanent weld: a brighter doubled-ice lens at the overlap
        // with whichever pan this one rafted onto.
        if (p.weldedWith !== null) {
          const partner = pans.find((q) => q.id === p.weldedWith);
          if (partner) {
            const mx = (p.x + partner.x) / 2;
            const my = (p.y + partner.y) / 2;
            const lensR = Math.min(p.r, partner.r) * 0.5;
            ctx.fillStyle = weldColor;
            ctx.globalAlpha = 0.85;
            ctx.beginPath();
            ctx.ellipse(mx, my, lensR, lensR * 0.82, 0, 0, TAU);
            ctx.fill();
            ctx.globalAlpha = 1;
          }
        }
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) {
        sized = false;
        return;
      }
      width = rect.width;
      height = rect.height;
      minDim = Math.min(width, height);
      maxPanR = Math.max(10, minDim * panRatio);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      simTime = 0;
      rng = mulberry32(0x51ed270b);
      seedField();
      sized = true;
    };

    const warmStart = () => {
      const steps = Math.round(WARM_SECONDS / WARM_DT);
      for (let i = 0; i < steps; i++) step(WARM_DT);
      // the reduced-motion / initial frame must show a mid-lap pan, not just
      // mixed maturity — force one into the "cross" phase if none is already
      // rafting after the warm start.
      if (!pans.some((p) => p.raft)) {
        const c = cell();
        const grid = buildHash(c);
        for (const rider of pans) {
          if (rider.weldedWith !== null) continue;
          const cand = neighborsOf(grid, c, rider);
          for (const idx of cand) {
            const other = pans[idx];
            if (other.id === rider.id || other.weldedWith !== null) continue;
            const d = Math.hypot(other.x - rider.x, other.y - rider.y);
            if (d < (rider.r + other.r) * 1.15) {
              startRaft(rider, other);
              rider.raft!.t0 = simTime - (RISE_MS + CROSS_MS * 0.5) / 1000;
              rider.raft!.phase = "cross";
              const elapsedMs = (simTime - rider.raft!.t0) * 1000;
              const crossT = (elapsedMs - RISE_MS) / CROSS_MS;
              const eased = crossT < 0.5 ? 2 * crossT * crossT : 1 - Math.pow(-2 * crossT + 2, 2) / 2;
              rider.x = rider.raft!.startX + (rider.raft!.endX - rider.raft!.startX) * eased;
              rider.y = rider.raft!.startY + (rider.raft!.endY - rider.raft!.startY) * eased;
              return;
            }
          }
        }
      }
    };

    const loop = (now: number) => {
      if (!visible) return;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      step(dt);
      draw();
      raf = requestAnimationFrame(loop);
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        resize();
        if (!sized) return;
        warmStart();
        ready = true;
        draw();
        if (!reduced && !paused && visible && !raf) {
          last = 0;
          raf = requestAnimationFrame(loop);
        }
      }, 150);
    };

    const ro = new ResizeObserver(onResize);
    ro.observe(canvas);

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true;
        if (visible && ready && !reduced && !paused) {
          last = 0;
          raf = requestAnimationFrame(loop);
        } else {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      },
      { threshold: 0 }
    );
    io.observe(canvas);

    const onVis = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (visible && ready && !reduced && !paused) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced || paused) draw();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    document.fonts.ready.then(() => {
      if (disposed) return;
      readTokens();
      resize();
      if (!sized) {
        ready = true;
        return;
      }
      warmStart();
      ready = true;
      if (reduced || paused) {
        draw();
      } else {
        raf = requestAnimationFrame(loop);
      }
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (resizeTimer) clearTimeout(resizeTimer);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [panRatio, paused]);

  return (
    <div
      className={`relative isolate h-full w-full overflow-hidden bg-background ${className}`}
      style={style}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 block h-full w-full"
      />
      {children ? <div className="relative z-[1] h-full w-full">{children}</div> : null}
    </div>
  );
}

PancakeLap.displayName = "PancakeLap";
