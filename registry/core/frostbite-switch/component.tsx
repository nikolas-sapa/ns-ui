"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// FrostbiteSwitch — iOS-style switch whose OFF state grows a dendritic ice
// skin across the track: seeded stochastic branching walkers creep out from
// the thumb's leading edge. Switching ON melts the segments in reverse growth
// order with droplet run-off, the thumb springs across 120 ms into the melt,
// and the accent glow ramps at the destination. Canvas 2D overlay clipped to
// the track; direct-DOM rAF that sleeps when settled; idle work is a shimmer
// that only mutates canvas opacity (no redraw). All drawn ink is derived from
// CSS tokens at mount and re-derived live on documentElement class changes.
// ---------------------------------------------------------------------------

const TRACK_W = 50; // content-box px (52 outer minus 1px border per side)
const THUMB = 26;
const TRAVEL = TRACK_W - THUMB - 2; // 22px, 1px inset at each end
const STEP = 2; // walker step length px
const SPEED = 140; // walker advance px/s
const GROW_S = 0.7; // grow-in duration s
const MELT_S = 0.45; // melt duration s
const SLIDE_DELAY_MS = 120; // thumb waits this long into the melt
const GRAVITY = 1200; // droplet gravity px/s^2
const DROP_LIFE = 0.4; // droplet lifetime s
const SPRING_K = 170; // s^-2
const SPRING_ZETA = 0.85; // one small overshoot
const MAX_SEGS = 700;
const MAX_WALKERS = 48;

type Vec3 = readonly [number, number, number];

interface Seg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  depth: number;
  birth: number; // seconds into the grow timeline
}
interface DropPlan {
  segBirth: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  spawned: boolean;
}
interface Drop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  age: number;
}

// deterministic PRNG — reseeded per state-change so regrowth repeats in-session
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

