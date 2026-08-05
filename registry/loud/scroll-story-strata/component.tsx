"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// CoreSampleScroll — pinned scroll story. The viewport becomes a geological
// core cross-section: a 250vh track wraps a sticky 100vh stage, and scroll
// drives a drill bit descending through procedurally banded strata while
// content panels crossfade per band and a mono HUD ticks depth in meters.
// Strata grain (2-octave value noise, 3px cells, quantized to 3 gray levels
// between --border and --ns-muted, per-band thresholds) is rendered ONCE per
// resize/theme into an offscreen band atlas and blitted per frame. Exactly
// one accent vein — a 1.5px --ns-accent polyline at a fixed depth in band 4.
// Direct-DOM rAF, refs only on the hot path; the loop sleeps when the eased
// depth is within epsilon of target and the chip spray is empty.
// ---------------------------------------------------------------------------

export interface CoreSampleBand {
  id: string;
  label: string;
  title: string;
  body: string;
  spec: string;
}

const DEFAULT_BANDS: CoreSampleBand[] = [
  {
    id: "interface",
    label: "Interface",
    title: "Surface layer",
    body: "Everything the user touches renders here: design tokens, optimistic state, and a 60fps interaction budget. Nothing below this band is visible, but every band below shapes how it feels.",
    spec: "react 19 · edge-rendered · p75 INP 84ms",
  },
  {
    id: "api",
    label: "API",
    title: "Contract stratum",
    body: "A thin, typed boundary where every request is validated, shaped, and signed. Breaking changes surface here as schema drift long before they reach a client.",
    spec: "graphql + rest · 214 endpoints · p99 121ms",
  },
  {
    id: "engine",
    label: "Engine",
    title: "Compute band",
    body: "Schedulers, queues, and the rules engine burn through about two million jobs a day. Backpressure is absorbed inside this band, so spikes never reach the surface.",
    spec: "12 workers · 2.1M jobs/day · retry ×3",
  },
  {
    id: "storage",
    label: "Storage",
    title: "Sedimented state",
    body: "Every event since day zero is compacted into columnar layers — cheap to scan, impossible to lose. The accent vein marks the write-ahead log, the one seam everything above depends on.",
    spec: "wal + columnar · 41TB · rpo 0s",
  },
  {
    id: "bedrock",
    label: "Bedrock",
    title: "Bedrock / infra",
    body: "Machines, networks, and the failure domains everything above stands on. It moves rarely, and when it does, the whole column feels it.",
    spec: "3 regions · 9 AZs · chaos-tested weekly",
  },
];

// band thickness fractions — each within 12–28% of stage height, sum = 1
const FRACTIONS_5 = [0.17, 0.21, 0.15, 0.27, 0.2];

function bandFractions(n: number): number[] {
  if (n === 5) return FRACTIONS_5;
  return new Array(n).fill(1 / Math.max(1, n));
}

type Vec3 = [number, number, number];

