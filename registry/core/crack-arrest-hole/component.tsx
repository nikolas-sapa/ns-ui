"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

// STOP/ABORT confirm modeled on the real structural-repair technique of
// drilling a crack-arrest (stop) hole at a fatigue crack's tip: the round
// hole blunts the stress concentration that was driving the crack forward
// and halts propagation. Here the mapping is deliberate and NOT a
// commit-the-destruction gesture: holding grows a crack from the control's
// edge toward a fixed drilled hole: reaching the hole ARRESTS it, and that
// arrest IS the confirmation — suited to STOP/ABORT/CANCEL, not to a
// destructive commit (which is what confirm-slide-shatter's break-through is
// for). Release early and the crack heals and re-seeds a new path; a full
// hold arrests permanently for a beat, announces, then resets — continuous.
// Direct-DOM/canvas physics on the hot path, React state only at the rare
// arrested/idle transitions. Tokens read from document.documentElement via
// getComputedStyle, re-read on a MutationObserver watching its class.

type Pt = { x: number; y: number };
type Mode = "idle" | "hold" | "heal" | "arrest";

const HALF_ANNOUNCE_AT = 0.5;
const ARREST_HOLD_MS = 650; // solid-arrested dwell before the beat that resets it
const ARREST_FADE_MS = 320;
const STATIC_DEMO_P = 0.52; // reduced-motion freeze: partway, so the mechanic reads in one still

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

/** jagged random-walk polyline from the left edge to the drilled hole's rim —
 *  straight segments, not bezier: cracks don't have curvature. Amplitude
 *  tapers as it nears the hole, like a crack tip drawn straight into a stop
 *  hole rather than wandering past it. */
function buildCrackPath(w: number, h: number, holeX: number, holeY: number, holeR: number, seed: number): Pt[] {
  const rng = mulberry32(seed);
  const originX = w * 0.09;
  const originY = h * 0.5;
  const endX = holeX - holeR * 0.98;
  const endY = holeY;
  const N = 9;
  const pts: Pt[] = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const x = originX + (endX - originX) * t;
    const amp = h * 0.15 * (1 - t * 0.62);
    const y = i === 0 ? originY : i === N - 1 ? endY : originY + (rng() * 2 - 1) * amp;
    pts.push({ x, y });
  }
  return pts;
}

function cumulativeLengths(pts: Pt[]): { cum: number[]; total: number } {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x;
    const dy = pts[i].y - pts[i - 1].y;
    cum.push(cum[i - 1] + Math.hypot(dx, dy));
  }
  return { cum, total: cum[cum.length - 1] };
}

