"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// JamKickoutLoop — an ambient "background job with retries" status line,
// sourced from bulk-mail sortation conveyor jam handling: a photo-eye pair
// spanning the belt flags a mis-timed piece, a solenoid-driven diverter arm
// kicks that single piece off the main line onto a recirculation loop before
// it reaches the sort point, and the loop re-merges it one cycle later for
// another pass — the line never stops to clear it by hand.
//
// Geometry derives from the container's SMALLER dimension: loop depth =
// 0.3 * min(w,h); the main line and the loop's diverter/re-entry points
// scale off the container's full width. Every tile's position is a pure
// function of elapsed time since its own spawn (t=0 at the left edge),
// evaluated fresh each rAF tick and written straight to that tile's
// transform — nothing is animated with CSS transitions or React state.
//
// Timing (all fixed, none randomised):
//  - spawn: one tile every 900ms at the left edge.
//  - main line rate: reaches the diverter point (72% of track width) at
//    1.6s after spawn — this rate is held constant for the whole tile
//    lifetime, before and after the loop.
//  - kickout: exactly every 6th tile (a counter, never Math.random()) is
//    diverted. ~16.7% is a deliberate legibility amplification over the
//    real ~2-5% recirculation rate, documented, not a claim about real
//    jam frequency.
//  - diverter swing: 150ms, the tile visibly leaves the main line onto the
//    loop path (not a fade) as the arm swings out and re-seats.
//  - loop transit: 1.9s around the side loop, re-entering the main line at
//    a fixed point 18% of track width (behind the diverter) — a second
//    full attempt, not a respawn — then continuing to the right edge at
//    the same constant rate as any other tile.
//  - exit: both first-pass and recirculated tiles fade over 250ms on
//    reaching the right edge.
//
// Legibility: the one thing to follow is the diverter arm swinging a
// single tile off the line onto the loop and back — cadence is one
// kickout roughly every 5.4s (900ms * 6), well inside "watch it happen"
// pacing, and the swing is a visible mechanical gesture rather than an
// instant cut so the eye can track departure and arrival, not a blink.
// ---------------------------------------------------------------------------

const SPAWN_MS = 900;
const KICK_EVERY = 6; // 1-in-6 tiles diverted, fixed counter
const T_MAIN1 = 1600; // ms, left edge -> diverter point (72% of track)
const DIVERT_FRAC = 0.72;
const REENTRY_FRAC = 0.18;
const T_SWING = 150; // ms, diverter arm swing
const T_LOOP = 1900; // ms, loop transit
const T_FADE = 250; // ms, exit fade
const TILE_W = 13;
const TILE_H = 7;
const POOL_SIZE = 20; // headroom above max concurrently-alive tiles

interface Item {
  id: number;
  spawnTime: number;
  kicked: boolean;
}

interface Geometry {
  w: number;
  h: number;
  x0: number; // left edge (spawn x)
  trackW: number; // usable track width
  mainY: number;
  loopY: number; // bottom of the side loop
  dx: number; // diverter x (px)
  rx: number; // re-entry x (px)
  arcR: number; // loop corner radius, for path + tile keyframe match
  rate: number; // px/ms, constant main-line rate
  mainDurFull: number; // ms, non-kicked left edge -> right edge
  mainDur2: number; // ms, kicked re-entry -> right edge
}

function computeGeometry(w: number, h: number): Geometry {
  const loopY_depth = 0.3 * Math.min(w, h);
  const x0 = Math.min(10, w * 0.03);
  const trackW = Math.max(1, w - x0 * 2);
  const mainY = Math.max(18, Math.min(h - loopY_depth - 14, h * 0.42));
  const loopY = mainY + loopY_depth;
  const dx = x0 + DIVERT_FRAC * trackW;
  const rx = x0 + REENTRY_FRAC * trackW;
  const arcR = Math.max(4, Math.min(loopY_depth * 0.5, (dx - rx) * 0.22));
  const rate = (DIVERT_FRAC * trackW) / T_MAIN1;
  const mainDurFull = trackW / rate;
  const mainDur2 = (x0 + trackW - rx) / rate;
  return { w, h, x0, trackW, mainY, loopY, dx, rx, arcR, rate, mainDurFull, mainDur2 };
}

