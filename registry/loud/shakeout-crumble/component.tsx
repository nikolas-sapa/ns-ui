"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// ShakeoutCrumble — a destructive confirm rendered as a green-sand casting
// shakeout: the foundry conveyor that vibrates a friable sand mould until it
// loses cohesion and crumbles away, revealing the casting inside, then
// reclaims the sand and re-compacts a fresh mould for the next pour. The
// mechanic is COMPACTION FAILURE UNDER VIBRATION — a granular field whose
// grains individually detach past a per-grain threshold and either drop into
// a loose pile or drift off as dust — never a wipe (dew-coalesce) and never a
// chemical front sweeping across a surface (kamacite-etch).
//
// Every grain's position/alpha each frame is a pure function of one global
// scalar `drive` (0 = mould compacted over the casting, 1 = fully shaken out)
// plus that grain's own static escape threshold and destination. That single
// fact is what makes the confirm gesture and the idle demonstration the same
// system: raising `drive` crumbles the mould, lowering it re-compacts, and
// nothing needs a separate "undo" animation because the render is already
// reversible in both directions.
//
// GESTURE (distinct from every other destructive-confirm in the registry —
// confirm-hold-ink gates on TIME held, confirm-slide-shatter on DISTANCE
// dragged, confirm-dial-align on ACCURACY): this gates on a click-arm-then-
// confirm exchange. First activation (click, Space, Enter — a real <button>,
// so all three are free) arms the button: the mould starts shaking harder as
// a ticking window counts down, teasing the shakeout without completing it.
// A second activation inside that window commits — the mould finishes
// crumbling, the casting is fully revealed, and onConfirm fires. Letting the
// window expire, pressing Escape, or losing focus while armed de-arms: drive
// eases back to 0 and the mould visibly reclaims itself, exactly mirroring
// the ambient loop below. That reversibility is load-bearing, not cosmetic —
// nothing is destroyed until the second activation actually lands.
//
// ALIVE AT REST: whenever the button is not armed or committed, `drive`
// follows its own timed envelope (settle -> vibrate/crumble -> reveal hold ->
// reclaim -> settle, ~7s) forever, so the foundry cycle runs with no input
// and no settled end state. Even once committed, per-grain idle jitter never
// stops (a constant low agitation floor) — dust keeps sifting on the
// revealed casting rather than the frame ever going dead.
//
// PERFORMANCE: grain count is derived from the container's own area against
// a hard budget (MAX_GRAINS = 2600, ~2570 typical at this component's
// default demo size) rather than a fixed density, so a small preview card
// never pays for more grains than it can show. Per-frame draw batches grains
// into alpha buckets (BUCKETS = 6) and issues one canvas fill() per non-empty
// bucket, so draw-call count stays flat regardless of grain count — only
// path-building (cheap, CPU-side arc() calls) scales with the grain count.
// DPR is capped at 2 (house idiom for button-scale canvases, not the 1.5 used
// by full-bleed showpieces, since this is a compact control, not a hero).
//
// Direct-DOM/canvas on the whole animation hot path; React state exists only
// for the three discrete phases (idle/armed/committed) that change the
// visible label and aria state.
// ---------------------------------------------------------------------------

type Mode = "ambient" | "armed" | "dearming" | "committing" | "committed";
type Phase = "idle" | "armed" | "committed";

type Grain = {
  hx: number; // home x, css px
  hy: number; // home y, css px
  r: number; // radius, css px
  escapeThresh: number; // drive value at which this grain starts moving
  jphase: number; // idle-jitter phase offset
  isDust: boolean; // drifts off and fades, vs. settles into a nearby pile
  dx: number; // dust drift vector (isDust only)
  dy: number;
  px: number; // pile rest position (non-dust only)
  py: number;
};

