"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// SinkholeRavel — a destructive-action confirm modeled on cover-collapse
// sinkhole formation in karst terrain: groundwater dissolves a void in the
// bedrock, and the granular cover above it doesn't just sit there — grains at
// the void's ceiling continuously RAVEL (individually lose support and fall
// into the cavity, a real geotechnical term), so the void migrates upward
// through the overburden one grain-layer at a time as a narrow "stoping"
// chimney. This can run a long time with no surface expression. Once the
// chimney gets close enough to the surface, the remaining crust can no
// longer arch-bridge its own weight and drops in one sudden collapse,
// leaving a crater whose loose rim material immediately starts sliding back
// in to partially backfill it — never fully, so the scar is visible going
// into the next cycle, which renucleates at a new lateral position.
//
// A canvas cross-section renders a lattice of grains packed into rows
// (count derived from the container's smaller dimension). A single scalar
// void height (0 = void only at the bedrock line, 1 = void has reached the
// surface crust) tracks how far the chimney has migrated. Grains fall out of
// the lattice individually, each on its own randomized per-250ms trigger
// once it enters the ravel band (void height +/- one grain-row) — never in a
// body-wide sweep — so the ravel front reads as organic, independently-timed
// grain loss rather than a wipe. Crossing 0.94 fires the one big legible
// event per cycle: the remaining crust drops as a fast 220ms collapse, then
// loose rim grains slide back in along a 34deg angle-of-repose slope for
// 3.5s, refilling to ~55% before the chimney renucleates at a new x.
//
// The confirm control is click-arm-then-confirm: arming visibly accelerates
// the ambient ravel rate (teasing an early collapse, fully reversible — a
// second click within the window, Escape, or blur before that resolves
// nothing), a second click inside the window forces the collapse
// immediately regardless of where the ambient cycle sits and fires
// onConfirm once, exactly as the crater finishes dropping.
//
// Every colour is read from the theme via getComputedStyle on
// document.documentElement, re-read on a MutationObserver watching its
// class, and nothing paints before that first read. --ns-accent never
// touches the grains/void/collapse — it is the confirm button's own chrome.
// ---------------------------------------------------------------------------

type Phase = "ravel" | "collapsing" | "backfilling" | "waiting";

interface Grain {
  x: number;
  y: number;
  r: number;
  rowFrac: number; // 0 = bedrock (bottom), 1 = surface (top)
  state: "alive" | "falling" | "gone";
  fallStart: number;
  fallDur: number;
  fallDist: number;
}

const RAVEL_RATE = 0.09; // void-height fraction / s, ambient
const RAVEL_JITTER = 0.15; // +/-15% amplitude
const RAVEL_JITTER_MS = 400;
const RAVEL_TICK_MS = 250;
const RAVEL_CHANCE = 1 / 6; // per eligible grain, per tick
const FALL_DUR_MS = 180;
const COLLAPSE_THRESHOLD = 0.94;
const COLLAPSE_CRUST_FRAC = 0.06; // top 6% of overburden height
const COLLAPSE_DUR_MS = 220;
const BACKFILL_DUR_MS = 3500;
const BACKFILL_GRAIN_MS = 140;
const BACKFILL_FILL_FRAC = 0.55;
const BACKFILL_SLOPE_DEG = 34;
const RENUCLEATE_DELAY_MS = 900;
const ARM_WINDOW_MS = 3200;
const ARM_RATE_MULT = 3.5;
const ARM_EASE_PER_S = 3.4; // how fast the accel/de-accel ramps

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

