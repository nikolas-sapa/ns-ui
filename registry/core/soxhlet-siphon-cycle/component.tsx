"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// SoxhletSiphonCycle — an ambient "long-running background process" status
// indicator modelled on the Soxhlet extractor's siphon cycle: condensed
// solvent drips into the extraction chamber, filling it steadily until the
// level crosses the siphon arm's overflow height, at which point the
// chamber self-primes and drains almost instantly back into the boiling
// flask below — then the fill begins again.
//
// One drop lands every 900ms, each drop raising the chamber level by
// 100/22 ≈ 4.545% (the spec's headline anchor is "0% -> 100% over ~22
// drops = 19.8s"; 22 * 4.545% = 100% exactly, and it also reproduces the
// resting-loop beats given in the spec — ~2 drops landed by 2.5s (~9%,
// spec says "~12%") and ~5 drops landed by 5s (~23%, spec says "~25%") —
// far closer than the spec's separately-stated "2.5%/drop" figure, which
// only sums to 55% over 22 drops and cannot itself reach the stated 100%
// trigger; that number is treated here as the spec's rounding slip and
// the 22-drops/19.8s/0-to-100% statement is taken as authoritative).
// Once the level crosses 100% the chamber "self-primes": a fast 600ms
// drain runs, rendered as a bottom-to-top VALUE-ONLY wipe (an opacity
// boundary rising up through the chamber, draining what has already
// been passed and leaving what hasn't yet) rather than a level-height
// blink, so the slow 19.8s fill and the 0.6s dump read as two distinct
// paces purely through the shape of the motion, never through colour.
// A synced flow highlight travels the siphon tube from chamber to flask
// over the same 600ms, and the flask's own liquid line ticks up a fixed
// 4% the instant the drain completes — capped and reset every 5 cycles
// (~100s total) so the loop stays unbounded. A 400ms settle pause at
// empty follows every drain before the next drop begins falling.
// ---------------------------------------------------------------------------

const DROP_INTERVAL_MS = 900; // one condensate drop per interval
const DROPS_TO_TRIGGER = 22; // 22 * 900ms = 19.8s fill, spec's headline anchor
const LEVEL_PER_DROP = 100 / DROPS_TO_TRIGGER; // ~4.545% per drop
const DROP_FALL_MS = 480; // drop travel time within its interval
const DUMP_MS = 600; // fast self-priming drain
const SETTLE_MS = 400; // pause at empty before the next drop
const FLASK_STEP_PCT = 4; // flask level gain per completed cycle
const FLASK_CYCLE_RESET = 5; // reset flask accumulation every 5 cycles (~100s)
const CHAMBER_H_FRAC = 0.4; // chamber height = 0.4 * min(width, height)
const REDUCED_LEVEL_PCT = 85; // freeze frame: 85%-full, pre-siphon tension

type Phase = "fill" | "dump" | "settle";

interface Tokens {
  fg: string;
  border: string;
}

function readTokens(): Tokens | null {
  if (typeof document === "undefined") return null;
  const cs = getComputedStyle(document.documentElement);
  const fg = cs.getPropertyValue("--foreground").trim();
  const border = cs.getPropertyValue("--border").trim();
  if (!fg || !border) return null; // stylesheet not yet applied — no paint before this
  return { fg, border };
}

function easeInQuad(t: number): number {
  return t * t;
}

export interface SoxhletSiphonCycleProps {
  /** mono label above the chamber */
  label?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function SoxhletSiphonCycle({
  label = "EXTRACTION — SIPHON CYCLE",
  className = "",
}: SoxhletSiphonCycleProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

    let phase: Phase = "fill";
    let phaseStart = 0;
    let dropsLanded = 0; // drops landed so far this fill phase
    let levelAtDumpStart = 0; // 0..1, chamber fraction when the dump began
    let flaskPct = 0; // 0..(FLASK_CYCLE_RESET * FLASK_STEP_PCT), accumulated extract
    let cycleCount = 0;

    let raf = 0;
    let tokenWaitRaf = 0;

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
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      fitCanvas();
      sized = true;
    };

