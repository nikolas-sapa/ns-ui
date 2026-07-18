"use client";

import { useEffect, useRef, useState } from "react";

type Pt = { x: number; y: number };
type Edge = { ax: number; ay: number; bx: number; by: number; t: number };
type Shard = {
  poly: Pt[];
  cx: number;
  cy: number;
  ox: number;
  oy: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
};

const INSET = 4;
const RADIUS = 12;
// canvas bleeds past the track so shards can tumble out of frame
const PAD_X = 160;
const PAD_TOP = 120;
const PAD_BOTTOM = 320;
const COMMIT_AT = 0.98;
const SHATTER_MS = 900;
const FADE_MS = 700;
const KEY_STEP = 0.08;

/** dart-throwing Poisson disc — relaxes min distance if the pane is crowded */
function poissonPoints(w: number, h: number, count: number, minDist: number): Pt[] {
  const pts: Pt[] = [];
  let d = minDist;
  let attempts = 0;
  while (pts.length < count && attempts < 6000) {
    attempts++;
    const c = { x: Math.random() * w, y: Math.random() * h };
    let ok = true;
    for (const q of pts) {
      const dx = q.x - c.x;
      const dy = q.y - c.y;
      if (dx * dx + dy * dy < d * d) {
        ok = false;
        break;
      }
    }
    if (ok) pts.push(c);
    if (attempts % 1500 === 0) d *= 0.85;
  }
  return pts;
}

/** keep the part of `poly` on the seed's side of the bisector (dot(p-m, n) <= 0) */
function clipHalfPlane(poly: Pt[], mx: number, my: number, nx: number, ny: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const da = (a.x - mx) * nx + (a.y - my) * ny;
    const db = (b.x - mx) * nx + (b.y - my) * ny;
    if (da <= 0) out.push(a);
    if (da <= 0 !== db <= 0) {
      const f = da / (da - db);
      out.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
    }
  }
  return out;
}

/** exact Voronoi cells via half-plane clipping — O(n²), computed once at mount */
function voronoiCells(seeds: Pt[], w: number, h: number): Pt[][] {
  return seeds
    .map((s) => {
      let poly: Pt[] = [
        { x: 0, y: 0 },
        { x: w, y: 0 },
        { x: w, y: h },
        { x: 0, y: h },
      ];
      for (const o of seeds) {
        if (o === s) continue;
        poly = clipHalfPlane(poly, (s.x + o.x) / 2, (s.y + o.y) / 2, o.x - s.x, o.y - s.y);
        if (poly.length === 0) break;
      }
      return poly;
    })
    .filter((poly) => poly.length >= 3);
}

/** dedupe shared cell walls into crack polylines, each with a reveal threshold */
function crackEdges(cells: Pt[][], w: number, h: number, ox: number, oy: number): Edge[] {
  const eps = 0.5;
  const maxD = Math.hypot(w - ox, Math.max(oy, h - oy));
  const seen = new Set<string>();
  const edges: Edge[] = [];
  for (const poly of cells) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      // the pane's own border is a frame, not a crack
      if (
        (a.x < eps && b.x < eps) ||
        (a.x > w - eps && b.x > w - eps) ||
        (a.y < eps && b.y < eps) ||
        (a.y > h - eps && b.y > h - eps)
      )
        continue;
      const ka = `${a.x.toFixed(1)},${a.y.toFixed(1)}`;
      const kb = `${b.x.toFixed(1)},${b.y.toFixed(1)}`;
      const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const da = Math.hypot(a.x - ox, a.y - oy);
      const db = Math.hypot(b.x - ox, b.y - oy);
      const near = da <= db ? a : b;
      const far = da <= db ? b : a;
      // map raw distance into [0.04, 0.86] so every crack finishes growing by p≈0.98
      const t = 0.04 + 0.82 * (Math.min(da, db) / maxD);
      edges.push({ ax: near.x, ay: near.y, bx: far.x, by: far.y, t });
    }
  }
  return edges;
}