/** Loop-transit keyframe: swing-end point -> bottom-right corner ->
 * bottom-left corner -> re-entry point, matching the static loop <path>. */
function loopPosition(f: number, g: Geometry, swingEndX: number, swingEndY: number): { x: number; y: number } {
  const p0 = { x: swingEndX, y: swingEndY };
  const p1 = { x: g.dx - g.arcR, y: g.loopY };
  const p2 = { x: g.rx + g.arcR, y: g.loopY };
  const p3 = { x: g.rx, y: g.mainY };
  if (f < 0.2) {
    const t = f / 0.2;
    return { x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t };
  }
  if (f < 0.8) {
    const t = (f - 0.2) / 0.6;
    return { x: p1.x + (p2.x - p1.x) * t, y: p1.y };
  }
  const t = (f - 0.8) / 0.2;
  return { x: p2.x + (p3.x - p2.x) * t, y: p2.y + (p3.y - p2.y) * t };
}

interface Pose {
  x: number;
  y: number;
  opacity: number;
  alive: boolean;
  swingActive: boolean;
  swingFrac: number; // 0..1 while swingActive, for the arm
}

function poseAt(t: number, kicked: boolean, g: Geometry): Pose {
  if (!kicked) {
    if (t < g.mainDurFull) {
      return { x: g.x0 + g.rate * t, y: g.mainY, opacity: 1, alive: true, swingActive: false, swingFrac: 0 };
    }
    if (t < g.mainDurFull + T_FADE) {
      const f = (t - g.mainDurFull) / T_FADE;
      return { x: g.x0 + g.trackW, y: g.mainY, opacity: 1 - f, alive: true, swingActive: false, swingFrac: 0 };
    }
    return { x: 0, y: 0, opacity: 0, alive: false, swingActive: false, swingFrac: 0 };
  }

  if (t < T_MAIN1) {
    return { x: g.x0 + g.rate * t, y: g.mainY, opacity: 1, alive: true, swingActive: false, swingFrac: 0 };
  }
  const swingEndX = g.dx - g.arcR * 0.35;
  const swingEndY = g.mainY + (g.loopY - g.mainY) * 0.4;
  if (t < T_MAIN1 + T_SWING) {
    const f = (t - T_MAIN1) / T_SWING;
    return {
      x: g.dx + (swingEndX - g.dx) * f,
      y: g.mainY + (swingEndY - g.mainY) * f,
      opacity: 1,
      alive: true,
      swingActive: true,
      swingFrac: f,
    };
  }
  if (t < T_MAIN1 + T_SWING + T_LOOP) {
    const f = (t - T_MAIN1 - T_SWING) / T_LOOP;
    const p = loopPosition(f, g, swingEndX, swingEndY);
    return { x: p.x, y: p.y, opacity: 1, alive: true, swingActive: false, swingFrac: 0 };
  }
  const t3 = T_MAIN1 + T_SWING + T_LOOP;
  if (t < t3 + g.mainDur2) {
    const local = t - t3;
    return { x: g.rx + g.rate * local, y: g.mainY, opacity: 1, alive: true, swingActive: false, swingFrac: 0 };
  }
  if (t < t3 + g.mainDur2 + T_FADE) {
    const f = (t - t3 - g.mainDur2) / T_FADE;
    return { x: g.x0 + g.trackW, y: g.mainY, opacity: 1 - f, alive: true, swingActive: false, swingFrac: 0 };
  }
  return { x: 0, y: 0, opacity: 0, alive: false, swingActive: false, swingFrac: 0 };
}

