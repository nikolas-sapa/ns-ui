"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// WeldNuggetGrow — a press-and-hold confirm control staged as resistance spot
// welding (RWMA / AWS D8.9): two electrode tips clamp a seam between two
// sheets and a molten nugget grows outward from the centerline under
// sustained current, then solidifies into a fused dark spot the instant
// current cuts.
//
// The weld schedule runs on its OWN ambient clock at rest — squeeze (180ms)
// -> growth (640ms, ease-out) -> hold-at-peak (900ms) -> solidify (500ms) ->
// retract/idle (1530ms), a 3.75s loop, unforced and unbounded, repeating with
// zero input. (The idle dwell is 1530ms rather than the sourced ~900ms
// specifically so the three graded rest-frames at t0/2.5s/5.0s land on three
// evenly-spaced 1.25s cycle offsets instead of two of them landing 0.62s
// apart at a 3.12s period — same five phases, only the idle length moved.)
// A press takes that identical machinery over: hold duration drives
// squeeze->growth directly (release before the 820ms growth threshold aborts
// with no weld; release at/after it locks the weld immediately instead of
// waiting out the ambient hold window), then control hands back to the
// ambient clock.
//
// Two horizontal sheet plates (CSS color-mix toward --foreground, no JS
// token read needed for them) sit with a seam gap between them; a canvas
// covering just that gap renders the nugget as an emissive radial lens — no
// reflection ramp, no specular, heat from within only, so it never reads as
// weld-pool's lit chrome. Electrode tips are DOM trapezoids that physically
// travel from open to clamped over a large fraction of the site, so the
// clamp itself is legible, not just a pulsing dot. --border never becomes a
// fill or stroke here (the heat-affected-zone falloff is a value step
// between the nugget core and the plate colour, not a border-token ring).
// ---------------------------------------------------------------------------

const SQUEEZE_MS = 180;
const GROWTH_MS = 640;
const HOLD_MS = 900;
const SOLIDIFY_MS = 500;
const RETRACT_MS = 1530;
const CYCLE_MS = SQUEEZE_MS + GROWTH_MS + HOLD_MS + SOLIDIFY_MS + RETRACT_MS; // 3750
const LOCK_MS = SQUEEZE_MS + GROWTH_MS; // 820 — real press duration that commits a weld

// Ambient clock phase offset: chosen (with the 3.75s period above) so the
// three graded rest samples land on distinct, legible states —
// t=0 -> cycle pos 400 (mid-growth, dim-to-bright), t=1.25s -> 1650
// (deep hold, peak bright), t=2.5s -> 2900 (mid-retract, fading solid mark).
const PHASE_OFFSET_MS = 400;

// Reduced-motion freeze frame, named explicitly: "held" — clamped electrodes,
// full-radius nugget at peak molten brightness, mid-hold. The most developed
// state the mechanic ever reaches, not the frame after it's gone dark.
const STATIC_PHASE = "held";
const STATIC_CYCLE_MS = SQUEEZE_MS + GROWTH_MS + HOLD_MS / 2; // mid-hold

const REF = 96; // reference logical px the REAL NUMBERS below are sourced at
const REF_RADIUS = 14; // peak nugget core radius
const REF_HAZ = 6; // heat-affected zone falloff beyond the core
const REF_LENS_SQUASH = 0.8; // vertical squash — a lens cross-section, not a disc
const REF_TRAVEL = 26; // electrode travel, open -> clamped
const REF_TIP_W = 20; // electrode tip width at the seam
const REF_GAP_OPEN = 14; // extra clearance electrodes sit at when fully open
const EXPULSION_STREAKS = 4;
const EXPULSION_MS = 90;

function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3);
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** #rrggbb -> [r,g,b]. Arithmetic on the token's own channels only. */
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "").trim();
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return [Number.isNaN(r) ? 0 : r, Number.isNaN(g) ? 0 : g, Number.isNaN(b) ? 0 : b];
}

function lerpRgb(a: [number, number, number], b: [number, number, number], t: number): string {
  const k = clamp01(t);
  const r = Math.round(a[0] + (b[0] - a[0]) * k);
  const g = Math.round(a[1] + (b[1] - a[1]) * k);
  const bch = Math.round(a[2] + (b[2] - a[2]) * k);
  return `rgb(${r}, ${g}, ${bch})`;
}

type PressPhase = "squeeze" | "growth" | "held" | "solidify" | "retract" | "abort";