const MAX_GRAINS = 2600;
const AMBIENT_PERIOD = 7000; // ms, one full compact -> shakeout -> reclaim loop
const ARM_MS = 4000; // window to land the second activation before de-arming
// `committed` below is terminal (see "terminal" comment ~line 175 and the
// early return ~line 401): this state never resets itself. This card's
// meta.json autoplay presses the button on a period > ARM_MS on purpose, so
// each arm window expires and re-arms instead of committing. Drop the
// autoplay period below ARM_MS and cycle 2 will commit — the card latches
// on "Cleared" forever.
const DEARM_MS = 900;
const COMMIT_MS = 650;
const ESCAPE_SPAN = 0.4; // fraction of drive range a triggered grain takes to finish moving
const BUCKETS = 6;
const STATIC_DRIVE = 0.5; // reduced-motion idle freeze: mould and casting both partly visible
const STATIC_ARM_DRIVE = 0.85;

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function smoothstep(t: number) {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
}

/** Continuous piecewise envelope for the unforced foundry cycle. */
function ambientEnvelope(p: number): { drive: number; shake: number } {
  if (p < 0.12) return { drive: 0, shake: 0.15 };
  if (p < 0.42) {
    const t = smoothstep((p - 0.12) / 0.3);
    return { drive: t, shake: 0.15 + 0.85 * t };
  }
  if (p < 0.62) return { drive: 1, shake: 0.4 };
  if (p < 0.92) {
    const t = smoothstep((p - 0.62) / 0.3);
    return { drive: 1 - t, shake: 0.4 + 0.4 * t };
  }
  return { drive: 0, shake: 0.15 };
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildGrains(w: number, h: number): Grain[] {
  const minDim = Math.min(w, h);
  let spacing = clamp(minDim / 34, 2.4, 4.2);
  let cols = Math.ceil(w / spacing);
  let rows = Math.ceil(h / spacing);
  let count = cols * rows;
  if (count > MAX_GRAINS) {
    spacing *= Math.sqrt(count / MAX_GRAINS);
    cols = Math.ceil(w / spacing);
    rows = Math.ceil(h / spacing);
    count = cols * rows;
  }
  const rand = mulberry32((w * 7919 + h * 104729 + count) | 0);
  const grains: Grain[] = [];
  // casting sits centered — grains over it get a slightly earlier escape bias
  // so the casting reads clean rather than merely thinning uniformly.
  const cx = w / 2;
  const cy = h / 2;
  const cw = w * 0.34;
  const ch = h * 0.4;
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const jitter = spacing * 0.4;
      const hx = clamp((gx + 0.5) * spacing + (rand() - 0.5) * jitter, 1, w - 1);
      const hy = clamp((gy + 0.5) * spacing + (rand() - 0.5) * jitter, 1, h - 1);
      const overCasting = Math.abs(hx - cx) < cw / 2 && Math.abs(hy - cy) < ch / 2;
      const base = rand();
      const escapeThresh = clamp(base * (overCasting ? 0.55 : 0.9), 0.02, 0.92);
      const isDust = rand() < 0.35;
      const angle = Math.PI * 0.5 + (rand() - 0.5) * Math.PI * 0.9; // biased downward
      const dist = h * (0.5 + rand() * 0.9);
      grains.push({
        hx,
        hy,
        r: spacing * (0.32 + rand() * 0.22),
        escapeThresh,
        jphase: rand() * Math.PI * 2,
        isDust,
        dx: Math.cos(angle) * dist * 0.5,
        dy: Math.sin(angle) * dist,
        // non-dust grains settle into a loose pile along the bottom edge
        px: clamp(hx + (rand() - 0.5) * w * 0.5, spacing, w - spacing),
        py: h - spacing * (0.6 + rand() * 1.4),
      });
    }
  }
  return grains;
}

export interface ShakeoutCrumbleProps {
  /** resting label, before any activation */
  label?: ReactNode;
  /** label shown once armed, awaiting the confirming second activation */
  armedLabel?: ReactNode;
  /** label shown once committed (terminal) */
  clearedLabel?: ReactNode;
  /** ms the armed window stays open before auto-cancelling */
  armMs?: number;
  /** called once, the instant the second activation commits */
  onConfirm?: () => void;
  className?: string;
}