function buildGrains(
  w: number,
  h: number,
  minDim: number,
  rand: () => number
): { grains: Grain[]; rows: number; avgR: number } {
  const maxGrains = Math.min(2400, Math.max(1800, Math.round((minDim * minDim) / 340)));
  const cell = Math.sqrt((w * h) / maxGrains);
  const cols = Math.max(4, Math.round(w / cell));
  const rows = Math.max(4, Math.round(h / cell));
  const cw = w / cols;
  const ch = h / rows;
  const grains: Grain[] = [];
  let rSum = 0;
  for (let row = 0; row < rows; row++) {
    const rowFrac = rows > 1 ? (rows - 1 - row) / (rows - 1) : 1;
    for (let col = 0; col < cols; col++) {
      const x = (col + 0.5) * cw + (rand() - 0.5) * 0.7 * cw;
      const y = (row + 0.5) * ch + (rand() - 0.5) * 0.7 * ch;
      const r = Math.min(cw, ch) * 0.32 * (0.85 + 0.3 * rand());
      rSum += r;
      grains.push({ x, y, r, rowFrac, state: "alive", fallStart: 0, fallDur: 0, fallDist: 0 });
    }
  }
  return { grains, rows, avgR: rSum / Math.max(1, grains.length) };
}

export interface SinkholeRavelProps {
  /** idle button label */
  children?: string;
  /** label shown once armed, awaiting the confirming click */
  armedLabel?: string;
  /** ms the armed window stays open before it auto de-arms */
  armWindowMs?: number;
  /** fired once, exactly as the forced crater finishes dropping */
  onConfirm?: () => void;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function SinkholeRavel({
  children = "Trigger collapse",
  armedLabel = "Confirm collapse",
  armWindowMs = ARM_WINDOW_MS,
  onConfirm,
  className = "",
}: SinkholeRavelProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [armed, setArmed] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;
  const armWindowRef = useRef(armWindowMs);
  armWindowRef.current = armWindowMs;

  const s = useRef({
    grains: [] as Grain[],
    rows: 1,
    avgR: 2,
    w: 0,
    h: 0,
    dpr: 1,
    chimneyBase: 0,
    chimneyX: 0,
    voidFrac: 0,
    phase: "ravel" as Phase,
    jitterMult: 1,
    lastJitterAt: 0,
    raveAcc: 0,
    collapseStart: 0,
    backfillStart: 0,
    backfillAcc: 0,
    backfillSpawned: 0,
    backfillTarget: 0,
    waitStart: 0,
    armed: false,
    armEase: 0,
    armTimer: 0,
    seedCounter: 1,
    rand: mulberry32(0x5117e0),
    reduced: false,
    visible: true,
    raf: 0,
    last: 0,
    mountedAt: 0,
    tokens: { foreground: "", muted: "", background: "" },
  });

  useEffect(() => {
    const st = s.current;
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    st.mountedAt = performance.now();
    st.rand = mulberry32(0xa11ce5ee);

    const syncTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      st.tokens.foreground = cs.getPropertyValue("--foreground").trim();
      st.tokens.muted = cs.getPropertyValue("--ns-muted").trim();
      st.tokens.background = cs.getPropertyValue("--background").trim();
      draw(performance.now());
    };

    const radiusAt = (rowFrac: number) => st.chimneyBase * (0.6 + 0.4 * rowFrac);
    const inChimney = (g: Grain) => Math.abs(g.x - st.chimneyX) < radiusAt(g.rowFrac);

    const triggerFall = (g: Grain, now: number, dur: number, extraDelay: number) => {
      g.state = "falling";
      g.fallStart = now + extraDelay;
      g.fallDur = dur;
      g.fallDist = g.r * (2.4 + st.rand() * 2.2);
    };

    // -- one 250ms tick: any alive grain in the chimney whose row sits within
    // one grain-row of the current void front rolls an independent 1-in-6
    // chance to ravel early; anything the front has already passed by more
    // than a few rows is force-removed as a safety net so nothing is left
    // floating mid-void. --------------------------------------------------
    const raveTick = (now: number) => {
      const bandHalf = 1 / st.rows;
      for (const g of st.grains) {
        if (g.state !== "alive" || !inChimney(g)) continue;
        const ahead = g.rowFrac - st.voidFrac; // + = not yet engulfed
        if (ahead < -3 * bandHalf) {
          triggerFall(g, now, FALL_DUR_MS, 0);
        } else if (ahead <= bandHalf) {
          if (st.rand() < RAVEL_CHANCE) triggerFall(g, now, FALL_DUR_MS, 0);
        }
      }
    };

    const beginCollapse = (now: number, forced: boolean) => {
      st.phase = "collapsing";
      st.collapseStart = now;
      st.voidFrac = 1;
      const crustFloor = forced ? 0 : 1 - COLLAPSE_CRUST_FRAC;
      for (const g of st.grains) {
        if (g.state === "alive" && inChimney(g) && g.rowFrac >= crustFloor) {
          triggerFall(g, now, COLLAPSE_DUR_MS, st.rand() * 40);
        }
      }
      if (forced) {
        setAnnouncement("Collapsing.");
      }
      (st as unknown as { pendingConfirm: boolean }).pendingConfirm = forced;
    };

    const beginBackfill = (now: number) => {
      st.phase = "backfilling";
      st.backfillStart = now;
      st.backfillAcc = 0;
      st.backfillSpawned = 0;
      st.backfillTarget = Math.round(BACKFILL_DUR_MS / BACKFILL_GRAIN_MS);
      if ((st as unknown as { pendingConfirm: boolean }).pendingConfirm) {
        (st as unknown as { pendingConfirm: boolean }).pendingConfirm = false;
        onConfirmRef.current?.();
      }
    };

    const spawnBackfillGrain = (now: number) => {
      const rimRadius = st.chimneyBase * (0.6 + 0.4 * 1) * 1.25;
      const rowFrac = st.rand() * BACKFILL_FILL_FRAC;
      const spanFrac = 0.55 + 0.4 * st.rand();
      const x = st.chimneyX + (st.rand() - 0.5) * 2 * rimRadius * spanFrac;
      const y = st.h - rowFrac * st.h;
      const r = st.avgR * (0.85 + 0.3 * st.rand());
      st.grains.push({
        x,
        y,
        r,
        rowFrac,
        state: "falling",
        fallStart: now,
        fallDur: 260 + st.rand() * 120,
        fallDist: -st.avgR * 1.6, // slides IN (fades up from below-alpha) rather than out
      });
      // the "fall" here is used in reverse as an arrival tween — patched below
    };

    const renucleate = (now: number) => {
      const w = st.w;
      const prevX = st.chimneyX;
      let nx = prevX;
      let guard = 0;
      while (Math.abs(nx - prevX) < w * 0.22 && guard < 12) {
        nx = w * (0.18 + st.rand() * 0.64);
        guard++;
      }
      st.chimneyX = nx;
      st.voidFrac = 0;
      st.phase = "ravel";
      st.raveAcc = 0;
    };

    // -- draw ---------------------------------------------------------------
    const draw = (now: number) => {
      const { w, h, dpr } = st;
      if (!w || !h) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const bandHalf = 1 / st.rows;

      for (const g of st.grains) {
        if (g.state === "gone") continue;
        let alpha = 0.55;
        let gy = g.y;
        if (g.state === "falling") {
          const t = Math.max(0, Math.min(1, (now - g.fallStart) / g.fallDur));
          if (now < g.fallStart) continue;
          if (g.fallDist < 0) {
            // backfill arrival: fades/slides in rather than out
            alpha = 0.55 * t;
            gy = g.y - g.fallDist * (1 - t);
          } else {
            const ease = t * t;
            alpha = 0.55 * (1 - t);
            gy = g.y + g.fallDist * ease;
          }
          if (t >= 1) {
            if (g.fallDist < 0) {
              g.state = "alive";
              gy = g.y;
              alpha = 0.55;
            } else {
              g.state = "gone";
              continue;
            }
          }
        } else {
          const ahead = g.rowFrac - st.voidFrac;
          if (st.phase === "ravel" && ahead >= -bandHalf && ahead <= bandHalf && Math.abs(g.x - st.chimneyX) < radiusAt(g.rowFrac) + g.r * 3) {
            const glowT = 0.5 + 0.5 * Math.sin((now - st.mountedAt) / 180 + g.x * 0.05);
            ctx.globalAlpha = 0.14 + 0.14 * glowT;
            ctx.fillStyle = st.tokens.muted;
            ctx.beginPath();
            ctx.arc(g.x, gy, g.r * 2.1, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.globalAlpha = alpha;
        ctx.fillStyle = st.tokens.foreground;
        ctx.beginPath();
        ctx.arc(g.x, gy, g.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    // -- main loop ------------------------------------------------------
    const tick = (now: number) => {
      if (!st.visible) {
        st.raf = 0;
        return;
      }
      const dt = Math.min(0.064, st.last ? (now - st.last) / 1000 : 0);
      st.last = now;

      if (now - st.lastJitterAt >= RAVEL_JITTER_MS) {
        st.lastJitterAt = now;
        st.jitterMult = 1 + (st.rand() * 2 - 1) * RAVEL_JITTER;
      }

      const armTarget = st.armed ? 1 : 0;
      st.armEase += (armTarget - st.armEase) * Math.min(1, ARM_EASE_PER_S * dt);

      if (st.phase === "ravel") {
        const rate = RAVEL_RATE * st.jitterMult * (1 + st.armEase * (ARM_RATE_MULT - 1));
        st.voidFrac = Math.min(1, st.voidFrac + rate * dt);
        st.raveAcc += dt * 1000;
        while (st.raveAcc >= RAVEL_TICK_MS) {
          st.raveAcc -= RAVEL_TICK_MS;
          raveTick(now);
        }
        if (st.voidFrac >= COLLAPSE_THRESHOLD) beginCollapse(now, false);
      } else if (st.phase === "collapsing") {
        if (now - st.collapseStart >= COLLAPSE_DUR_MS + 60) beginBackfill(now);
      } else if (st.phase === "backfilling") {
        st.backfillAcc += dt * 1000;
        while (st.backfillAcc >= BACKFILL_GRAIN_MS && st.backfillSpawned < st.backfillTarget) {
          st.backfillAcc -= BACKFILL_GRAIN_MS;
          st.backfillSpawned += 1;
          spawnBackfillGrain(now);
        }
        if (now - st.backfillStart >= BACKFILL_DUR_MS) {
          st.phase = "waiting";
          st.waitStart = now;
        }
      } else if (st.phase === "waiting") {
        if (now - st.waitStart >= RENUCLEATE_DELAY_MS) renucleate(now);
      }

      draw(now);
      st.raf = requestAnimationFrame(tick);
    };

    const wake = () => {
      if (st.raf || !st.visible || st.reduced) return;
      st.last = 0;
      st.raf = requestAnimationFrame(tick);
    };

    // -- reduced motion: run the sim forward deterministically to exactly
    // the post-collapse, pre-backfill instant (crater fully open, walls
    // sharp) and render once — the single most structured frame. ---------
    const runReducedToFreeze = () => {
      const stepMs = 16;
      let now = st.mountedAt;
      let safety = 0;
      while (st.phase !== "collapsing" && safety < 4000) {
        now += stepMs;
        const dt = stepMs / 1000;
        st.voidFrac = Math.min(1, st.voidFrac + RAVEL_RATE * dt);
        st.raveAcc += stepMs;
        while (st.raveAcc >= RAVEL_TICK_MS) {
          st.raveAcc -= RAVEL_TICK_MS;
          raveTick(now);
        }
        if (st.voidFrac >= COLLAPSE_THRESHOLD) beginCollapse(now, false);
        safety++;
      }
      // land every triggered fall exactly at its finished state
      for (const g of st.grains) {
        if (g.state === "falling") g.state = "gone";
      }
      draw(now + COLLAPSE_DUR_MS + 10);
    };

    const startField = () => {
      const rect = root.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      if (w < 2 || h < 2) return;
      st.dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(w * st.dpr));
      canvas.height = Math.max(1, Math.round(h * st.dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      st.w = w;
      st.h = h;
      const minDim = Math.min(w, h);
      const rand = mulberry32(0x9e3779 ^ st.seedCounter);
      st.seedCounter += 1;
      const built = buildGrains(w, h, minDim, rand);
      st.grains = built.grains;
      st.rows = built.rows;
      st.avgR = built.avgR;
      st.chimneyBase = minDim * 0.17;
      st.chimneyX = w * (0.32 + rand() * 0.36);
      st.voidFrac = 0;
      st.phase = "ravel";
      st.raveAcc = 0;
      st.lastJitterAt = 0;
      st.jitterMult = 1;

      cancelAnimationFrame(st.raf);
      st.raf = 0;
      st.last = 0;

      if (st.reduced) {
        runReducedToFreeze();
        return;
      }
      draw(performance.now());
      wake();
    };

    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(startField, 100);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(root);

    const io = new IntersectionObserver(([entry]) => {
      st.visible = entry?.isIntersecting ?? true;
      if (st.visible) wake();
      else if (st.raf) {
        cancelAnimationFrame(st.raf);
        st.raf = 0;
      }
    });
    io.observe(root);

    const onVisChange = () => {
      if (document.hidden) {
        if (st.raf) {
          cancelAnimationFrame(st.raf);
          st.raf = 0;
        }
      } else {
        wake();
      }
    };
    document.addEventListener("visibilitychange", onVisChange);

    const mo = new MutationObserver(syncTokens);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMq = () => {
      st.reduced = mq.matches;
      if (st.raf) {
        cancelAnimationFrame(st.raf);
        st.raf = 0;
      }
      startField();
    };
    st.reduced = mq.matches;
    mq.addEventListener("change", onMq);

    syncTokens();
    startField();

    // -- confirm arm/commit — click driven, keyboard-equivalent via Enter/
    // Space on the button, Escape and blur both de-arm. --------------------
    const deArm = () => {
      if (!st.armed) return;
      st.armed = false;
      setArmed(false);
      setAnnouncement("");
      window.clearTimeout(st.armTimer);
    };

    const handleActivate = () => {
      if (st.phase !== "ravel") return;
      if (!st.armed) {
        st.armed = true;
        setArmed(true);
        setAnnouncement("Armed. Confirm to collapse.");
        window.clearTimeout(st.armTimer);
        st.armTimer = window.setTimeout(deArm, armWindowRef.current);
      } else {
        window.clearTimeout(st.armTimer);
        st.armed = false;
        setArmed(false);
        beginCollapse(performance.now(), true);
        wake();
      }
    };

    const btn = root.querySelector<HTMLButtonElement>("[data-sinkhole-confirm]");
    const onClick = () => handleActivate();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && st.armed) deArm();
    };
    const onBlur = () => deArm();
    btn?.addEventListener("click", onClick);
    btn?.addEventListener("keydown", onKeyDown);
    btn?.addEventListener("blur", onBlur);

    return () => {
      cancelAnimationFrame(st.raf);
      st.raf = 0;
      window.clearTimeout(resizeTimer);
      window.clearTimeout(st.armTimer);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVisChange);
      mq.removeEventListener("change", onMq);
      btn?.removeEventListener("click", onClick);
      btn?.removeEventListener("keydown", onKeyDown);
      btn?.removeEventListener("blur", onBlur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={rootRef}
      className={["ns-skr relative overflow-hidden rounded-[12px] border border-border bg-background", className].join(" ")}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none block h-full w-full" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-end p-3">
        <button
          type="button"
          data-sinkhole-confirm
          data-armed={armed}
          className="ns-skr-btn pointer-events-auto"
        >
          {armed ? armedLabel : children}
        </button>
      </div>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.ns-skr-btn{display:inline-flex;height:30px;align-items:center;justify-content:center;border-radius:6px;padding:0 12px;border:1px solid var(--border);background:var(--background);color:var(--ns-muted);font-family:var(--font-geist-mono,ui-monospace,monospace);font-size:11px;letter-spacing:0.02em;transition:background-color 150ms ease-out,color 150ms ease-out,border-color 150ms ease-out}
.ns-skr-btn:hover{color:var(--foreground);border-color:var(--foreground)}
.ns-skr-btn:focus-visible{outline:2px solid var(--ns-accent);outline-offset:2px}
.ns-skr-btn[data-armed="true"]{color:var(--ns-accent);border-color:var(--ns-accent)}
@media (prefers-reduced-motion: reduce){
  .ns-skr-btn{transition:none}
}
`;

export default SinkholeRavel;
