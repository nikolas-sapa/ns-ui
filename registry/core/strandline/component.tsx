"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// Strandline — a changelog drawn as a beach strand. Each event arrives as a
// foam crest sweeping a quadratic arc in from the "now" edge (right), breaks
// at its chronological position, deposits a DOM marker with a spring pop, and
// recedes leaving an etched tide-ring. Later waves reach further up-strand and
// wash past earlier markers, adding rings — ring density reads as history.
// Canvas 2D behind DOM markers; residue rings live in pruned per-marker
// segment lists re-stroked after a full clear every frame (never
// destination-in decay). Direct-DOM rAF hot path; the loop sleeps when no
// crest is traveling, the fleck array is empty, and all marker springs have
// settled.
// ---------------------------------------------------------------------------

export interface StrandlineEvent {
  /** short mono date label, e.g. "JAN 12" */
  date: string;
  /** version tag, e.g. "v1.2.0" */
  version: string;
  /** one-line release title */
  title: string;
  /** one-line body for the detail card */
  body: string;
}

const DEFAULT_EVENTS: StrandlineEvent[] = [
  {
    date: "JAN 12",
    version: "v1.0.0",
    title: "First public release",
    body: "Core engine, CLI, and the initial component registry.",
  },
  {
    date: "FEB 27",
    version: "v1.1.0",
    title: "Streaming responses",
    body: "Token-level streaming across every endpoint.",
  },
  {
    date: "APR 09",
    version: "v1.2.0",
    title: "Edge runtime",
    body: "Sub-50ms cold starts on the edge network.",
  },
  {
    date: "MAY 30",
    version: "v2.0.0",
    title: "Engine rewrite",
    body: "New scheduler, 3x throughput, breaking API cleanup.",
  },
  {
    date: "JUN 24",
    version: "v2.1.0",
    title: "Batch imports",
    body: "Bulk ingestion with resumable uploads.",
  },
  {
    date: "JUL 15",
    version: "v2.2.0",
    title: "Access controls",
    body: "Row-level permissions and full audit trails.",
  },
];

type RGB = { r: number; g: number; b: number };

function parseColor(raw: string): RGB | null {
  const v = raw.trim();
  if (v.startsWith("#")) {
    const hex = v.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0]! + hex[0]!, 16);
      const g = parseInt(hex[1]! + hex[1]!, 16);
      const b = parseInt(hex[2]! + hex[2]!, 16);
      return Number.isNaN(r + g + b) ? null : { r, g, b };
    }
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return Number.isNaN(r + g + b) ? null : { r, g, b };
    }
    return null;
  }
  const m = v.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  return m ? { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) } : null;
}

function rgba(c: RGB, a: number): string {
  return `rgba(${c.r},${c.g},${c.b},${a})`;
}

// deterministic prng — jitter, ring geometry, fleck spray
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);

const WAVE_SPEED = 420; // px/s along the arc
const RECEDE_MS = 550;
const CREST_SEGS = 48; // 40-60 short stroked segments
const CREST_WINDOW = 60; // px of arc the foam comb trails over
const FLECK_LIFE = 600; // ms
const FLECK_BURST = 250; // ms emission window on break
const GRAVITY = 300; // px/s²
const SPRING_K = 250; // s⁻² — overshoot ~1.06, settles < 500ms
const SPRING_ZETA = 0.5;
const SPRING_DEADLINE = 800; // ms forced-settle
const MAX_RINGS = 3; // per-marker residue cap, oldest pruned

type Ring = { r: number; rot: number; span: number; wave: number };

type Wave = {
  target: number; // event index
  pts: Float32Array; // x,y pairs along the arc
  cum: Float32Array; // cumulative arc length
  len: number;
  t0: number;
  dur: number;
  phase: "travel" | "recede";
  rt0: number;
  sTip: number;
  recedeP: number;
  deposits: boolean; // false for hover replays — no residue ring
  deposited: boolean; // true once breakWave() has actually landed the marker
  done: boolean;
  segD: Float32Array; // crest comb: distance behind tip
  segP: Float32Array; // perpendicular jitter ±3px
  segL: Float32Array; // segment length
  segA: Float32Array; // alpha falloff toward the back of the comb
};

