"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// SeedCrystal — a high-stakes success moment built on supercooling. While an
// action is pending (payment confirming, deploy running, publish in flight)
// the panel behind the content is a supercooled liquid: a canvas particle
// field of ~800 points doing damped random walks, a faint restless shimmer
// that visibly holds more energy than a settled surface should. The instant
// the pending action resolves, a nucleation flash fires at the exact point
// the user pressed and dendritic crystal growth races outward from it —
// needle segments advancing with side branches forking at ~60deg at
// depth-decaying probability — while nearby shimmer particles lock onto the
// nearest needle as its front passes, freezing the whole pane solid in
// ~700ms. The confirmation line then sits calm on the now-still crystal.
//
// MECHANISM: growth is precomputed synchronously the instant success fires
// (mulberry32-seeded), not simulated tip-by-tip per frame — every needle
// segment carries a "birth" time (seconds from growth start) baked in when
// it's built, the same reveal-by-threshold technique as frostbite-switch.
// Each animation frame just draws every segment whose birth <= elapsed and
// every particle whose precomputed lockBirth <= elapsed, which is O(live
// geometry) per frame instead of O(particles x segments) per frame — the
// nearest-segment lock search itself is a single one-time scan done once at
// growth start, not repeated on every tick.
//
// A locked particle's target point and birth are baked in at that same scan;
// past its lockBirth it eases from its ambient position onto the needle
// over a short settle window, tinting from --muted toward --foreground as it
// commits. Once every particle has finished settling the loop cancels itself
// entirely — "frozen" is a real stopped rAF, not a slow one, matching the
// brief's "freezing solid" rather than an animation that merely looks still.
//
// TOKENS: every drawn color is read from --muted / --foreground via
// getComputedStyle at mount and re-derived on a MutationObserver watching
// documentElement class changes (both the live loop and a frozen redraw use
// the same ref, so a theme flip repaints correctly whether mid-growth or
// long settled). The canvas itself is never painted with a background —
// --background shows through from the panel div underneath it.
//
// A11Y: canvas is aria-hidden + role=presentation. Success is announced via
// a role=status aria-live=assertive line that mounts the instant React state
// flips to "success" — independent of the ~700ms canvas animation, which is
// purely decorative. The trigger button is never disabled (state re-entry is
// guarded in JS, not via the disabled attribute), so it stays clickable
// throughout and never blocks anything. Reduced motion swaps the whole
// canvas for one static, seeded-once crystal texture — no shimmer, no
// growth — with the same status text driven by the same state machine.
// ---------------------------------------------------------------------------

type Status = "idle" | "pending" | "success";
type RGB = [number, number, number];

interface Seg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  depth: number;
  birth: number; // seconds from growth start
}

interface Particle {
  bx: number; // base x, px
  by: number; // base y, px
  dx: number; // OU shimmer offset x, px
  dy: number;
  vx: number;
  vy: number;
  lockBirth: number; // seconds; Infinity = never locks
  lx: number; // lock target x
  ly: number; // lock target y
}