function parseColor(raw: string): Vec3 | null {
  const s = raw.trim();
  if (s.startsWith("#")) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex.slice(0, 1) + hex.slice(0, 1), 16);
      const g = parseInt(hex.slice(1, 2) + hex.slice(1, 2), 16);
      const b = parseInt(hex.slice(2, 3) + hex.slice(2, 3), 16);
      return Number.isNaN(r + g + b) ? null : [r, g, b];
    }
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return Number.isNaN(r + g + b) ? null : [r, g, b];
    }
    return null;
  }
  const m = s.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function mix(a: Vec3, b: Vec3, t: number): Vec3 {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

// 5-7 seeded branching walkers from the thumb's leading edge; ±25° heading
// jitter per 2px step, 0.15 child probability, max depth 4, walls reflect.
function buildCrystal(
  rand: () => number,
  w: number,
  h: number,
  originX: number
): { segs: Seg[]; maxBirth: number; plan: DropPlan[] } {
  const segs: Seg[] = [];
  const stepDur = STEP / SPEED;
  const trunks = 5 + Math.floor(rand() * 3);
  interface Walker {
    x: number;
    y: number;
    a: number;
    depth: number;
    birth: number;
  }
  const queue: Walker[] = [];
  let walkers = trunks;
  for (let i = 0; i < trunks; i++) {
    queue.push({
      x: originX,
      y: 3 + ((h - 6) * (i + 0.2 + rand() * 0.6)) / trunks,
      a: (rand() - 0.5) * 1.4, // ±40° initial fan toward +x
      depth: 0,
      birth: rand() * 0.05,
    });
  }
  while (queue.length > 0 && segs.length < MAX_SEGS) {
    const wk = queue.shift();
    if (!wk) break;
    let { x, y, a, birth } = wk;
    while (birth < GROW_S && segs.length < MAX_SEGS) {
      a += (rand() - 0.5) * ((50 * Math.PI) / 180); // ±25° jitter
      let nx = x + Math.cos(a) * STEP;
      let ny = y + Math.sin(a) * STEP;
      if (nx < 1 || nx > w - 1) {
        a = Math.PI - a;
        nx = x + Math.cos(a) * STEP;
      }
      if (ny < 1 || ny > h - 1) {
        a = -a;
        ny = y + Math.sin(a) * STEP;
      }
      nx = Math.min(w - 1, Math.max(1, nx));
      ny = Math.min(h - 1, Math.max(1, ny));
      segs.push({ x1: x, y1: y, x2: nx, y2: ny, depth: wk.depth, birth });
      birth += stepDur;
      if (wk.depth < 4 && walkers < MAX_WALKERS && rand() < 0.15) {
        walkers++;
        const side = rand() < 0.5 ? 1 : -1;
        queue.push({
          x: nx,
          y: ny,
          a: a + side * (Math.PI / 6 + rand() * (Math.PI / 5)),
          depth: wk.depth + 1,
          birth,
        });
      }
      x = nx;
      y = ny;
    }
  }
  let maxBirth = 0;
  for (const s of segs) if (s.birth > maxBirth) maxBirth = s.birth;
  // droplet run-off plan — 6-10, deterministic with the same seed
  const plan: DropPlan[] = [];
  if (segs.length > 0) {
    const n = 6 + Math.floor(rand() * 5);
    for (let i = 0; i < n; i++) {
      const seg = segs[Math.floor(rand() * segs.length)];
      if (!seg) continue;
      plan.push({
        segBirth: seg.birth,
        x: seg.x2,
        y: seg.y2,
        vx: (rand() - 0.5) * 40,
        vy: 10 + rand() * 30,
        r: 0.9 + rand() * 0.8,
        spawned: false,
      });
    }
  }
  return { segs, maxBirth, plan };
}

export function FrostbiteSwitch({
  checked,
  defaultChecked = false,
  onCheckedChange,
  disabled = false,
  className = "",
  "aria-label": ariaLabel = "Toggle",
}: {
  /** controlled state; omit for uncontrolled */
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const engineRef = useRef<{
    transition: (on: boolean) => void;
    setDisabled: (d: boolean) => void;
  } | null>(null);

  const isControlled = checked !== undefined;
  const [internal, setInternal] = useState(defaultChecked);
  const isChecked = isControlled ? checked : internal;
  const checkedRef = useRef(isChecked);
  checkedRef.current = isChecked;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  useEffect(() => {
    const btn = btnRef.current;
    const canvas = canvasRef.current;
    const thumb = thumbRef.current;
    if (!btn || !canvas || !thumb) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // -- token-derived ink: read at mount, re-derived on theme class change --
    let fg: Vec3 = [237, 237, 237];
    let bd: Vec3 = [46, 46, 46];
    const derive = () => {
      const cs = getComputedStyle(document.documentElement);
      fg = parseColor(cs.getPropertyValue("--foreground")) ?? fg;
      bd = parseColor(cs.getPropertyValue("--border")) ?? bd;
    };
    derive();

    // -- hot-path state: locals only, never React state --------------------
    let w = 0;
    let h = 0;
    let dpr = 1;
    let sized = false;
    let raf = 0;
    let last = 0;
    let visible = true;
    let phase: "offIdle" | "grow" | "melt" | "onIdle" = "onIdle";
    let current = checkedRef.current;
    let phaseStart = 0;
    let grownT = 0; // birth threshold currently visible
    let meltFrom = 0;
    let maxBirth = 0;
    let segs: Seg[] = [];
    let plan: DropPlan[] = [];
    const drops: Drop[] = [];
    let growCount = 0;
    let thumbX = current ? TRAVEL : 0;
    let thumbV = 0;
    let target = thumbX;
    let springOn = false;
    let pendingTarget = 0;
    let pendingAt = -1; // performance.now() when a delayed spring target lands

    const setThumb = () => {
      thumb.style.transform = `translateX(${thumbX.toFixed(2)}px)`;
    };
    const baseOpacity = () => (disabledRef.current ? "0.4" : "1");

    const clearCanvas = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
    };

    // strokes ramp --foreground (trunks) toward --border (fine tips) with a
    // tapering alpha, so ice stays visible on both light and dark tracks
    const drawCrystal = (thr: number) => {
      clearCanvas();
      ctx.lineCap = "round";
      for (let d = 0; d <= 4; d++) {
        let any = false;
        ctx.beginPath();
        for (const s of segs) {
          if (s.depth !== d || s.birth > thr) continue;
          ctx.moveTo(s.x1, s.y1);
          ctx.lineTo(s.x2, s.y2);
          any = true;
        }
        if (!any) continue;
        const m = d / 4;
        const c = mix(fg, bd, m * 0.55);
        ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${(0.95 - 0.35 * m).toFixed(3)})`;
        ctx.lineWidth = 1.4 - 0.2 * d; // 1.4 → 0.6 by depth
        ctx.stroke();
      }
    };

    const rebuild = () => {
      if (!sized) {
        segs = [];
        plan = [];
        maxBirth = 0;
        return;
      }
      const rand = mulberry32(0x9e3779b9 ^ (growCount++ * 101));
      const built = buildCrystal(rand, w, h, 1 + THUMB);
      segs = built.segs;
      plan = built.plan;
      maxBirth = built.maxBirth;
    };

    const redrawStatic = () => {
      if (!sized) return;
      if (phase === "onIdle") clearCanvas();
      else if (phase === "offIdle" || phase === "grow") drawCrystal(grownT);
      // melt frames are repainted by the running loop
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) {
        sized = false; // zero-size guard — never seed walkers into nothing
        return;
      }
      w = rect.width;
      h = rect.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      sized = true;
      if (phase === "offIdle" && segs.length === 0) {
        rebuild();
        grownT = maxBirth;
      }
      redrawStatic();
    };
    resize();

    const loop = (now: number) => {
      raf = 0;
      const dt = last ? Math.min(0.033, (now - last) / 1000) : 1 / 60;
      last = now;
      let active = false;

      // delayed spring target (thumb starts 120 ms into the melt)
      if (pendingAt >= 0) {
        if (now >= pendingAt) {
          target = pendingTarget;
          pendingAt = -1;
          springOn = true;
        } else active = true;
      }

      if (springOn) {
        const c = 2 * SPRING_ZETA * Math.sqrt(SPRING_K);
        thumbV += (-SPRING_K * (thumbX - target) - c * thumbV) * dt;
        thumbX += thumbV * dt;
        if (Math.abs(thumbX - target) < 0.05 && Math.abs(thumbV) < 0.5) {
          thumbX = target;
          thumbV = 0;
          springOn = false;
        } else active = true;
        setThumb();
      }

      if (phase === "grow") {
        const t = (now - phaseStart) / 1000;
        grownT = Math.min(t, maxBirth);
        if (sized) drawCrystal(grownT);
        if (t >= maxBirth) phase = "offIdle"; // shimmer takes over next frame
        active = true;
      } else if (phase === "melt") {
        const t = (now - phaseStart) / 1000;
        const p = Math.min(1, t / MELT_S);
        const thr = meltFrom * (1 - p);
        for (const d of plan) {
          if (!d.spawned && d.segBirth > thr) {
            d.spawned = true;
            drops.push({ x: d.x, y: d.y, vx: d.vx, vy: d.vy, r: d.r, age: 0 });
          }
        }
        if (sized) {
          drawCrystal(thr);
          for (let i = drops.length - 1; i >= 0; i--) {
            const dr = drops[i];
            if (!dr) continue;
            dr.vy += GRAVITY * dt;
            dr.x += dr.vx * dt;
            dr.y += dr.vy * dt;
            dr.age += dt;
            if (dr.age >= DROP_LIFE) {
              drops.splice(i, 1);
              continue;
            }
            const a = (1 - dr.age / DROP_LIFE) * 0.85;
            ctx.beginPath();
            ctx.arc(dr.x, dr.y, dr.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${fg[0]},${fg[1]},${fg[2]},${a.toFixed(3)})`;
            ctx.fill();
          }
        }
        if (p >= 1 && drops.length === 0) {
          phase = "onIdle";
          segs = []; // free walker arrays — nothing to keep while thawed
          plan = [];
          clearCanvas();
          canvas.style.opacity = baseOpacity();
        } else active = true;
      } else if (phase === "offIdle" && segs.length > 0) {
        // idle shimmer: the ONLY idle work — opacity breathe, no redraw
        if (visible && !document.hidden && !disabledRef.current && !reduced) {
          canvas.style.opacity = (
            0.92 +
            0.06 * Math.sin((now / 1000) * Math.PI * 2 * 0.2)
          ).toFixed(3);
          active = true;
        }
      }

      if (active) raf = requestAnimationFrame(loop);
    };

    const wake = () => {
      if (!raf && !reduced) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    const transition = (on: boolean) => {
      if (on === current) return;
      current = on;
      if (reduced) {
        // two static frames: full crystal OFF / clear ON; thumb snaps
        thumbX = on ? TRAVEL : 0;
        thumbV = 0;
        springOn = false;
        pendingAt = -1;
        setThumb();
        drops.length = 0;
        if (on) {
          segs = [];
          plan = [];
          phase = "onIdle";
          clearCanvas();
        } else {
          rebuild();
          grownT = maxBirth;
          phase = "offIdle";
          redrawStatic();
        }
        canvas.style.opacity = baseOpacity();
        return;
      }
      const now = performance.now();
      canvas.style.opacity = baseOpacity();
      if (on) {
        drops.length = 0;
        if (segs.length === 0) {
          phase = "onIdle";
          target = TRAVEL;
          springOn = true;
          pendingAt = -1;
        } else {
          phase = "melt";
          phaseStart = now;
          meltFrom = grownT;
          for (const d of plan) d.spawned = d.segBirth > meltFrom;
          pendingTarget = TRAVEL;
          pendingAt = now + SLIDE_DELAY_MS;
        }
      } else {
        rebuild(); // fresh deterministic seed per state-change
        grownT = 0;
        phase = "grow";
        phaseStart = now;
        drops.length = 0;
        target = 0;
        springOn = true;
        pendingAt = -1;
      }
      wake();
    };

    const setDisabledFn = (d: boolean) => {
      canvas.style.opacity = d ? "0.4" : "1";
      if (!d) wake(); // shimmer resumes
    };

    // -- init ---------------------------------------------------------------
    setThumb();
    canvas.style.opacity = baseOpacity();
    if (!current) {
      rebuild();
      grownT = maxBirth;
      phase = "offIdle";
      redrawStatic();
      wake();
    }

    engineRef.current = { transition, setDisabled: setDisabledFn };

    // -- observers ----------------------------------------------------------
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) wake();
    });
    io.observe(btn);
    // live theme re-derive: watch documentElement class flips
    const mo = new MutationObserver(() => {
      derive();
      redrawStatic();
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    const onVis = () => {
      if (!document.hidden) wake();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      segs = [];
      plan = [];
      drops.length = 0;
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.transition(isChecked);
  }, [isChecked]);

  useEffect(() => {
    engineRef.current?.setDisabled(disabled);
  }, [disabled]);

  const toggle = () => {
    if (disabled) return;
    const next = !isChecked;
    if (!isControlled) setInternal(next);
    onCheckedChange?.(next);
  };

  return (
    <button
      ref={btnRef}
      type="button"
      role="switch"
      aria-checked={isChecked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={toggle}
      className={`relative h-[30px] w-[52px] shrink-0 overflow-hidden rounded-full border outline-none transition-[background-color,border-color,box-shadow] duration-200 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none ${
        isChecked
          ? "border-accent/40 bg-accent shadow-[0_0_14px_-2px] shadow-accent/60 delay-150"
          : "border-foreground/10 bg-border delay-0"
      } ${
        disabled
          ? "cursor-not-allowed opacity-60"
          : "cursor-pointer hover:border-foreground/25"
      } ${className}`}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
      <span
        ref={thumbRef}
        aria-hidden
        className="absolute left-[1px] top-[1px] h-[26px] w-[26px] rounded-full bg-foreground shadow-[0_1px_3px_rgba(0,0,0,0.35)] will-change-transform"
      />
    </button>
  );
}
