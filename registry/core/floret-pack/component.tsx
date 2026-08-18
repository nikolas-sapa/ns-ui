"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// FloretPack — a full-bleed phyllotactic background that is genuinely GROWN,
// not evaluated. A meristem at the container's centre births one primordium
// per plastochron at theta = orderIndex * 137.50776deg (the golden angle,
// sequential, mod 360 — never batch-computed). Each floret's radial motion
// is the exact analytic solution of dr/dt = K/r (area-conserving outward
// advection) taken from its own age, and on top of that a local repulsion
// pass every 30Hz tick nudges it against its birth-order neighbours, capped
// at 0.3px/tick, and that nudge is never pulled back to a target lattice —
// it is a permanent record of packing history. It is THIS relaxation, not
// the golden angle itself, that turns a field of jittered newborns into the
// visible 34/55 parastichy spirals a few rows out; switch it off and every
// floret just advects along its own fixed noisy ray with nothing to
// reorganise it, so the spirals visibly smear — the falsifiable tell that
// this is grown, not sampled from the closed-form Vogel layout r=c*sqrt(n).
//
// Every floret is one pre-mounted, absolutely-positioned div, pooled at a
// fixed size (maxPrimordia) and updated only via style.transform / opacity /
// backgroundColor from a direct-DOM rAF loop — no React state on the hot
// path, no canvas, no WebGL. A slot's index is literally birth order modulo
// the pool size, so the pool recycles itself exactly when a primordium
// reaches the rim (its radial lifetime is tuned to equal maxPrimordia
// plastochrons), with no separate free-list bookkeeping.
//
// Distinct from background-lloyd-relax: Lloyd relaxation converges toward a
// centroidal equilibrium and would sit still if the density field ever held
// still — it has no source and no sink. FloretPack has a permanent source
// (the meristem, always emitting) and a permanent sink (the rim, always
// consuming), a steady-state growth flow, and its local order comes from
// divergence-angle arrival history, never a centroidal correction.
// ---------------------------------------------------------------------------

const GOLDEN_ANGLE_RAD = (137.50776405003785 * Math.PI) / 180;
const TICK_MS = 1000 / 30; // fixed 30Hz physics step
const R0 = 3; // meristem birth radius, px
const NEIGHBOR_WINDOW = 10; // +-N birth-order slots searched for spatial neighbours
const NEIGHBOR_COUNT = 4; // 4-neighbour soft repulsion
const DESIRED_SPACING = 4; // px — the repulsion pass's target inter-floret spacing
const REPEL_STRENGTH = 0.9;
const MAX_STEP_PX = 0.3; // capped displacement per 30Hz tick
const RIM_FADE_START = 0.85; // senescence band: last 15% of the radial lifetime
const BIRTH_FADE_FRAC = 0.06; // opacity/scale ramp-in over the first 6% of lifetime
const DOT_SIZE = 10; // px, fully-grown dot diameter — sized against the ~27px mean spacing an inscribed rim gives, so the parastichy families read as lines rather than as scattered specks
const DOT_MIN_SCALE = 0.35;
const WARMUP_PLASTOCHRONS = 500;
const JITTER_MAX_PX = 2.2;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

