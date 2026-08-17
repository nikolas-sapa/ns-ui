"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

// ---------------------------------------------------------------------------
// FlashEntrain — an ambient field of pulse-coupled firefly oscillators
// (Mirollo-Strogatz coupling), not a scripted animation. Every firefly holds
// one phase in a shared Float32Array, climbing linearly from 0 toward a
// firing threshold of 1 at its own natural rate. The instant a firefly
// reaches 1 it fires: its phase resets to 0 and it nudges the phase of each
// of its k=12 STATIC nearest neighbours forward by a fixed coupling strength
// epsilon. A nudged neighbour that itself crosses 1 fires immediately in the
// same tick, cascading — this is the whole mechanism. There is no target
// synchrony state written anywhere; unison, travelling bands and partial-sync
// clusters are all the same cascade rule evaluated on a random initial phase
// field, and they are what makes the field's very long-run arc (twinkle,
// then order, then a local relapse near a deaf firefly, then re-entrainment,
// forever) genuinely emergent rather than authored.
//
// COUPLING STRENGTH is the one governing scalar. epsilon = 0.03 is the
// widest value that still shows travelling bands: above ~0.08 the field
// snaps to full unison in a few seconds and the "order" act eats the whole
// clip; below ~0.02 it never locks within a normal page dwell and only ever
// twinkles. The neighbour graph is k=12 nearest by planar distance, computed
// ONCE at mount and never rebuilt — coupling only ever happens along that
// fixed graph, which is what makes synchrony a spatially local, propagating
// event (a travelling wave, a cluster negotiating a merge) instead of a
// global average snapping over instantly.
//
// DEAF FIREFLIES (2% of the population, a fixed random subset) are the
// honest source of relapse: they never RECEIVE a neighbour's nudge (their
// own phase only ever advances at their own natural rate), they run a
// slightly faster natural period than the rest of the field, and they still
// SEND a pulse to their own neighbours every time they fire. A deaf firefly
// therefore drifts out of whatever local consensus has formed around it and,
// on its own schedule, reaches back in and perturbs its neighbourhood — that
// perturbation is what pulls a locally synced patch apart and restarts local
// entrainment, differently every time, with no scripted reset anywhere.
//
// RENDER SPLIT is the whole performance story: 350 fixed-position DOM dots
// are pre-mounted once at --ns-muted and never move. JS owns exactly one
// number per firefly (phase) and, on a fire event, toggles which of two
// identical-effect CSS classes is present on that one dot — the 200ms
// opacity/scale/color flash envelope itself is a `@keyframes` animation that
// then runs entirely on the compositor. JS never touches opacity, transform
// or color directly; it only ever adds/removes a class name.
//
// ACCESSIBILITY / PHOTOSENSITIVITY: two hard visual caps live in the render
// path, independent of prefers-reduced-motion. (1) A per-firefly refractory
// period of ~910ms after each flash means no single dot can visually flash
// faster than ~1.1Hz, even mid-cascade. (2) A global burst gate: when a
// cascade's eligible-flash count exceeds a small fraction of the field (a
// "unison" event), the WHOLE burst is suppressed unless at least 900ms has
// passed since the last one — phase state still updates normally underneath,
// only the visual flash of that particular burst is skipped, so unison never
// reads as flicker faster than roughly once per 900ms. That is well under
// the three-per-second photosensitivity guideline even without reduced
// motion engaged. With prefers-reduced-motion: reduce, no rAF loop ever
// starts: the field renders once, statically, at its seeded resting phases,
// and one spatial cluster (a BFS walk over the same neighbour graph used for
// coupling) is marked at +10% opacity as the frozen stand-in for a
// synchrony band — the arc is described, not demonstrated, with nothing
// live.
//
// Distinct from loader-pendulum-sync: that component is a small mechanical
// loader whose handful of pendulums converge on an AUTHORED schedule (their
// CSS animation-durations are picked so the row is guaranteed to land back
// in phase every periodMs, by integer-oscillation arithmetic with zero
// per-frame JS) and stay converged once finished. FlashEntrain has no
// schedule and no finish: 350 independent phases pulse-couple over a static
// neighbour graph, synchrony is earned frame by frame, and a handful of deaf
// individuals mean it never stays settled — the story is chaos-to-order-to
// relapse, forever, not converge-and-stop.
// ---------------------------------------------------------------------------

