"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// FrostbiteSwitch — iOS-style switch whose OFF state freezes over: seeded
// dendritic spines creep in from the track edges throwing alternating side
// needles (real frost-finger anatomy), rendered in three passes (haze film,
// cold shade, bright ice body) over a frosted-glass backdrop layer that blurs
// and brightens whatever sits beneath — including the thumb. A separate
// sparkle canvas carries grain + four-point glints and glistens on idle by
// mutating layer opacity only (no redraw). Switching ON drives a spatial melt
// front left-to-right ahead of the sliding thumb: a wet gleam edge, receding
// glass clip, and a few droplets of run-off. All ink derives from CSS tokens
// at mount and re-derives live on documentElement class changes.
// ---------------------------------------------------------------------------

const TRACK_W = 50; // content-box px (52 outer minus 1px border per side)
const THUMB = 26;
const TRAVEL = TRACK_W - THUMB - 2; // 22px, 1px inset at each end
const STEP = 2; // walker step length px
const SPEED = 140; // spine advance px/s
const GROW_S = 0.7; // grow-in budget s (seeded pattern finishes within this)
const MELT_S = 0.45; // melt-front sweep duration s
const SLIDE_DELAY_MS = 120; // thumb waits this long into the melt
const GRAVITY = 1200; // droplet gravity px/s^2
const DROP_LIFE = 0.4; // droplet lifetime s
const SPRING_K = 170; // s^-2
const SPRING_ZETA = 0.85; // one small overshoot
const MAX_SEGS = 700;

type Vec3 = readonly [number, number, number];