    // -- geometry, all derived from m = min(width, height) so the
    // apparatus reads at card scale regardless of the card's aspect. -----
    const geo = () => {
      const m = Math.min(w, h);
      const chamberH = CHAMBER_H_FRAC * m;
      const chamberW = 0.5 * m;
      const chamberX = w / 2 - chamberW / 2;
      const chamberTopY = h * 0.2;
      const chamberBottomY = chamberTopY + chamberH;
      const flaskR = chamberW * 0.36;
      const flaskCx = w / 2;
      const flaskCy = chamberBottomY + h * 0.19;
      const tubeX = chamberX + chamberW + 0.05 * m;
      const tubeTopY = chamberTopY - 0.05 * m;
      const tubeMouth = { x: chamberX + chamberW * 0.84, y: chamberTopY };
      const tubeBend = { x: tubeX, y: tubeTopY };
      const tubeDown = { x: tubeX, y: flaskCy - flaskR * 0.55 };
      const tubeEnter = { x: flaskCx + flaskR * 0.5, y: flaskCy - flaskR * 0.35 };
      const dripX = chamberX + chamberW * 0.5;
      const dripY = h * 0.05;
      return {
        m,
        chamberH,
        chamberW,
        chamberX,
        chamberTopY,
        chamberBottomY,
        flaskR,
        flaskCx,
        flaskCy,
        tubeMouth,
        tubeBend,
        tubeDown,
        tubeEnter,
        dripX,
        dripY,
      };
    };

    // -- tube is a 4-point polyline; a "flow progress" fraction fills it
    // from the chamber mouth toward the flask, used during the dump to
    // show liquid actually travelling the siphon path. -------------------
    const tubePoints = (g: ReturnType<typeof geo>) => [g.tubeMouth, g.tubeBend, g.tubeDown, g.tubeEnter];