const TICK_MS = 1000 / 30; // fixed 30Hz physics step
const REFRACTORY_MS = 910; // per-firefly visual cooldown -> caps flash rate just under 1.1Hz
const BURST_GAP_MS = 900; // global unison-burst gate
const DOT_MIN_PX = 3;
const DOT_MAX_PX = 5;
const BAND_OPACITY_BOOST = 0.1; // reduced-motion frozen band differential
// Every firefly's own uncoupled cadence stays comfortably below the 1.1Hz
// visual cap: refractory should only ever bind during a coupling-accelerated
// cascade, never as routine background muting of normal ticking.
const MIN_PERIOD_MS = REFRACTORY_MS + 60;
// Concavity of the Mirollo-Strogatz charge/rise function f(phase). This is
// what a naive "phase += epsilon on every nudge" coupling is missing: with a
// LINEAR phase, equal nudges never compress the gap between two out-of-phase
// fireflies, and a headless sweep of that naive version never rose above an
// order parameter of ~0.1 in 90s at any epsilon from 0.02-0.25 — it just
// never locks. With f concave (f(phase)=ln(1+(e^b-1)*phase)/b, b=3 here,
// verified by the same sweep), an equal charge-nudge buys a LARGER phase
// jump for a firefly that is further from firing than for one already close
// to it, which is exactly the absorption mechanism that drives real
// convergence — chaos visibly resolving into partial and then near-full
// synchrony over tens of seconds, continuously reopened by the deaf
// fireflies, at coupling=0.03 exactly as specified.
const CONCAVITY_B = 3;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CSS = `
.ns-fe-field{ position:relative; overflow:hidden; }
.ns-fe-dot{
  position:absolute;
  left:0; top:0;
  border-radius:9999px;
  background:var(--ns-muted);
  will-change:opacity,transform;
}
.ns-fe-flash-a, .ns-fe-flash-b{
  animation-duration:200ms;
  animation-timing-function:cubic-bezier(.22,.7,.32,1);
  animation-fill-mode:none;
}
.ns-fe-flash-a{ animation-name:ns-fe-flash-a; }
.ns-fe-flash-b{ animation-name:ns-fe-flash-b; }
@keyframes ns-fe-flash-a{
  0%{ opacity:var(--ns-fe-rest-o); transform:scale(1); background-color:var(--ns-muted); }
  18%{ opacity:1; transform:scale(1.9); background-color:var(--foreground); }
  100%{ opacity:var(--ns-fe-rest-o); transform:scale(1); background-color:var(--ns-muted); }
}
@keyframes ns-fe-flash-b{
  0%{ opacity:var(--ns-fe-rest-o); transform:scale(1); background-color:var(--ns-muted); }
  18%{ opacity:1; transform:scale(1.9); background-color:var(--foreground); }
  100%{ opacity:var(--ns-fe-rest-o); transform:scale(1); background-color:var(--ns-muted); }
}
@media (prefers-reduced-motion: reduce){
  .ns-fe-flash-a, .ns-fe-flash-b{ animation:none; }
}
`;

interface Firefly {
  xFrac: number;
  yFrac: number;
  sizePx: number;
  deaf: boolean;
}

