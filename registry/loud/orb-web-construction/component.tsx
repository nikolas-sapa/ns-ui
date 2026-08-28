"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// OrbWebConstruction — a full-bleed hero background that builds a web in the
// real orb-weaver sequence (Zschokke 1999): bridge/frame first, then radii
// laid hub-outward, then a temporary non-sticky auxiliary spiral hub-outward
// (structural scaffold, dashed), then the permanent sticky capture spiral
// laid from the OUTSIDE back toward the hub, replacing the auxiliary spiral
// turn by turn as it goes. Once finished, the web rests, a random sector
// tears, and the SAME sequence (radii, then spiral) rebuilds only that
// sector while the rest of the web stays put — real, documented orb-weaver
// damage-repair behaviour.
//
// The auxiliary and capture spirals share one underlying curve
// (spiralPoint(u), u=0 at hub .. u=1 at outer edge) so the "replacement" the
// brief calls for reads as one spiral changing character (dashed -> solid)
// rather than two visually distinct curves swapping — a boundary value
// `uCap` marks how far in from the outer edge the capture silk has replaced
// the scaffold; below it the segment renders dashed, at/above it solid.
//
// No pointer/keyboard interaction: this is a decorative full-bleed backdrop,
// the canvas is aria-hidden, children render as ordinary DOM above it.
// prefers-reduced-motion skips straight to the finished, mid-rest web (no
// build sequence, no tear/repair cycle ever runs).
// ---------------------------------------------------------------------------

const FRAME_ANCHORS = 3;
const FRAME_SEG_DUR = 0.4; // s, sequential
const FRAME_TOTAL = FRAME_ANCHORS * FRAME_SEG_DUR;

const RADII_STAGGER = 0.09; // s between spoke starts
const RADII_DRAW_DUR = 0.26; // s for one spoke to finish drawing
const RADII_JITTER_DEG = 4; // +/- per spoke

const AUX_DURATION = 2.1; // s, hub -> outer edge, dashed scaffold
const CAPTURE_DURATION = 3.1; // s, outer edge -> hub, solid capture silk
const SPIRAL_TURNS = 5.5; // shared by both aux and capture curves

const REST_MIN = 6;
const REST_MAX = 9;
const TEAR_DUR = 0.18; // s
const WEDGE_MIN_DEG = 40;
const WEDGE_MAX_DEG = 70;

const OUTER_FRACTION = 0.46; // outerRadius = min(w,h) * this

// xorshift32 — deterministic across mounts, unlike Math.random, so the
// resting frame this component ships doesn't drift screenshot to screenshot
function makeRng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

type RGB = [number, number, number];

function parseHex(raw: string): RGB | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgba(c: RGB, a: number): string {
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
}

const TAU = Math.PI * 2;

function norm2pi(a: number): number {
  let x = a % TAU;
  if (x < 0) x += TAU;
  return x;
}

interface Radius {
  angle: number; // radians, fixed at rebuild
  progress: number; // 0..1 fraction drawn, updated per frame
}

interface Wedge {
  startDeg: number;
  widthDeg: number;
  indices: number[]; // radii indices whose angle falls inside the wedge
  uCap: number; // 0..1, spiral replacement boundary local to this wedge
}

function angleInWedge(angleRad: number, w: Wedge): boolean {
  const a = (norm2pi(angleRad) * 180) / Math.PI;
  const start = ((w.startDeg % 360) + 360) % 360;
  const end = start + w.widthDeg;
  if (end <= 360) return a >= start && a <= end;
  return a >= start || a <= end - 360;
}

// point on the shared aux/capture curve, u=0 at hub, u=1 at outer edge
function spiralPoint(hubX: number, hubY: number, outerR: number, u: number): [number, number] {
  const angle = u * SPIRAL_TURNS * TAU;
  const r = u * outerR;
  return [hubX + Math.cos(angle) * r, hubY + Math.sin(angle) * r];
}

type Phase = "frame" | "radii" | "aux" | "capture" | "rest" | "tear" | "repairRadii" | "repairSpiral";