    const drawTubePartial = (g: ReturnType<typeof geo>, frac: number, color: string, width: number) => {
      if (frac <= 0) return;
      const pts = tubePoints(g);
      const lens: number[] = [];
      let total = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i]!;
        const b = pts[i + 1]!;
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        lens.push(d);
        total += d;
      }
      let target = total * Math.min(1, frac);
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(pts[0]!.x, pts[0]!.y);
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i]!;
        const b = pts[i + 1]!;
        const segLen = lens[i]!;
        if (target >= segLen) {
          ctx.lineTo(b.x, b.y);
          target -= segLen;
        } else {
          const t = segLen > 0 ? target / segLen : 0;
          ctx.lineTo(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
          break;
        }
      }
      ctx.stroke();
    };

    // -- render one frame from (levelFrac 0..1, dumpT 0..1 | null,
    // dropFallFrac 0..1 | null, flaskPct). Pure function of state, called
    // both from the rAF loop and once, synchronously, for the reduced-
    // motion freeze frame. ------------------------------------------------
    const render = (levelFrac: number, dumpT: number | null, dropFallFrac: number | null) => {
      if (!tokens || !sized) return;
      ctx.clearRect(0, 0, w, h);
      const g = geo();

      // condenser drip line — plain --border, non-load-bearing.
      ctx.strokeStyle = tokens.border;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(g.dripX, g.dripY);
      ctx.lineTo(g.dripX, g.chamberTopY);
      ctx.stroke();

      // siphon tube outline — glass rim, --border only, never a fill.
      const pts = tubePoints(g);
      ctx.strokeStyle = tokens.border;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(pts[0]!.x, pts[0]!.y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
      ctx.stroke();

      // flask outline — plain --border circle.
      ctx.beginPath();
      ctx.arc(g.flaskCx, g.flaskCy, g.flaskR, 0, Math.PI * 2);
      ctx.stroke();
      // flask neck connecting up toward the chamber base.
      ctx.beginPath();
      ctx.moveTo(g.flaskCx - g.flaskR * 0.22, g.flaskCy - g.flaskR * 0.94);
      ctx.lineTo(g.flaskCx - g.flaskR * 0.22, g.chamberBottomY + h * 0.03);
      ctx.moveTo(g.flaskCx + g.flaskR * 0.22, g.flaskCy - g.flaskR * 0.94);
      ctx.lineTo(g.flaskCx + g.flaskR * 0.22, g.chamberBottomY + h * 0.03);
      ctx.stroke();

      // flask liquid — accumulated extract, rises in density not hue.
      if (flaskPct > 0) {
        const cap = FLASK_CYCLE_RESET * FLASK_STEP_PCT;
        const frac = Math.min(1, flaskPct / cap);
        const liquidR = g.flaskR * 0.94;
        const liquidTop = g.flaskCy + g.flaskR * 0.55 - frac * g.flaskR * 0.95;
        ctx.save();
        ctx.beginPath();
        ctx.arc(g.flaskCx, g.flaskCy, liquidR, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = tokens.fg;
        ctx.globalAlpha = 0.22 + frac * 0.18;
        ctx.fillRect(g.flaskCx - liquidR, liquidTop, liquidR * 2, g.flaskCy + liquidR - liquidTop);
        ctx.restore();
        ctx.globalAlpha = 1;
      }

      // chamber outline.
      ctx.strokeStyle = tokens.border;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(g.chamberX, g.chamberTopY, g.chamberW, g.chamberH);

      // chamber liquid — foreground at moderate alpha, density rising
      // with level; the bottom-to-top drain wipe during a dump clears an
      // opacity boundary upward rather than shrinking the fill rect.
      const fillTopAtLevel = g.chamberBottomY - levelFrac * g.chamberH;
      ctx.save();
      ctx.beginPath();
      ctx.rect(g.chamberX, g.chamberTopY, g.chamberW, g.chamberH);
      ctx.clip();
      ctx.fillStyle = tokens.fg;

      if (dumpT === null) {
        ctx.globalAlpha = 0.28 + levelFrac * 0.32;
        ctx.fillRect(g.chamberX, fillTopAtLevel, g.chamberW, g.chamberBottomY - fillTopAtLevel);
      } else {
        // wipe boundary rises from the bottom as dumpT goes 0 -> 1;
        // below it liquid has already drained (transparent), above it
        // liquid is still present at its pre-dump density.
        const startTop = g.chamberBottomY - levelAtDumpStart * g.chamberH;
        const wipeY = g.chamberBottomY - dumpT * (g.chamberBottomY - startTop);
        const alpha = 0.28 + levelAtDumpStart * 0.32;
        if (wipeY > startTop) {
          ctx.globalAlpha = alpha;
          ctx.fillRect(g.chamberX, startTop, g.chamberW, wipeY - startTop);
        }
        // soft leading edge at the wipe boundary so it reads as a drain
        // sweeping through, not a hard cut.
        const edgeH = Math.max(2, g.chamberH * 0.04);
        const grad = ctx.createLinearGradient(0, wipeY, 0, Math.min(g.chamberBottomY, wipeY + edgeH));
        grad.addColorStop(0, tokens.fg);
        grad.addColorStop(1, tokens.fg);
        ctx.globalAlpha = alpha * 0.5;
        ctx.fillRect(g.chamberX, wipeY, g.chamberW, edgeH);
      }
      ctx.restore();
      ctx.globalAlpha = 1;

      // siphon threshold mark — the overflow mouth height, plain --border.
      ctx.strokeStyle = tokens.border;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(g.chamberX + g.chamberW * 0.7, g.chamberTopY);
      ctx.lineTo(g.chamberX + g.chamberW, g.chamberTopY);
      ctx.stroke();

      // flow along the siphon tube, synced to the same dump progress.
      if (dumpT !== null) {
        ctx.globalAlpha = 0.85;
        drawTubePartial(g, dumpT, tokens.fg, 2.25);
        ctx.globalAlpha = 1;
      }

      // falling drop — gravity-eased travel from the condenser tip to
      // the current liquid surface.
      if (dropFallFrac !== null) {
        const eased = easeInQuad(dropFallFrac);
        const dropY = g.dripY + (fillTopAtLevel - g.dripY) * eased;
        const r = Math.max(1.5, g.m * 0.014);
        ctx.beginPath();
        ctx.fillStyle = tokens.fg;
        ctx.globalAlpha = 0.75;
        ctx.arc(g.dripX, dropY, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    };

    // -- reduced motion: one deterministic frame, no rAF, no timers. -----
    const renderStatic = () => {
      render(REDUCED_LEVEL_PCT / 100, null, null);
    };

    const loop = (now: number) => {
      if (disposed) return;
      if (!visible) {
        raf = 0; // IntersectionObserver re-arms this on re-entering view
        return;
      }
      raf = requestAnimationFrame(loop);
      if (!sized || !tokens) return;
      if (phaseStart === 0) phaseStart = now;
      const elapsed = now - phaseStart;

      if (phase === "fill") {
        const cycleElapsed = dropsLanded * DROP_INTERVAL_MS + elapsed;
        const dropIndex = Math.floor(cycleElapsed / DROP_INTERVAL_MS);
        if (dropIndex > dropsLanded && dropsLanded < DROPS_TO_TRIGGER) {
          dropsLanded = Math.min(DROPS_TO_TRIGGER, dropIndex);
        }
        const level = Math.min(1, (dropsLanded * LEVEL_PER_DROP) / 100);
        if (dropsLanded >= DROPS_TO_TRIGGER) {
          phase = "dump";
          phaseStart = now;
          levelAtDumpStart = 1;
          render(1, 0, null);
          return;
        }
        const withinDrop = elapsed % DROP_INTERVAL_MS;
        const fallFrac = withinDrop < DROP_FALL_MS ? withinDrop / DROP_FALL_MS : null;
        render(level, null, fallFrac);
      } else if (phase === "dump") {
        const t = Math.min(1, elapsed / DUMP_MS);
        render((1 - t) * levelAtDumpStart, t, null);
        if (t >= 1) {
          phase = "settle";
          phaseStart = now;
          cycleCount += 1;
          flaskPct = (cycleCount % FLASK_CYCLE_RESET) * FLASK_STEP_PCT;
        }
      } else {
        render(0, null, null);
        if (elapsed >= SETTLE_MS) {
          phase = "fill";
          phaseStart = now;
          dropsLanded = 0;
        }
      }
    };

    let started = false;
    const kick = () => {
      if (started || disposed || !tokens || !sized) return;
      started = true;
      if (reduced) {
        renderStatic();
        return; // no rAF loop, no timers, no observers driving motion
      }
      phase = "fill";
      phaseStart = 0;
      dropsLanded = 0;
      raf = requestAnimationFrame(loop);
    };

    const start = () => {
      if (disposed) return;
      tokens = readTokens();
      if (!tokens) {
        tokenWaitRaf = requestAnimationFrame(start);
        return;
      }
      resize();
      kick();
    };

    const ro = new ResizeObserver(() => {
      if (!tokens) return;
      resize();
      if (reduced && sized) renderStatic();
      kick();
    });
    ro.observe(wrap);

    const mo = new MutationObserver(() => {
      const next = readTokens();
      if (next) {
        tokens = next;
        if (reduced && sized) renderStatic();
        kick();
      }
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const io = new IntersectionObserver((entries) => {
      const wasVisible = visible;
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && !wasVisible && !reduced && tokens && !raf) {
        tokens = readTokens() ?? tokens; // pick up any theme flip that happened while hidden
        resize();
        phase = "fill";
        phaseStart = 0;
        dropsLanded = 0;
        raf = requestAnimationFrame(loop);
      }
    });
    io.observe(wrap);

    start();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(tokenWaitRaf);
      ro.disconnect();
      mo.disconnect();
      io.disconnect();
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className={`relative w-full max-w-sm overflow-hidden rounded-md border border-border bg-surface p-4 ${className}`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="truncate font-mono text-[11px] tracking-widest text-ns-muted">{label}</p>
        <p className="shrink-0 font-mono text-[10px] tracking-widest text-ns-muted">CYCLE</p>
      </div>
      <div className="relative w-full" style={{ aspectRatio: "4 / 5" }}>
        <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />
      </div>
    </div>
  );
}