interface Seg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  depth: number; // 0 spine, 1 needle, 2 sub-needle
  birth: number; // seconds into the grow timeline
}
interface Spark {
  x: number;
  y: number;
  r: number;
  a: number;
  birth: number;
}
interface Glint {
  x: number;
  y: number;
  arm: number;
  a: number;
  birth: number;
}
interface DropPlan {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  birth: number;
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

// cold-cast a token color: pull red down, push blue up — still token-derived
function cold(c: Vec3): Vec3 {
  return [
    Math.max(0, Math.round(c[0] * 0.93)),
    Math.max(0, Math.round(c[1] * 0.985)),
    Math.min(255, Math.round(c[2] * 1.06 + 6)),
  ];
}

const rgba = (c: Vec3, a: number) =>
  `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;

const easeOutCubic = (p: number) => 1 - (1 - p) * (1 - p) * (1 - p);

interface Crystal {
  segs: Seg[];
  sparks: Spark[];
  glints: Glint[];
  plan: DropPlan[];
  maxBirth: number;
}

// Dendritic frost: seeded spines creep in from the right/top/bottom track
// edges, mostly straight with gentle curvature, throwing short alternating
// side needles (~60 deg) every few steps; longer needles may fork once more.
function buildCrystal(rand: () => number, w: number, h: number): Crystal {
  const segs: Seg[] = [];
  const stepDur = STEP / SPEED;

  const needle = (
    x: number,
    y: number,
    a: number,
    birth: number,
    depth: number,
    len: number
  ) => {
    let b = birth;
    for (let k = 0; k < len && segs.length < MAX_SEGS; k++) {
      a += (rand() - 0.5) * 0.1;
      const nx = x + Math.cos(a) * STEP;
      const ny = y + Math.sin(a) * STEP;
      if (nx < 0.5 || nx > w - 0.5 || ny < 0.5 || ny > h - 0.5) break;
      segs.push({ x1: x, y1: y, x2: nx, y2: ny, depth, birth: b });
      // feathering: longer needles throw their own barbs at the same angle
      if (depth === 1 && k >= 1 && rand() < 0.3) {
        const side = rand() < 0.5 ? 1 : -1;
        needle(
          nx,
          ny,
          a + side * (0.9 + rand() * 0.3),
          b + stepDur * 0.4,
          2,
          1 + Math.floor(rand() * 2)
        );
      }
      b += stepDur * 0.55;
      x = nx;
      y = ny;
    }
  };

  interface Seed {
    x: number;
    y: number;
    a: number;
    birth: number;
  }
  const seeds: Seed[] = [];
  const nR = 3 + Math.floor(rand() * 2); // right edge, sweeping left
  for (let i = 0; i < nR; i++) {
    seeds.push({
      x: w - 0.5,
      y: h * (0.12 + (0.76 * (i + 0.1 + rand() * 0.8)) / nR),
      a: Math.PI + (rand() - 0.5) * 0.5,
      birth: rand() * 0.08,
    });
  }
  // one steeper feather from the top and bottom edges keeps the lattice open
  seeds.push({
    x: w * (0.5 + 0.35 * rand()),
    y: 0.5,
    a: Math.PI - 0.7 - rand() * 0.3,
    birth: rand() * 0.1,
  });
  seeds.push({
    x: w * (0.5 + 0.35 * rand()),
    y: h - 0.5,
    a: Math.PI + 0.7 + rand() * 0.3,
    birth: rand() * 0.1,
  });

  for (const seed of seeds) {
    let { x, y, a, birth } = seed;
    const curv = (rand() - 0.5) * 0.05;
    let needleClock = 1 + Math.floor(rand() * 2);
    let side = rand() < 0.5 ? 1 : -1;
    const maxSteps = Math.ceil(w / STEP) + 4;
    for (let steps = 0; steps < maxSteps && segs.length < MAX_SEGS; steps++) {
      if (steps > 10 && rand() < 0.03) break; // some fingers stall early
      a += curv + (rand() - 0.5) * 0.1;
      let nx = x + Math.cos(a) * STEP;
      let ny = y + Math.sin(a) * STEP;
      if (ny < 0.5 || ny > h - 0.5) {
        a = -a;
        ny = y + Math.sin(a) * STEP;
        ny = Math.min(h - 0.5, Math.max(0.5, ny));
      }
      if (nx < 0.5) break; // spine reached the far edge
      if (nx > w - 0.5) {
        a = Math.PI - a;
        nx = x + Math.cos(a) * STEP;
      }
      segs.push({ x1: x, y1: y, x2: nx, y2: ny, depth: 0, birth });
      if (--needleClock <= 0) {
        needleClock = 2 + Math.floor(rand() * 2);
        side = -side;
        needle(
          nx,
          ny,
          a + side * (1.0 + rand() * 0.25),
          birth + stepDur * 0.5,
          1,
          2 + Math.floor(rand() * 3)
        );
      }
      birth += stepDur;
      x = nx;
      y = ny;
    }
  }

  let maxBirth = 0;
  for (const s of segs) if (s.birth > maxBirth) maxBirth = s.birth;
  maxBirth = Math.min(maxBirth, GROW_S);

  // sparkle grain + four-point glints, all deterministic with the same seed
  const sparks: Spark[] = [];
  const glints: Glint[] = [];
  for (const s of segs) {
    if (rand() < 0.3) {
      sparks.push({
        x: s.x2 + (rand() - 0.5) * 1.6,
        y: s.y2 + (rand() - 0.5) * 1.6,
        r: 0.3 + rand() * 0.45,
        a: 0.35 + rand() * 0.55,
        birth: s.birth,
      });
    }
  }
  if (segs.length > 0) {
    const n = 7 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const s = segs[Math.floor(rand() * segs.length)];
      if (!s) continue;
      glints.push({
        x: s.x2,
        y: s.y2,
        arm: 1.5 + rand() * 1.3,
        a: 0.65 + rand() * 0.35,
        birth: s.birth,
      });
    }
  }

  // droplet run-off plan — a few, from the lower half, released by the front
  const plan: DropPlan[] = [];
  const low = segs.filter((s) => s.y2 > h * 0.45);
  if (low.length > 0) {
    const n = 3 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const s = low[Math.floor(rand() * low.length)];
      if (!s) continue;
      plan.push({
        x: s.x2,
        y: s.y2,
        vx: (rand() - 0.5) * 30,
        vy: 8 + rand() * 24,
        r: 0.9 + rand() * 0.7,
        birth: s.birth,
        spawned: false,
      });
    }
  }
  return { segs, sparks, glints, plan, maxBirth };
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
  const sparkRef = useRef<HTMLCanvasElement>(null);
  const glassRef = useRef<HTMLSpanElement>(null);
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
    const sparkCanvas = sparkRef.current;
    const glass = glassRef.current;
    const thumb = thumbRef.current;
    if (!btn || !canvas || !sparkCanvas || !glass || !thumb) return;
    const ctx = canvas.getContext("2d");
    const sctx = sparkCanvas.getContext("2d");
    if (!ctx || !sctx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // -- token-derived ink: read at mount, re-derived on theme class change --
    let fg: Vec3 = [237, 237, 237];
    let bg: Vec3 = [10, 10, 10];
    let isDark = true;
    let bodyCol: Vec3 = [255, 255, 255]; // bright ice ridge
    let shadeCol: Vec3 = [40, 55, 75]; // cold definition under the ridge
    let hazeA = 0.05;
    let shadeA = 0.4;
    const derive = () => {
      const cs = getComputedStyle(document.documentElement);
      fg = parseColor(cs.getPropertyValue("--foreground")) ?? fg;
      bg = parseColor(cs.getPropertyValue("--background")) ?? bg;
      const lum = 0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2];
      isDark = lum < 128;
      if (isDark) {
        bodyCol = cold(mix(fg, [255, 255, 255], 0.4));
        shadeCol = cold(mix(fg, bg, 0.72));
        hazeA = 0.055;
        shadeA = 0.4;
      } else {
        bodyCol = cold(mix(fg, [255, 255, 255], 0.96)); // near-white ridge
        shadeCol = cold(mix(fg, bg, 0.48)); // mid cold slate
        hazeA = 0.3;
        shadeA = 0.6;
      }
      // frosted-glass film over whatever sits beneath (track AND thumb)
      glass.style.background = isDark
        ? "rgba(255,255,255,0.08)"
        : "rgba(255,255,255,0.34)";
      glass.style.backdropFilter = isDark
        ? "blur(1.5px) brightness(1.3) saturate(0.85)"
        : "blur(1.5px) brightness(1.04) saturate(0.85)";
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
    let meltThr = 0; // birth threshold frozen when the melt began
    let crystal: Crystal = {
      segs: [],
      sparks: [],
      glints: [],
      plan: [],
      maxBirth: 0,
    };
    const drops: Drop[] = [];
    let growCount = 0;
    let glassLevel = 0;
    let thumbX = current ? TRAVEL : 0;
    let thumbV = 0;
    let target = thumbX;
    let springOn = false;
    let pendingTarget = 0;
    let pendingAt = -1; // performance.now() when a delayed spring target lands

    const setThumb = () => {
      thumb.style.transform = `translateX(${thumbX.toFixed(2)}px)`;
    };
    const base = () => (disabledRef.current ? 0.4 : 1);
    const setGlass = (level: number) => {
      glassLevel = level;
      glass.style.opacity = (level * base()).toFixed(3);
    };

    const clearLayer = (c: CanvasRenderingContext2D) => {
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, h);
    };

    // Three passes: wide translucent haze (frost mass), cold shade (definition
    // on light surfaces / the thumb), bright ice body. Melt clips to x>=front.
    const drawCrystal = (thr: number, front: number | null) => {
      clearLayer(ctx);
      const segs = crystal.segs;
      if (segs.length === 0) return;
      ctx.save();
      if (front !== null) {
        ctx.beginPath();
        ctx.rect(front, 0, Math.max(0, w - front), h);
        ctx.clip();
      }
      ctx.lineCap = "round";
      // haze film
      ctx.beginPath();
      for (const s of segs) {
        if (s.birth > thr) continue;
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
      }
      ctx.strokeStyle = rgba([255, 255, 255], hazeA);
      ctx.lineWidth = 4.5;
      ctx.stroke();
      // rim frost creeping in from the pill edge
      const prog = crystal.maxBirth > 0 ? Math.min(1, thr / crystal.maxBirth) : 1;
      if (typeof ctx.roundRect === "function" && prog > 0.05) {
        ctx.beginPath();
        ctx.roundRect(0.75, 0.75, w - 1.5, h - 1.5, h / 2);
        ctx.strokeStyle = rgba(bodyCol, (isDark ? 0.16 : 0.3) * prog);
        ctx.lineWidth = 2.2;
        ctx.stroke();
      }
      // shade + body, batched by depth
      const shadeW = [1.7, 1.1, 0.8];
      const bodyW = [1.15, 0.7, 0.5];
      const bodyAl = [0.9, 0.75, 0.55];
      for (let pass = 0; pass < 2; pass++) {
        for (let d = 0; d <= 2; d++) {
          let any = false;
          ctx.beginPath();
          for (const s of segs) {
            if (s.depth !== d || s.birth > thr) continue;
            ctx.moveTo(s.x1, s.y1);
            ctx.lineTo(s.x2, s.y2);
            any = true;
          }
          if (!any) continue;
          if (pass === 0) {
            ctx.strokeStyle = rgba(shadeCol, shadeA * (1 - d * 0.2));
            ctx.lineWidth = shadeW[d] ?? 1;
          } else {
            ctx.strokeStyle = rgba(bodyCol, bodyAl[d] ?? 0.6);
            ctx.lineWidth = bodyW[d] ?? 0.6;
          }
          ctx.stroke();
        }
      }
      ctx.restore();
      // wet gleam edge at the melt front, over the still-frozen side
      if (front !== null && front > 0 && front < w) {
        const g = ctx.createLinearGradient(front, 0, front + 6, 0);
        g.addColorStop(0, rgba([255, 255, 255], 0.4));
        g.addColorStop(1, rgba([255, 255, 255], 0));
        ctx.fillStyle = g;
        ctx.fillRect(front, 0, 6, h);
        ctx.fillStyle = rgba(bodyCol, 0.55);
        ctx.fillRect(front, 0, 1, h);
      }
    };

    const drawSparks = (thr: number, front: number | null) => {
      clearLayer(sctx);
      if (crystal.segs.length === 0) return;
      sctx.save();
      if (front !== null) {
        sctx.beginPath();
        sctx.rect(front, 0, Math.max(0, w - front), h);
        sctx.clip();
      }
      for (const p of crystal.sparks) {
        if (p.birth > thr) continue;
        sctx.beginPath();
        sctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        sctx.fillStyle = rgba([255, 255, 255], p.a);
        sctx.fill();
      }
      sctx.lineCap = "round";
      sctx.lineWidth = 0.7;
      for (const p of crystal.glints) {
        if (p.birth > thr) continue;
        sctx.strokeStyle = rgba([255, 255, 255], p.a);
        sctx.beginPath();
        sctx.moveTo(p.x - p.arm, p.y);
        sctx.lineTo(p.x + p.arm, p.y);
        sctx.moveTo(p.x, p.y - p.arm);
        sctx.lineTo(p.x, p.y + p.arm);
        sctx.stroke();
        sctx.beginPath();
        sctx.arc(p.x, p.y, 0.7, 0, Math.PI * 2);
        sctx.fillStyle = rgba([255, 255, 255], Math.min(1, p.a + 0.2));
        sctx.fill();
      }
      sctx.restore();
    };

    const drawDrops = () => {
      for (const dr of drops) {
        const a = 1 - dr.age / DROP_LIFE;
        ctx.beginPath();
        ctx.ellipse(dr.x, dr.y, dr.r * 0.72, dr.r * 1.1, 0, 0, Math.PI * 2);
        ctx.fillStyle = rgba(bodyCol, a * 0.85);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(dr.x - dr.r * 0.25, dr.y - dr.r * 0.35, dr.r * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = rgba([255, 255, 255], a * 0.9);
        ctx.fill();
      }
    };

    const rebuild = () => {
      if (!sized) {
        crystal = { segs: [], sparks: [], glints: [], plan: [], maxBirth: 0 };
        return;
      }
      const rand = mulberry32(0x9e3779b9 ^ (growCount++ * 101));
      crystal = buildCrystal(rand, w, h);
    };

    const redrawStatic = () => {
      if (!sized) return;
      if (phase === "onIdle") {
        clearLayer(ctx);
        clearLayer(sctx);
      } else if (phase === "offIdle" || phase === "grow") {
        drawCrystal(grownT, null);
        drawSparks(grownT, null);
      }
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
      for (const c of [canvas, sparkCanvas]) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
        c.style.width = `${w}px`;
        c.style.height = `${h}px`;
      }
      sized = true;
      if (phase === "offIdle" && crystal.segs.length === 0) {
        rebuild();
        grownT = crystal.maxBirth;
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
        grownT = Math.min(t, crystal.maxBirth);
        if (sized) {
          drawCrystal(grownT, null);
          drawSparks(grownT, null);
        }
        setGlass(
          crystal.maxBirth > 0 ? Math.min(1, grownT / crystal.maxBirth) : 1
        );
        if (t >= crystal.maxBirth) phase = "offIdle"; // glisten takes over
        active = true;
      } else if (phase === "melt") {
        const t = (now - phaseStart) / 1000;
        const p = Math.min(1, t / MELT_S);
        // front recedes just ahead of the sliding thumb: a near-linear sweep,
        // but never closer than a few px past the thumb's leading edge
        const thumbFloor =
          pendingAt < 0 ? Math.min(w + 6, thumbX + THUMB + 5) : 0;
        const front = Math.max(
          (0.3 * p + 0.7 * easeOutCubic(p) * p) * (w + 6),
          thumbFloor
        );
        for (const d of crystal.plan) {
          if (!d.spawned && d.birth <= meltThr && front > d.x) {
            d.spawned = true;
            drops.push({ x: d.x, y: d.y, vx: d.vx, vy: d.vy, r: d.r, age: 0 });
          }
        }
        for (let i = drops.length - 1; i >= 0; i--) {
          const dr = drops[i];
          if (!dr) continue;
          dr.vy += GRAVITY * dt;
          dr.x += dr.vx * dt;
          dr.y += dr.vy * dt;
          dr.age += dt;
          if (dr.age >= DROP_LIFE) drops.splice(i, 1);
        }
        if (sized) {
          drawCrystal(meltThr, front);
          drawDrops();
          drawSparks(meltThr, front);
        }
        glass.style.clipPath = `inset(0 0 0 ${front.toFixed(1)}px)`;
        if (p >= 1 && drops.length === 0) {
          phase = "onIdle";
          crystal = { segs: [], sparks: [], glints: [], plan: [], maxBirth: 0 };
          clearLayer(ctx);
          clearLayer(sctx);
          setGlass(0);
          glass.style.clipPath = "";
          canvas.style.opacity = String(base());
          sparkCanvas.style.opacity = String(base());
        } else active = true;
      } else if (phase === "offIdle" && crystal.segs.length > 0) {
        // idle glisten: the ONLY idle work — sparkle-layer opacity, no redraw
        if (visible && !document.hidden && !disabledRef.current && !reduced) {
          sparkCanvas.style.opacity = (
            base() *
            (0.62 + 0.38 * Math.sin((now / 1000) * Math.PI * 2 * 0.25))
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
        glass.style.clipPath = "";
        if (on) {
          crystal = { segs: [], sparks: [], glints: [], plan: [], maxBirth: 0 };
          phase = "onIdle";
          clearLayer(ctx);
          clearLayer(sctx);
          setGlass(0);
        } else {
          rebuild();
          grownT = crystal.maxBirth;
          phase = "offIdle";
          redrawStatic();
          setGlass(1);
        }
        canvas.style.opacity = String(base());
        sparkCanvas.style.opacity = String(base());
        return;
      }
      const now = performance.now();
      canvas.style.opacity = String(base());
      sparkCanvas.style.opacity = String(base());
      if (on) {
        drops.length = 0;
        if (crystal.segs.length === 0) {
          phase = "onIdle";
          target = TRAVEL;
          springOn = true;
          pendingAt = -1;
          setGlass(0);
        } else {
          phase = "melt";
          phaseStart = now;
          meltThr = grownT;
          for (const d of crystal.plan) d.spawned = false;
          pendingTarget = TRAVEL;
          pendingAt = now + SLIDE_DELAY_MS;
        }
      } else {
        rebuild(); // fresh deterministic seed per state-change
        grownT = 0;
        phase = "grow";
        phaseStart = now;
        drops.length = 0;
        glass.style.clipPath = "";
        setGlass(0);
        target = 0;
        springOn = true;
        pendingAt = -1;
      }
      wake();
    };

    const setDisabledFn = (d: boolean) => {
      canvas.style.opacity = d ? "0.4" : "1";
      sparkCanvas.style.opacity = d ? "0.4" : "1";
      setGlass(glassLevel);
      if (!d) wake(); // glisten resumes
    };

    // -- init ---------------------------------------------------------------
    setThumb();
    canvas.style.opacity = String(base());
    sparkCanvas.style.opacity = String(base());
    if (!current) {
      rebuild();
      grownT = crystal.maxBirth;
      phase = "offIdle";
      redrawStatic();
      setGlass(1);
      wake();
    } else {
      setGlass(0);
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
      crystal = { segs: [], sparks: [], glints: [], plan: [], maxBirth: 0 };
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
      <span
        ref={thumbRef}
        aria-hidden
        className="absolute left-[1px] top-[1px] h-[26px] w-[26px] rounded-full bg-foreground shadow-[0_1px_3px_rgba(0,0,0,0.35)] will-change-transform"
      />
      <span
        ref={glassRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{ opacity: 0 }}
      />
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
      <canvas
        ref={sparkRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
    </button>
  );
}