function loopPathD(g: Geometry): string {
  return [
    `M${g.dx.toFixed(1)} ${g.mainY.toFixed(1)}`,
    `C ${g.dx.toFixed(1)} ${(g.mainY + (g.loopY - g.mainY) * 0.7).toFixed(1)}, ${g.dx.toFixed(1)} ${g.loopY.toFixed(1)}, ${(g.dx - g.arcR).toFixed(1)} ${g.loopY.toFixed(1)}`,
    `L ${(g.rx + g.arcR).toFixed(1)} ${g.loopY.toFixed(1)}`,
    `C ${g.rx.toFixed(1)} ${g.loopY.toFixed(1)}, ${g.rx.toFixed(1)} ${(g.mainY + (g.loopY - g.mainY) * 0.7).toFixed(1)}, ${g.rx.toFixed(1)} ${g.mainY.toFixed(1)}`,
  ].join(" ");
}

// Fixed reduced-motion freeze frame — named MID_KICKOUT: one tile mid
// diverter-swing (still partially over the main line, already angled onto
// the loop), one tile further along the loop, one ordinary tile mid main
// line — normal transit, the kickout event, and loop transit in one frame.
const FREEZE_SWING_T = T_MAIN1 + T_SWING * 0.5;
const FREEZE_LOOP_T = T_MAIN1 + T_SWING + T_LOOP * 0.72;
const FREEZE_MAIN_T = 800;