export function CrackArrestHole({
  children = "Hold to stop",
  arrestedLabel = "Arrested",
  holdMs = 900,
  width = 224,
  height = 56,
  onArrest,
  className = "",
}: {
  /** label shown before arrest */
  children?: ReactNode;
  /** label shown briefly once the crack reaches the hole */
  arrestedLabel?: ReactNode;
  /** ms the control must be held before the crack reaches the hole */
  holdMs?: number;
  /** px width of the control */
  width?: number;
  /** px height of the control */
  height?: number;
  /** called once per completed arrest */
  onArrest?: () => void;
  /** extra classes merged onto the rendered button */
  className?: string;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [arrested, setArrested] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const onArrestRef = useRef(onArrest);
  onArrestRef.current = onArrest;
  const holdMsRef = useRef(holdMs);
  holdMsRef.current = holdMs;

  const stateRef = useRef({
    mode: "idle" as Mode,
    p: 0,
    v: 0,
    holding: false,
    halfAnnounced: false,
    arrestStart: 0,
    seed: Math.floor(Math.random() * 2 ** 31),
    points: [] as Pt[],
    cum: [] as number[],
    total: 0,
    w: 0,
    h: 0,
    holeX: 0,
    holeY: 0,
    holeR: 0,
    dpr: 1,
    reduced: false,
    visible: true,
    raf: 0,
    last: 0,
    mountedAt: 0,
    scale: 1,
    sv: 0,
    shake: 0,
    // tokens: start empty, assigned unconditionally in useLayoutEffect below —
    // nothing paints before the read.
    tokens: { foreground: "", muted: "", border: "", background: "" },
  });

  useLayoutEffect(() => {
    const s = stateRef.current;
    const btn = btnRef.current;
    const canvas = canvasRef.current;
    if (!btn || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    s.mountedAt = performance.now();

    const layoutHole = () => {
      s.holeX = s.w * 0.76;
      s.holeY = s.h * 0.5;
      s.holeR = Math.max(3, s.h * 0.15);
    };

    const regenPath = () => {
      s.seed = (s.seed + 0x9e3779b9) >>> 0;
      s.points = buildCrackPath(s.w, s.h, s.holeX, s.holeY, s.holeR, s.seed);
      const { cum, total } = cumulativeLengths(s.points);
      s.cum = cum;
      s.total = total;
    };

    const syncTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      s.tokens.foreground = cs.getPropertyValue("--foreground").trim();
      s.tokens.muted = cs.getPropertyValue("--ns-muted").trim();
      s.tokens.border = cs.getPropertyValue("--border").trim();
      s.tokens.background = cs.getPropertyValue("--background").trim();
      draw();
    };

    // partial polyline up to arc-length `len`, straight segments (no smoothing)
    const strokePartial = (len: number) => {
      if (len <= 0) return;
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      let i = 1;
      for (; i < s.points.length && s.cum[i] < len; i++) {
        ctx.lineTo(s.points[i].x, s.points[i].y);
      }
      if (i < s.points.length) {
        const a = s.points[i - 1];
        const b = s.points[i];
        const segLen = s.cum[i] - s.cum[i - 1];
        const f = segLen > 0 ? (len - s.cum[i - 1]) / segLen : 0;
        ctx.lineTo(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f);
      }
      ctx.stroke();
    };

    const drawHole = (alpha: number, width: number) => {
      ctx.beginPath();
      ctx.arc(s.holeX, s.holeY, s.holeR, 0, Math.PI * 2);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = s.tokens.foreground;
      ctx.lineWidth = width;
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    // resting fatigue read: the material is already under load, so a few
    // short striations near the edge and a faint stress ring around the hole
    // shimmer even with no input — three independent phases so the pattern is
    // never a single static pulse, and genuinely different at t0/2.5s/5s.
    const drawAmbient = (now: number) => {
      const tSec = (now - s.mountedAt) / 1000;
      ctx.strokeStyle = s.tokens.muted;
      ctx.lineWidth = 1;
      const originX = s.w * 0.09;
      const originY = s.h * 0.5;
      const tickPhases = [0, 2.05, 3.9];
      const tickFreq = [1.3, 1.05, 1.55];
      for (let k = 0; k < 3; k++) {
        const a = 0.16 + 0.16 * (0.5 + 0.5 * Math.sin(tSec * tickFreq[k] + tickPhases[k]));
        const dx = -6 - k * 5;
        const dy = (k - 1) * s.h * 0.16;
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.moveTo(originX + dx, originY + dy - 3.5);
        ctx.lineTo(originX + dx + 3, originY + dy + 3.5);
        ctx.stroke();
      }
      const ringA = 0.14 + 0.16 * (0.5 + 0.5 * Math.sin(tSec * (2 * Math.PI) / 4.6));
      ctx.globalAlpha = ringA;
      ctx.beginPath();
      ctx.arc(s.holeX, s.holeY, s.holeR + 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    const draw = () => {
      const { w, h, dpr } = s;
      if (!w || !h) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (s.mode === "idle") {
        const holeAlpha = 0.55;
        if (s.reduced) {
          // frozen, non-t0 demo frame: crack drawn partway to the hole so
          // the mechanic reads in a single still, no shimmer/oscillation
          drawHole(holeAlpha, 1.5);
          ctx.strokeStyle = s.tokens.foreground;
          ctx.lineWidth = 1.2;
          strokePartial(s.total * STATIC_DEMO_P);
        } else {
          drawHole(holeAlpha, 1.5);
          drawAmbient(performance.now());
        }
        return;
      }

      if (s.mode === "hold" || s.mode === "heal") {
        drawHole(0.55, 1.5);
        const len = s.total * Math.max(0, Math.min(1, s.p));
        // dual pass: hairline + a faint offset ghost, same depth cue the
        // other confirms use for glass/ink
        ctx.strokeStyle = s.tokens.muted;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 0.75 + s.p * 0.6;
        ctx.save();
        ctx.translate(0.6, 0.6);
        strokePartial(len);
        ctx.restore();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = s.tokens.foreground;
        ctx.lineWidth = 1 + s.p * 0.9;
        strokePartial(len);
        return;
      }

      if (s.mode === "arrest") {
        const elapsed = performance.now() - s.arrestStart;
        const fadeStart = ARREST_HOLD_MS;
        const alpha =
          elapsed <= fadeStart ? 1 : Math.max(0, 1 - (elapsed - fadeStart) / ARREST_FADE_MS);
        ctx.globalAlpha = alpha;
        drawHole(1, 2.25);
        ctx.strokeStyle = s.tokens.foreground;
        ctx.lineWidth = 2;
        strokePartial(s.total);
        ctx.globalAlpha = 1;
      }
    };

    const applyTransform = () => {
      if (s.mode === "hold") {
        const jitter = s.reduced ? 0 : s.p * s.p * 1.1;
        const jx = (Math.random() - 0.5) * 2 * jitter;
        const jy = (Math.random() - 0.5) * 2 * jitter;
        btn.style.transform = `translate(${jx.toFixed(2)}px, ${jy.toFixed(2)}px)`;
      } else if (s.mode === "arrest") {
        btn.style.transform = `scale(${s.scale.toFixed(4)})`;
      } else {
        btn.style.transform = "";
      }
    };

    const beginArrest = () => {
      s.mode = "arrest";
      s.arrestStart = performance.now();
      s.p = 1;
      s.scale = s.reduced ? 1 : 0.972;
      s.sv = s.reduced ? 0 : 0.55;
      setArrested(true);
      setAnnouncement("Arrested.");
      onArrestRef.current?.();
    };

    const resetToIdle = () => {
      s.mode = "idle";
      s.p = 0;
      s.v = 0;
      s.halfAnnounced = false;
      s.scale = 1;
      regenPath();
      setArrested(false);
      applyTransform();
      draw();
    };

    const wake = () => {
      if (s.raf || !s.visible) return;
      s.last = performance.now();
      s.raf = requestAnimationFrame(tick);
    };

    const tick = (now: number) => {
      const rawMs = now - s.last;
      const dtMs = Math.min(64, rawMs);
      s.last = now;
      const dt = dtMs / 1000;

      if (s.mode === "hold") {
        s.p += rawMs / holdMsRef.current;
        if (!s.halfAnnounced && s.p >= HALF_ANNOUNCE_AT) {
          s.halfAnnounced = true;
          setAnnouncement("Halfway to arrest.");
        }
        if (s.p >= 1) {
          s.p = 1;
          beginArrest();
        }
      } else if (s.mode === "heal") {
        if (s.reduced) {
          s.p -= (dtMs / holdMsRef.current) * 2.6;
          if (s.p <= 0) {
            s.p = 0;
            resetToIdle();
            return;
          }
        } else {
          s.v += (-220 * s.p - 16 * s.v) * dt;
          s.p += s.v * dt;
          if (s.p <= 0) {
            s.p = 0;
            s.v = 0;
          }
          if (s.p < 0.006 && Math.abs(s.v) < 0.2) {
            resetToIdle();
            return;
          }
        }
      } else if (s.mode === "arrest") {
        const elapsed = now - s.arrestStart;
        if (!s.reduced) {
          s.sv += ((1 - s.scale) * 300 - 12 * s.sv) * dt;
          s.scale += s.sv * dt;
        }
        if (elapsed >= ARREST_HOLD_MS + ARREST_FADE_MS) {
          resetToIdle();
          return;
        }
      } else {
        // idle: ambient shimmer keeps running unless reduced-motion freezes it
        if (s.reduced) {
          s.raf = 0;
          draw();
          return;
        }
      }

      draw();
      applyTransform();
      if (s.visible) {
        s.raf = requestAnimationFrame(tick);
      } else {
        s.raf = 0;
      }
    };

    const startHold = () => {
      if (s.mode === "arrest") return;
      s.mode = "hold";
      s.halfAnnounced = false;
      if (s.p <= 0) s.v = 0;
      s.holding = true;
      wake();
    };

    const release = () => {
      if (!s.holding) return;
      s.holding = false;
      if (s.mode !== "hold") return;
      if (s.p > 0) {
        s.mode = "heal";
        s.v = s.reduced ? 0 : -1.1;
        wake();
      } else {
        s.mode = "idle";
        applyTransform();
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      btn.setPointerCapture(e.pointerId);
      startHold();
    };
    const onPointerEnd = () => release();
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.key === " " || e.key === "Enter") && !e.repeat) {
        e.preventDefault();
        startHold();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") release();
    };
    btn.addEventListener("pointerdown", onPointerDown);
    btn.addEventListener("pointerup", onPointerEnd);
    btn.addEventListener("pointercancel", onPointerEnd);
    btn.addEventListener("lostpointercapture", onPointerEnd);
    btn.addEventListener("keydown", onKeyDown);
    btn.addEventListener("keyup", onKeyUp);
    btn.addEventListener("blur", onPointerEnd);

    const ro = new ResizeObserver(() => {
      const r = btn.getBoundingClientRect();
      s.w = r.width;
      s.h = r.height;
      s.dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(s.w * s.dpr));
      canvas.height = Math.max(1, Math.round(s.h * s.dpr));
      layoutHole();
      regenPath();
      draw();
    });
    ro.observe(btn);

    const io = new IntersectionObserver(([entry]) => {
      s.visible = entry.isIntersecting;
      if (s.visible) {
        if (s.mode !== "idle" || !s.reduced) wake();
      } else if (s.raf) {
        cancelAnimationFrame(s.raf);
        s.raf = 0;
      }
    });
    io.observe(btn);

    const onVisChange = () => {
      if (document.hidden) {
        if (s.raf) {
          cancelAnimationFrame(s.raf);
          s.raf = 0;
        }
      } else if (s.mode !== "idle" || !s.reduced) {
        wake();
      }
    };
    document.addEventListener("visibilitychange", onVisChange);

    const mo = new MutationObserver(syncTokens);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMq = () => {
      s.reduced = mq.matches;
      if (!s.reduced && s.mode === "idle") wake();
      draw();
    };
    s.reduced = mq.matches;
    mq.addEventListener("change", onMq);

    syncTokens();
    if (!s.reduced) wake();

    return () => {
      cancelAnimationFrame(s.raf);
      s.raf = 0;
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVisChange);
      mq.removeEventListener("change", onMq);
      btn.removeEventListener("pointerdown", onPointerDown);
      btn.removeEventListener("pointerup", onPointerEnd);
      btn.removeEventListener("pointercancel", onPointerEnd);
      btn.removeEventListener("lostpointercapture", onPointerEnd);
      btn.removeEventListener("keydown", onKeyDown);
      btn.removeEventListener("keyup", onKeyUp);
      btn.removeEventListener("blur", onPointerEnd);
    };
  }, []);

  return (
    <button
      ref={btnRef}
      type="button"
      className={[
        "ns-cah-btn relative isolate inline-flex select-none touch-none items-center justify-center overflow-hidden",
        "rounded-sm border border-border bg-surface text-sm font-medium text-foreground",
        "hover:border-ns-muted hover:bg-border/60",
        "transition-[border-color,background-color] duration-150",
        "focus:border-ns-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent",
        className,
      ].join(" ")}
      style={{ width, height }}
    >
      <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />
      <span className="relative z-10">{arrested ? arrestedLabel : children}</span>
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </button>
  );
}