export interface FlashEntrainProps {
  /** Population size. */
  count?: number;
  /** Mirollo-Strogatz coupling strength per firing (governing scalar). Above ~0.08 the field snaps to unison in seconds; below ~0.02 it never locks. */
  coupling?: number;
  /** Static nearest-neighbour graph size per firefly. */
  neighbors?: number;
  /** Fraction of the population that is deaf (never receives coupling), the source of relapse. */
  deafFraction?: number;
  /** Mean natural period, ms, before per-firefly jitter. */
  periodMs?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function FlashEntrain({
  count = 350,
  coupling = 0.03,
  neighbors = 12,
  deafFraction = 0.02,
  periodMs = 1250,
  className = "",
}: FlashEntrainProps) {
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

  const n = Math.max(24, Math.round(count));
  const k = Math.max(3, Math.min(n - 1, Math.round(neighbors)));

  // -- one seeded field: positions, sizes, deaf flags, neighbour graph -----
  // Deterministic per (n, k, deafFraction) so re-mounts (and the SSR pass)
  // agree with the client without needing to defer render.
  const fieldRef = useRef<{
    fireflies: Firefly[];
    neighborIdx: Int32Array;
    restOpacity: number;
    bandMembers: Uint8Array;
    n: number;
    k: number;
    deafFraction: number;
  } | null>(null);
  if (
    !fieldRef.current ||
    fieldRef.current.n !== n ||
    fieldRef.current.k !== k ||
    fieldRef.current.deafFraction !== deafFraction
  ) {
    const rand = mulberry32(0x5eed0001 ^ n ^ (k << 8));
    const fireflies: Firefly[] = Array.from({ length: n }, () => ({
      xFrac: rand(),
      yFrac: rand(),
      sizePx: DOT_MIN_PX + rand() * (DOT_MAX_PX - DOT_MIN_PX),
      deaf: false,
    }));
    // Floored at 1: the deaf minority is the only source of relapse in this
    // model (see header comment), so deafFraction=0 would silently produce a
    // field that locks into unison and then just sits there forever — a
    // floor of one keeps that story honest even at a tiny population.
    const deafCount = Math.max(1, Math.round(n * deafFraction));
    // pick a random subset deaf, without replacement
    const order = Array.from({ length: n }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = order[i]!;
      order[i] = order[j]!;
      order[j] = tmp;
    }
    for (let i = 0; i < deafCount; i++) fireflies[order[i]!]!.deaf = true;

    // k-NN by planar (fractional) distance, brute force — n is small (<=~700
    // in practice), computed once and never rebuilt.
    const neighborIdx = new Int32Array(n * k);
    const candIdx = new Int32Array(k);
    const candD2 = new Float32Array(k);
    for (let i = 0; i < n; i++) {
      let filled = 0;
      let worst = -1;
      let worstD2 = -Infinity;
      const xi = fireflies[i]!.xFrac;
      const yi = fireflies[i]!.yFrac;
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const dx = fireflies[j]!.xFrac - xi;
        const dy = fireflies[j]!.yFrac - yi;
        const d2 = dx * dx + dy * dy;
        if (filled < k) {
          candIdx[filled] = j;
          candD2[filled] = d2;
          if (d2 > worstD2) {
            worstD2 = d2;
            worst = filled;
          }
          filled++;
        } else if (d2 < worstD2) {
          candIdx[worst] = j;
          candD2[worst] = d2;
          worstD2 = -Infinity;
          for (let m = 0; m < k; m++) {
            const dm = candD2[m]!;
            if (dm > worstD2) {
              worstD2 = dm;
              worst = m;
            }
          }
        }
      }
      for (let m = 0; m < k; m++) neighborIdx[i * k + m] = candIdx[m] ?? i;
    }

    // Reduced-motion frozen band: BFS over the same neighbour graph from one
    // seeded anchor, collecting ~15% of the population as "already synced".
    const bandMembers = new Uint8Array(n);
    const bandTarget = Math.max(1, Math.round(n * 0.15));
    const anchor = Math.floor(rand() * n);
    const queue: number[] = [anchor];
    bandMembers[anchor] = 1;
    let bandCount = 1;
    let qi = 0;
    while (qi < queue.length && bandCount < bandTarget) {
      const cur = queue[qi++]!;
      for (let m = 0; m < k; m++) {
        const nb = neighborIdx[cur * k + m]!;
        if (bandMembers[nb]) continue;
        bandMembers[nb] = 1;
        bandCount++;
        queue.push(nb);
        if (bandCount >= bandTarget) break;
      }
    }

    fieldRef.current = {
      fireflies,
      neighborIdx,
      restOpacity: 0.55,
      bandMembers,
      n,
      k,
      deafFraction,
    };
  }
  const field = fieldRef.current;