type Fleck = { x: number; y: number; vx: number; vy: number; birth: number };

type Spring = { s: number; v: number; t0: number; active: boolean };

export function Strandline({
  events = DEFAULT_EVENTS,
  autoplay = 3,
  className = "h-80",
  "aria-label": ariaLabel = "Release timeline strand",
}: {
  /** chronological events, oldest first — oldest breaks nearest the now edge */
  events?: StrandlineEvent[];
  /** waves auto-launched on mount (0 disables the intro tide) */
  autoplay?: number;
  className?: string;
  "aria-label"?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const outerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const cardRef = useRef<HTMLDivElement>(null);
  const cardTitleRef = useRef<HTMLParagraphElement>(null);
  const cardMetaRef = useRef<HTMLParagraphElement>(null);
  const cardBodyRef = useRef<HTMLParagraphElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const prevRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const apiRef = useRef<{
    advance: () => void;
    retreat: () => void;
    hoverIn: (i: number) => void;
    hoverOut: () => void;
  } | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const card = cardRef.current;
    if (!root || !canvas || !card) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const n = events.length;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const rand = mulberry32(0x57a4d);

    // -- token inks: derived at mount, re-derived on documentElement class ---
    let borderC: RGB = { r: 46, g: 46, b: 46 };
    let fgC: RGB = { r: 237, g: 237, b: 237 };
    let mutedC: RGB = { r: 143, g: 143, b: 143 };
    let accentC: RGB = { r: 0, g: 107, b: 255 };
    const derive = () => {
      const cs = getComputedStyle(document.documentElement);
      borderC = parseColor(cs.getPropertyValue("--border")) ?? borderC;
      fgC = parseColor(cs.getPropertyValue("--foreground")) ?? fgC;
      mutedC = parseColor(cs.getPropertyValue("--muted")) ?? mutedC;
      accentC = parseColor(cs.getPropertyValue("--accent")) ?? accentC;
    };
    derive();

    // -- geometry ------------------------------------------------------------
    let w = 0;
    let h = 0;
    let dpr = 1;
    let axisY = 0;
    let sized = false;
    const xs = new Float64Array(Math.max(1, n)); // marker x per event

    // -- hot-path state: locals only, never React state ----------------------
    let raf = 0;
    let last = 0;
    let visible = true;
    let mainWave: Wave | null = null;
    let replayWave: Wave | null = null;
    // true only while a wave is still in flight and hasn't landed yet — once
    // breakWave() fires, the marker is already stranded so it must not be
    // double-counted as "reserved" for the rest of the recede tail.
    const reserved = (wv: Wave | null): wv is Wave =>
      wv !== null && wv.deposits && !wv.deposited;
    const queue: number[] = [];
    const flecks: Fleck[] = [];
    let strandedCount = 0;
    const rings: Ring[][] = Array.from({ length: n }, () => []);
    const springs: Spring[] = Array.from({ length: n }, () => ({
      s: 0.6,
      v: 0,
      t0: 0,
      active: false,
    }));
    let cardVisible = false;
    let disposed = false;

    const placeMarker = (i: number) => {
      const outer = outerRefs.current[i];
      if (!outer) return;
      outer.style.transform = `translate3d(${xs[i]! - 12}px, ${axisY - 12}px, 0)`;
    };

    const resize = (): boolean => {
      const rect = root.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) {
        sized = false; // zero-size container guard — loop no-ops until real
        return false;
      }
      w = rect.width;
      h = rect.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      // canvas is a replaced element — inset never sizes it; explicit CSS
      // size + dpr backing store, or it renders at dpr scale
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      axisY = h * 0.62;
      const padL = Math.max(28, w * 0.07);
      const padR = Math.max(30, w * 0.075);
      const usable = Math.max(1, w - padL - padR);
      for (let i = 0; i < n; i++) {
        // oldest nearest the now edge (right); each later wave reaches
        // further up-strand — that is what lets it wash earlier markers
        xs[i] = n === 1 ? padL + usable / 2 : w - padR - (i / (n - 1)) * usable;
      }
      // DOM markers take OFFSET transforms from the container origin — never
      // absolute canvas coords
      for (let i = 0; i < n; i++) placeMarker(i);
      sized = true;
      return true;
    };

    // -- arc construction ----------------------------------------------------
    const buildArc = (
      x0: number,
      y0: number,
      cx: number,
      cy: number,
      x1: number,
      y1: number
    ) => {
      const N = Math.max(24, Math.min(150, Math.round(Math.abs(x0 - x1) / 5)));
      const pts = new Float32Array((N + 1) * 2);
      const cum = new Float32Array(N + 1);
      let px = 0;
      let py = 0;
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const u = 1 - t;
        const x = u * u * x0 + 2 * u * t * cx + t * t * x1;
        const y = u * u * y0 + 2 * u * t * cy + t * t * y1;
        pts[i * 2] = x;
        pts[i * 2 + 1] = y;
        cum[i] = i === 0 ? 0 : cum[i - 1]! + Math.hypot(x - px, y - py);
        px = x;
        py = y;
      }
      return { pts, cum, len: cum[N]! };
    };

    const makeWave = (target: number, deposits: boolean): Wave => {
      const x1 = xs[target]!;
      let x0: number;
      let y0: number;
      let lift: number;
      let x1End: number;
      let y1End: number;
      if (deposits) {
        x0 = w + 10;
        y0 = axisY + 12;
        lift = Math.min(h * 0.3, 26 + (x0 - x1) * 0.14);
        x1End = x1;
        y1End = axisY;
      } else {
        // hover/focus replay: the swash originates AT the stranded dot and
        // washes a short distance further up-strand (left, away from the
        // water) before receding back to it — the dot is the start, not
        // the destination.
        x0 = x1;
        y0 = axisY;
        lift = 26;
        x1End = Math.max(6, x1 - 110);
        y1End = axisY;
      }
      const arc = buildArc(x0, y0, (x0 + x1End) / 2, axisY - lift, x1End, y1End);
      const segs = deposits ? CREST_SEGS : 28;
      const win = deposits ? CREST_WINDOW : 34;
      const segD = new Float32Array(segs);
      const segP = new Float32Array(segs);
      const segL = new Float32Array(segs);
      const segA = new Float32Array(segs);
      for (let k = 0; k < segs; k++) {
        segD[k] = rand() * win;
        segP[k] = (rand() * 2 - 1) * 3; // ±3px perpendicular jitter
        segL[k] = 3 + rand() * 6;
        segA[k] = Math.max(0.15, 1 - segD[k]! / (win + 12));
      }
      return {
        target,
        pts: arc.pts,
        cum: arc.cum,
        len: arc.len,
        t0: performance.now(),
        dur: Math.max(120, (arc.len / WAVE_SPEED) * 1000),
        phase: "travel",
        rt0: 0,
        sTip: 0,
        recedeP: 0,
        deposits,
        deposited: false,
        done: false,
        segD,
        segP,
        segL,
        segA,
      };
    };

    // position + unit tangent at arc length s (binary search on cum)
    const posTan = (
      wv: Wave,
      s: number,
      out: { x: number; y: number; tx: number; ty: number }
    ) => {
      const cum = wv.cum;
      const N = cum.length - 1;
      const cs = Math.min(wv.len, Math.max(0, s));
      let lo = 0;
      let hi = N;
      while (lo < hi - 1) {
        const mid = (lo + hi) >> 1;
        if (cum[mid]! <= cs) lo = mid;
        else hi = mid;
      }
      const seg = cum[hi]! - cum[lo]!;
      const f = seg > 0 ? (cs - cum[lo]!) / seg : 0;
      const ax = wv.pts[lo * 2]!;
      const ay = wv.pts[lo * 2 + 1]!;
      const bx = wv.pts[hi * 2]!;
      const by = wv.pts[hi * 2 + 1]!;
      const dx = bx - ax;
      const dy = by - ay;
      const d = Math.hypot(dx, dy) || 1;
      out.x = ax + dx * f;
      out.y = ay + dy * f;
      out.tx = dx / d;
      out.ty = dy / d;
    };
    const pt = { x: 0, y: 0, tx: 0, ty: 0 };

    // -- residue rings: pruned segment lists, re-stroked from a full clear ---
    const pushRing = (marker: number, wave: number) => {
      const list = rings[marker]!;
      const r = 11 + list.length * 5 + rand() * 3;
      const span = Math.PI * (1.0 + rand() * 0.35);
      const rot = -span / 2 + (rand() * 2 - 1) * 0.35; // crescent bows seaward
      list.push({ r, rot, span, wave });
      if (list.length > MAX_RINGS) list.shift(); // oldest pruned — no decay
    };

    const spawnFlecks = (bx: number, by: number, count: number, now: number) => {
      for (let i = 0; i < count; i++) {
        const speed = 60 + rand() * 80;
        const ang = Math.PI * (1.05 + rand() * 0.8); // spray up + up-strand
        flecks.push({
          x: bx + (rand() * 2 - 1) * 5,
          y: by + (rand() * 2 - 1) * 3,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed,
          birth: now + rand() * FLECK_BURST,
        });
      }
    };

    const syncControls = () => {
      const launched =
        strandedCount + queue.length + (reserved(mainWave) ? 1 : 0);
      if (counterRef.current)
        counterRef.current.textContent = `${reduced ? n : strandedCount} / ${n}`;
      if (nextRef.current) nextRef.current.disabled = reduced || launched >= n;
      if (prevRef.current) prevRef.current.disabled = reduced || launched <= 0;
    };

    const depositMarker = (i: number, now: number) => {
      const outer = outerRefs.current[i];
      const btn = btnRefs.current[i];
      if (outer) outer.style.visibility = "visible";
      if (btn) btn.style.transform = "scale(0.6)";
      const sp = springs[i]!;
      sp.s = 0.6;
      sp.v = 0;
      sp.t0 = now;
      sp.active = true;
      strandedCount = Math.max(strandedCount, i + 1);
      pushRing(i, i); // its own tide-ring
      // this wash passes every already-stranded marker on its way up-strand
      for (let j = 0; j < i; j++) {
        if (j < strandedCount - 1 && xs[j]! > xs[i]!) pushRing(j, i);
      }
      syncControls();
    };

    const undeposit = () => {
      const i = strandedCount - 1;
      if (i < 0) return;
      const outer = outerRefs.current[i];
      if (outer) outer.style.visibility = "hidden";
      springs[i]!.active = false;
      springs[i]!.s = 0.6;
      strandedCount = i;
      for (let j = 0; j < n; j++) {
        rings[j] = rings[j]!.filter((r) => r.wave < i);
      }
    };

    // -- detail card ---------------------------------------------------------
    const showCard = (i: number) => {
      const ev = events[i];
      if (!ev || !sized) return;
      if (cardTitleRef.current) cardTitleRef.current.textContent = ev.title;
      if (cardMetaRef.current)
        cardMetaRef.current.textContent = `${ev.version} · ${ev.date}`;
      if (cardBodyRef.current) cardBodyRef.current.textContent = ev.body;
      const cx = Math.min(w - 118, Math.max(118, xs[i]!));
      const tf = `translate3d(${cx}px, ${axisY - 26}px, 0) translate(-50%, -100%)`;
      if (!cardVisible) {
        // first show: no fly-in from the previous transform
        card.style.transition = "none";
        card.style.transform = tf;
        void card.offsetWidth;
        card.style.transition = "";
      } else {
        card.style.transform = tf;
      }
      card.style.opacity = "1";
      cardVisible = true;
    };
    const hideCard = () => {
      card.style.opacity = "0";
      cardVisible = false;
    };

    // -- render: full clear, then everything re-stroked from lists -----------
    const render = (now: number) => {
      if (!sized) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = "round";

      // axis — 1px --border at 62% height
      ctx.strokeStyle = rgba(borderC, 1);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.max(10, w * 0.03), axisY + 0.5);
      ctx.lineTo(w, axisY + 0.5);
      ctx.stroke();

      // chronological ticks — stranded solid, future faint
      for (let i = 0; i < n; i++) {
        ctx.strokeStyle = rgba(borderC, i < strandedCount ? 0.9 : 0.35);
        ctx.beginPath();
        ctx.moveTo(xs[i]!, axisY + 3);
        ctx.lineTo(xs[i]!, axisY + 8);
        ctx.stroke();
      }

      // now edge — short vertical bar where the water lives
      ctx.strokeStyle = rgba(borderC, 0.9);
      ctx.beginPath();
      ctx.moveTo(w - 1.5, axisY - 14);
      ctx.lineTo(w - 1.5, axisY + 14);
      ctx.stroke();

      // residue tide-rings — one batched stroke, --muted alpha 0.12
      ctx.strokeStyle = rgba(mutedC, 0.12);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < strandedCount; i++) {
        const list = rings[i]!;
        for (let k = 0; k < list.length; k++) {
          const rg = list[k]!;
          ctx.moveTo(
            xs[i]! + rg.r * Math.cos(rg.rot),
            axisY + rg.r * Math.sin(rg.rot)
          );
          ctx.arc(xs[i]!, axisY, rg.r, rg.rot, rg.rot + rg.span);
        }
      }
      ctx.stroke();

      // active waves
      if (mainWave) renderWave(mainWave);
      if (replayWave) renderWave(replayWave);

      // foam flecks
      ctx.fillStyle = rgba(fgC, 1);
      for (let i = 0; i < flecks.length; i++) {
        const f = flecks[i]!;
        if (now < f.birth) continue;
        const a = 0.5 * (1 - (now - f.birth) / FLECK_LIFE);
        if (a <= 0) continue;
        ctx.globalAlpha = a;
        ctx.fillRect(f.x - 1, f.y - 1, 2, 2);
      }
      ctx.globalAlpha = 1;
    };

    const trail = (wv: Wave, sEnd: number, alpha: number) => {
      if (sEnd <= 0) return;
      const cum = wv.cum;
      const N = cum.length - 1;
      ctx.beginPath();
      ctx.moveTo(wv.pts[0]!, wv.pts[1]!);
      for (let i = 1; i <= N && cum[i]! <= sEnd; i++) {
        ctx.lineTo(wv.pts[i * 2]!, wv.pts[i * 2 + 1]!);
      }
      posTan(wv, sEnd, pt);
      ctx.lineTo(pt.x, pt.y);
      ctx.strokeStyle = rgba(fgC, alpha * 0.45);
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.strokeStyle = rgba(fgC, alpha);
      ctx.lineWidth = 1;
      ctx.stroke();
    };

    const renderWave = (wv: Wave) => {
      if (wv.phase === "travel") {
        trail(wv, wv.sTip, 0.1); // glowing wetted arc behind the crest
        // crest comb — short segments jittered perpendicular to the arc
        ctx.lineWidth = 1;
        for (let k = 0; k < wv.segD.length; k++) {
          const s = wv.sTip - wv.segD[k]!;
          if (s < 0) continue;
          posTan(wv, s, pt);
          const nx = -pt.ty;
          const ny = pt.tx;
          const ox = pt.x + nx * wv.segP[k]!;
          const oy = pt.y + ny * wv.segP[k]!;
          const half = wv.segL[k]! / 2;
          ctx.strokeStyle = rgba(fgC, 0.5 * wv.segA[k]!);
          ctx.beginPath();
          ctx.moveTo(ox - pt.tx * half, oy - pt.ty * half);
          ctx.lineTo(ox + pt.tx * half, oy + pt.ty * half);
          ctx.stroke();
        }
        // leading 1px accent line — the ONLY accent ink: active incoming crest
        posTan(wv, Math.max(0, wv.sTip - 10), pt);
        const lx = pt.x;
        const ly = pt.y;
        posTan(wv, wv.sTip, pt);
        ctx.strokeStyle = rgba(accentC, 0.95);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
      } else {
        // recede: the wetted arc dries back toward the arc's start — the
        // now edge for a real wave, the dot itself for a hover replay
        const e = 1 - easeOutQuad(wv.recedeP);
        trail(wv, wv.len * e, 0.1 * (1 - wv.recedeP));
      }
    };

    // -- update --------------------------------------------------------------
    const breakWave = (wv: Wave, now: number) => {
      // break point is wherever this arc actually ends — the target dot for
      // a real deposit, but the far end of the up-strand swash for a replay
      // (which now starts at the dot rather than ending there).
      const lastI = wv.pts.length - 2;
      const bx = wv.deposits ? xs[wv.target]! : wv.pts[lastI]!;
      const by = wv.deposits ? axisY : wv.pts[lastI + 1]!;
      spawnFlecks(bx, by, wv.deposits ? 24 : 8, now);
      if (wv.deposits) {
        depositMarker(wv.target, now);
        wv.deposited = true;
      }
    };

    const stepWave = (wv: Wave, now: number) => {
      if (wv.phase === "travel") {
        const p = (now - wv.t0) / wv.dur;
        wv.sTip = easeOutExpo(Math.min(1, p)) * wv.len;
        // forced-settle deadline — arrival never waits on an epsilon
        if (p >= 1 || now - wv.t0 > wv.dur + 150) {
          wv.sTip = wv.len;
          breakWave(wv, now);
          wv.phase = "recede";
          wv.rt0 = now;
        }
      } else {
        wv.recedeP = Math.min(1, (now - wv.rt0) / RECEDE_MS);
        if (wv.recedeP >= 1) wv.done = true;
      }
    };

    const springC = 2 * SPRING_ZETA * Math.sqrt(SPRING_K);
    let springsActive = false;

    const update = (now: number, dt: number) => {
      if (!mainWave && queue.length > 0) {
        mainWave = makeWave(queue.shift()!, true);
      }
      if (mainWave) {
        stepWave(mainWave, now);
        if (mainWave.done) mainWave = null;
      }
      if (replayWave) {
        stepWave(replayWave, now);
        if (replayWave.done) replayWave = null;
      }
      // marker pop springs — 0.6 → 1.0, overshoot ~1.06, 800ms hard deadline
      springsActive = false;
      for (let i = 0; i < n; i++) {
        const sp = springs[i]!;
        if (!sp.active) continue;
        sp.v += (-SPRING_K * (sp.s - 1) - springC * sp.v) * dt;
        sp.s += sp.v * dt;
        if (
          now - sp.t0 > SPRING_DEADLINE ||
          (Math.abs(sp.s - 1) < 0.002 && Math.abs(sp.v) < 0.02)
        ) {
          sp.s = 1;
          sp.v = 0;
          sp.active = false;
        } else {
          springsActive = true;
        }
        const btn = btnRefs.current[i];
        if (btn) btn.style.transform = `scale(${sp.s})`;
      }
      // flecks — pruned array, no residue
      for (let i = flecks.length - 1; i >= 0; i--) {
        const f = flecks[i]!;
        if (now < f.birth) continue;
        if (now - f.birth > FLECK_LIFE) {
          flecks.splice(i, 1);
          continue;
        }
        f.vy += GRAVITY * dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
      }
    };

    const needsFrame = () =>
      mainWave !== null ||
      replayWave !== null ||
      queue.length > 0 ||
      flecks.length > 0 ||
      springsActive;

    const loop = (now: number) => {
      raf = 0;
      if (!visible || !sized) {
        last = 0;
        return; // paused offscreen / zero-size — observers wake us
      }
      const dt = last === 0 ? 1 / 60 : Math.min(0.05, (now - last) / 1000);
      last = now;
      update(now, dt);
      render(now);
      if (needsFrame()) raf = requestAnimationFrame(loop);
      else last = 0; // genuinely asleep — last frame stays on the canvas
    };

    const wake = () => {
      if (!raf && !disposed && visible && sized) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    // -- public api (React handlers call through the ref) --------------------
    apiRef.current = {
      advance: () => {
        if (reduced) return;
        const launched =
          strandedCount + queue.length + (reserved(mainWave) ? 1 : 0);
        if (launched >= n) return;
        queue.push(launched);
        syncControls();
        wake();
      },
      retreat: () => {
        if (reduced) return;
        if (queue.length > 0) queue.pop();
        else if (reserved(mainWave)) {
          // cancel the incoming wave: it recedes without depositing
          mainWave.deposits = false;
          if (mainWave.phase === "travel") {
            mainWave.phase = "recede";
            mainWave.rt0 = performance.now();
            mainWave.recedeP = 0;
          }
        } else if (strandedCount > 0) undeposit();
        syncControls();
        wake();
        if (!raf && sized) render(performance.now()); // asleep → one redraw
      },
      hoverIn: (i: number) => {
        showCard(i);
        // replay the swash from THIS dot — no new residue ring. If a swash
        // from a previously-hovered dot is still traveling/receding, it must
        // be replaced now, not left to finish: otherwise moving the pointer
        // from dot A to dot B before A's ~700ms wave settles leaves A's arc
        // on screen while B is what's hovered, so the arrow appears to start
        // from the wrong origin. Same-target re-hover is left alone.
        if (
          !reduced &&
          i < strandedCount &&
          sized &&
          (!replayWave || replayWave.target !== i)
        ) {
          replayWave = makeWave(i, false);
          wake();
        }
      },
      hoverOut: () => hideCard(),
    };

    // -- reduced motion: pre-stranded, ringed, static ------------------------
    const strandStatic = () => {
      strandedCount = n;
      for (let i = 0; i < n; i++) {
        const outer = outerRefs.current[i];
        const btn = btnRefs.current[i];
        if (outer) outer.style.visibility = "visible";
        if (btn) btn.style.transform = "scale(1)";
        rings[i] = [];
        const washes = Math.min(MAX_RINGS, n - i);
        for (let k = 0; k < washes; k++) pushRing(i, i + k);
      }
      syncControls();
    };

    resize();

    if (reduced) {
      strandStatic();
      if (sized) render(0);
      const ro = new ResizeObserver(() => {
        if (resize()) render(0);
      });
      ro.observe(root);
      const mo = new MutationObserver(() => {
        derive();
        if (sized) render(0); // re-derive inks, re-stroke everything
      });
      mo.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
      return () => {
        disposed = true;
        ro.disconnect();
        mo.disconnect();
        apiRef.current = null;
      };
    }

    syncControls();
    if (sized) render(performance.now());

    // intro tide — first waves launch themselves
    for (let i = 0; i < Math.min(autoplay, n); i++) queue.push(i);
    syncControls();
    wake();

    const ro = new ResizeObserver(() => {
      if (resize()) {
        render(performance.now());
        wake();
      }
    });
    ro.observe(root);
    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) wake();
    });
    io.observe(root);
    const mo = new MutationObserver(() => {
      derive();
      if (sized && !raf) render(performance.now()); // asleep → single re-stroke
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
      disposed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      apiRef.current = null;
    };
  }, [events, autoplay]);

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={ariaLabel}
      className={`relative w-full overflow-hidden ${className}`}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        className="absolute left-0 top-0"
      />

      {/* now-edge label */}
      <span
        aria-hidden
        className="absolute right-2 top-[calc(62%-1.6rem)] font-mono text-[9px] tracking-widest text-muted"
      >
        NOW
      </span>

      {/* stranded event markers — offset transforms from the container origin */}
      {events.map((ev, i) => (
        <div
          key={`${ev.version}-${i}`}
          ref={(el) => {
            outerRefs.current[i] = el;
          }}
          className="absolute left-0 top-0 will-change-transform"
          style={{ visibility: "hidden" }}
        >
          <button
            ref={(el) => {
              btnRefs.current[i] = el;
            }}
            type="button"
            aria-label={`${ev.version} — ${ev.title}, ${ev.date}`}
            onPointerEnter={() => apiRef.current?.hoverIn(i)}
            onPointerLeave={() => apiRef.current?.hoverOut()}
            onFocus={() => apiRef.current?.hoverIn(i)}
            onBlur={() => apiRef.current?.hoverOut()}
            className="group block rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/60"
            style={{ transform: "scale(0.6)" }}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface text-muted transition duration-200 group-hover:-translate-y-0.5 group-hover:border-foreground group-hover:text-foreground group-focus-visible:border-foreground group-focus-visible:text-foreground">
              <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" aria-hidden>
                <circle
                  cx="5"
                  cy="5"
                  r="2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M5 0v1.6M5 8.4V10"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
              </svg>
            </span>
          </button>
          <div className="pointer-events-none absolute left-1/2 top-[30px] -translate-x-1/2 whitespace-nowrap text-center">
            <p className="font-mono text-[10px] leading-tight text-foreground">
              {ev.version}
            </p>
            <p className="font-mono text-[9px] leading-tight tracking-wider text-muted">
              {ev.date}
            </p>
          </div>
        </div>
      ))}

      {/* detail card — raised on hover / keyboard focus of a marker */}
      <div
        ref={cardRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 z-10 w-56 rounded-md border border-border bg-surface p-3 shadow-lg"
        style={{
          opacity: 0,
          transform: "translate3d(-9999px, -9999px, 0)",
          transition:
            "opacity 160ms ease-out, transform 260ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <p
          ref={cardMetaRef}
          className="font-mono text-[10px] tracking-wider text-muted"
        />
        <p
          ref={cardTitleRef}
          className="mt-1 text-xs font-medium text-foreground"
        />
        <p
          ref={cardBodyRef}
          className="mt-1 text-[11px] leading-relaxed text-muted"
        />
      </div>

      {/* scrub controls — advance / retreat the tide */}
      <div className="absolute bottom-3 right-3 z-10 flex items-center gap-2">
        <button
          ref={prevRef}
          type="button"
          aria-label="Previous release"
          onClick={() => apiRef.current?.retreat()}
          className="flex h-7 w-7 items-center justify-center rounded-sm border border-border bg-surface text-muted transition-colors duration-200 hover:border-foreground/40 hover:text-foreground disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/60"
        >
          <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
            <path
              d="M7.5 2.5 4 6l3.5 3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <span
          ref={counterRef}
          className="min-w-[2.6rem] text-center font-mono text-[10px] text-muted"
        >
          0 / {events.length}
        </span>
        <button
          ref={nextRef}
          type="button"
          aria-label="Next release"
          onClick={() => apiRef.current?.advance()}
          className="flex h-7 w-7 items-center justify-center rounded-sm border border-border bg-surface text-muted transition-colors duration-200 hover:border-foreground/40 hover:text-foreground disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/60"
        >
          <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
            <path
              d="M4.5 2.5 8 6l-3.5 3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