export interface OrbWebConstructionProps {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function OrbWebConstruction({ children, className = "", style }: OrbWebConstructionProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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
    let hubX = 0;
    let hubY = 0;
    let outerR = 0;

    let rng = makeRng(0x51ffab1e);
    let radii: Radius[] = [];
    let n = 0;

    let phase: Phase = "frame";
    let phaseStart = 0; // seconds, same clock as `now`
    let restDuration = REST_MIN;
    let wedge: Wedge | null = null;
    let capUCap = 1; // global capture boundary during the very first build only

    // --- palette ------------------------------------------------------------
    let foreground: RGB = [230, 230, 230];
    let border: RGB = [58, 58, 58];
    let isLight = false;
    const readColors = () => {
      const cs = getComputedStyle(document.documentElement);
      foreground = parseHex(cs.getPropertyValue("--foreground")) ?? foreground;
      border = parseHex(cs.getPropertyValue("--border")) ?? border;
      isLight = !document.documentElement.classList.contains("dark");
    };
    readColors();

    // --- build/reset ----------------------------------------------------------
    const resetCycle = () => {
      n = Math.max(16, Math.min(28, Math.round(Math.min(cssW, cssH) / 60)));
      rng = makeRng(0x51ffab1e);
      radii = new Array(n).fill(0).map((_, i) => {
        const base = (i / n) * TAU;
        const jitter = ((rng() - 0.5) * 2 * RADII_JITTER_DEG * Math.PI) / 180;
        return { angle: base + jitter, progress: 0 };
      });
      phase = "frame";
      phaseStart = 0;
      wedge = null;
      capUCap = 1;
    };

    const pickWedge = (): Wedge => {
      const startDeg = rng() * 360;
      const widthDeg = WEDGE_MIN_DEG + rng() * (WEDGE_MAX_DEG - WEDGE_MIN_DEG);
      const indices: number[] = [];
      const probe: Wedge = { startDeg, widthDeg, indices, uCap: 0 };
      for (let i = 0; i < radii.length; i++) {
        if (angleInWedge(radii[i]!.angle, probe)) indices.push(i);
      }
      // never tear an empty wedge — widen until at least one spoke is caught
      let guard = 0;
      while (indices.length === 0 && guard < 8) {
        probe.widthDeg += 15;
        indices.length = 0;
        for (let i = 0; i < radii.length; i++) {
          if (angleInWedge(radii[i]!.angle, probe)) indices.push(i);
        }
        guard++;
      }
      return probe;
    };

    // --- phase advance --------------------------------------------------------
    const advance = (now: number) => {
      const elapsed = now - phaseStart;
      switch (phase) {
        case "frame":
          if (elapsed >= FRAME_TOTAL) {
            phase = "radii";
            phaseStart = now;
          }
          break;
        case "radii": {
          const dur = n * RADII_STAGGER + RADII_DRAW_DUR;
          if (elapsed >= dur) {
            phase = "aux";
            phaseStart = now;
          }
          break;
        }
        case "aux":
          if (elapsed >= AUX_DURATION) {
            phase = "capture";
            phaseStart = now;
            capUCap = 1;
          }
          break;
        case "capture":
          if (elapsed >= CAPTURE_DURATION) {
            phase = "rest";
            phaseStart = now;
            capUCap = 0;
            restDuration = REST_MIN + rng() * (REST_MAX - REST_MIN);
          }
          break;
        case "rest":
          if (elapsed >= restDuration) {
            phase = "tear";
            phaseStart = now;
            wedge = pickWedge();
            wedge.uCap = 0;
          }
          break;
        case "tear":
          if (elapsed >= TEAR_DUR) {
            phase = "repairRadii";
            phaseStart = now;
          }
          break;
        case "repairRadii": {
          const count = wedge ? wedge.indices.length : 0;
          const dur = count * RADII_STAGGER + RADII_DRAW_DUR;
          if (elapsed >= dur) {
            phase = "repairSpiral";
            phaseStart = now;
          }
          break;
        }
        case "repairSpiral": {
          const widthDeg = wedge ? wedge.widthDeg : WEDGE_MIN_DEG;
          const dur = Math.max(0.8, (AUX_DURATION + CAPTURE_DURATION) * (widthDeg / 360));
          if (elapsed >= dur) {
            phase = "rest";
            phaseStart = now;
            wedge = null;
            restDuration = REST_MIN + rng() * (REST_MAX - REST_MIN);
          }
          break;
        }
      }
    };

    // --- per-frame state update (radii progress, wedge uCap) ------------------
    const updateState = (now: number) => {
      const elapsed = now - phaseStart;
      if (phase === "radii") {
        for (let i = 0; i < radii.length; i++) {
          const start = i * RADII_STAGGER;
          const p = Math.max(0, Math.min(1, (elapsed - start) / RADII_DRAW_DUR));
          radii[i]!.progress = p;
        }
      } else if (phase === "frame") {
        for (let i = 0; i < radii.length; i++) radii[i]!.progress = 0;
      } else {
        for (let i = 0; i < radii.length; i++) {
          if (radii[i]!.progress < 1 && !(wedge && wedge.indices.includes(i))) radii[i]!.progress = 1;
        }
      }

      if (phase === "aux") {
        capUCap = 1; // nothing solid yet, only the growing dashed scaffold
      } else if (phase === "capture") {
        const p = Math.max(0, Math.min(1, elapsed / CAPTURE_DURATION));
        capUCap = 1 - p;
      }

      if (wedge) {
        if (phase === "tear") {
          const p = Math.max(0, Math.min(1, elapsed / TEAR_DUR));
          for (const i of wedge.indices) radii[i]!.progress = 1 - p;
          wedge.uCap = p; // 0 (solid) -> 1 (erased)
        } else if (phase === "repairRadii") {
          for (let k = 0; k < wedge.indices.length; k++) {
            const i = wedge.indices[k]!;
            const start = k * RADII_STAGGER;
            const p = Math.max(0, Math.min(1, (elapsed - start) / RADII_DRAW_DUR));
            radii[i]!.progress = p;
          }
          wedge.uCap = 1; // spiral still fully absent in this wedge
        } else if (phase === "repairSpiral") {
          const widthDeg = wedge.widthDeg;
          const dur = Math.max(0.8, (AUX_DURATION + CAPTURE_DURATION) * (widthDeg / 360));
          const p = Math.max(0, Math.min(1, elapsed / dur));
          wedge.uCap = 1 - p; // 1 (erased) -> 0 (rebuilt, solid)
          for (const i of wedge.indices) radii[i]!.progress = 1;
        }
      }
    };

    // --- render -----------------------------------------------------------
    // `t` throughout render/draw* is always seconds-since-mount (same clock
    // advance()/updateState() use), never a raw performance.now() timestamp.
    const auxGrowLimit = (t: number) => {
      if (phase === "aux") return Math.max(0, Math.min(1, (t - phaseStart) / AUX_DURATION));
      return 1;
    };

    const drawFrame = (elapsedInPhase: number, active: boolean) => {
      const col = rgba(border, isLight ? 0.55 : 0.4);
      ctx.strokeStyle = col;
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      const pts: [number, number][] = [];
      for (let i = 0; i < FRAME_ANCHORS; i++) {
        const a = (i / FRAME_ANCHORS) * TAU - Math.PI / 2;
        pts.push([hubX + Math.cos(a) * outerR, hubY + Math.sin(a) * outerR]);
      }
      for (let i = 0; i < FRAME_ANCHORS; i++) {
        const segStart = i * FRAME_SEG_DUR;
        const p = active ? Math.max(0, Math.min(1, (elapsedInPhase - segStart) / FRAME_SEG_DUR)) : 1;
        if (p <= 0) continue;
        const a = pts[i]!;
        const b = pts[(i + 1) % FRAME_ANCHORS]!;
        const x = a[0] + (b[0] - a[0]) * p;
        const y = a[1] + (b[1] - a[1]) * p;
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    };

    const drawRadii = () => {
      ctx.strokeStyle = rgba(border, isLight ? 0.6 : 0.45);
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      for (const r of radii) {
        if (r.progress <= 0) continue;
        const x = hubX + Math.cos(r.angle) * outerR * r.progress;
        const y = hubY + Math.sin(r.angle) * outerR * r.progress;
        ctx.beginPath();
        ctx.moveTo(hubX, hubY);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    };

    // draws the shared spiral curve, splitting each sample into dashed
    // (not-yet-replaced scaffold) or solid (capture silk) runs, using the
    // wedge's local uCap where the sample angle falls inside the active
    // wedge and the global capUCap everywhere else.
    const drawSpiral = (builtLimitU: number) => {
      const steps = Math.max(60, Math.round(SPIRAL_TURNS * 48));
      let prevSolid: boolean | null = null;
      let path: [number, number][] = [];
      const flush = (solid: boolean) => {
        if (path.length < 2) {
          path = [];
          return;
        }
        ctx.strokeStyle = solid ? rgba(foreground, isLight ? 0.45 : 0.35) : rgba(border, isLight ? 0.55 : 0.4);
        ctx.setLineDash(solid ? [] : [2, 3]);
        ctx.lineWidth = solid ? 1.1 : 0.9;
        ctx.beginPath();
        ctx.moveTo(path[0]![0], path[0]![1]);
        for (let k = 1; k < path.length; k++) ctx.lineTo(path[k]![0], path[k]![1]);
        ctx.stroke();
        path = [];
      };
      for (let s = 0; s <= steps; s++) {
        const u = (s / steps) * builtLimitU;
        if (u > builtLimitU) break;
        const [x, y] = spiralPoint(hubX, hubY, outerR, u);
        const angle = u * SPIRAL_TURNS * TAU;
        const local = wedge && angleInWedge(angle, wedge) ? wedge.uCap : capUCap;
        const solid = u >= local;
        if (prevSolid !== null && prevSolid !== solid) {
          path.push([x, y]);
          flush(prevSolid);
          path.push([x, y]);
        } else {
          path.push([x, y]);
        }
        prevSolid = solid;
      }
      if (prevSolid !== null) flush(prevSolid);
      ctx.setLineDash([]);
    };

    const render = (t: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(dpr, dpr);

      const framePhaseElapsed = phase === "frame" ? t - phaseStart : FRAME_TOTAL;
      drawFrame(framePhaseElapsed, phase === "frame");

      if (phase !== "frame") drawRadii();

      if (phase === "aux") {
        drawSpiral(auxGrowLimit(t));
      } else if (phase !== "frame" && phase !== "radii") {
        // capture / rest / tear / repair — full spiral extent, dashed vs
        // solid decided per-sample inside drawSpiral via capUCap/wedge.uCap
        drawSpiral(1);
      }

      ctx.restore();
    };

    // --- sizing -------------------------------------------------------------
    const applyBacking = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(cssW * dpr));
      canvas.height = Math.max(1, Math.round(cssH * dpr));
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
    };

    let resizeTimer = 0;
    let everSized = false;
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      const changed = Math.abs(rect.width - cssW) > 0.5 || Math.abs(rect.height - cssH) > 0.5;
      cssW = rect.width;
      cssH = rect.height;
      hubX = cssW / 2;
      hubY = cssH / 2;
      outerR = Math.min(cssW, cssH) * OUTER_FRACTION;
      applyBacking();
      if (changed && !everSized) {
        // first real measurement — build and paint immediately, no debounce
        everSized = true;
        resetCycle();
        if (reduced) primeReduced();
        renderNow();
      } else if (changed) {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(() => {
          resetCycle();
          if (reduced) primeReduced();
          renderNow();
        }, 200);
      } else {
        renderNow();
      }
    };