function parseColor(raw: string): Vec3 | null {
  const s = raw.trim();
  if (s.startsWith("#")) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
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

function css(c: Vec3): string {
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

// deterministic lattice hash → [0,1)
function hash2(x: number, y: number, s: number): number {
  let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

// single-octave value noise on an integer lattice
function vnoise(x: number, y: number, s: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const a = hash2(ix, iy, s);
  const b = hash2(ix + 1, iy, s);
  const c = hash2(ix, iy + 1, s);
  const d = hash2(ix + 1, iy + 1, s);
  const u = smooth(fx);
  const v = smooth(fy);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CELL = 3; // px — grain cell size
// per-band [t1, t2] quantization thresholds over the 2-octave noise — tuned so
// each stratum has a visibly different dark/mid/light balance
const THRESHOLDS: readonly [number, number][] = [
  [0.46, 0.74], // dense dark topsoil
  [0.3, 0.52], // light, porous
  [0.5, 0.62], // mid-heavy
  [0.36, 0.68], // balanced — the vein band
  [0.42, 0.5], // light-flooded bedrock
];
const EASE_RATE = 8; // depth += (target-depth)*(1-exp(-dt*8)) ≈ 120ms lag
const SETTLE_MS = 250; // forced-settle deadline after the last scroll event
const EPS = 0.1; // px — sleep epsilon on |depth - target|
const CHIP_LIFE = 400; // ms
const CHIP_BATCH = 12; // particles per emission
const CHIP_CAP = 120;
const EMIT_EVERY = 0.09; // s between 12-particle batches while cutting
const VEL_MIN = 2; // px/s — below this the bit is "parked", no spray
const MIN_TIP = 16; // scene px — resting sliver so the bit tip clears the top edge at rest

type Chip = { x: number; y: number; vx: number; vy: number; born: number };

export function CoreSampleScroll({
  bands = DEFAULT_BANDS,
  totalDepth = 128,
  trackVh = 250,
  className = "",
}: {
  /** strata content, top → bottom; band 4 (index 3) carries the accent vein */
  bands?: CoreSampleBand[];
  /** depth in meters the HUD reads at full scroll */
  totalDepth?: number;
  /** scroll-track height in vh; the sticky stage is always 100vh */
  trackVh?: number;
  className?: string;
}) {
  const uid = useId();
  const rootRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelLayerRef = useRef<HTMLDivElement>(null);
  const depthElRef = useRef<HTMLDivElement>(null);
  const hoverRef = useRef(-1); // hovered/focused band index, -1 = none
  const wakeRef = useRef<() => void>(() => {});

  const [active, setActive] = useState(0);
  const [reduced, setReduced] = useState(false);

  const fractions = useMemo(() => bandFractions(bands.length), [bands.length]);
  const starts = useMemo(() => {
    const s: number[] = [];
    let acc = 0;
    for (const f of fractions) {
      s.push(acc);
      acc += f;
    }
    return s;
  }, [fractions]);

  const veinIdx = Math.min(3, bands.length - 1);
  // scene is taller than the stage so the 0.15x parallax has strata to reveal
  const overscan = reduced ? 1 : 1 + (0.15 * Math.max(0, trackVh - 100)) / 100;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const atlas = document.createElement("canvas");
    const actx = atlas.getContext("2d");
    const grain = document.createElement("canvas");
    const gctx = grain.getContext("2d");
    if (!actx || !gctx) return;

    const n = bands.length;
    const rand = mulberry32(0xc02e);

    // -- token inks: read at mount, re-derived live on theme flip ------------
    let fg: Vec3 = [237, 237, 237];
    let border: Vec3 = [46, 46, 46];
    let muted: Vec3 = [143, 143, 143];
    let accent: Vec3 = [0, 107, 255];
    const derive = () => {
      const cs = getComputedStyle(document.documentElement);
      fg = parseColor(cs.getPropertyValue("--foreground")) ?? fg;
      border = parseColor(cs.getPropertyValue("--border")) ?? border;
      muted = parseColor(cs.getPropertyValue("--ns-muted")) ?? muted;
      accent = parseColor(cs.getPropertyValue("--ns-accent")) ?? accent;
    };
    derive();

    // -- sizing: explicit style.width/height — sticky inset does NOT size a
    // replaced element; backing store is dpr-scaled separately ---------------
    let w = 0;
    let h = 0;
    let dpr = 1;
    let sized = false;
    let sceneH = 0;

    const bandAt = (f: number): number => {
      for (let i = n - 1; i >= 0; i--) {
        if (f >= (starts[i] ?? 0)) return i;
      }
      return 0;
    };

    // grain rendered ONCE per resize/theme into the band atlas, blitted per
    // frame — never per-frame noise
    const genAtlas = () => {
      if (!sized) return;
      atlas.width = Math.max(1, Math.round(w * dpr));
      atlas.height = Math.max(1, Math.round(sceneH * dpr));
      actx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const gw = Math.max(1, Math.ceil(w / CELL));
      const gh = Math.max(1, Math.ceil(sceneH / CELL));
      grain.width = gw;
      grain.height = gh;
      const img = gctx.createImageData(gw, gh);
      const px = img.data;
      // 3 gray levels interpolated between --border and --ns-muted
      const levels: Vec3[] = [border, mix(border, muted, 0.5), muted];
      for (let gy = 0; gy < gh; gy++) {
        const f = ((gy + 0.5) * CELL) / sceneH;
        const b = bandAt(Math.min(0.9999, f));
        // per-band quantization thresholds — each band gets a distinct
        // dark/mid/light density so strata read apart in monochrome
        const th = THRESHOLDS[b % THRESHOLDS.length] ?? THRESHOLDS[0]!;
        const t1 = th[0];
        const t2 = th[1];
        for (let gx = 0; gx < gw; gx++) {
          // 2-octave value noise, 3px cells
          const nn =
            0.65 * vnoise(gx / 5, gy / 5, b * 31 + 7) +
            0.35 * vnoise(gx / 2.2, gy / 2.2, b * 31 + 19);
          const c = levels[nn < t1 ? 0 : nn < t2 ? 1 : 2] ?? border;
          const o = (gy * gw + gx) * 4;
          px[o] = c[0];
          px[o + 1] = c[1];
          px[o + 2] = c[2];
          px[o + 3] = 255;
        }
      }
      gctx.putImageData(img, 0, 0);
      actx.imageSmoothingEnabled = false;
      actx.drawImage(grain, 0, 0, w, sceneH);
      actx.imageSmoothingEnabled = true;

      // hairline band boundaries
      actx.strokeStyle = css(fg);
      actx.globalAlpha = 0.22;
      actx.lineWidth = 1;
      for (let i = 1; i < n; i++) {
        const y = Math.round((starts[i] ?? 0) * sceneH) + 0.5;
        actx.beginPath();
        actx.moveTo(0, y);
        actx.lineTo(w, y);
        actx.stroke();
      }
      actx.globalAlpha = 1;

      // exactly one accent vein: 1.5px --ns-accent polyline at a fixed depth
      // inside band 4
      const vy =
        ((starts[veinIdx] ?? 0) + (fractions[veinIdx] ?? 0.2) * 0.55) * sceneH;
      actx.strokeStyle = css(accent);
      actx.lineWidth = 1.5;
      actx.lineJoin = "round";
      actx.beginPath();
      for (let x = 0; x <= w; x += 8) {
        const yy = vy + (vnoise(x / 42, 3.7, 991) - 0.5) * 12;
        if (x === 0) actx.moveTo(x, yy);
        else actx.lineTo(x, yy);
      }
      actx.stroke();
    };

    const resize = () => {
      const rect = stage.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) {
        sized = false; // zero-size stage guard — loop no-ops until real
        return;
      }
      w = rect.width;
      h = rect.height;
      sceneH = h * overscan;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sized = true;
      genAtlas();
    };
    resize();

    // -- hot-path state: locals only ----------------------------------------
    let raf = 0;
    let last = 0;
    let visible = true;
    let tip = 0; // eased drill-tip depth, scene px
    let lastScrollT = performance.now();
    let emitAccum = 0;
    let chips: Chip[] = []; // pruned array — never destination-in fades
    let curBand = -1;

    // one frame: explicit full clear of the dynamic layer, atlas blit under a
    // camera transform, then drill + chip spray in scene coords
    const draw = (now: number) => {
      ctx.clearRect(0, 0, w, h);
      const camProg = sceneH > 0 ? Math.min(1, Math.max(0, tip / sceneH)) : 0;
      const camY = -camProg * (sceneH - h); // 0.15x parallax travel
      const s = 1 + 0.06 * camProg; // scale 1.00 → 1.06
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(s, s);
      ctx.translate(-w / 2, -h / 2);
      ctx.translate(0, camY);

      ctx.drawImage(atlas, 0, 0, w, sceneH);

      // hover/focus affordance: 1px --foreground top-rule on the band
      const hov = hoverRef.current;
      if (hov >= 0 && hov < n) {
        const y = Math.round((starts[hov] ?? 0) * sceneH) + 0.5;
        ctx.strokeStyle = css(fg);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // drill string + mono-weight chevron bit, center-left column. Rendered
      // at max(tip, MIN_TIP) so the bit tip always clears the top edge at
      // rest (mount has tip=0) — physics/HUD still track the real `tip`.
      const dx = Math.round(w * 0.34);
      const drawTip = Math.max(MIN_TIP, tip);
      ctx.strokeStyle = css(fg);
      ctx.lineCap = "butt";
      ctx.lineJoin = "miter";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(dx, -h);
      ctx.lineTo(dx, drawTip - 9);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(dx - 7, drawTip - 10);
      ctx.lineTo(dx, drawTip);
      ctx.lineTo(dx + 7, drawTip - 10);
      ctx.stroke();
      // depth ticks along the drilled hole
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 1;
      for (let y = 56; y < drawTip - 12; y += 56) {
        ctx.beginPath();
        ctx.moveTo(dx - 5, y + 0.5);
        ctx.lineTo(dx + 5, y + 0.5);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // chip spray
      ctx.fillStyle = css(muted);
      for (let i = 0; i < chips.length; i++) {
        const c = chips[i];
        if (!c) continue;
        ctx.globalAlpha = Math.max(0, 1 - (now - c.born) / CHIP_LIFE);
        ctx.fillRect(c.x - 1, c.y - 1, 2, 2);
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      // labels ride the same camera via an offset transform on their layer —
      // never absolute canvas/page coords
      const layer = labelLayerRef.current;
      if (layer) layer.style.transform = `scale(${s}) translateY(${camY}px)`;
    };

    // -- reduced motion: static labeled cross-section at full depth ----------
    if (reduced) {
      const renderStatic = () => {
        if (!sized) return;
        tip = sceneH;
        chips = [];
        draw(performance.now());
      };
      renderStatic();
      wakeRef.current = renderStatic; // label hover redraws the top-rule
      const ro = new ResizeObserver(() => {
        resize();
        renderStatic();
      });
      ro.observe(stage);
      const mo = new MutationObserver(() => {
        derive();
        genAtlas(); // regenerate the band atlas for the new theme
        renderStatic();
      });
      mo.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
      return () => {
        ro.disconnect();
        mo.disconnect();
        wakeRef.current = () => {};
      };
    }

    const spawnChips = (dx: number, now: number) => {
      for (let i = 0; i < CHIP_BATCH && chips.length < CHIP_CAP; i++) {
        chips.push({
          x: dx + (rand() - 0.5) * 12,
          y: tip - 2,
          vx: (rand() - 0.5) * 170,
          vy: -(40 + rand() * 110),
          born: now,
        });
      }
    };

    const loop = (now: number) => {
      raf = 0;
      if (!visible || !sized || !root) {
        last = 0;
        return; // paused offscreen / zero-size — observers wake us
      }
      const dt = last === 0 ? 1 / 60 : Math.min(0.05, (now - last) / 1000);
      last = now;

      // scroll progress from track geometry
      const rrect = root.getBoundingClientRect();
      const range = Math.max(1, rrect.height - window.innerHeight);
      const prog = Math.min(1, Math.max(0, -rrect.top / range));
      const target = prog * sceneH;

      const prev = tip;
      if (now - lastScrollT > SETTLE_MS) {
        tip = target; // forced-settle deadline — the HUD never ticks forever
      } else {
        tip += (target - tip) * (1 - Math.exp(-dt * EASE_RATE));
      }
      const vel = (tip - prev) / dt;

      // chip spray while the bit is cutting
      const dx = Math.round(w * 0.34);
      if (Math.abs(vel) > VEL_MIN) {
        emitAccum += dt;
        while (emitAccum >= EMIT_EVERY) {
          emitAccum -= EMIT_EVERY;
          spawnChips(dx, now);
        }
      } else {
        emitAccum = 0;
      }
      // integrate + prune in place
      let keep = 0;
      for (let i = 0; i < chips.length; i++) {
        const c = chips[i];
        if (!c || now - c.born > CHIP_LIFE) continue;
        c.vy += 520 * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        chips[keep++] = c;
      }
      chips.length = keep;

      // band crossings drive the panel crossfade (rare setState, off the
      // per-frame path otherwise)
      const f = sceneH > 0 ? Math.min(0.9999, Math.max(0, tip / sceneH)) : 0;
      const b = bandAt(f);
      if (b !== curBand) {
        curBand = b;
        setActive(b);
      }

      // HUD depth readout — direct DOM, ticks every frame while moving
      const depthEl = depthElRef.current;
      if (depthEl) {
        const meters =
          (sceneH > 0 ? Math.min(1, Math.max(0, tip / sceneH)) : 0) * totalDepth;
        depthEl.textContent = `${meters.toFixed(2).padStart(6, "0")} m`;
      }

      draw(now);

      // sleep: settled within epsilon AND the chip list is empty
      if (Math.abs(tip - target) < EPS && chips.length === 0) {
        last = 0;
        return;
      }
      raf = requestAnimationFrame(loop);
    };

    const wake = () => {
      if (!raf) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    wakeRef.current = wake;

    const onScroll = () => {
      lastScrollT = performance.now();
      wake();
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    const ro = new ResizeObserver(() => {
      resize();
      wake();
    });
    ro.observe(stage);
    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) wake();
    });
    io.observe(stage);
    // live theme re-derive + atlas regeneration on documentElement class flip
    const mo = new MutationObserver(() => {
      derive();
      genAtlas();
      wake();
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    const onVis = () => {
      if (!document.hidden) wake();
    };
    document.addEventListener("visibilitychange", onVis);

    wake();

    return () => {
      cancelAnimationFrame(raf);
      raf = 0;
      window.removeEventListener("scroll", onScroll);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      wakeRef.current = () => {};
    };
  }, [bands, fractions, starts, totalDepth, trackVh, overscan, veinIdx, reduced]);

  const scrollToBand = (i: number) => {
    if (reduced) {
      document
        .getElementById(`${uid}-panel-${i}`)
        ?.scrollIntoView({ block: "start" });
      return;
    }
    const root = rootRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const top = window.scrollY + rect.top;
    const range = Math.max(1, root.offsetHeight - window.innerHeight);
    const f = (starts[i] ?? 0) + (fractions[i] ?? 0) * 0.5;
    window.scrollTo({ top: top + f * range, behavior: "smooth" });
  };

  const labelButtons = (
    <div
      ref={labelLayerRef}
      aria-hidden={false}
      className="pointer-events-none absolute inset-0 z-10"
      style={{ transformOrigin: "50% 50%" }}
    >
      {bands.map((b, i) => (
        <button
          key={b.id}
          type="button"
          onClick={() => scrollToBand(i)}
          onMouseEnter={() => {
            hoverRef.current = i;
            wakeRef.current();
          }}
          onMouseLeave={() => {
            hoverRef.current = -1;
            wakeRef.current();
          }}
          onFocus={() => {
            hoverRef.current = i;
            wakeRef.current();
          }}
          onBlur={() => {
            hoverRef.current = -1;
            wakeRef.current();
          }}
          className="pointer-events-auto absolute left-4 -translate-y-1/2 rounded-sm bg-background/60 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ns-muted transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          style={{
            top: `${((starts[i] ?? 0) + (fractions[i] ?? 0) / 2) * overscan * 100}%`,
          }}
        >
          {String(i + 1).padStart(2, "0")} {b.label}
        </button>
      ))}
    </div>
  );

  const panelCard = (b: CoreSampleBand, i: number, extra = "") => (
    <article
      key={b.id}
      id={reduced ? `${uid}-panel-${i}` : undefined}
      className={`rounded-md border border-border bg-surface p-6 ${extra}`}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ns-muted">
        {String(i + 1).padStart(2, "0")} / {b.label}
      </p>
      <h3 className="mt-3 text-xl font-semibold text-foreground">{b.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ns-muted">{b.body}</p>
      <p className="mt-4 border-t border-border pt-3 font-mono text-xs text-ns-muted">
        {b.spec}
      </p>
    </article>
  );

  // -- reduced motion: no pin choreography — static cross-section + list ----
  if (reduced) {
    return (
      <section className={`relative ${className}`}>
        <div
          ref={stageRef}
          className="relative h-[80vh] min-h-[480px] overflow-hidden border-y border-border"
        >
          <canvas
            ref={canvasRef}
            aria-hidden
            className="pointer-events-none absolute left-0 top-0"
          />
          {labelButtons}
          <div className="pointer-events-none absolute right-6 top-6 z-10 rounded-sm bg-background/60 p-3 text-right font-mono">
            <p className="text-[10px] uppercase tracking-[0.25em] text-ns-muted">
              depth
            </p>
            <div className="mt-1 text-sm tabular-nums text-foreground">
              {`${totalDepth.toFixed(2).padStart(6, "0")} m`}
            </div>
            <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-ns-muted">
              full core · {bands.length} bands
            </p>
          </div>
        </div>
        <div className="mx-auto mt-8 grid max-w-2xl gap-4 px-6">
          {bands.map((b, i) => panelCard(b, i))}
        </div>
      </section>
    );
  }

  return (
    <section
      ref={rootRef}
      className={`relative ${className}`}
      style={{ height: `${trackVh}vh` }}
    >
      <div
        ref={stageRef}
        className="sticky top-0 h-screen overflow-hidden border-y border-border"
      >
        <canvas
          ref={canvasRef}
          aria-hidden
          className="pointer-events-none absolute left-0 top-0"
        />
        {labelButtons}

        {/* HUD — fixed stage corner, mono, ticks every frame while moving */}
        <div className="pointer-events-none absolute right-6 top-6 z-10 rounded-sm bg-background/60 p-3 text-right font-mono">
          <p className="text-[10px] uppercase tracking-[0.25em] text-ns-muted">
            depth
          </p>
          <div
            ref={depthElRef}
            className="mt-1 text-sm tabular-nums text-foreground"
          >
            000.00 m
          </div>
          <p
            className={`mt-1 text-[10px] uppercase tracking-[0.2em] transition-colors ${
              active === veinIdx ? "text-ns-accent" : "text-ns-muted"
            }`}
          >
            {bands[active]?.label ?? ""} · {active + 1}/{bands.length}
          </p>
        </div>

        {/* content panels — right column, crossfade + 12px slide per band */}
        <div className="absolute right-[4%] top-1/2 z-10 w-[45%] max-w-[560px] -translate-y-1/2">
          <div className="grid">
            {bands.map((b, i) => (
              <div
                key={b.id}
                className={`col-start-1 row-start-1 transition-[opacity,transform] duration-[350ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  i === active
                    ? "translate-y-0 opacity-100"
                    : i < active
                      ? "pointer-events-none -translate-y-3 opacity-0"
                      : "pointer-events-none translate-y-3 opacity-0"
                }`}
                aria-hidden={i !== active}
              >
                {panelCard(b, i)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