export interface JamKickoutLoopProps {
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function JamKickoutLoop({ className = "" }: JamKickoutLoopProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const lineRef = useRef<SVGLineElement>(null);
  const armRef = useRef<SVGLineElement>(null);
  const tileRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let disposed = false;
    let geo = computeGeometry(root.clientWidth || 1, root.clientHeight || 1);
    let visible = true;
    let raf = 0;
    let last = 0;
    let spawnAcc = 0;
    let spawnCounter = 0;
    let idSeq = 0;
    let items: Item[] = [];
    let armSwingStart = -Infinity;

    const applyGeometry = () => {
      pathRef.current?.setAttribute("d", loopPathD(geo));
      lineRef.current?.setAttribute("x1", String(geo.x0));
      lineRef.current?.setAttribute("x2", String(geo.x0 + geo.trackW));
      lineRef.current?.setAttribute("y1", String(geo.mainY));
      lineRef.current?.setAttribute("y2", String(geo.mainY));
      const armLen = Math.max(10, geo.arcR * 0.9);
      armRef.current?.setAttribute("x1", String(geo.dx));
      armRef.current?.setAttribute("y1", String(geo.mainY));
      armRef.current?.setAttribute("x2", String(geo.dx + armLen));
      armRef.current?.setAttribute("y2", String(geo.mainY));
    };

    const setTile = (el: HTMLDivElement | null, x: number, y: number, opacity: number) => {
      if (!el) return;
      el.style.transform = `translate3d(${(x - TILE_W / 2).toFixed(1)}px, ${(y - TILE_H / 2).toFixed(1)}px, 0)`;
      el.style.opacity = String(opacity);
    };

    const setArm = (angleDeg: number, emphasis: number) => {
      const el = armRef.current;
      if (!el) return;
      el.setAttribute("transform", `rotate(${angleDeg.toFixed(2)} ${geo.dx.toFixed(1)} ${geo.mainY.toFixed(1)})`);
      el.style.opacity = String(0.55 + 0.45 * emphasis);
    };

    const renderFrame = (now: number) => {
      let i = 0;
      for (; i < items.length && i < POOL_SIZE; i++) {
        const item = items[i];
        if (!item) continue;
        const pose = poseAt(now - item.spawnTime, item.kicked, geo);
        setTile(tileRefs.current[i] ?? null, pose.x, pose.y, pose.opacity);
        if (item.kicked && pose.swingActive) {
          armSwingStart = item.spawnTime + T_MAIN1;
        }
      }
      for (; i < POOL_SIZE; i++) setTile(tileRefs.current[i] ?? null, geo.x0, geo.mainY, 0);

      // Arm: swing out over T_SWING, ease back over the following ~250ms;
      // resting otherwise. Driven off the most recent kick's own timeline,
      // not a separate clock, so it always matches the tile that triggered it.
      const sinceSwing = now - armSwingStart;
      if (sinceSwing >= 0 && sinceSwing < T_SWING) {
        const f = sinceSwing / T_SWING;
        setArm(108 * f, f);
      } else if (sinceSwing >= T_SWING && sinceSwing < T_SWING + 260) {
        const f = 1 - (sinceSwing - T_SWING) / 260;
        setArm(108 * f, f);
      } else {
        setArm(0, 0);
      }
    };

    const loop = (now: number) => {
      raf = 0;
      if (!visible) return;
      if (last === 0) last = now;
      const dt = Math.min(100, now - last);
      last = now;

      spawnAcc += dt;
      while (spawnAcc >= SPAWN_MS) {
        spawnAcc -= SPAWN_MS;
        const kicked = spawnCounter % KICK_EVERY === KICK_EVERY - 1;
        spawnCounter += 1;
        items.push({ id: idSeq++, spawnTime: now - spawnAcc, kicked });
      }
      items = items.filter((it) => poseAt(now - it.spawnTime, it.kicked, geo).alive);

      renderFrame(now);
      raf = requestAnimationFrame(loop);
    };

    const seedResting = () => {
      // Populate a believable "already running" resting state instead of an
      // empty track on first paint: back-date a handful of spawn times.
      const now = performance.now();
      items = [];
      spawnCounter = 0;
      const seedSpawns = [-5100, -4200, -3300, -2400, -1500, -600];
      for (const offset of seedSpawns) {
        const kicked = spawnCounter % KICK_EVERY === KICK_EVERY - 1;
        spawnCounter += 1;
        items.push({ id: idSeq++, spawnTime: now + offset, kicked });
      }
      items = items.filter((it) => poseAt(now - it.spawnTime, it.kicked, geo).alive);
      spawnAcc = 600; // next spawn due in 300ms, matching the 900ms cadence
      renderFrame(now);
    };

    const renderFreezeFrame = () => {
      applyGeometry();
      const swing = poseAt(FREEZE_SWING_T, true, geo);
      const loopTile = poseAt(FREEZE_LOOP_T, true, geo);
      const mainTile = poseAt(FREEZE_MAIN_T, false, geo);
      setTile(tileRefs.current[0] ?? null, swing.x, swing.y, 1);
      setTile(tileRefs.current[1] ?? null, loopTile.x, loopTile.y, 1);
      setTile(tileRefs.current[2] ?? null, mainTile.x, mainTile.y, 1);
      for (let i = 3; i < POOL_SIZE; i++) setTile(tileRefs.current[i] ?? null, geo.x0, geo.mainY, 0);
      setArm(108 * swing.swingFrac, swing.swingFrac);
    };

    const start = () => {
      applyGeometry();
      if (reduced) {
        renderFreezeFrame();
        return;
      }
      seedResting();
      last = 0;
      if (!raf) raf = requestAnimationFrame(loop);
    };

    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (disposed || !root) return;
        geo = computeGeometry(root.clientWidth || 1, root.clientHeight || 1);
        applyGeometry();
        if (reduced) renderFreezeFrame();
      }, 100);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(root);

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && !reduced && !raf) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    });
    io.observe(root);

    start();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      window.clearTimeout(resizeTimer);
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={`relative isolate overflow-hidden bg-background ${className}`}
    >
      <svg aria-hidden="true" focusable="false" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
        <line ref={lineRef} stroke="var(--border)" strokeWidth={1} />
        <path ref={pathRef} fill="none" stroke="var(--border)" strokeWidth={1} />
        <line
          ref={armRef}
          stroke="var(--ns-muted)"
          strokeWidth={2}
          strokeLinecap="round"
          style={{ transition: "opacity 150ms ease-out" }}
        />
      </svg>
      <div className="pointer-events-none absolute inset-0">
        {Array.from({ length: POOL_SIZE }).map((_, i) => (
          <div
            key={i}
            ref={(el) => {
              tileRefs.current[i] = el;
            }}
            className="absolute left-0 top-0 rounded-[1px] bg-foreground"
            style={{ width: TILE_W, height: TILE_H, opacity: 0, willChange: "transform" }}
          />
        ))}
      </div>
    </div>
  );
}
