"use client";

import { useEffect, useRef, type ReactNode } from "react";

type Pt = { x: number; y: number };
type Fissure = {
  /** origin x relative to the handle (seam offset at spawn) */
  ox: number;
  /** origin y in pane coordinates */
  oy: number;
  /** polyline relative to the origin */
  pts: Pt[];
  len: number;
  alpha: number;
  born: number;
  /** timestamp retraction started; 0 while still held open */
  retract: number;
};

const HANDLE_W = 40;
const GROW_MS = 90;
const RETRACT_MS = 300;
const GLINT_MS = 450;
const GLINT_LEN = 56;
const SPRING_K = 170; // s^-2
const SPRING_C = 2 * 0.85 * Math.sqrt(SPRING_K); // zeta 0.85 — taut, no wobble

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const easeOut = (t: number) => 1 - (1 - t) ** 3;

function parseColor(raw: string): { r: number; g: number; b: number } | null {
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

/**
 * Nearest and second-nearest seeds to (x, y). Their perpendicular bisector is
 * the half-plane boundary between the two Voronoi cells — the exact wall the
 * confirm-slide-shatter clipper would produce — so points solved on it lie on real
 * cell edges without ever chaining polygons.
 */
function nearestPair(seeds: Pt[], x: number, y: number): { a: Pt; b: Pt; ia: number } {
  let ia = 0;
  let ib = 1;
  let da = Infinity;
  let db = Infinity;
  for (let i = 0; i < seeds.length; i++) {
    const s = seeds[i];
    const d = (s.x - x) * (s.x - x) + (s.y - y) * (s.y - y);
    if (d < da) {
      db = da;
      ib = ia;
      da = d;
      ia = i;
    } else if (d < db) {
      db = d;
      ib = i;
    }
  }
  return { a: seeds[ia], b: seeds[ib], ia };
}

// Before/after comparison slider whose divider is a living Voronoi crack seam.
// The seam polyline rides the cell walls nearest the handle, re-jags only when
// the handle crosses a cell, splinters micro-fissures on fast drags, heals
// them on slow ones, and fires a 1px specular glint down the fracture on
// release. Clip-path + canvas are written direct-DOM in one rAF loop that
// sleeps at rest.
export function CrackCompare({
  before = <div className="h-full w-full bg-surface" />,
  after = <div className="h-full w-full bg-background" />,
  initial = 0.5,
  seedCount = 140,
  jag = 18,
  spawnVelocity = 600,
  label = "Comparison position",
  onChange,
  className = "",
}: {
  /** left layer — revealed as the seam moves right */
  before?: ReactNode;
  /** right layer — clipped along the crack seam */
  after?: ReactNode;
  /** initial split position 0..1 */
  initial?: number;
  /** Voronoi seed count feeding the seam's cell walls */
  seedCount?: number;
  /** max horizontal jag of the seam in px */
  jag?: number;
  /** |vx| in px/s above which micro-fissures branch off the seam */
  spawnVelocity?: number;
  /** aria label for the hidden native range input */
  label?: string;
  /** fires on release and keyboard change with the split 0..1 */
  onChange?: (value: number) => void;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const afterRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const gripRef = useRef<HTMLDivElement>(null);
  const rangeRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const root = rootRef.current;
    const afterEl = afterRef.current;
    const canvas = canvasRef.current;
    const divider = dividerRef.current;
    const handle = handleRef.current;
    const grip = gripRef.current;
    const range = rangeRef.current;
    if (!root || !afterEl || !canvas || !divider || !handle || !grip || !range) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let w = 0;
    let h = 0;
    let prevW = 0;
    let seeds: Pt[] = [];
    let ys: number[] = [];

    const S = {
      x: 0,
      v: 0,
      target: 0,
      dragging: false,
      raf: 0,
      last: 0,
      rectLeft: 0,
      cell: -1,
      offsets: [] as number[],
      goals: [] as number[],
      fissures: [] as Fissure[],
      lastSpawn: 0,
      pendingGlint: false,
      glintStart: -1,
      seamRGB: { r: 255, g: 255, b: 255 },
    };

    /** seam x-offsets (relative to the handle) solved on the local Voronoi walls */
    const seamGoalsFor = (x: number): number[] =>
      ys.map((y) => {
        if (seeds.length < 2) return 0;
        const { a, b } = nearestPair(seeds, x, y);
        const dx = b.x - a.x;
        if (Math.abs(dx) < 0.001) return 0;
        // solve px on the a|b bisector at this y: |p-a| = |p-b|
        const px =
          (b.x * b.x - a.x * a.x + (a.y - b.y) * (2 * y - a.y - b.y)) / (2 * dx);
        return clamp(px - x, -jag, jag);
      });

    const cellAt = (x: number) =>
      seeds.length < 2 ? 0 : nearestPair(seeds, x, h / 2).ia;

    const seamPts = (): Pt[] => ys.map((y, i) => ({ x: S.x + S.offsets[i], y }));

    const syncRange = () => {
      const pct = Math.round((S.x / Math.max(1, w)) * 100);
      if (document.activeElement === range && !S.dragging) return;
      if (range.value !== String(pct)) range.value = String(pct);
    };

    /** stroke a fissure polyline up to maxLen px of arc length */
    const strokePartial = (ox: number, oy: number, pts: Pt[], maxLen: number) => {
      ctx.moveTo(ox, oy);
      let prev: Pt = { x: 0, y: 0 };
      let remaining = maxLen;
      for (const p of pts) {
        const seg = Math.hypot(p.x - prev.x, p.y - prev.y);
        if (seg >= remaining) {
          const f = remaining / seg;
          ctx.lineTo(ox + prev.x + (p.x - prev.x) * f, oy + prev.y + (p.y - prev.y) * f);
          return;
        }
        ctx.lineTo(ox + p.x, oy + p.y);
        prev = p;
        remaining -= seg;
      }
    };

    const pointAt = (pts: Pt[], cum: number[], s: number): Pt => {
      for (let i = 1; i < pts.length; i++) {
        if (cum[i] >= s) {
          const f = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
          return {
            x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f,
            y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f,
          };
        }
      }
      return pts[pts.length - 1];
    };

    /** 1px specular dash traveling the settled seam over 450ms */
    const drawGlint = (now: number, pts: Pt[]) => {
      const p = (now - S.glintStart) / GLINT_MS;
      if (p >= 1) {
        S.glintStart = -1;
        return;
      }
      const cum: number[] = [0];
      let total = 0;
      for (let i = 1; i < pts.length; i++) {
        total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        cum.push(total);
      }
      const raw = easeOut(p) * (total + GLINT_LEN);
      const head = clamp(raw, 0, total);
      const tail = clamp(raw - GLINT_LEN, 0, total);
      if (head - tail < 1) return;
      ctx.beginPath();
      const t0 = pointAt(pts, cum, tail);
      ctx.moveTo(t0.x, t0.y);
      for (let i = 1; i < pts.length; i++) {
        if (cum[i] > tail && cum[i] < head) ctx.lineTo(pts[i].x, pts[i].y);
      }
      const t1 = pointAt(pts, cum, head);
      ctx.lineTo(t1.x, t1.y);
      const { r, g, b } = S.seamRGB;
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(${r},${g},${b},0.5)`;
      ctx.stroke();
    };

    const draw = (now: number, pts: Pt[]) => {
      ctx.clearRect(0, 0, w, h);
      if (pts.length < 2) return;
      // seam: hairline + offset ghost stroke for glass depth — token-derived, theme-aware
      const { r, g, b } = S.seamRGB;
      const passes = [
        { o: 0.75, lw: 0.5, c: `rgba(${r},${g},${b},0.10)` },
        { o: 0, lw: 1, c: `rgba(${r},${g},${b},0.32)` },
      ];
      for (const pass of passes) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x + pass.o, pts[0].y + pass.o);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x + pass.o, pts[i].y + pass.o);
        }
        ctx.lineWidth = pass.lw;
        ctx.strokeStyle = pass.c;
        ctx.stroke();
      }
      // micro-fissures: grow fast, retract over 300ms ease-out once slow
      for (const f of S.fissures) {
        const grow = easeOut(Math.min(1, (now - f.born) / GROW_MS));
        const heal = f.retract
          ? 1 - easeOut(Math.min(1, (now - f.retract) / RETRACT_MS))
          : 1;
        const drawn = f.len * grow * heal;
        if (drawn < 0.5) continue;
        ctx.beginPath();
        strokePartial(S.x + f.ox, f.oy, f.pts, drawn);
        ctx.lineWidth = 0.75;
        ctx.strokeStyle = `rgba(${r},${g},${b},${(f.alpha * heal).toFixed(3)})`;
        ctx.stroke();
      }
      if (S.glintStart >= 0) drawGlint(now, pts);
    };

    const applyStatic = () => {
      afterEl.style.clipPath = `inset(0 0 0 ${S.x.toFixed(1)}px)`;
      divider.style.transform = `translateX(${S.x.toFixed(1)}px)`;
      handle.style.transform = `translateX(${(S.x - HANDLE_W / 2).toFixed(2)}px)`;
      syncRange();
    };

    const applyFrame = (now: number) => {
      if (ys.length < 2) return;
      const pts = seamPts();
      let poly = "";
      for (const p of pts) poly += `${p.x.toFixed(1)}px ${p.y.toFixed(1)}px, `;
      afterEl.style.clipPath = `polygon(${poly}${(w + 40).toFixed(0)}px ${(h + 6).toFixed(0)}px, ${(w + 40).toFixed(0)}px -6px)`;
      handle.style.transform = `translateX(${(S.x - HANDLE_W / 2).toFixed(2)}px)`;
      draw(now, pts);
    };

    const spawnFissures = (now: number, speed: number) => {
      S.lastSpawn = now;
      const n = 2 + Math.floor(Math.random() * 3); // 2–4 branches
      const alpha = clamp(0.3 + (speed - spawnVelocity) / 1800, 0.3, 0.85);
      for (let i = 0; i < n && S.fissures.length < 28; i++) {
        const idx = 1 + Math.floor(Math.random() * Math.max(1, ys.length - 2));
        const oy = ys[idx] + (Math.random() - 0.5) * 10;
        const ox = S.offsets[idx] ?? 0;
        const dir = Math.random() < 0.5 ? -1 : 1;
        const len = 30 + Math.random() * 40;
        const a0 = Math.random() * 0.9 - 0.45 + (dir < 0 ? Math.PI : 0);
        const a1 = a0 + (Math.random() * 0.8 - 0.4);
        const l0 = len * (0.4 + Math.random() * 0.3);
        const p1 = { x: Math.cos(a0) * l0, y: Math.sin(a0) * l0 };
        const p2 = { x: p1.x + Math.cos(a1) * (len - l0), y: p1.y + Math.sin(a1) * (len - l0) };
        S.fissures.push({ ox, oy, pts: [p1, p2], len, alpha, born: now, retract: 0 });
      }
    };

    const loop = (now: number) => {
      const dt = Math.min((now - S.last) / 1000, 1 / 30);
      S.last = now;

      // taut spring toward the pointer / keyboard target
      S.v += (SPRING_K * (S.target - S.x) - SPRING_C * S.v) * dt;
      S.x = clamp(S.x + S.v * dt, 0, w);
      const speed = Math.abs(S.v);

      // seam re-jags only when the handle crosses into a new Voronoi cell
      const cell = cellAt(S.x);
      if (cell !== S.cell) {
        S.cell = cell;
        S.goals = seamGoalsFor(S.x);
      }
      const k = 1 - Math.exp(-16 * dt);
      let seamMoving = false;
      for (let i = 0; i < S.offsets.length; i++) {
        S.offsets[i] += (S.goals[i] - S.offsets[i]) * k;
        if (Math.abs(S.goals[i] - S.offsets[i]) > 0.25) seamMoving = true;
      }

      // fast drags splinter, slow drags heal
      if (S.dragging && speed > spawnVelocity && now - S.lastSpawn > 70) {
        spawnFissures(now, speed);
      }
      if (speed < spawnVelocity) {
        for (const f of S.fissures) if (!f.retract) f.retract = now;
      }
      S.fissures = S.fissures.filter(
        (f) => !(f.retract && now - f.retract >= RETRACT_MS)
      );

      const settled = !S.dragging && Math.abs(S.target - S.x) < 0.3 && speed < 4;
      if (settled) {
        S.x = clamp(S.target, 0, w);
        S.v = 0;
        if (S.pendingGlint) {
          S.pendingGlint = false;
          S.glintStart = now;
        }
      }

      applyFrame(now);
      syncRange();

      const alive =
        S.dragging ||
        !settled ||
        seamMoving ||
        S.fissures.length > 0 ||
        S.glintStart >= 0;
      S.raf = alive ? requestAnimationFrame(loop) : 0;
    };

    const wake = () => {
      if (!S.raf) {
        S.last = performance.now();
        S.raf = requestAnimationFrame(loop);
      }
    };

    const build = () => {
      const rect = root.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      if (w < 4 || h < 4) return;
      handle.style.left = "0px";
      handle.style.marginLeft = "0px";
      const frac = prevW > 0 ? S.x / prevW : initial;
      prevW = w;
      S.x = clamp(frac, 0, 1) * w;
      S.target = S.x;
      S.v = 0;
      S.fissures = [];
      S.glintStart = -1;
      S.pendingGlint = false;

      if (reduced) {
        canvas.style.display = "none";
        divider.style.display = "";
        applyStatic();
        return;
      }
      divider.style.display = "none";
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const cell = Math.sqrt((w * h) / seedCount);
      seeds = poissonPoints(w, h, seedCount, Math.max(6, cell * 0.72));
      const step = clamp(cell * 0.55, 14, 48);
      ys = [];
      for (let y = -6; y < h + 6; y += step) ys.push(y);
      ys.push(h + 6);

      S.cell = cellAt(S.x);
      S.goals = seamGoalsFor(S.x);
      S.offsets = S.goals.slice();
      S.last = performance.now();
      applyFrame(S.last);
      syncRange();
    };

    const onDown = (e: PointerEvent) => {
      handle.setPointerCapture(e.pointerId);
      S.dragging = true;
      S.rectLeft = root.getBoundingClientRect().left;
      S.target = clamp(e.clientX - S.rectLeft, 0, w);
      if (reduced) {
        S.x = S.target;
        applyStatic();
      } else {
        wake();
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!S.dragging) return;
      S.target = clamp(e.clientX - S.rectLeft, 0, w);
      if (reduced) {
        S.x = S.target;
        applyStatic();
      }
    };
    const onUp = () => {
      if (!S.dragging) return;
      S.dragging = false;
      onChangeRef.current?.(w > 0 ? S.target / w : 0);
      if (!reduced) {
        S.pendingGlint = true;
        wake();
      }
    };

    const onRange = () => {
      S.target = (Number(range.value) / 100) * w;
      if (reduced) {
        S.x = S.target;
        applyStatic();
      } else {
        wake();
      }
      onChangeRef.current?.(Number(range.value) / 100);
    };
    const onFocus = () => {
      if (range.matches(":focus-visible")) {
        grip.classList.add("outline", "outline-2", "outline-offset-2", "outline-accent");
      }
    };
    const onBlur = () => {
      grip.classList.remove("outline", "outline-2", "outline-offset-2", "outline-accent");
    };

    /** re-sample the seam color off the resolved --foreground token so the
     * crack reads on light or dark content alike, then repaint once even at rest */
    const deriveSeamColor = () => {
      const raw = getComputedStyle(document.documentElement).getPropertyValue("--foreground");
      S.seamRGB = parseColor(raw) ?? S.seamRGB;
      if (S.raf) return;
      const pts = seamPts();
      if (pts.length >= 2) draw(performance.now(), pts);
    };
    deriveSeamColor();
    const themeObserver = new MutationObserver(deriveSeamColor);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const ro = new ResizeObserver(build);
    ro.observe(root);
    handle.addEventListener("pointerdown", onDown);
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
    range.addEventListener("input", onRange);
    range.addEventListener("focus", onFocus);
    range.addEventListener("blur", onBlur);
    return () => {
      cancelAnimationFrame(S.raf);
      ro.disconnect();
      themeObserver.disconnect();
      handle.removeEventListener("pointerdown", onDown);
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      range.removeEventListener("input", onRange);
      range.removeEventListener("focus", onFocus);
      range.removeEventListener("blur", onBlur);
    };
  }, [initial, seedCount, jag, spawnVelocity]);

  return (
    <div
      ref={rootRef}
      className={`relative aspect-[16/10] w-full select-none overflow-hidden rounded-md border border-border bg-background ${className}`}
    >
      {/* before layer — full bleed */}
      <div className="absolute inset-0">{before}</div>

      {/* after layer — clipped along the crack seam */}
      <div
        ref={afterRef}
        className="absolute inset-0"
        style={{ clipPath: `inset(0 0 0 ${initial * 100}%)` }}
      >
        {after}
      </div>

      {/* hairline crack strokes + glint */}
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
      />

      {/* straight divider — reduced-motion fallback only */}
      <div
        ref={dividerRef}
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-px bg-border"
        style={{ display: "none" }}
      />

      {/* hidden native range for a11y — arrows move 2% per press */}
      <input
        ref={rangeRef}
        type="range"
        min={0}
        max={100}
        step={2}
        defaultValue={Math.round(initial * 100)}
        aria-label={label}
        className="peer sr-only"
      />

      {/* drag handle riding the seam */}
      <div
        ref={handleRef}
        aria-hidden
        className="absolute inset-y-0 flex cursor-ew-resize touch-none items-center justify-center will-change-transform"
        style={{ left: `${initial * 100}%`, width: HANDLE_W, marginLeft: -HANDLE_W / 2 }}
      >
        <div
          ref={gripRef}
          className="flex h-7 w-7 items-center justify-center rounded-sm border border-foreground/15 bg-foreground/10 text-muted shadow-[inset_0_1px_0_0_color-mix(in_srgb,var(--foreground)_18%,transparent),0_2px_8px_-2px_rgba(0,0,0,0.5)] backdrop-blur-md transition-colors duration-150 hover:border-foreground/30 hover:text-foreground"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="m9 18-6-6 6-6" />
            <path d="m15 6 6 6-6 6" />
          </svg>
        </div>
      </div>
    </div>
  );
}
