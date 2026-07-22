"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// CausticCoverflow — 3D coverflow gallery whose cards sit behind frosted
// glass running a lightweight caustic-light simulation. Three drifting light
// pools (Lissajous paths, 7s/11s/13s periods) refract across each pane —
// drawn into a quarter-resolution buffer and upscaled with image smoothing
// for soft pool edges. Drag velocity drives chromatic aberration on the
// focused card's border (red/blue channel restrokes) that decays to zero at
// rest under a forced-settle deadline. Direct-DOM rAF: React renders once,
// the loop is the sole writer of transforms and canvas frames.
// ---------------------------------------------------------------------------

type RGB = { r: number; g: number; b: number };

function parseColor(raw: string): RGB | null {
  const v = raw.trim();
  if (v.startsWith("#")) {
    const hex = v.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
      return { r, g, b };
    }
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
      return { r, g, b };
    }
    return null;
  }
  const m = v.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (!m) return null;
  return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
}

function mixRGB(a: RGB, b: RGB, t: number): RGB {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

// deterministic 2-octave value noise for the generated thumbs — no deps
function hash2(x: number, y: number) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}
function vnoise(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function noise2(x: number, y: number) {
  return 0.62 * vnoise(x, y) + 0.38 * vnoise(x * 2.3 + 19.7, y * 2.3 + 7.3);
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
function easeOutExpo(t: number) {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}
function rrectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// coverflow pose for a card at signed index distance d from the focus point:
// center card scale 1, sides rotateY ±35° / scale 0.82, x-spacing in px,
// translateZ -60px per index of distance. Offsets from the stage center —
// never absolute coords (the -50%,-50% anchor does the centering).
function cardTransform(d: number, spacing: number) {
  const a = clamp(d, -1, 1);
  const rot = -35 * a;
  const scale = 1 - 0.18 * Math.min(1, Math.abs(d));
  const dx = d * spacing;
  const z = -60 * Math.abs(d);
  return `translate(-50%, -50%) translateX(${dx.toFixed(2)}px) translateZ(${z.toFixed(
    1
  )}px) rotateY(${rot.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
}

export type CausticCoverflowItem = {
  /** card title, Geist Sans */
  title: string;
  /** mono meta line (date + index); auto-numbered when omitted */
  meta?: string;
  /** seed for the generated abstract thumb + caustic phases */
  seed?: number;
};

const DEFAULT_ITEMS: CausticCoverflowItem[] = [
  { title: "Meltwater channel, dawn", meta: "JAN 07 · 01" },
  { title: "Condensation study", meta: "JAN 19 · 02" },
  { title: "Caustic net, tank 4", meta: "FEB 02 · 03" },
  { title: "Refraction drift", meta: "FEB 21 · 04" },
  { title: "Surface tension map", meta: "MAR 05 · 05" },
  { title: "Foam decay series", meta: "MAR 18 · 06" },
  { title: "Light pool census", meta: "APR 02 · 07" },
];

// Lissajous pools: periods 7s / 11s / 13s, incommensurate x/y ratios so the
// paths never close, foreground-ink alphas in the 0.05–0.10 band
const POOLS = [
  { T: 7, rx: 1.0, ry: 1.31, a: 0.1 },
  { T: 11, rx: 0.83, ry: 1.0, a: 0.07 },
  { T: 13, rx: 1.19, ry: 0.71, a: 0.05 },
] as const;

export function CausticCoverflow({
  items = DEFAULT_ITEMS,
  initialIndex,
  cardWidth = 264,
  cardHeight = 330,
  className = "",
  "aria-label": ariaLabel = "Coverflow gallery",
}: {
  items?: CausticCoverflowItem[];
  /** starting focused card; defaults to the middle */
  initialIndex?: number;
  /** card width in px (shrinks responsively on narrow containers) */
  cardWidth?: number;
  cardHeight?: number;
  className?: string;
  "aria-label"?: string;
}) {
  const n = Math.max(1, items.length);
  const start = clamp(initialIndex ?? Math.floor((n - 1) / 2), 0, n - 1);

  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<HTMLSpanElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const thumbRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const fxRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const dotRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const root = rootRef.current;
    const stage = stageRef.current;
    if (!root || !stage) return;
    const cardsRaw = cardRefs.current.slice(0, n);
    const fxRaw = fxRefs.current.slice(0, n);
    const thumbRaw = thumbRefs.current.slice(0, n);
    if (
      cardsRaw.length < n ||
      fxRaw.length < n ||
      thumbRaw.length < n ||
      cardsRaw.includes(null) ||
      fxRaw.includes(null) ||
      thumbRaw.includes(null)
    )
      return;
    const cards = cardsRaw as HTMLDivElement[];
    const fxs = fxRaw as HTMLCanvasElement[];
    const thumbs = thumbRaw as HTMLCanvasElement[];

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const seedOf = (i: number) => items[i]?.seed ?? i * 7 + 3;

    // --- theme tokens: every canvas ink derives from these, never hardcoded
    let fg: RGB = { r: 237, g: 237, b: 237 };
    let mut: RGB = { r: 143, g: 143, b: 143 };
    let brd: RGB = { r: 46, g: 46, b: 46 };
    let srf: RGB = { r: 23, g: 23, b: 23 };
    let dark = true;
    const deriveTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      fg = parseColor(cs.getPropertyValue("--foreground")) ?? fg;
      mut = parseColor(cs.getPropertyValue("--muted")) ?? mut;
      brd = parseColor(cs.getPropertyValue("--border")) ?? brd;
      srf = parseColor(cs.getPropertyValue("--surface")) ?? srf;
      const bg = parseColor(cs.getPropertyValue("--background")) ?? srf;
      dark = 0.2126 * bg.r + 0.7152 * bg.g + 0.0722 * bg.b < 128;
    };
    deriveTokens();

    // --- geometry (responsive: cards shrink on narrow containers)
    let cw = cardWidth;
    let ch = cardHeight;
    let spacing = cw * 0.46;
    let sized = false;
    // quarter-resolution offscreen buffer shared by all cards, upscaled with
    // imageSmoothing for soft pool edges
    const qc = document.createElement("canvas");
    const qctx = qc.getContext("2d");
    // tiny buffer for the generated thumbs
    const tiny = document.createElement("canvas");
    const tctx = tiny.getContext("2d");
    if (!qctx || !tctx) return;

    const layout = () => {
      const rect = root.getBoundingClientRect();
      if (rect.width < 40 || rect.height < 10) {
        sized = false; // zero-size guard — never draw into a collapsed stage
        return;
      }
      sized = true;
      cw = Math.max(140, Math.round(Math.min(cardWidth, rect.width * 0.58)));
      ch = Math.round(cw * (cardHeight / cardWidth));
      spacing = cw * 0.46;
      stage.style.height = `${ch + 48}px`;
      qc.width = Math.max(1, Math.round(cw / 4));
      qc.height = Math.max(1, Math.round(ch / 4));
      for (let i = 0; i < n; i++) {
        cards[i].style.width = `${cw}px`;
        cards[i].style.height = `${ch}px`;
        // gotcha: a <canvas> is a replaced element — CSS inset does not size
        // it. Explicit style.width/height + dpr backing store, always.
        for (const c of [fxs[i], thumbs[i]]) {
          c.style.width = `${cw}px`;
          c.style.height = `${ch}px`;
          c.width = Math.max(1, Math.round(cw * dpr));
          c.height = Math.max(1, Math.round(ch * dpr));
        }
      }
    };

    // --- generated abstract thumbs: token-gray value-noise fields, one per
    // seed, redrawn per theme (no external images)
    const paintThumb = (i: number) => {
      if (!sized) return;
      const th = thumbs[i];
      const ctx = th.getContext("2d");
      if (!ctx) return;
      const seed = seedOf(i);
      const gw = 26;
      const gh = Math.max(8, Math.round((gw * ch) / cw));
      tiny.width = gw;
      tiny.height = gh;
      const img = tctx.createImageData(gw, gh);
      const data = img.data;
      for (let y = 0; y < gh; y++) {
        for (let x = 0; x < gw; x++) {
          const v = clamp(
            noise2(x * 0.33 + seed * 13.7, y * 0.33 + seed * 5.1),
            0,
            1
          );
          let c: RGB;
          if (v < 0.62) c = mixRGB(srf, brd, v / 0.62);
          else if (v < 0.88) c = mixRGB(brd, mut, (v - 0.62) / 0.26);
          else c = mixRGB(mut, fg, ((v - 0.88) / 0.12) * 0.55);
          // sink toward surface near the footer so the caption stays legible
          const settle = (y / gh) * 0.45;
          c = mixRGB(c, srf, settle);
          const o = (y * gw + x) * 4;
          data[o] = Math.round(c.r);
          data[o + 1] = Math.round(c.g);
          data[o + 2] = Math.round(c.b);
          data[o + 3] = 255;
        }
      }
      tctx.putImageData(img, 0, 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.clearRect(0, 0, th.width, th.height);
      ctx.drawImage(tiny, 0, 0, gw, gh, 0, 0, th.width, th.height);
    };
    const paintThumbs = () => {
      for (let i = 0; i < n; i++) paintThumb(i);
    };

    // --- caustics: 3 radial light pools on Lissajous paths, drawn into the
    // quarter-res buffer on a fully cleared frame (no alpha accumulation),
    // then upscaled onto the card's overlay canvas
    const drawCaustics = (i: number, timeSec: number, amp: number) => {
      if (!sized) return;
      const fx = fxs[i];
      const ctx = fx.getContext("2d");
      if (!ctx) return;
      const qw = qc.width;
      const qh = qc.height;
      qctx.setTransform(1, 0, 0, 1, 0, 0);
      qctx.clearRect(0, 0, qw, qh);
      const seed = seedOf(i);
      for (let j = 0; j < POOLS.length; j++) {
        const p = POOLS[j];
        const ph = seed * 1.7 + j * 2.399;
        const x =
          qw * 0.5 +
          qw * 0.3 * amp * Math.sin(((timeSec / p.T) * 2 * Math.PI) * p.rx + ph);
        const y =
          qh * 0.5 +
          qh *
            0.3 *
            amp *
            Math.sin(((timeSec / p.T) * 2 * Math.PI) * p.ry + ph * 1.83);
        const r = Math.max(2, qw * 0.4); // 40% of card width, quarter space
        const g = qctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(${fg.r},${fg.g},${fg.b},${p.a})`);
        g.addColorStop(1, `rgba(${fg.r},${fg.g},${fg.b},0)`);
        qctx.fillStyle = g;
        qctx.fillRect(0, 0, qw, qh);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(qc, 0, 0, qw, qh, 0, 0, cw, ch);
    };

    // static frame for cards outside the live trio (and for reduced motion):
    // one fixed-phase caustic frame at half amplitude
    const paintStatic = () => {
      for (let i = 0; i < n; i++) drawCaustics(i, seedOf(i) * 0.37, 0.5);
    };

    // --- chromatic aberration: the focused card's border restroked twice
    // with horizontal offsets ±k in red/blue channel inks split from the
    // foreground token (fg.r → red pass, fg.b → blue pass). Additive
    // 'lighter' on dark themes; source-over fringes on light. Drawn onto the
    // freshly cleared caustic frame each tick — never accumulates.
    const drawAberration = (i: number, k: number) => {
      if (!sized) return;
      const ctx = fxs[i].getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const alpha = clamp(0.18 + (k / 6) * 0.55, 0, 0.85);
      ctx.lineWidth = 1.25;
      ctx.globalCompositeOperation = dark ? "lighter" : "source-over";
      // fixed minimum-saturation floor on the split channel: a pure
      // channel-split off a near-black --foreground (light theme) degrades
      // to a gray smudge, not a color, without a floor to keep it visible
      const redV = Math.max(fg.r, 190);
      const blueV = Math.max(fg.b, 190);
      ctx.save();
      ctx.translate(-k, 0);
      rrectPath(ctx, 1, 1, cw - 2, ch - 2, 11);
      ctx.strokeStyle = `rgba(${redV},0,0,${alpha})`;
      ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.translate(k, 0);
      rrectPath(ctx, 1, 1, cw - 2, ch - 2, 11);
      ctx.strokeStyle = `rgba(0,0,${blueV},${alpha})`;
      ctx.stroke();
      ctx.restore();
      ctx.globalCompositeOperation = "source-over";
    };

    // --- motion state (refs/locals only — never React state on hot paths)
    let pos = start;
    let prevPos = start;
    let vel = 0; // idx/s
    let effVel = 0; // smoothed, drives aberration
    let mode: "idle" | "drag" | "momentum" | "spring" | "tween" = "idle";
    let springStart = 0;
    let springTarget = start;
    let tweenFrom = 0;
    let tweenTarget = 0;
    let tweenStart = 0;
    let tweenDur = 250;
    let aberK = 0;
    let aberDeadline = 0;
    let lastWindow: number[] = [];
    let ambient = 0.5; // pool amplitude scale: 0.5 idle ↔ 1 interacting
    let raf = 0;
    let running = false;
    let last = 0;
    let lastCaustic = 0;
    let intersecting = true;
    let activeShown = -1;

    const applyTransforms = () => {
      for (let i = 0; i < n; i++) {
        const d = i - pos;
        cards[i].style.transform = cardTransform(d, spacing);
        // depth sort via explicit z-index (no preserve-3d intersection risk)
        cards[i].style.zIndex = String(200 - Math.round(Math.abs(d) * 10));
      }
    };

    const syncActive = () => {
      const a = Math.round(clamp(pos, 0, n - 1));
      if (a === activeShown) return;
      activeShown = a;
      const dots = dotRefs.current;
      for (let i = 0; i < n; i++) {
        const dot = dots[i];
        if (dot) dot.dataset.active = i === a ? "true" : "false";
      }
      if (liveRef.current)
        liveRef.current.textContent = `${items[a]?.title ?? ""}, item ${
          a + 1
        } of ${n}`;
    };

    const settledNow = () => mode === "idle" && aberK < 0.02;

    const frame = (now: number) => {
      raf = 0;
      const dt = Math.min(0.05, last === 0 ? 1 / 60 : (now - last) / 1000);
      last = now;

      if (mode === "momentum") {
        vel *= Math.pow(0.92, dt * 60); // friction 0.92/frame, fps-normalized
        pos += vel * dt;
        if (pos < 0) {
          pos += (0 - pos) * Math.min(1, dt * 10);
          vel *= 0.8;
        } else if (pos > n - 1) {
          pos += (n - 1 - pos) * Math.min(1, dt * 10);
          vel *= 0.8;
        }
        if (Math.abs(vel) < 0.05) {
          mode = "spring";
          springTarget = Math.round(clamp(pos, 0, n - 1));
          springStart = now;
        }
      } else if (mode === "spring") {
        const kk = 170;
        const cc = 2 * Math.sqrt(kk) * 0.95;
        vel += (-kk * (pos - springTarget) - cc * vel) * dt;
        pos += vel * dt;
        // forced-settle deadline: a flick can never oscillate past 900ms
        if (
          (Math.abs(pos - springTarget) < 0.0015 && Math.abs(vel) < 0.02) ||
          now - springStart > 900
        ) {
          pos = springTarget;
          vel = 0;
          mode = "idle";
        }
      } else if (mode === "tween") {
        const t = Math.min(1, (now - tweenStart) / tweenDur);
        pos = tweenFrom + (tweenTarget - tweenFrom) * easeOutExpo(t);
        if (t >= 1) {
          pos = tweenTarget;
          mode = "idle";
        }
      }
      // mode === "drag": pointermove writes pos directly between frames

      // posChanged must be read before prevPos updates — a spring/tween that
      // just force-settled flipped mode to "idle" this frame, but its final
      // pos snap still needs one applyTransforms pass
      const posChanged = pos !== prevPos;
      const inst = (pos - prevPos) / Math.max(dt, 1e-4);
      prevPos = pos;
      effVel += (inst - effVel) * 0.4;

      // aberration: k = min(6, |angular velocity| * 0.04), angular velocity
      // of the focused card = 35 deg per index of travel; exponential decay
      // at rest (τ=100ms → settles < 500ms) under a 900ms hard deadline
      const moving = mode !== "idle" || posChanged;
      if (moving) {
        aberK = Math.min(6, Math.abs(effVel) * 35 * 0.04);
        if (aberK > 0.05) aberDeadline = now + 900;
      } else {
        aberK *= Math.exp(-dt * 10);
        if (aberK < 0.03 || now > aberDeadline) aberK = 0;
      }

      // idle pools drift at half amplitude — ambient is the default look
      const ambTarget = moving ? 1 : 0.5;
      ambient += (ambTarget - ambient) * Math.min(1, dt * 4);

      if (sized) {
        if (moving) applyTransforms();
        syncActive();
        const a = activeShown;
        // full-rate while interacting or aberrating; 30fps cap at rest
        const draw = moving || aberK >= 0.02 || now - lastCaustic >= 33;
        if (draw) {
          lastCaustic = now;
          const t = now / 1000;
          // only the focused card and its two neighbors run live caustics
          const winStart = Math.max(0, a - 1);
          const winEnd = Math.min(n - 1, a + 1);
          // unconditionally wipe any index the live window left behind —
          // e.g. a fast multi-card navigate tween where `a` jumps 2+ cards
          // in one frame — regardless of aberK's decay state, so a stale
          // aberration fringe can never strand on an unattended card
          for (const idx of lastWindow) {
            if (idx < winStart || idx > winEnd) drawCaustics(idx, t, ambient);
          }
          lastWindow = [];
          for (let i = winStart; i <= winEnd; i++) {
            drawCaustics(i, t, ambient);
            lastWindow.push(i);
          }
          if (aberK >= 0.02) drawAberration(a, aberK);
        }
      }

      // sleep policy: offscreen → stop; settled AND tab hidden → full sleep;
      // otherwise the ambient 30fps drift keeps running
      if (!intersecting || (settledNow() && document.hidden)) {
        running = false;
        return;
      }
      raf = requestAnimationFrame(frame);
    };

    const wake = () => {
      if (reduced || running || !intersecting) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    };

    const navigate = (target: number, dur: number) => {
      const t = clamp(Math.round(target), 0, n - 1);
      if (reduced) {
        // reduced motion: instant 200ms CSS ease, no momentum, no aberration
        pos = t;
        vel = 0;
        applyTransforms();
        syncActive();
        return;
      }
      tweenFrom = pos;
      tweenTarget = t;
      tweenStart = performance.now();
      tweenDur = dur;
      mode = "tween";
      wake();
    };

    // --- pointer: drag scrubs the index continuously, release applies
    // momentum, taps center the tapped card
    let dragging = false;
    let dragMoved = 0;
    let dragTotal = 0;
    let lastX = 0;
    let lastT = 0;
    let dragVel = 0;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      dragging = true;
      dragMoved = 0;
      dragTotal = 0;
      lastX = e.clientX;
      lastT = performance.now();
      dragVel = 0;
      if (!reduced) {
        mode = "drag";
        vel = 0;
        stage.style.cursor = "grabbing";
        wake();
      }
      try {
        stage.setPointerCapture(e.pointerId);
      } catch {
        /* capture unsupported */
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const now = performance.now();
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      dragMoved += Math.abs(dx);
      dragTotal += dx;
      if (reduced) return;
      const dtm = Math.max(4, now - lastT) / 1000;
      lastT = now;
      let next = pos - dx / spacing;
      if (next < 0) next *= 0.3; // rubber band past the ends
      else if (next > n - 1) next = n - 1 + (next - (n - 1)) * 0.3;
      dragVel += ((next - pos) / dtm - dragVel) * 0.35;
      pos = next;
    };
    const onUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      stage.style.cursor = "grab";
      try {
        stage.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      if (dragMoved < 5) {
        // click: center the card under the pointer
        const rect = stage.getBoundingClientRect();
        const rel = (e.clientX - rect.left - rect.width / 2) / spacing;
        navigate(pos + rel, 300);
        return;
      }
      if (reduced) {
        if (Math.abs(dragTotal) > 30)
          navigate(Math.round(pos) - Math.sign(dragTotal), 200);
        return;
      }
      vel = clamp(dragVel, -8, 8);
      mode = "momentum";
      wake();
    };
    const onCancel = () => {
      if (!dragging) return;
      dragging = false;
      stage.style.cursor = "grab";
      if (!reduced) {
        vel = clamp(dragVel, -8, 8);
        mode = "momentum";
        wake();
      }
    };

    // --- wheel steps one card (250ms ease-out-expo), locked per step
    let wheelLock = 0;
    const onWheel = (e: WheelEvent) => {
      const delta =
        Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (delta === 0) return;
      e.preventDefault();
      const now = performance.now();
      if (now < wheelLock) return;
      wheelLock = now + 260;
      navigate(Math.round(pos) + (delta > 0 ? 1 : -1), 250);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        navigate(Math.round(pos) - 1, 250);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        navigate(Math.round(pos) + 1, 250);
      }
    };

    const dotCleanups: (() => void)[] = [];
    dotRefs.current.slice(0, n).forEach((dot, i) => {
      if (!dot) return;
      const h = () => navigate(i, 300);
      dot.addEventListener("click", h);
      dotCleanups.push(() => dot.removeEventListener("click", h));
    });

    // --- observers
    const io = new IntersectionObserver((entries) => {
      intersecting = entries[0]?.isIntersecting ?? true;
      if (intersecting) wake();
    });
    io.observe(root);

    const ro = new ResizeObserver(() => {
      const wasSized = sized;
      layout();
      if (!sized) return;
      paintThumbs();
      paintStatic();
      applyTransforms();
      if (!wasSized) syncActive();
      wake();
    });
    ro.observe(root);

    // live theme re-derive: regenerate thumbs and static frames per theme;
    // the live trio re-inks on the next frame
    const mo = new MutationObserver(() => {
      deriveTokens();
      paintThumbs();
      paintStatic();
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

    if (reduced) {
      for (const c of cards) c.style.transition = "transform 200ms ease";
    }
    stage.addEventListener("pointerdown", onDown);
    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerup", onUp);
    stage.addEventListener("pointercancel", onCancel);
    stage.addEventListener("wheel", onWheel, { passive: false });
    stage.addEventListener("keydown", onKey);

    // initial paint
    layout();
    paintThumbs();
    paintStatic();
    applyTransforms();
    syncActive();
    wake();

    return () => {
      cancelAnimationFrame(raf);
      running = false;
      io.disconnect();
      ro.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      stage.removeEventListener("pointerdown", onDown);
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerup", onUp);
      stage.removeEventListener("pointercancel", onCancel);
      stage.removeEventListener("wheel", onWheel);
      stage.removeEventListener("keydown", onKey);
      for (const c of dotCleanups) c();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, n, start, cardWidth, cardHeight]);

  return (
    <div ref={rootRef} className={`w-full ${className}`}>
      <div
        ref={stageRef}
        role="group"
        aria-roledescription="carousel"
        aria-label={ariaLabel}
        tabIndex={0}
        className="relative w-full touch-pan-y select-none overflow-hidden rounded-md outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        style={{
          height: cardHeight + 48,
          perspective: "1200px",
          cursor: "grab",
        }}
      >
        {items.map((item, i) => {
          const d = i - start;
          return (
            <div
              key={i}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              className="absolute left-1/2 top-1/2"
              style={{
                width: cardWidth,
                height: cardHeight,
                transform: cardTransform(d, cardWidth * 0.46),
                zIndex: 200 - Math.round(Math.abs(d) * 10),
                willChange: "transform",
              }}
            >
              {/* hover lift + border shift on an inner wrapper so the rAF
                  loop's 3D transform on the outer node is never fought.
                  clip-path (not just overflow-hidden+rounded-md) contains the
                  backdrop-filter pane and canvases: this wrapper sits inside
                  an ancestor that's both will-change:transform'd and
                  rotateY/translateZ'd for the coverflow pose, and on that
                  combination Chromium/WebKit can rasterize a border-radius +
                  overflow:hidden clip as its full rectangular layer bounds
                  instead of the rounded mask — a rectangular box behind the
                  center card, sharp corner wedges poking past the radius on
                  the rotated side cards. clip-path is evaluated as its own
                  mask primitive every paint and doesn't share that failure
                  mode, so it stays authoritative regardless of compositing. */}
              <div
                className="relative h-full w-full overflow-hidden rounded-md border border-border bg-surface transition-[translate,border-color] duration-200 hover:-translate-y-0.5 hover:border-foreground/25"
                style={{ clipPath: "inset(0 round var(--radius-md))" }}
              >
                <canvas
                  ref={(el) => {
                    thumbRefs.current[i] = el;
                  }}
                  aria-hidden
                  className="absolute left-0 top-0"
                />
                {/* frosted pane over the generated thumb */}
                <div
                  aria-hidden
                  className="absolute inset-0"
                  style={{
                    backdropFilter: "blur(14px) saturate(1.1)",
                    WebkitBackdropFilter: "blur(14px) saturate(1.1)",
                    background:
                      "color-mix(in srgb, var(--surface) 60%, transparent)",
                  }}
                />
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <p className="text-sm font-semibold tracking-tight text-foreground">
                    {item.title}
                  </p>
                  <p className="mt-1 font-mono text-[10px] tracking-widest text-muted">
                    {item.meta ?? `NO. ${String(i + 1).padStart(2, "0")}`}
                  </p>
                </div>
                {/* caustic + aberration overlay */}
                <canvas
                  ref={(el) => {
                    fxRefs.current[i] = el;
                  }}
                  aria-hidden
                  className="pointer-events-none absolute left-0 top-0"
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-5 flex items-center justify-center gap-2">
        {items.map((item, i) => (
          <button
            key={i}
            ref={(el) => {
              dotRefs.current[i] = el;
            }}
            type="button"
            data-active={i === start ? "true" : "false"}
            aria-label={`Go to ${item.title}`}
            className="h-1.5 w-6 rounded-full bg-border transition-colors duration-200 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent data-[active=true]:bg-foreground"
          />
        ))}
      </div>
      <span ref={liveRef} aria-live="polite" className="sr-only" />
    </div>
  );
}