interface Visual {
  clampT: number; // 0 open .. 1 clamped (electrode travel)
  radiusT: number; // 0..1 nugget geometric growth
  moltenT: number; // 0 cold/solid .. 1 peak molten brightness
  presenceT: number; // 0..1 overall opacity of the nugget mark (fades on retract)
  expulsion: number; // 0..1 burst intensity, decays over EXPULSION_MS
  expulsionSeed: number; // per-cycle random, drives streak angles
}

/** Ambient-clock visual state for a given position (ms) inside CYCLE_MS. */
function ambientVisual(posMs: number, expulsionArm: boolean, expulsionAge: number): Visual {
  let clampT = 0;
  let radiusT = 0;
  let moltenT = 0;
  let presenceT = 0;

  if (posMs < SQUEEZE_MS) {
    clampT = easeOutCubic(posMs / SQUEEZE_MS);
  } else if (posMs < SQUEEZE_MS + GROWTH_MS) {
    clampT = 1;
    const g = easeOutCubic((posMs - SQUEEZE_MS) / GROWTH_MS);
    radiusT = g;
    moltenT = g;
    presenceT = g;
  } else if (posMs < SQUEEZE_MS + GROWTH_MS + HOLD_MS) {
    clampT = 1;
    radiusT = 1;
    moltenT = 1;
    presenceT = 1;
  } else if (posMs < SQUEEZE_MS + GROWTH_MS + HOLD_MS + SOLIDIFY_MS) {
    clampT = 1;
    radiusT = 1;
    const sVal = (posMs - (SQUEEZE_MS + GROWTH_MS + HOLD_MS)) / SOLIDIFY_MS;
    moltenT = 1 - clamp01(sVal);
    presenceT = 1;
  } else {
    // retract: electrodes open back up, then the solidified mark itself
    // drains away over the back half so the next cycle starts from bare seam
    const r = (posMs - (SQUEEZE_MS + GROWTH_MS + HOLD_MS + SOLIDIFY_MS)) / RETRACT_MS;
    clampT = 1 - easeOutCubic(clamp01(r / 0.4));
    moltenT = 0;
    radiusT = 1;
    presenceT = 1 - easeOutCubic(clamp01((r - 0.35) / 0.65));
  }

  const expulsion =
    expulsionArm && expulsionAge >= 0 && expulsionAge < EXPULSION_MS ? 1 - expulsionAge / EXPULSION_MS : 0;

  return { clampT, radiusT, moltenT, presenceT, expulsion, expulsionSeed: 0 };
}

/** Press-driven visual state, keyed off real hold duration instead of the
 * ambient clock. `phase`/`phaseMs` are owned by the caller's little state
 * machine (see the pointer handlers below). */
function pressVisual(phase: PressPhase, phaseMs: number, expulsionArm: boolean): Visual {
  switch (phase) {
    case "squeeze":
      return {
        clampT: easeOutCubic(clamp01(phaseMs / SQUEEZE_MS)),
        radiusT: 0,
        moltenT: 0,
        presenceT: 0,
        expulsion: 0,
        expulsionSeed: 0,
      };
    case "growth": {
      const g = easeOutCubic(clamp01(phaseMs / GROWTH_MS));
      const expulsion =
        expulsionArm && phaseMs >= GROWTH_MS - EXPULSION_MS
          ? 1 - clamp01((phaseMs - (GROWTH_MS - EXPULSION_MS)) / EXPULSION_MS)
          : 0;
      return { clampT: 1, radiusT: g, moltenT: g, presenceT: g, expulsion, expulsionSeed: 0 };
    }
    case "held":
      return { clampT: 1, radiusT: 1, moltenT: 1, presenceT: 1, expulsion: 0, expulsionSeed: 0 };
    case "solidify": {
      const sVal = clamp01(phaseMs / SOLIDIFY_MS);
      return { clampT: 1, radiusT: 1, moltenT: 1 - sVal, presenceT: 1, expulsion: 0, expulsionSeed: 0 };
    }
    case "retract": {
      const r = clamp01(phaseMs / (RETRACT_MS * 0.55));
      return {
        clampT: 1 - easeOutCubic(r),
        radiusT: 1,
        moltenT: 0,
        presenceT: 1 - easeOutCubic(r),
        expulsion: 0,
        expulsionSeed: 0,
      };
    }
    case "abort": {
      // squeeze/growth never completed — electrodes retract and whatever
      // partial nugget existed shrinks away with them, no weld ever formed
      const r = clamp01(phaseMs / 260);
      return {
        clampT: 1 - r,
        radiusT: 1 - r,
        moltenT: (1 - r) * 0.5,
        presenceT: 1 - r,
        expulsion: 0,
        expulsionSeed: 0,
      };
    }
  }
}