function roundedRectPath(
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

// Frosted-glass confirm slider: drag distance IS crack density. Voronoi
// fractures spider from the thumb, heal on a spring if released early, and at
// full travel the pane explodes into tumbling shards revealing the confirmed
// state. Progress lives in refs; all drawing is direct-DOM/canvas in one rAF
// loop that sleeps when settled.
export function SlideToShatter({
  label = "SLIDE TO CONFIRM",
  confirmedLabel = "CONFIRMED",
  width = 320,
  height = 56,
  shardCount = 48,
  onConfirm,
  resetKey = 0,
  className = "",
}: {
  /** mono label etched on the glass */
  label?: string;
  /** label revealed once the pane shatters */
  confirmedLabel?: string;
  width?: number;
  height?: number;
  /** approximate Voronoi cell count — cracks while dragging, shards on commit */
  shardCount?: number;
  onConfirm?: () => void;
  /** bump to restore the pane and replay */
  resetKey?: number;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const glassRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [confirmed, setConfirmed] = useState(false);
  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;

  useEffect(() => {
    const root = rootRef.current;
    const glass = glassRef.current;
    const thumb = thumbRef.current;
    const canvas = canvasRef.current;
    if (!root || !glass || !thumb || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // reset pane state (also runs on resetKey bump)
    setConfirmed(false);
    glass.style.visibility = "";
    thumb.style.visibility = "";
    thumb.style.transform = "translateX(0px)";
    thumb.setAttribute("aria-valuenow", "0");
    root.style.transform = "";

    const thumbSize = height - INSET * 2;
    const maxTravel = width - INSET * 2 - thumbSize;
    const cw = width + PAD_X * 2;
    const ch = height + PAD_TOP + PAD_BOTTOM;

    // geometry: one Poisson + Voronoi pass, reused as cracks AND shards
    const originX = INSET + thumbSize / 2;
    const originY = height / 2;
    const seeds = reduced
      ? []
      : poissonPoints(
          width,
          height,
          shardCount,
          Math.max(8, Math.sqrt((width * height) / shardCount) * 0.72)
        );
    const cells = voronoiCells(seeds, width, height);
    const edges = crackEdges(cells, width, height, originX, originY);

    if (!reduced) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, PAD_X * dpr, PAD_TOP * dpr);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.clearRect(-PAD_X, -PAD_TOP, cw, ch);
    }

    const S = {
      p: 0,
      v: 0,
      dragging: false,
      mode: "idle" as "idle" | "drag" | "spring" | "shatter",
      raf: 0,
      last: 0,
      startX: 0,
      startP: 0,
      shatterStart: 0,
      shards: [] as Shard[],
    };

    const setThumb = (p: number) => {
      thumb.style.transform = `translateX(${p * maxTravel}px)`;
    };

    const drawCracks = (p: number) => {
      ctx.clearRect(-PAD_X, -PAD_TOP, cw, ch);
      if (p <= 0) return;
      ctx.save();
      roundedRectPath(ctx, 0.5, 0.5, width - 1, height - 1, RADIUS);
      ctx.clip();
      // two passes: hairline + offset ghost stroke for glass depth
      const passes = [
        { dx: 0.75, dy: 0.75, w: 0.5, c: "rgba(255,255,255,0.12)" },
        { dx: 0, dy: 0, w: 1, c: "rgba(255,255,255,0.35)" },
      ];
      for (const pass of passes) {
        ctx.beginPath();
        for (const e of edges) {
          if (p <= e.t) continue;
          // cracks grow segment-by-segment from the near end outward
          const f = Math.min(1, (p - e.t) / 0.12);
          ctx.moveTo(e.ax + pass.dx, e.ay + pass.dy);
          ctx.lineTo(e.ax + (e.bx - e.ax) * f + pass.dx, e.ay + (e.by - e.ay) * f + pass.dy);
        }
        ctx.lineWidth = pass.w;
        ctx.strokeStyle = pass.c;
        ctx.stroke();
      }
      ctx.restore();
    };

    const buildShards = (): Shard[] => {
      const tx = width - INSET - thumbSize / 2;
      const ty = height / 2;
      return cells.map((poly) => {
        let cx = 0;
        let cy = 0;
        for (const pt of poly) {
          cx += pt.x;
          cy += pt.y;
        }
        cx /= poly.length;
        cy /= poly.length;
        let dx = cx - tx;
        let dy = cy - ty;
        const d = Math.hypot(dx, dy);
        if (d < 1) {
          const a = Math.random() * Math.PI * 2;
          dx = Math.cos(a);
          dy = Math.sin(a);
        } else {
          dx /= d;
          dy /= d;
        }
        const speed = 120 + Math.random() * 300;
        return {
          poly: poly.map((pt) => ({ x: pt.x - cx, y: pt.y - cy })),
          cx,
          cy,
          ox: 0,
          oy: 0,
          vx: dx * speed,
          vy: dy * speed,
          rot: 0,
          vr: (Math.random() * 2 - 1) * 3,
        };
      });
    };

    const stepShards = (dt: number) => {
      for (const s of S.shards) {
        s.vy += 1800 * dt;
        s.ox += s.vx * dt;
        s.oy += s.vy * dt;
        s.rot += s.vr * dt;
      }
    };

    const drawShards = (elapsed: number) => {
      ctx.clearRect(-PAD_X, -PAD_TOP, cw, ch);
      const alpha = Math.max(0, 1 - elapsed / FADE_MS);
      if (alpha <= 0) return;
      for (const s of S.shards) {
        ctx.save();
        ctx.translate(s.cx + s.ox, s.cy + s.oy);
        ctx.rotate(s.rot);
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        for (let i = 0; i < s.poly.length; i++) {
          const pt = s.poly[i];
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.closePath();
        ctx.fillStyle = "rgba(255,255,255,0.10)";
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.stroke();
        ctx.restore();
      }
    };

    const wake = () => {
      if (!S.raf) {
        S.last = performance.now();
        S.raf = requestAnimationFrame(loop);
      }
    };

    const commit = () => {
      S.dragging = false;
      S.p = 1;
      setThumb(1);
      thumb.setAttribute("aria-valuenow", "100");
      // the pane is gone the instant it breaks
      glass.style.visibility = "hidden";
      thumb.style.visibility = "hidden";
      root.style.transform = "";
      setConfirmed(true);
      if (!reduced) {
        S.mode = "shatter";
        S.shatterStart = performance.now();
        S.shards = buildShards();
        wake();
      } else {
        S.mode = "idle";
      }
      onConfirmRef.current?.();
    };

    const loop = (now: number) => {
      const dt = Math.min((now - S.last) / 1000, 1 / 30);
      S.last = now;
      let alive = false;
      if (S.mode === "drag") {
        if (S.p >= COMMIT_AT) {
          commit();
          alive = true;
        } else {
          const p = S.p;
          setThumb(p);
          drawCracks(p);
          // structural shudder once the pane is badly cracked
          root.style.transform =
            p > 0.6
              ? `translate(${Math.random() - 0.5}px, ${Math.random() - 0.5}px)`
              : "";
          alive = true;
        }
      } else if (S.mode === "spring") {
        // stiffness 220 / damping 26 — slightly underdamped, tiny overshoot
        S.v += (-220 * S.p - 26 * S.v) * dt;
        S.p += S.v * dt;
        if (Math.abs(S.p) < 0.001 && Math.abs(S.v) < 0.01) {
          S.p = 0;
          S.v = 0;
          S.mode = "idle";
          setThumb(0);
          drawCracks(0);
          root.style.transform = "";
        } else {
          const p = Math.max(0, S.p);
          setThumb(p);
          drawCracks(p); // same t-mapping in reverse — the heal is free
          root.style.transform = "";
          alive = true;
        }
      } else if (S.mode === "shatter") {
        const elapsed = now - S.shatterStart;
        if (elapsed >= SHATTER_MS) {
          ctx.clearRect(-PAD_X, -PAD_TOP, cw, ch);
          S.mode = "idle";
        } else {
          stepShards(dt);
          drawShards(elapsed);
          alive = true;
        }
      }
      S.raf = alive ? requestAnimationFrame(loop) : 0;
    };

    const onDown = (e: PointerEvent) => {
      if (S.mode === "shatter" || glass.style.visibility === "hidden") return;
      thumb.setPointerCapture(e.pointerId);
      S.dragging = true;
      S.mode = "drag";
      S.v = 0;
      S.startX = e.clientX;
      S.startP = S.p;
      if (!reduced) wake();
    };

    const onMove = (e: PointerEvent) => {
      if (!S.dragging) return;
      S.p = Math.min(1, Math.max(0, S.startP + (e.clientX - S.startX) / maxTravel));
      if (reduced) {
        // no canvas at all — plain slide, instant swap at full travel
        setThumb(S.p);
        if (S.p >= COMMIT_AT) commit();
      }
    };

    const onUp = () => {
      if (!S.dragging) return;
      S.dragging = false;
      if (S.p >= COMMIT_AT) {
        if (S.mode !== "shatter") commit();
        return;
      }
      thumb.setAttribute("aria-valuenow", "0");
      if (reduced) {
        S.p = 0;
        S.mode = "idle";
        setThumb(0);
      } else {
        S.mode = "spring";
        wake();
      }
    };

    // Arrow keys nudge p by KEY_STEP; Home/End jump to the ends; Enter/Space
    // confirms outright — mirrors the pointer path without engaging the rAF
    // loop for a static value (loop only wakes once travel actually commits).
    const onKeyDown = (e: KeyboardEvent) => {
      if (S.mode === "shatter" || S.mode === "spring" || glass.style.visibility === "hidden") return;
      let next: number;
      switch (e.key) {
        case "ArrowRight":
        case "ArrowUp":
          next = S.p + KEY_STEP;
          break;
        case "ArrowLeft":
        case "ArrowDown":
          next = S.p - KEY_STEP;
          break;
        case "Home":
          next = 0;
          break;
        case "End":
        case "Enter":
        case " ":
          next = 1;
          break;
        default:
          return;
      }
      e.preventDefault();
      next = Math.min(1, Math.max(0, next));
      S.p = next;
      S.startP = next;
      thumb.setAttribute("aria-valuenow", String(Math.round(next * 100)));
      if (S.p >= COMMIT_AT) {
        commit();
      } else {
        S.mode = "idle";
        setThumb(S.p);
        if (!reduced) drawCracks(S.p);
      }
    };

    thumb.addEventListener("pointerdown", onDown);
    thumb.addEventListener("pointermove", onMove);
    thumb.addEventListener("pointerup", onUp);
    thumb.addEventListener("pointercancel", onUp);
    thumb.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(S.raf);
      thumb.removeEventListener("pointerdown", onDown);
      thumb.removeEventListener("pointermove", onMove);
      thumb.removeEventListener("pointerup", onUp);
      thumb.removeEventListener("pointercancel", onUp);
      thumb.removeEventListener("keydown", onKeyDown);
      root.style.transform = "";
    };
  }, [width, height, shardCount, resetKey]);

  const thumbSize = height - INSET * 2;

  return (
    <div
      ref={rootRef}
      className={`relative select-none ${className}`}
      style={{ width, height }}
    >
      {/* revealed state beneath the glass */}
      <div
        aria-hidden={!confirmed}
        className={`absolute inset-0 flex items-center justify-center gap-2 rounded-md border border-border bg-surface ${
          confirmed ? "opacity-100" : "opacity-0"
        }`}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className="text-foreground"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
        <span className="font-mono text-xs tracking-[0.2em] text-foreground">
          {confirmedLabel}
        </span>
      </div>

      {/* frosted pane — house glass recipe */}
      <div
        ref={glassRef}
        className={`absolute inset-0 overflow-hidden rounded-md border border-black/15 bg-white/60 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.7),0_8px_24px_-8px_rgba(0,0,0,0.28)] backdrop-blur-xl backdrop-saturate-150 dark:border-white/10 dark:bg-white/[0.06] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),0_8px_24px_-8px_rgba(0,0,0,0.5)] ${
          confirmed ? "invisible" : ""
        }`}
      >
        <span className="absolute inset-0 flex items-center justify-center pl-8 font-mono text-[11px] tracking-[0.25em] text-muted">
          {label}
        </span>
      </div>

      {/* crack + shard overlay, bleeds past the track so shards can fly */}
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          left: -PAD_X,
          top: -PAD_TOP,
          width: width + PAD_X * 2,
          height: height + PAD_TOP + PAD_BOTTOM,
        }}
      />

      {/* thumb */}
      <button
        ref={thumbRef}
        type="button"
        role="slider"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={0}
        className={`absolute flex cursor-grab touch-none items-center justify-center rounded-sm border border-black/15 bg-black/[0.04] text-muted transition-colors duration-150 hover:border-black/25 hover:bg-black/[0.08] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background shadow-[inset_0_1px_0_0_rgba(255,255,255,0.6),0_2px_8px_-2px_rgba(0,0,0,0.25)] will-change-transform active:cursor-grabbing dark:border-white/15 dark:bg-white/10 dark:hover:border-white/30 dark:hover:bg-white/15 dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.18),0_2px_8px_-2px_rgba(0,0,0,0.5)] ${
          confirmed ? "invisible" : ""
        }`}
        style={{ left: INSET, top: INSET, width: thumbSize, height: thumbSize }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="m6 17 5-5-5-5" />
          <path d="m13 17 5-5-5-5" />
        </svg>
      </button>
    </div>
  );
}