export function ShakeoutCrumble({
  label = "Clear all",
  armedLabel = "Confirm clear all?",
  clearedLabel = "Cleared",
  armMs = ARM_MS,
  onConfirm,
  className = "",
}: ShakeoutCrumbleProps) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [announce, setAnnounce] = useState("");
  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;
  const armMsRef = useRef(armMs);
  armMsRef.current = armMs;

  const s = useRef({
    mode: "ambient" as Mode,
    ambientMs: 0,
    lastT: 0,
    armStart: 0,
    dearmStart: 0,
    dearmFromDrive: 0,
    dearmFromShake: 0.15,
    commitStart: 0,
    commitFromDrive: 0,
    commitFromShake: 0.15,
    raf: 0,
    w: 0,
    h: 0,
    dpr: 1,
    reduced: false,
    visible: true,
    grains: [] as Grain[],
    fg: "",
    muted: "",
    bg: "",
  });

  // colors derived unconditionally before first paint — nothing draws off an
  // empty token string
  useLayoutEffect(() => {
    const st = s.current;
    const sync = () => {
      const cs = getComputedStyle(document.documentElement);
      st.fg = cs.getPropertyValue("--foreground").trim();
      st.muted = cs.getPropertyValue("--ns-muted").trim();
      st.bg = cs.getPropertyValue("--background").trim();
      draw();
    };
    let draw = () => {};
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d") ?? null;
    draw = () => {
      const { w, h, dpr } = st;
      if (!ctx || !w || !h) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (!st.fg) return;

      let drive: number;
      let shake: number;
      if (st.reduced) {
        drive = st.mode === "committed" ? 1 : st.mode === "armed" || st.mode === "committing" ? STATIC_ARM_DRIVE : STATIC_DRIVE;
        shake = 0;
      } else {
        ({ drive, shake } = computeDrive(performance.now()));
      }

      // casting: a static ingot form, drawn first so it shows through
      // wherever grain coverage above it has thinned
      const cx = w / 2;
      const cy = h / 2;
      const cw = w * 0.34;
      const ch = h * 0.4;
      const rad = Math.min(cw, ch) * 0.18;
      ctx.globalAlpha = 1;
      ctx.fillStyle = st.fg;
      roundRect(ctx, cx - cw / 2, cy - ch / 2, cw, ch, rad);
      ctx.fill();
      // bevel: an alpha-only inset lightened toward background — no new hue
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = st.bg;
      roundRect(ctx, cx - cw / 2 + cw * 0.14, cy - ch / 2 + ch * 0.16, cw * 0.72, ch * 0.22, rad * 0.6);
      ctx.fill();
      ctx.globalAlpha = 1;

      // grains, bucketed by alpha so draw-call count is flat regardless of count
      const vibeAmp = 0.35 + shake * 1.6;
      const now = performance.now();
      const buckets: { x: number; y: number; r: number }[][] = Array.from({ length: BUCKETS }, () => []);
      for (const g of st.grains) {
        const e = clamp((drive - g.escapeThresh) / ESCAPE_SPAN, 0, 1);
        const eased = smoothstep(e);
        let px: number;
        let py: number;
        let alpha: number;
        if (g.isDust) {
          px = g.hx + g.dx * eased;
          py = g.hy + g.dy * eased;
          alpha = 1 - eased;
        } else {
          px = lerp(g.hx, g.px, eased);
          py = lerp(g.hy, g.py, eased);
          alpha = 1;
        }
        if (!st.reduced && alpha > 0.02) {
          px += Math.sin(now * 0.011 + g.jphase) * vibeAmp * 0.6;
          py += Math.cos(now * 0.013 + g.jphase * 1.7) * vibeAmp * 0.5;
        }
        if (alpha <= 0.02) continue;
        const bIdx = Math.min(BUCKETS - 1, Math.floor(alpha * BUCKETS));
        buckets[bIdx].push({ x: px, y: py, r: g.r });
      }
      ctx.fillStyle = st.muted;
      for (let bi = 0; bi < BUCKETS; bi++) {
        const pts = buckets[bi];
        if (!pts.length) continue;
        ctx.globalAlpha = (bi + 0.5) / BUCKETS;
        ctx.beginPath();
        for (const pt of pts) {
          ctx.moveTo(pt.x + pt.r, pt.y);
          ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
        }
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    function computeDrive(now: number): { drive: number; shake: number } {
      const st2 = s.current;
      if (st2.mode === "ambient") {
        st2.ambientMs += now - (st2.lastT || now);
        st2.lastT = now;
        const p = (st2.ambientMs % AMBIENT_PERIOD) / AMBIENT_PERIOD;
        return ambientEnvelope(p);
      }
      st2.lastT = now;
      if (st2.mode === "armed") {
        const t = clamp((now - st2.armStart) / armMsRef.current, 0, 1);
        const drive = 0.2 + 0.65 * t;
        const shake = 0.3 + 0.7 * t;
        if (t >= 1) {
          beginDearm(now, drive, shake);
          return computeDrive(now);
        }
        return { drive, shake };
      }
      if (st2.mode === "dearming") {
        const t = clamp((now - st2.dearmStart) / DEARM_MS, 0, 1);
        const drive = lerp(st2.dearmFromDrive, 0, t);
        const shake = lerp(st2.dearmFromShake, 0.15, t);
        if (t >= 1) {
          st2.mode = "ambient";
          st2.ambientMs = 0;
        }
        return { drive, shake };
      }
      if (st2.mode === "committing") {
        const t = clamp((now - st2.commitStart) / COMMIT_MS, 0, 1);
        const drive = lerp(st2.commitFromDrive, 1, smoothstep(t));
        const shake = lerp(st2.commitFromShake, 0.15, t);
        if (t >= 1) {
          st2.mode = "committed";
          setPhase("committed");
          setAnnounce((a) => "Cleared" + (a.endsWith("​") ? "" : "​"));
          return { drive: 1, shake: 0.15 };
        }
        return { drive, shake };
      }
      // committed
      return { drive: 1, shake: 0.15 };
    }

    const wake = () => {
      if (st.raf || !st.visible || st.reduced) return;
      st.lastT = performance.now();
      st.raf = requestAnimationFrame(tick);
    };
    const tick = () => {
      draw();
      if (st.visible && !st.reduced) {
        st.raf = requestAnimationFrame(tick);
      } else {
        st.raf = 0;
      }
    };

    const beginDearm = (now: number, fromDrive: number, fromShake: number) => {
      st.mode = "dearming";
      st.dearmStart = now;
      st.dearmFromDrive = fromDrive;
      st.dearmFromShake = fromShake;
      setPhase("idle");
      setAnnounce((a) => "Cancelled" + (a.endsWith("​") ? "" : "​"));
    };

    const beginArm = (now: number) => {
      st.mode = "armed";
      st.armStart = now;
      setPhase("armed");
      setAnnounce((a) => "Awaiting confirmation" + (a.endsWith("​") ? "" : "​"));
      wake();
    };

    const beginCommit = (now: number, fromDrive: number, fromShake: number) => {
      st.mode = "committing";
      st.commitStart = now;
      st.commitFromDrive = fromDrive;
      st.commitFromShake = fromShake;
      onConfirmRef.current?.();
      wake();
    };

    const handleActivate = () => {
      const now = performance.now();
      if (st.mode === "committed" || st.mode === "committing") return;
      if (st.reduced) {
        if (st.mode === "ambient" || st.mode === "dearming") {
          st.mode = "armed";
          st.armStart = now;
          setPhase("armed");
          setAnnounce((a) => "Awaiting confirmation" + (a.endsWith("​") ? "" : "​"));
          draw();
        } else if (st.mode === "armed") {
          st.mode = "committed";
          setPhase("committed");
          setAnnounce((a) => "Cleared" + (a.endsWith("​") ? "" : "​"));
          onConfirmRef.current?.();
          draw();
        }
        return;
      }
      if (st.mode === "ambient") {
        beginArm(now);
      } else if (st.mode === "armed") {
        const t = clamp((now - st.armStart) / armMsRef.current, 0, 1);
        beginCommit(now, 0.2 + 0.65 * t, 0.3 + 0.7 * t);
      } else if (st.mode === "dearming") {
        beginArm(now);
      }
    };

    const onCancelKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && st.mode === "armed") {
        const now = performance.now();
        if (st.reduced) {
          st.mode = "ambient";
          setPhase("idle");
          setAnnounce((a) => "Cancelled" + (a.endsWith("​") ? "" : "​"));
          draw();
        } else {
          const t = clamp((now - st.armStart) / armMsRef.current, 0, 1);
          beginDearm(now, 0.2 + 0.65 * t, 0.3 + 0.7 * t);
        }
      }
    };
    const onBlur = () => {
      if (st.mode !== "armed") return;
      const now = performance.now();
      if (st.reduced) {
        st.mode = "ambient";
        setPhase("idle");
        draw();
      } else {
        const t = clamp((now - st.armStart) / armMsRef.current, 0, 1);
        beginDearm(now, 0.2 + 0.65 * t, 0.3 + 0.7 * t);
      }
    };

    const btn = btnRef.current;
    btn?.addEventListener("click", handleActivate);
    btn?.addEventListener("keydown", onCancelKey);
    btn?.addEventListener("blur", onBlur);

    const ro = new ResizeObserver(() => {
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      st.w = r.width;
      st.h = r.height;
      st.dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas) {
        canvas.width = Math.max(1, Math.round(st.w * st.dpr));
        canvas.height = Math.max(1, Math.round(st.h * st.dpr));
      }
      st.grains = buildGrains(st.w, st.h);
      draw();
    });
    if (btn) ro.observe(btn);

    const io = new IntersectionObserver(([entry]) => {
      st.visible = entry.isIntersecting;
      if (st.visible) wake();
      else if (st.raf) {
        cancelAnimationFrame(st.raf);
        st.raf = 0;
      }
    });
    if (btn) io.observe(btn);

    const onVis = () => {
      st.visible = document.visibilityState === "visible" && st.visible;
      if (document.visibilityState !== "visible" && st.raf) {
        cancelAnimationFrame(st.raf);
        st.raf = 0;
      } else if (document.visibilityState === "visible") {
        wake();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    const mo = new MutationObserver(sync);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMq = () => {
      st.reduced = mq.matches;
      if (st.raf) {
        cancelAnimationFrame(st.raf);
        st.raf = 0;
      }
      if (!st.reduced) wake();
      else draw();
    };
    st.reduced = mq.matches;
    mq.addEventListener("change", onMq);

    sync();
    if (!st.reduced) wake();

    return () => {
      if (st.raf) cancelAnimationFrame(st.raf);
      st.raf = 0;
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      mq.removeEventListener("change", onMq);
      btn?.removeEventListener("click", handleActivate);
      btn?.removeEventListener("keydown", onCancelKey);
      btn?.removeEventListener("blur", onBlur);
    };
  }, []);

  const visibleLabel = phase === "committed" ? clearedLabel : phase === "armed" ? armedLabel : label;

  return (
    <button
      ref={btnRef}
      type="button"
      aria-disabled={phase === "committed" || undefined}
      className={[
        "ns-shakeout-btn relative isolate flex aspect-[16/7] w-full max-w-sm select-none items-center justify-center overflow-hidden",
        "rounded-md border border-border bg-background",
        "hover:border-ns-muted",
        "transition-colors duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent",
        className,
      ].join(" ")}
    >
      <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />
      <span className="ns-shakeout-label relative z-10 rounded-sm border border-border bg-background/85 px-3 py-1.5 text-sm font-medium text-foreground backdrop-blur-sm">
        {visibleLabel}
      </span>
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announce}
      </span>
    </button>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