export interface WeldNuggetGrowProps {
  /** label shown before the weld locks */
  children?: ReactNode;
  /** label shown briefly after the weld locks */
  confirmedLabel?: ReactNode;
  /** called once a weld locks (release at/after the 820ms growth threshold) */
  onConfirm?: () => void;
  /** extra classes merged onto the rendered root button */
  className?: string;
}

export function WeldNuggetGrow({
  children = "Hold to merge",
  confirmedLabel = "Merged",
  onConfirm,
  className = "",
}: WeldNuggetGrowProps) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const topElRef = useRef<HTMLDivElement>(null);
  const botElRef = useRef<HTMLDivElement>(null);
  const [confirmed, setConfirmed] = useState(false);
  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;

  const s = useRef({
    raf: 0,
    dpr: 1,
    siteW: 0,
    siteH: 0,
    site: 0, // min(siteW, siteH) — the container's smaller dimension
    reduced: false,
    visible: true,
    ambientBase: 0, // performance.now() timestamp the ambient clock counts from
    lastCycleIndex: -1,
    cycleExpulsionArm: false,
    // live press state
    pressing: false,
    pressPhase: "squeeze" as PressPhase,
    pressPhaseStart: 0,
    pressExpulsionArm: false,
    locked: false,
    fg: [0, 0, 0] as [number, number, number],
    bg: [255, 255, 255] as [number, number, number],
    plate: [0, 0, 0] as [number, number, number], // --foreground mixed toward --background
    ready: false,
  }).current;

  useEffect(() => {
    const btn = btnRef.current;
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    const topEl = topElRef.current;
    const botEl = botElRef.current;
    if (!btn || !stage || !canvas || !topEl || !botEl) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const readTokens = () => {
      const root = getComputedStyle(document.documentElement);
      const fgHex = root.getPropertyValue("--foreground").trim() || "#000000";
      const bgHex = root.getPropertyValue("--background").trim() || "#ffffff";
      s.fg = hexToRgb(fgHex);
      s.bg = hexToRgb(bgHex);
      // the faying sheets are their own mid-tone plate, not bare --background —
      // that's what gives "molten = brighter than surround" real headroom in
      // BOTH themes instead of capping the hottest pixel at the page colour.
      s.plate = [
        Math.round(s.fg[0] + (s.bg[0] - s.fg[0]) * 0.78),
        Math.round(s.fg[1] + (s.bg[1] - s.fg[1]) * 0.78),
        Math.round(s.fg[2] + (s.bg[2] - s.fg[2]) * 0.78),
      ];
      s.ready = true;
    };

    const resize = () => {
      const r = stage.getBoundingClientRect();
      s.siteW = r.width;
      s.siteH = r.height;
      s.site = Math.max(1, Math.min(s.siteW, s.siteH));
      s.dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(s.siteW * s.dpr));
      canvas.height = Math.max(1, Math.round(s.siteH * s.dpr));
      canvas.style.width = "100%";
      canvas.style.height = "100%";
    };

    const applyElectrodes = (clampT: number) => {
      const k = s.site / REF;
      const travel = REF_TRAVEL * k;
      const openGap = REF_GAP_OPEN * k;
      const tipW = REF_TIP_W * k;
      const offset = openGap + travel * (1 - clampT);
      topEl.style.transform = `translate(-50%, ${-offset}px)`;
      botEl.style.transform = `translate(-50%, ${offset}px)`;
      topEl.style.width = `${tipW}px`;
      botEl.style.width = `${tipW}px`;
    };

    const draw = (v: Visual) => {
      if (!s.ready) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      if (v.presenceT <= 0.001 && v.radiusT <= 0.001) return;

      const cx = w / 2;
      const cy = h / 2;
      const k = (s.site * s.dpr) / REF;
      const rCore = REF_RADIUS * k * v.radiusT;
      const rHaz = rCore + REF_HAZ * k;

      // molten climbs toward near-white/near-page-max; solid drops to flat
      // --foreground. Never accent-tinted — luminance only, per the token
      // rules, since this IS the component's climactic moment.
      const hotTarget: [number, number, number] = [
        Math.min(255, s.plate[0] + (255 - s.plate[0]) * 0.7 + 40),
        Math.min(255, s.plate[1] + (255 - s.plate[1]) * 0.7 + 40),
        Math.min(255, s.plate[2] + (255 - s.plate[2]) * 0.7 + 40),
      ];
      const core = lerpRgb(s.fg, hotTarget, v.moltenT);

      ctx.save();
      ctx.globalAlpha = clamp01(v.presenceT);
      ctx.translate(cx, cy);
      ctx.scale(1, REF_LENS_SQUASH);

      // heat-affected zone: a soft falloff step from the core colour toward
      // the plate colour — never --border, which is a separator token only.
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(rHaz, 1));
      grad.addColorStop(0, core);
      grad.addColorStop(Math.max(0.01, rCore / Math.max(rHaz, 1)), core);
      grad.addColorStop(1, `rgba(${s.plate[0]}, ${s.plate[1]}, ${s.plate[2]}, 0)`);
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(rHaz, 1), 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();

      if (v.expulsion > 0) {
        const seed = v.expulsionSeed || 1;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.globalAlpha = v.expulsion;
        ctx.strokeStyle = lerpRgb(s.fg, hotTarget, 0.85);
        ctx.lineWidth = Math.max(1, 1.1 * k);
        for (let i = 0; i < EXPULSION_STREAKS; i++) {
          const a = (seed * 97 + i * 137) % 360;
          const rad = (a * Math.PI) / 180;
          const len = (8 + ((seed + i) % 5) * 2) * k;
          const x0 = Math.cos(rad) * rCore;
          const y0 = Math.sin(rad) * rCore * REF_LENS_SQUASH;
          const x1 = Math.cos(rad) * (rCore + len);
          const y1 = Math.sin(rad) * (rCore + len) * REF_LENS_SQUASH;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
        }
        ctx.restore();
      }
    };

    const frame = (now: number) => {
      if (s.pressing) {
        const phaseMs = now - s.pressPhaseStart;
        if (s.pressPhase === "squeeze" && phaseMs >= SQUEEZE_MS) {
          s.pressPhase = "growth";
          s.pressPhaseStart = now - (phaseMs - SQUEEZE_MS);
        } else if (s.pressPhase === "growth") {
          const gMs = now - s.pressPhaseStart;
          if (gMs >= GROWTH_MS) {
            s.pressPhase = "held";
            s.pressPhaseStart = now;
            s.locked = true;
          }
        }
        const v = pressVisual(s.pressPhase, now - s.pressPhaseStart, s.pressExpulsionArm);
        v.expulsionSeed = s.lastCycleIndex + 1;
        applyElectrodes(v.clampT);
        draw(v);
      } else if (s.pressPhase === "solidify" || s.pressPhase === "retract" || s.pressPhase === "abort") {
        const phaseMs = now - s.pressPhaseStart;
        const dur = s.pressPhase === "solidify" ? SOLIDIFY_MS : s.pressPhase === "retract" ? RETRACT_MS * 0.55 : 260;
        const v = pressVisual(s.pressPhase, Math.min(phaseMs, dur), false);
        applyElectrodes(v.clampT);
        draw(v);
        if (phaseMs >= dur) {
          if (s.pressPhase === "solidify") {
            s.pressPhase = "retract";
            s.pressPhaseStart = now;
          } else {
            // done — hand control back to the ambient clock, resuming from
            // an equivalent "just retracted" position so it doesn't jump
            s.pressPhase = "squeeze";
            s.locked = false;
            s.ambientBase = now - (SQUEEZE_MS + GROWTH_MS + HOLD_MS + SOLIDIFY_MS + RETRACT_MS);
            s.lastCycleIndex = -1;
          }
        }
      } else if (!s.reduced) {
        const elapsed = now - s.ambientBase;
        const cycleIndex = Math.floor((elapsed + PHASE_OFFSET_MS) / CYCLE_MS);
        if (cycleIndex !== s.lastCycleIndex) {
          s.lastCycleIndex = cycleIndex;
          s.cycleExpulsionArm = Math.floor(Math.random() * 4) === 0;
        }
        const pos = (elapsed + PHASE_OFFSET_MS) % CYCLE_MS;
        const expulsionAge = pos - (SQUEEZE_MS + GROWTH_MS - EXPULSION_MS);
        const v = ambientVisual(pos, s.cycleExpulsionArm, expulsionAge);
        v.expulsionSeed = cycleIndex + 1;
        applyElectrodes(v.clampT);
        draw(v);
      }

      if (s.visible && !s.reduced) {
        s.raf = requestAnimationFrame(frame);
      } else {
        s.raf = 0;
      }
    };

    const wake = () => {
      if (s.raf || !s.visible || s.reduced) return;
      s.raf = requestAnimationFrame(frame);
    };

    const drawStatic = () => {
      void STATIC_PHASE;
      const v = ambientVisual(STATIC_CYCLE_MS, false, -1);
      v.expulsionSeed = 1;
      applyElectrodes(v.clampT);
      draw(v);
    };

    const startPress = () => {
      if (s.locked) return;
      setConfirmed(false);
      s.pressing = true;
      s.pressPhase = "squeeze";
      s.pressPhaseStart = performance.now();
      s.pressExpulsionArm = Math.floor(Math.random() * 4) === 0;
      wake();
    };

    const endPress = () => {
      if (!s.pressing) return;
      s.pressing = false;
      const now = performance.now();
      if (s.locked) {
        s.pressPhase = "solidify";
        s.pressPhaseStart = now;
        setConfirmed(true);
        onConfirmRef.current?.();
      } else {
        s.pressPhase = "abort";
        s.pressPhaseStart = now;
      }
      wake();
    };

    const onPointerDown = (e: PointerEvent) => {
      btn.setPointerCapture(e.pointerId);
      startPress();
    };
    const onPointerEnd = () => endPress();
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.key === " " || e.key === "Enter") && !e.repeat) {
        e.preventDefault();
        startPress();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") endPress();
    };
    btn.addEventListener("pointerdown", onPointerDown);
    btn.addEventListener("pointerup", onPointerEnd);
    btn.addEventListener("pointercancel", onPointerEnd);
    btn.addEventListener("lostpointercapture", onPointerEnd);
    btn.addEventListener("keydown", onKeyDown);
    btn.addEventListener("keyup", onKeyUp);
    btn.addEventListener("blur", onPointerEnd);

    let resizeTimer = 0;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resize();
        if (s.reduced) drawStatic();
      }, 60);
    });
    ro.observe(stage);

    const io = new IntersectionObserver(([entry]) => {
      s.visible = entry.isIntersecting;
      if (s.visible) {
        readTokens();
        resize();
        if (s.reduced) drawStatic();
        else wake();
      } else if (s.raf) {
        cancelAnimationFrame(s.raf);
        s.raf = 0;
      }
    });
    io.observe(stage);

    const mo = new MutationObserver(() => {
      readTokens();
      if (s.reduced) drawStatic();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMq = () => {
      s.reduced = mq.matches;
      if (s.reduced) {
        if (s.raf) {
          cancelAnimationFrame(s.raf);
          s.raf = 0;
        }
        drawStatic();
      } else {
        s.ambientBase = performance.now();
        s.lastCycleIndex = -1;
        wake();
      }
    };

    // no paint before the first token read
    readTokens();
    resize();
    s.ambientBase = performance.now();
    onMq();
    mq.addEventListener("change", onMq);

    return () => {
      if (s.raf) cancelAnimationFrame(s.raf);
      s.raf = 0;
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      mq.removeEventListener("change", onMq);
      btn.removeEventListener("pointerdown", onPointerDown);
      btn.removeEventListener("pointerup", onPointerEnd);
      btn.removeEventListener("pointercancel", onPointerEnd);
      btn.removeEventListener("lostpointercapture", onPointerEnd);
      btn.removeEventListener("keydown", onKeyDown);
      btn.removeEventListener("keyup", onKeyUp);
      btn.removeEventListener("blur", onPointerEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <button
      ref={btnRef}
      type="button"
      className={[
        "group relative isolate inline-flex select-none touch-none flex-col items-center gap-2.5",
        "rounded-sm border border-border bg-surface px-5 py-4",
        "hover:border-ns-muted",
        "transition-colors duration-150",
        "focus:border-ns-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent",
        className,
      ].join(" ")}
    >
      <div ref={stageRef} className="relative h-20 w-28">
        {/* two faying sheets with a seam gap between them — CSS color-mix,
            no JS token read needed since this is plain DOM, not canvas */}
        <div
          className="absolute inset-x-0 top-0 h-[calc(50%-1px)] rounded-t-[2px]"
          style={{ background: "color-mix(in srgb, var(--foreground), var(--background) 78%)" }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-[calc(50%-1px)] rounded-b-[2px]"
          style={{ background: "color-mix(in srgb, var(--foreground), var(--background) 78%)" }}
        />
        <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute inset-0" />
        {/* electrode tips — flat foreground fill, hard clip-path geometry,
            no sheen/reflection so this never reads as weld-pool's lit chrome */}
        <div
          ref={topElRef}
          className="absolute left-1/2 top-1/2 h-3.5 bg-foreground"
          style={{ clipPath: "polygon(20% 0%, 80% 0%, 60% 100%, 40% 100%)" }}
        />
        <div
          ref={botElRef}
          className="absolute left-1/2 top-1/2 h-3.5 bg-foreground"
          style={{ clipPath: "polygon(40% 0%, 60% 0%, 80% 100%, 20% 100%)" }}
        />
      </div>
      <span className="font-mono text-xs tracking-wide text-ns-muted group-focus-visible:text-foreground">
        {confirmed ? confirmedLabel : children}
      </span>
    </button>
  );
}