  useEffect(() => {
    if (reduced) return; // static frame only, no loop, no listeners
    const root = rootRef.current;
    if (!root) return;

    const { fireflies, neighborIdx } = field;

    const phase = new Float32Array(n);
    const rate = new Float32Array(n); // phase units per ms
    const isDeaf = new Uint8Array(n);
    // Float64, not Float32: holds performance.now()-scale timestamps, which
    // lose the millisecond precision the refractory comparison needs once a
    // long-lived tab's clock runs past ~4.6 hours in a Float32.
    const nextFlashOkAt = new Float64Array(n);
    const flip = new Uint8Array(n); // alternates which flash class to use
    const firedThisTick = new Uint8Array(n);

    const rand = mulberry32(0x5eed0002 ^ n);
    for (let i = 0; i < n; i++) {
      const ff = fireflies[i]!;
      isDeaf[i] = ff.deaf ? 1 : 0;
      phase[i] = rand(); // start scattered, not synced
      const jitter = 0.85 + rand() * 0.3; // +-15% natural-period spread
      // deaf fireflies run ~14% faster; MIN_PERIOD_MS floors every period
      // (deaf or not) above the refractory so ordinary ticking never trips
      // the visual rate cap on its own — only a coupling cascade does.
      const period = Math.max(
        MIN_PERIOD_MS,
        ff.deaf ? periodMs * jitter * 0.86 : periodMs * jitter
      );
      rate[i] = TICK_MS / period;
    }

    const eps = coupling;
    const eb = Math.exp(CONCAVITY_B);
    // phase -> charge (concave) and charge -> phase (its inverse). A firing
    // pulse nudges a neighbour's CHARGE by epsilon, then the neighbour's
    // phase is recovered from that new charge — see CONCAVITY_B above.
    const toCharge = (p: number) => Math.log(1 + (eb - 1) * p) / CONCAVITY_B;
    const toPhase = (x: number) => (Math.exp(CONCAVITY_B * x) - 1) / (eb - 1);
    const fireQueue: number[] = [];
    const eligible: number[] = [];
    let lastBurstAt = -Infinity;
    const burstThreshold = Math.max(6, Math.round(n * 0.06));

    const applyFlash = (i: number, nowMs: number) => {
      nextFlashOkAt[i] = nowMs + REFRACTORY_MS;
      const el = elRefs.current[i];
      if (!el) return;
      el.classList.remove("ns-fe-flash-a", "ns-fe-flash-b");
      // Alternating between two classes with distinct animation-name values
      // (not the same class re-added) is what forces the keyframe to
      // restart: re-adding an identical animation-name is a no-op per spec
      // even after the previous run finished, no reflow trick needed.
      el.classList.add(flip[i] ? "ns-fe-flash-b" : "ns-fe-flash-a");
      flip[i] = flip[i] ? 0 : 1;
    };

    const tick = (nowMs: number) => {
      for (let i = 0; i < n; i++) phase[i] += rate[i]!;

      firedThisTick.fill(0);
      fireQueue.length = 0;
      eligible.length = 0;
      for (let i = 0; i < n; i++) {
        if (phase[i]! >= 1 && !firedThisTick[i]) {
          firedThisTick[i] = 1;
          fireQueue.push(i);
        }
      }

      let qi = 0;
      while (qi < fireQueue.length) {
        const i = fireQueue[qi++]!;
        phase[i] = 0;
        if (nowMs >= nextFlashOkAt[i]!) eligible.push(i);

        const base = i * k;
        for (let m = 0; m < k; m++) {
          const j = neighborIdx[base + m]!;
          if (isDeaf[j]) continue; // deaf: never receives coupling
          // Mirollo-Strogatz coupling proper: nudge the neighbour's CHARGE
          // (the concave transform of its phase) by epsilon, not its phase
          // directly — see CONCAVITY_B above for why that distinction is
          // what makes convergence actually happen.
          const chargeJ = toCharge(Math.min(1, phase[j]!)) + eps;
          if (chargeJ >= 1) {
            if (!firedThisTick[j]) {
              firedThisTick[j] = 1;
              fireQueue.push(j); // popped next: reset to 0, coupled onward
            }
          } else {
            phase[j] = toPhase(chargeJ);
          }
        }
      }

      if (eligible.length === 0) return;
      if (eligible.length > burstThreshold) {
        if (nowMs - lastBurstAt < BURST_GAP_MS) return; // gated: physics ran, visuals held back
        lastBurstAt = nowMs;
      }
      for (let e = 0; e < eligible.length; e++) applyFlash(eligible[e]!, nowMs);
    };

    let raf = 0;
    let lastFrame = 0;
    let acc = 0;

    const loop = (now: number) => {
      const dt = lastFrame ? Math.min(200, now - lastFrame) : TICK_MS;
      lastFrame = now;
      acc += dt;
      while (acc >= TICK_MS) {
        tick(now);
        acc -= TICK_MS;
      }
      raf = requestAnimationFrame(loop);
    };

    const onVisibility = () => {
      if (document.hidden) {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf) {
        lastFrame = 0;
        acc = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    raf = requestAnimationFrame(loop);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reduced, n, k, coupling, periodMs, field]);

  return (
    <div ref={rootRef} className={`ns-fe-field block h-full w-full ${className}`}>
      <style>{CSS}</style>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {field.fireflies.map((ff, i) => {
          const bandOpacity = reduced && field.bandMembers[i]
            ? field.restOpacity + BAND_OPACITY_BOOST
            : field.restOpacity;
          return (
            <div
              key={i}
              ref={(el) => {
                elRefs.current[i] = el;
              }}
              className="ns-fe-dot"
              style={{
                left: `${ff.xFrac * 100}%`,
                top: `${ff.yFrac * 100}%`,
                width: ff.sizePx,
                height: ff.sizePx,
                marginLeft: -ff.sizePx / 2,
                marginTop: -ff.sizePx / 2,
                opacity: bandOpacity,
                "--ns-fe-rest-o": field.restOpacity,
              } as CSSProperties}
            />
          );
        })}
      </div>
    </div>
  );
}