    const renderNow = () => render((performance.now() - mountClock) / 1000);

    // reduced motion: run the phase machine forward synchronously in fixed
    // small steps until the web is finished and sitting mid-rest, then paint
    // that one static frame and never schedule another
    const primeReduced = () => {
      let t = 0;
      const dt = 0.05;
      const targetRestElapsed = 3; // land solidly inside "rest", not at its edge
      let guard = 0;
      while (guard < 4000) {
        t += dt;
        advance(t);
        updateState(t);
        if (phase === "rest" && t - phaseStart >= targetRestElapsed) break;
        guard++;
      }
    };

    // --- loop -----------------------------------------------------------
    let raf = 0;
    let visible = true;
    let staticMode = reduced;
    // fixed at first paint below, before resetCycle()/resize() run, so every
    // renderNow() call (including the very first synchronous one) reads a
    // consistent, small, near-zero `t` rather than a stale-vs-fresh mix
    const mountClock = performance.now();

    const loop = (now: number) => {
      const t = (now - mountClock) / 1000;
      advance(t);
      updateState(t);
      render(t);
      if (visible && !document.hidden && !staticMode) {
        raf = requestAnimationFrame(loop);
      } else {
        raf = 0;
      }
    };

    const wake = () => {
      if (raf || staticMode || !visible || document.hidden) return;
      // mountClock stays fixed for the component's whole life — `t` is real
      // elapsed wall time since mount, so a sleep period just means several
      // pending phase transitions cascade through on the first few frames
      // back, which is harmless since nobody was watching while asleep.
      raf = requestAnimationFrame(loop);
    };
    const sleep = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize(); // first real measurement runs resetCycle() itself, see above

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries.some((e) => e.isIntersecting);
        if (visible) wake();
        else sleep();
      },
      { threshold: 0 }
    );
    io.observe(wrap);

    const onVis = () => {
      if (document.hidden) sleep();
      else wake();
    };
    document.addEventListener("visibilitychange", onVis);

    const applyMode = () => {
      staticMode = reduced;
      if (staticMode) {
        sleep();
        resetCycle();
        primeReduced();
        renderNow();
      } else {
        resetCycle();
        wake();
      }
    };
    const onMq = () => {
      reduced = mq.matches;
      applyMode();
    };
    mq.addEventListener("change", onMq);

    const themeObserver = new MutationObserver(() => {
      readColors();
      renderNow();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // resize()'s first-measurement branch above already primed and painted
    // the initial frame (reduced or not) — only the live rAF loop is left
    if (!reduced) raf = requestAnimationFrame(loop);

    return () => {
      sleep();
      ro.disconnect();
      io.disconnect();
      themeObserver.disconnect();
      mq.removeEventListener("change", onMq);
      document.removeEventListener("visibilitychange", onVis);
      window.clearTimeout(resizeTimer);
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

OrbWebConstruction.displayName = "OrbWebConstruction";