const PARTICLE_COUNT = 800;
const MAX_SEGS = 900;
const LOCK_RADIUS = 15; // px
const SETTLE_S = 0.22;
const FLASH_MS = 180;
const FREEZE_PAD_MS = 260; // extra time after growMs for the last lock to settle

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function easeOutCubic(t: number) {
  const u = 1 - t;
  return 1 - u * u * u;
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

function parseHex(v: string): RGB | null {
  const m = v.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let h = m[1]!;
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function readToken(el: HTMLElement, name: string, fallback: RGB): RGB {
  return parseHex(getComputedStyle(el).getPropertyValue(name)) ?? fallback;
}

function rgbaStr(rgb: RGB, a: number): string {
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
}

function mixRgb(a: RGB, b: RGB, t: number): RGB {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function buildDust(count: number, w: number, h: number, rand: () => number): Particle[] {
  const out: Particle[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      bx: lerp(w * 0.04, w * 0.96, rand()),
      by: lerp(h * 0.04, h * 0.96, rand()),
      dx: 0,
      dy: 0,
      vx: 0,
      vy: 0,
      lockBirth: Infinity,
      lx: 0,
      ly: 0,
    });
  }
  return out;
}

// Precompute the whole dendritic pattern up front: primary arms radiate from
// the nucleation point, each a slightly curved walk that throws side
// branches at ~60deg with depth-decaying probability. Every segment's birth
// time is baked in at build time (reveal-by-threshold at draw time), the
// same trick frostbite-switch uses for its frost spines.
function buildCrystal(
  rand: () => number,
  cx: number,
  cy: number,
  w: number,
  h: number,
  growS: number
): { segs: Seg[]; maxBirth: number } {
  const segs: Seg[] = [];
  const STEP = 4;
  const maxLen = Math.hypot(w, h) * 0.58;
  const speed = maxLen / growS; // px/s, tuned so a straight arm finishes near growS
  const stepDur = STEP / speed;
  const maxDepth = 3;
  const baseProb = 0.5;
  const decay = 0.5;

  function grow(x: number, y: number, angle: number, depth: number, birth: number, steps: number) {
    let a = angle;
    let bx = x;
    let by = y;
    let b = birth;
    const curv = (rand() - 0.5) * 0.05;
    for (let k = 0; k < steps && segs.length < MAX_SEGS; k++) {
      a += curv + (rand() - 0.5) * 0.14;
      const nx = bx + Math.cos(a) * STEP;
      const ny = by + Math.sin(a) * STEP;
      if (nx < 1 || nx > w - 1 || ny < 1 || ny > h - 1) break;
      const birthClamped = Math.min(b, growS);
      segs.push({ x1: bx, y1: by, x2: nx, y2: ny, depth, birth: birthClamped });
      if (depth < maxDepth && k > 1 && k % 3 === 0) {
        const p = baseProb * Math.pow(decay, depth);
        if (rand() < p) {
          const side = rand() < 0.5 ? 1 : -1;
          const branchAngle = a + side * (0.96 + rand() * 0.18); // ~55-65deg
          const branchSteps = Math.max(3, Math.floor(steps * 0.45));
          grow(nx, ny, branchAngle, depth + 1, b + stepDur * 0.6, branchSteps);
        }
      }
      b += stepDur;
      bx = nx;
      by = ny;
    }
  }

  const arms = 5 + Math.floor(rand() * 2);
  const spread = (Math.PI * 2) / arms;
  for (let i = 0; i < arms; i++) {
    const angle = i * spread + (rand() - 0.5) * spread * 0.6;
    grow(cx, cy, angle, 0, 0, Math.ceil(maxLen / STEP));
  }

  let maxBirth = 0;
  for (const s of segs) if (s.birth > maxBirth) maxBirth = s.birth;
  return { segs, maxBirth: Math.max(maxBirth, 0.001) };
}

// one-time nearest-segment-endpoint scan: every particle either finds a
// needle endpoint within LOCK_RADIUS (and adopts that segment's birth as its
// own lockBirth + that endpoint as its settle target) or never locks and
// simply stops moving, in place, when the pane freezes.
function assignLocks(particles: Particle[], segs: Seg[]) {
  for (const p of particles) {
    let bestD = LOCK_RADIUS * LOCK_RADIUS;
    let bestSeg: Seg | null = null;
    for (const s of segs) {
      const dx = s.x2 - p.bx;
      const dy = s.y2 - p.by;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        bestSeg = s;
      }
    }
    if (bestSeg) {
      p.lockBirth = bestSeg.birth;
      p.lx = bestSeg.x2;
      p.ly = bestSeg.y2;
    }
  }
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

export interface SeedCrystalProps {
  /** idle button label. default "Confirm payment" */
  label?: string;
  /** button label while the action is in flight. default "Confirming…" */
  pendingLabel?: string;
  /** the calm payoff line, also the aria-live=assertive announcement text. default "Payment confirmed" */
  confirmedText?: string;
  /** called on trigger; return a Promise and success plays on resolve (or reverts to idle on reject) */
  onConfirm?: () => void | Promise<void>;
  /** fallback simulated pending duration when onConfirm is absent or synchronous. default 900 */
  pendingMs?: number;
  /** crystal growth duration in ms. default 700 */
  growMs?: number;
  className?: string;
}

export function SeedCrystal({
  label = "Confirm payment",
  pendingLabel = "Confirming…",
  confirmedText = "Payment confirmed",
  onConfirm,
  pendingMs = 900,
  growMs = 700,
  className = "",
}: SeedCrystalProps) {
  const reduced = useReducedMotion();
  const [status, setStatus] = useState<Status>("idle");
  const statusRef = useRef<Status>("idle");
  statusRef.current = status;

  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const pendingMsRef = useRef(pendingMs);
  pendingMsRef.current = pendingMs;
  const growMsRef = useRef(growMs);
  growMsRef.current = growMs;
  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;

  const engineRef = useRef({
    w: 0,
    h: 0,
    dpr: 1,
    particles: [] as Particle[],
    segs: [] as Seg[],
    maxBirth: 0.001,
    growStart: 0, // performance.now() ms
    nucX: 0,
    nucY: 0,
    frozen: false,
    raf: 0,
    lastNow: 0,
    visible: true,
    muted: [141, 141, 141] as RGB,
    foreground: [237, 237, 237] as RGB,
    reduced: false,
    seedCounter: 1,
  });

  const controls = useRef<{
    startPending?: () => void;
    startGrowth?: (x: number, y: number) => void;
  }>({});

  useEffect(() => {
    const panel = panelRef.current;
    const canvas = canvasRef.current;
    if (!panel || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const e = engineRef.current;

    const syncColors = () => {
      e.muted = readToken(panel, "--muted", e.muted);
      e.foreground = readToken(panel, "--foreground", e.foreground);
    };

    const resize = () => {
      const r = panel.getBoundingClientRect();
      e.w = Math.max(1, r.width);
      e.h = Math.max(1, r.height);
      e.dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(e.w * e.dpr);
      canvas.height = Math.round(e.h * e.dpr);
      canvas.style.width = `${e.w}px`;
      canvas.style.height = `${e.h}px`;
      if (statusRef.current === "idle" || statusRef.current === "pending") {
        // ambient only — safe to regenerate on resize, nothing depends on continuity
        e.particles = buildDust(PARTICLE_COUNT, e.w, e.h, mulberry32(e.seedCounter * 7919 + 1));
      }
    };

    const drawStatic = () => {
      // reduced motion: one faint, seeded-once dendritic texture, no motion.
      ctx.setTransform(e.dpr, 0, 0, e.dpr, 0, 0);
      ctx.clearRect(0, 0, e.w, e.h);
      const rand = mulberry32(424242);
      const { segs } = buildCrystal(rand, e.w * 0.5, e.h * 0.5, e.w, e.h, 1);
      ctx.lineCap = "round";
      ctx.strokeStyle = rgbaStr(e.foreground, 0.16);
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      for (const s of segs) {
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
      }
      ctx.stroke();
    };

    const drawDust = () => {
      ctx.setTransform(e.dpr, 0, 0, e.dpr, 0, 0);
      ctx.clearRect(0, 0, e.w, e.h);
      ctx.fillStyle = rgbaStr(e.muted, 0.55);
      for (const p of e.particles) {
        ctx.beginPath();
        ctx.arc(p.bx + p.dx, p.by + p.dy, 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const stepDust = (dtS: number) => {
      const K = 46; // spring back toward origin
      const C = 7.5; // damping
      const NOISE = 90;
      for (const p of e.particles) {
        p.vx += (-K * p.dx - C * p.vx) * dtS + (Math.random() - 0.5) * NOISE * dtS;
        p.vy += (-K * p.dy - C * p.vy) * dtS + (Math.random() - 0.5) * NOISE * dtS;
        p.dx += p.vx * dtS;
        p.dy += p.vy * dtS;
      }
    };

    const drawGrowth = (elapsedMs: number) => {
      ctx.setTransform(e.dpr, 0, 0, e.dpr, 0, 0);
      ctx.clearRect(0, 0, e.w, e.h);
      const elapsedS = elapsedMs / 1000;

      // nucleation flash
      if (elapsedMs < FLASH_MS) {
        const t = elapsedMs / FLASH_MS;
        const r = lerp(2, 46, easeOutCubic(t));
        const a = (1 - t) * 0.85;
        const grad = ctx.createRadialGradient(e.nucX, e.nucY, 0, e.nucX, e.nucY, r);
        grad.addColorStop(0, rgbaStr(e.foreground, a));
        grad.addColorStop(1, rgbaStr(e.foreground, 0));
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, e.w, e.h);
      }

      // particles: ambient shimmer until their needle passes, then settle
      // onto it, tinting from --muted toward --foreground as they commit.
      // (velocity/offset integration for the still-unlocked ones happens once
      // per frame in the caller, before this draw — this only reads state.)
      for (const p of e.particles) {
        if (elapsedS < p.lockBirth) {
          ctx.fillStyle = rgbaStr(e.muted, 0.55);
          ctx.beginPath();
          ctx.arc(p.bx + p.dx, p.by + p.dy, 0.9, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const t = clamp01((elapsedS - p.lockBirth) / SETTLE_S);
          const ease = easeOutCubic(t);
          const x = lerp(p.bx + p.dx, p.lx, ease);
          const y = lerp(p.by + p.dy, p.ly, ease);
          const col = mixRgb(e.muted, e.foreground, ease);
          ctx.fillStyle = rgbaStr(col, 0.5 + 0.45 * ease);
          ctx.beginPath();
          ctx.arc(x, y, 0.9 + 0.5 * ease, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // needles: soft halo pass then a crisp core, revealed by birth <= elapsed
      ctx.lineCap = "round";
      const widths = [1.4, 1.0, 0.75, 0.6];
      for (let pass = 0; pass < 2; pass++) {
        for (let d = 0; d <= 3; d++) {
          let any = false;
          ctx.beginPath();
          for (const s of e.segs) {
            if (s.depth !== d || s.birth > elapsedS) continue;
            ctx.moveTo(s.x1, s.y1);
            ctx.lineTo(s.x2, s.y2);
            any = true;
          }
          if (!any) continue;
          if (pass === 0) {
            ctx.strokeStyle = rgbaStr(e.foreground, 0.16);
            ctx.lineWidth = widths[d]! + 2.2;
          } else {
            ctx.strokeStyle = rgbaStr(e.foreground, 0.92);
            ctx.lineWidth = widths[d]!;
          }
          ctx.stroke();
        }
      }
    };

    // idle draws nothing (the panel's own --background shows through) and
    // does not reschedule itself — there's nothing to animate at rest, so
    // the loop stops rather than clearing an empty canvas 60x/s forever.
    const drawIdle = () => {
      ctx.setTransform(e.dpr, 0, 0, e.dpr, 0, 0);
      ctx.clearRect(0, 0, e.w, e.h);
    };

    const paintStill = () => {
      if (e.reduced) return drawStatic();
      const st = statusRef.current;
      if (st === "success") drawGrowth(e.frozen ? growMsRef.current + FREEZE_PAD_MS : performance.now() - e.growStart);
      else if (st === "pending") drawDust();
      else drawIdle();
    };

    const loop = (now: number) => {
      const dtMs = Math.min(48, now - e.lastNow);
      e.lastNow = now;
      const st = statusRef.current;

      if (st === "success") {
        const elapsedMs = now - e.growStart;
        // advance shimmer physics only for particles still unlocked
        const dtS = dtMs / 1000;
        const elapsedS = elapsedMs / 1000;
        const K = 46;
        const C = 7.5;
        const NOISE = 90;
        for (const p of e.particles) {
          if (elapsedS < p.lockBirth) {
            p.vx += (-K * p.dx - C * p.vx) * dtS + (Math.random() - 0.5) * NOISE * dtS;
            p.vy += (-K * p.dy - C * p.vy) * dtS + (Math.random() - 0.5) * NOISE * dtS;
            p.dx += p.vx * dtS;
            p.dy += p.vy * dtS;
          }
        }
        drawGrowth(elapsedMs);
        if (elapsedMs >= growMsRef.current + FREEZE_PAD_MS) {
          drawGrowth(growMsRef.current + FREEZE_PAD_MS); // final settled frame
          e.frozen = true;
          e.raf = 0;
          return; // loop stops — genuinely frozen, not just slow
        }
      } else if (st === "pending") {
        stepDust(dtMs / 1000);
        drawDust();
      } else {
        drawIdle();
        e.raf = 0;
        return; // nothing to animate at rest
      }

      e.raf = e.visible ? requestAnimationFrame(loop) : 0;
    };

    const wake = () => {
      if (e.raf || !e.visible || e.frozen) return;
      e.lastNow = performance.now();
      e.raf = requestAnimationFrame(loop);
    };

    controls.current.startPending = () => {
      e.frozen = false;
      e.particles = buildDust(PARTICLE_COUNT, e.w, e.h, mulberry32(e.seedCounter * 104729 + 3));
      wake();
    };

    controls.current.startGrowth = (nx: number, ny: number) => {
      e.nucX = nx;
      e.nucY = ny;
      e.growStart = performance.now();
      const seed = (e.seedCounter++ * 2654435761 + Math.floor(nx) * 97 + Math.floor(ny)) >>> 0;
      const rand = mulberry32(seed || 1);
      const growS = growMsRef.current / 1000;
      const built = buildCrystal(rand, nx, ny, e.w, e.h, growS);
      e.segs = built.segs;
      e.maxBirth = built.maxBirth;
      assignLocks(e.particles, e.segs);
      e.frozen = false;
      wake();
    };

    resize();
    syncColors();
    e.reduced = reduced;
    paintStill();

    const ro = new ResizeObserver(() => {
      resize();
      paintStill();
    });
    ro.observe(panel);

    const io = new IntersectionObserver(
      ([entry]) => {
        e.visible = !!entry?.isIntersecting;
        if (e.visible) wake();
        else if (e.raf) {
          cancelAnimationFrame(e.raf);
          e.raf = 0;
        }
      },
      { threshold: 0 }
    );
    io.observe(panel);

    const mo = new MutationObserver(() => {
      syncColors();
      if (!e.raf) paintStill(); // repaint the current still frame with new colors
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      cancelAnimationFrame(e.raf);
      e.raf = 0;
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  function handleActivate(clientX: number, clientY: number) {
    if (statusRef.current !== "idle") return;
    setStatus("pending");

    const canvas = canvasRef.current;
    const btn = btnRef.current;
    if (!reduced) controls.current.startPending?.();

    const finishToSuccess = () => {
      setStatus("success");
      const r = canvas?.getBoundingClientRect();
      let nx = engineRef.current.w * 0.5;
      let ny = engineRef.current.h * 0.5;
      // a real pointer click carries genuine coordinates; a keyboard-fired
      // click reports (0,0) in every browser, so treat that as "no point"
      // and nucleate from the button's own centre instead of the corner.
      const bt = btn?.getBoundingClientRect();
      const px = clientX === 0 && clientY === 0 && bt ? bt.left + bt.width / 2 : clientX;
      const py = clientX === 0 && clientY === 0 && bt ? bt.top + bt.height / 2 : clientY;
      if (r) {
        nx = clamp01((px - r.left) / (r.width || 1)) * engineRef.current.w;
        ny = clamp01((py - r.top) / (r.height || 1)) * engineRef.current.h;
      }
      if (!reduced) controls.current.startGrowth?.(nx, ny);
    };

    const ret = onConfirmRef.current?.();
    if (ret && typeof (ret as Promise<void>).then === "function") {
      (ret as Promise<void>).then(finishToSuccess, () => setStatus("idle"));
    } else {
      window.setTimeout(finishToSuccess, pendingMsRef.current);
    }
  }

  return (
    <div className={className}>
      <style>{`
@keyframes ns-seed-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
.ns-seed-in{animation:ns-seed-in 320ms cubic-bezier(0.16,1,0.3,1) both}
@media (prefers-reduced-motion: reduce){ .ns-seed-in{animation:none} }
`}</style>

      <div
        ref={panelRef}
        data-seed-panel
        className="relative w-full overflow-hidden rounded-md border border-border bg-background p-6"
        style={{ minHeight: 220 }}
      >
        <canvas
          ref={canvasRef}
          aria-hidden
          role="presentation"
          className="pointer-events-none absolute inset-0 h-full w-full"
        />

        <div className="relative z-10 flex h-full flex-col justify-between gap-6">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
              Secure checkout
            </p>
            <p className="mt-1 text-sm text-muted">
              One-time confirmation — held in a supercooled state until you act.
            </p>
          </div>

          <div className="flex flex-col items-start gap-4">
            <button
              ref={btnRef}
              type="button"
              onClick={(ev) => handleActivate(ev.clientX, ev.clientY)}
              aria-busy={status === "pending"}
              className="inline-flex items-center gap-2 rounded-sm bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {status === "success" ? (
                <>
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
                    <path
                      d="M3.5 8.5l3 3 6-7"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Confirmed
                </>
              ) : status === "pending" ? (
                pendingLabel
              ) : (
                label
              )}
            </button>

            {status === "success" ? (
              <p
                role="status"
                aria-live="assertive"
                data-seed-status
                className="ns-seed-in text-sm font-medium text-foreground"
              >
                {confirmedText}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