function parseHex(raw: string): RGB | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(raw.trim());
  if (!m || !m[1]) return null;
  const int = parseInt(m[1], 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function lerpChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

// Three token stops from --ns-muted (young) toward --foreground (mature),
// read live so a theme flip re-derives them without a remount.
function readStops(): string[] {
  const cs = getComputedStyle(document.documentElement);
  const muted = parseHex(cs.getPropertyValue("--ns-muted")) ?? { r: 143, g: 143, b: 143 };
  const fg = parseHex(cs.getPropertyValue("--foreground")) ?? { r: 237, g: 237, b: 237 };
  return [0, 0.5, 1].map(
    (t) => `rgb(${lerpChannel(muted.r, fg.r, t)},${lerpChannel(muted.g, fg.g, t)},${lerpChannel(muted.b, fg.b, t)})`
  );
}

export interface FloretPackProps {
  /** Content overlaid on a bg-background/70 scrim above the growing head. */
  children?: ReactNode;
  /** Plastochron — ms between successive primordium emissions. ~1.4s reads as organic; faster reads as popcorn, slower as frozen. */
  plastochron?: number;
  /** Live primordia population cap — also the pool size and, by construction, the radial lifetime in plastochrons. */
  maxPrimordia?: number;
  className?: string;
}

export function FloretPack({ children, plastochron = 1400, maxPrimordia = 700, className = "" }: FloretPackProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const elRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const n = maxPrimordia;
    const theta = new Float32Array(n);
    const bornAt = new Float32Array(n); // ms, sim clock
    const bornOrder = new Int32Array(n).fill(-1);
    const ox = new Float32Array(n);
    const oy = new Float32Array(n);
    const posX = new Float32Array(n);
    const posY = new Float32Array(n);
    // Render-interpolation buffers: the physics tick is fixed at 30Hz
    // (TICK_MS) but rAF fires at display rate (60/120Hz). Without these, the
    // last tick's posX/posY got re-applied verbatim to the DOM on every
    // in-between frame, so a tracked dot's per-frame render delta alternated
    // "0px for 1-2 frames, then a multi-px jump" — a beat between the 30Hz
    // physics step and the display's refresh rate, not smooth advection.
    // prevPosX/Y hold the position as of the second-most-recent tick;
    // applyToDOM lerps toward the latest tick by the leftover accumulator
    // fraction every frame, so the rendered position moves a little every
    // single frame instead of only on tick boundaries.
    const prevPosX = new Float32Array(n);
    const prevPosY = new Float32Array(n);
    const prevBornOrder = new Int32Array(n).fill(-1);
    const maturity = new Float32Array(n);
    const dx = new Float32Array(n);
    const dy = new Float32Array(n);
    const lastColorIdx = new Int8Array(n).fill(-1);
    const candD2: number[] = new Array(NEIGHBOR_WINDOW * 2);
    const candDx: number[] = new Array(NEIGHBOR_WINDOW * 2);
    const candDy: number[] = new Array(NEIGHBOR_WINDOW * 2);
    const rand = mulberry32(0x9e3779b9);

    let stops = readStops();
    let w = 0;
    let h = 0;
    let cx = 0;
    let cy = 0;
    let rRim = 100;
    let growthK = 1;
    let lifetimeMs = maxPrimordia * plastochron;
    let simAge = 0;
    let nextEmitAt = 0;
    let emitOrder = 0;
    let started = false;
    let raf = 0;
    let lastT = 0;
    let acc = 0;

    const measure = () => {
      const rect = root!.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      cx = w / 2;
      cy = h / 2;
      // The rim is the INSCRIBED circle, not the half-diagonal. Advection is
      // area-conserving, so a head whose rim is the half-diagonal spreads the
      // same maxPrimordia florets over ~1.7x the area AND pushes the rim off
      // screen entirely: the result is a uniform full-bleed scatter with no
      // visible head, no rim, and parastichy families too sparse to read as
      // spirals at all. Inscribing the head puts the whole flower in frame.
      rRim = Math.min(cx, cy) * 0.92;
    };

    const spawn = (order: number, atMs: number) => {
      const slot = order % n;
      // modulo 2*PI keeps the stored angle small (single-precision friendly)
      // over very long mount times without changing the golden-angle rule.
      theta[slot] = (order * GOLDEN_ANGLE_RAD) % (Math.PI * 2);
      bornAt[slot] = atMs;
      bornOrder[slot] = order;
      const jAng = rand() * Math.PI * 2;
      const jMag = rand() * JITTER_MAX_PX;
      ox[slot] = Math.cos(jAng) * jMag;
      oy[slot] = Math.sin(jAng) * jMag;
      lastColorIdx[slot] = -1;
    };

    // Resolves the analytic radial position (age -> r -> Cartesian, plus the
    // persisted relaxation offset) for every live floret against the
    // CURRENT cx/cy/growthK. Reused after a resize (reproject in place, no
    // physics advance) and as the first pass of stepPhysics.
    const computePositions = () => {
      for (let slot = 0; slot < n; slot++) {
        if (bornOrder[slot] < 0) continue;
        const age = Math.max(0, simAge - (bornAt[slot] ?? 0));
        const m = Math.min(1, age / lifetimeMs);
        maturity[slot] = m;
        // Continuous, not quantised: rounding this to a 4px grid (the old
        // behaviour) reads as fine-grained packing structure once you're
        // comparing sampled positions, but every floret's radius crosses a
        // 4px boundary at a different moment and pops there instantly — with
        // the accumulator fix elsewhere in this file actually running
        // physics at its intended ~30Hz (it previously fired only a handful
        // of times in 3s, which buried this), those pops became frequent
        // enough to read as the whole field stuttering rather than smooth
        // outward advection. The repulsion pass below still enforces
        // DESIRED_SPACING in continuous space, so the parastichy packing is
        // unaffected — only the render position stops jumping.
        const rBase = Math.sqrt(R0 * R0 + 2 * growthK * age);
        const t = theta[slot] ?? 0;
        posX[slot] = cx + rBase * Math.cos(t) + (ox[slot] ?? 0);
        posY[slot] = cy + rBase * Math.sin(t) + (oy[slot] ?? 0);
      }
    };

    // Advances the sim clock, spawns due primordia, resolves the analytic
    // radial position for every live floret, then runs one pass of capped
    // 4-neighbour soft repulsion on top. Pure physics — no DOM writes.
    const stepPhysics = (dtMs: number, capScale: number) => {
      simAge += dtMs;
      while (simAge >= nextEmitAt) {
        spawn(emitOrder, nextEmitAt);
        emitOrder++;
        nextEmitAt += plastochron;
      }

      computePositions();

      const cap = MAX_STEP_PX * capScale;
      for (let i = 0; i < n; i++) {
        if (bornOrder[i] < 0) {
          dx[i] = 0;
          dy[i] = 0;
          continue;
        }
        let count = 0;
        for (let off = -NEIGHBOR_WINDOW; off <= NEIGHBOR_WINDOW; off++) {
          if (off === 0) continue;
          const j = ((i + off) % n + n) % n;
          if (bornOrder[j] < 0) continue;
          const ddx = (posX[i] ?? 0) - (posX[j] ?? 0);
          const ddy = (posY[i] ?? 0) - (posY[j] ?? 0);
          candD2[count] = ddx * ddx + ddy * ddy;
          candDx[count] = ddx;
          candDy[count] = ddy;
          count++;
        }
        // partial selection: the NEIGHBOR_COUNT closest candidates by d2
        let fx = 0;
        let fy = 0;
        for (let pick = 0; pick < NEIGHBOR_COUNT && pick < count; pick++) {
          let bestIdx = -1;
          let bestD2 = Infinity;
          for (let c = 0; c < count; c++) {
            const d2 = candD2[c] ?? Infinity;
            if (d2 < bestD2) {
              bestD2 = d2;
              bestIdx = c;
            }
          }
          if (bestIdx < 0) break;
          candD2[bestIdx] = Infinity; // consumed
          if (bestD2 < DESIRED_SPACING * DESIRED_SPACING) {
            const dist = Math.sqrt(bestD2) || 0.01;
            const overlap = (DESIRED_SPACING - dist) / DESIRED_SPACING;
            const mag = overlap * REPEL_STRENGTH;
            fx += ((candDx[bestIdx] ?? 0) / dist) * mag;
            fy += ((candDy[bestIdx] ?? 0) / dist) * mag;
          }
        }
        const fMag = Math.hypot(fx, fy);
        if (fMag > cap) {
          const s = cap / fMag;
          fx *= s;
          fy *= s;
        }
        dx[i] = fx;
        dy[i] = fy;
      }

      for (let slot = 0; slot < n; slot++) {
        if (bornOrder[slot] < 0) continue;
        ox[slot] = (ox[slot] ?? 0) + (dx[slot] ?? 0);
        oy[slot] = (oy[slot] ?? 0) + (dy[slot] ?? 0);
        posX[slot] = (posX[slot] ?? 0) + (dx[slot] ?? 0);
        posY[slot] = (posY[slot] ?? 0) + (dy[slot] ?? 0);
      }
    };

    // `alpha` is the fraction of the way from the previous completed tick to
    // the latest one (0 right after a tick, approaching 1 just before the
    // next). alpha=1 means "render the latest tick's position outright" —
    // used by warmup and resize reprojection, which aren't running inside
    // the interpolated rAF loop.
    const applyToDOM = (alpha = 1) => {
      for (let slot = 0; slot < n; slot++) {
        const el = elRefs.current[slot];
        if (!el) continue;
        if (bornOrder[slot] < 0) {
          el.style.opacity = "0";
          continue;
        }
        const curX = posX[slot] ?? 0;
        const curY = posY[slot] ?? 0;
        let rx = curX;
        let ry = curY;
        // Only interpolate a floret that already existed at the previous
        // tick under this same slot — a just-spawned or just-recycled slot
        // has no meaningful "previous" position and must snap, not lerp in
        // from stale/garbage coordinates.
        if (alpha < 1 && prevBornOrder[slot] === bornOrder[slot]) {
          const px = prevPosX[slot] ?? curX;
          const py = prevPosY[slot] ?? curY;
          rx = px + (curX - px) * alpha;
          ry = py + (curY - py) * alpha;
        }
        const m = maturity[slot] ?? 0;
        const fadeIn = Math.min(1, m / BIRTH_FADE_FRAC);
        const fadeOut = m <= RIM_FADE_START ? 1 : Math.max(0, 1 - (m - RIM_FADE_START) / (1 - RIM_FADE_START));
        const opacity = fadeIn * fadeOut;
        const scale = DOT_MIN_SCALE + (1 - DOT_MIN_SCALE) * fadeIn;
        el.style.transform = `translate3d(${rx.toFixed(1)}px, ${ry.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`;
        el.style.opacity = opacity.toFixed(3);
        const colorIdx = m < 1 / 3 ? 0 : m < 2 / 3 ? 1 : 2;
        if (lastColorIdx[slot] !== colorIdx) {
          lastColorIdx[slot] = colorIdx;
          el.style.backgroundColor = stops[colorIdx] ?? stops[0] ?? "";
        }
      }
    };

    const recomputeGrowthK = () => {
      lifetimeMs = maxPrimordia * plastochron;
      growthK = Math.max(0.0001, (rRim * rRim - R0 * R0) / (2 * lifetimeMs));
    };

    const warmup = () => {
      const stepMs = plastochron / 4;
      const capScale = stepMs / TICK_MS;
      const ticks = Math.ceil((WARMUP_PLASTOCHRONS * plastochron) / stepMs);
      for (let i = 0; i < ticks; i++) stepPhysics(stepMs, capScale);
      applyToDOM();
    };

    const onThemeChange = () => {
      stops = readStops();
      for (let i = 0; i < n; i++) lastColorIdx[i] = -1;
      applyToDOM();
    };
    const themeObserver = new MutationObserver(onThemeChange);

    const onResize = () => {
      const prevRim = rRim;
      measure();
      if (!started) {
        trySetup();
        return;
      }
      if (prevRim !== rRim) {
        // K stays fixed at its mount-time value on purpose — the live
        // population keeps advecting the same birth history toward the
        // new bounds instead of the field being re-sampled from a formula.
        // Reproject (not re-simulate) so the existing offsets/ages carry over.
        computePositions();
        applyToDOM();
      }
    };
    const ro = new ResizeObserver(onResize);

    const frame = (now: number) => {
      // Fixed-timestep accumulator: leftover sub-tick time MUST carry over
      // frame to frame (acc lives in the outer closure, not reset here) —
      // rAF fires faster than TICK_MS at most refresh rates, so resetting
      // acc to dt every call discarded the remainder every time and this
      // loop advanced physics only on the rare frame-time hiccup.
      const dt = Math.min(200, lastT ? now - lastT : TICK_MS);
      lastT = now;
      acc += dt;
      while (acc >= TICK_MS) {
        // Snapshot the pre-step state as "previous" right before overwriting
        // it, so prevPos always trails posX/posY by exactly one tick even
        // when a laggy frame runs several catch-up ticks in a row.
        prevPosX.set(posX);
        prevPosY.set(posY);
        prevBornOrder.set(bornOrder);
        stepPhysics(TICK_MS, 1);
        acc -= TICK_MS;
      }
      applyToDOM(acc / TICK_MS);
      raf = requestAnimationFrame(frame);
    };

    const onVisibility = () => {
      if (document.hidden) {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      } else if (!reduced && started) {
        lastT = 0;
        raf = requestAnimationFrame(frame);
      }
    };

    function trySetup() {
      if (started) return;
      measure();
      if (!w || !h) return;
      started = true;
      recomputeGrowthK();
      warmup();
      themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      if (!reduced) {
        document.addEventListener("visibilitychange", onVisibility);
        raf = requestAnimationFrame(frame);
      }
    }

    trySetup();
    ro.observe(root);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      themeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reduced, plastochron, maxPrimordia]);

  return (
    <div
      ref={rootRef}
      className={["relative isolate min-h-[480px] w-full overflow-hidden bg-background", className].join(" ")}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {Array.from({ length: maxPrimordia }, (_, slot) => (
          <div
            key={slot}
            ref={(el) => {
              elRefs.current[slot] = el;
            }}
            className="will-change-transform absolute rounded-full"
            style={{
              left: 0,
              top: 0,
              width: DOT_SIZE,
              height: DOT_SIZE,
              marginLeft: -DOT_SIZE / 2,
              marginTop: -DOT_SIZE / 2,
              opacity: 0,
              backgroundColor: "var(--ns-muted)",
            }}
          />
        ))}
      </div>
      {children ? (
        <div className="relative z-10 flex min-h-[inherit] flex-col items-center justify-center px-8 py-14">
          {/* the scrim hugs the copy — spread over the whole pane it washed
              the entire head out to a faint speckle in both themes */}
          <div className="flex max-w-xl flex-col items-center gap-2 rounded-xl bg-background/80 px-8 py-8 text-center backdrop-blur-sm">
            {children}
          </div>
        </div>
      ) : null}
    </div>
  );
}
