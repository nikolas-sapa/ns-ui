"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";

// ---------------------------------------------------------------------------
// TonerFuseStreak — a loader / progress surface that "prints in" content the
// way a laser printer images a page, rather than spinning or fading: charge,
// a top-to-bottom expose/develop wipe, toner catching behind it, then a fuse
// flash locking it down. Two real xerographic failure artifacts ride along
// (source: standard charge/expose/develop/transfer/fuse cycle + print-shop
// service literature) and ARE the identity, not garnish:
//   - edge deletion: fringing-field effects thin toner right at small-feature
//     boundaries (hairline rules, serifs) for the first 400ms after the wipe
//     passes, then it fills to full density.
//   - toner starvation: a large solid fill area locally depletes the toner
//     cloud faster than it replenishes, leaving a persistent lighter streak
//     band toward the trailing edge of the fill.
//
// Shape source: `children`, if passed, is mounted off-screen (visibility
// hidden, never displayed) purely to donate a silhouette — text lines become
// thin bars via Range.getClientRects() (exact per-line boxes, no manual
// wrap math), leaf elements with a visible background/border/media tag
// become filled blocks. No children -> a built-in placeholder (heading +
// three text lines + one wide media block) that alone is enough to trigger
// both artifacts, so this ships as `core` without ever requiring a caller
// snapshot. The traced silhouette is rasterized ONCE per layout into a
// luminance mask on an offscreen canvas, then downsampled to one toner cell
// per ~3 mask px (grid: ~140 cells across the container's smaller
// dimension) — everything the visible canvas draws is that per-cell grid,
// never the real glyphs, so caller content never actually appears; only its
// shape does.
//
// The wipe cadence (900ms) is deliberately decoupled from and far slower
// than the real xerographic engine (>20ppm, well under a second per page) —
// this is the ONE followable event per round-9 legibility rule, and 900ms
// top-to-bottom is slow enough that a viewer's eye can track the wipe
// position at any instant.
//
// Colour is --border (unresolved shape whisper) and --foreground (toned
// ink and the luminance-only wipe/fuse highlights) only, read via
// getComputedStyle(document.documentElement) at mount and re-read on a
// MutationObserver watching documentElement's class — no paint before that
// first read. --ns-accent never appears; this is a passive loading state
// with no interaction.
// ---------------------------------------------------------------------------

export interface TonerFuseStreakProps {
  /** Real content used only to derive the printed silhouette's shape — never
   *  displayed. Omit to use the built-in heading/text/media placeholder. */
  children?: ReactNode;
  /** extra classes merged onto the rendered root element */
  className?: string;
  /** inline styles merged onto the root element */
  style?: CSSProperties;
}

type RGB = [number, number, number];

function parseColor(raw: string): RGB | null {
  const s = raw.trim();
  if (s.startsWith("#")) {
    let hex = s.slice(1);
    if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
    if (hex.length < 6) return null;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return Number.isNaN(r + g + b) ? null : [r, g, b];
  }
  const m = s.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

// deterministic per-cell/per-region hash — never Math.random, so the streak
// layout a caller sees is reproducible across a rebuild with the same shape
function hash01(n: number): number {
  const h = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return h - Math.floor(h);
}

const CELLS_ACROSS = 140; // ~120-160 cells span the container's smaller dim
const SS = 3; // mask supersample factor: one toner cell per ~3 mask px
const WIPE_MS = 900;
const HOLD_MS = 1500;
const RESET_MS = 200;
const CYCLE_MS = WIPE_MS + HOLD_MS + RESET_MS; // 2600
const RAMP_IN_MS = 150; // toner visibly "catching" behind the wipe line
const EDGE_MS = 400; // edge-deletion under-tone window
const EDGE_FILL_MS = 150; // then eases up to full density
const STREAK_FADE_MS = 400;
const FUSE_DELAY_MS = 220; // after the wipe completes
const FUSE_SWEEP_MS = 300;
const FUSE_DECAY_MS = 180;
const FUSE_BRIGHTEN = 0.08;
const WIPE_BAND_BOOST = 0.06;
const EDGE_RADIUS = 2; // cells — "gradient over <2 cells" test window
const FILL_THRESH = 0.6; // a cell counts as solid fill for region-finding
const INK_THRESH = 0.15; // a cell counts as "has ink" at all
const STARVE_WIDTH_FRAC = 0.18; // of the smaller grid dimension
// most-structured non-t0 frame: full density, both artifacts settled, well
// clear of the transient fuse flash (which decays by ~1600ms)
const FREEZE_MS = 1700;

interface StreakBand {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  reduction: number; // 0..1 opacity reduction at full fade-in
}

interface Mask {
  cols: number;
  rows: number;
  density: Float32Array; // 0..1 ink coverage per cell
  isEdge: Uint8Array; // 1 where a mask edge (gradient over <2 cells) sits
  bands: StreakBand[];
}

function deriveMask(density: Float32Array, cols: number, rows: number): Mask {
  const isEdge = new Uint8Array(cols * rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (density[i] <= INK_THRESH) continue;
      let edge = false;
      for (let dy = -EDGE_RADIUS; dy <= EDGE_RADIUS && !edge; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= rows) continue;
        for (let dx = -EDGE_RADIUS; dx <= EDGE_RADIUS; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= cols) continue;
          if (density[ny * cols + nx] <= INK_THRESH) {
            edge = true;
            break;
          }
        }
      }
      if (edge) isEdge[i] = 1;
    }
  }

  // flood-fill contiguous solid-fill regions (4-connectivity) to find
  // toner-starvation candidates
  const visited = new Uint8Array(cols * rows);
  const bands: StreakBand[] = [];
  const stackX = new Int32Array(cols * rows);
  const stackY = new Int32Array(cols * rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const start = y * cols + x;
      if (visited[start] || density[start] <= FILL_THRESH) continue;
      let sp = 0;
      stackX[sp] = x;
      stackY[sp] = y;
      sp++;
      visited[start] = 1;
      let minX = x, maxX = x, minY = y, maxY = y;
      const seed = start;
      while (sp > 0) {
        sp--;
        const cx = stackX[sp];
        const cy = stackY[sp];
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        const neighbors: [number, number][] = [
          [cx - 1, cy],
          [cx + 1, cy],
          [cx, cy - 1],
          [cx, cy + 1],
        ];
        for (const [nx, ny] of neighbors) {
          if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
          const ni = ny * cols + nx;
          if (visited[ni] || density[ni] <= FILL_THRESH) continue;
          visited[ni] = 1;
          stackX[sp] = nx;
          stackY[sp] = ny;
          sp++;
        }
      }
      const width = maxX - minX + 1;
      const smaller = Math.min(cols, rows);
      if (width >= STARVE_WIDTH_FRAC * smaller) {
        const h = maxY - minY + 1;
        const trailStart = minY + Math.round(0.7 * h);
        const trailEnd = maxY;
        const trailSpan = Math.max(1, trailEnd - trailStart + 1);
        const r1 = hash01(seed * 1.7 + 3.1);
        const r2 = hash01(seed * 2.3 + 9.7);
        const r3 = hash01(seed * 3.9 + 1.3);
        const r4 = hash01(seed * 5.1 + 6.6);
        const bandHeight = Math.max(1, Math.min(trailSpan, Math.round(1 + r1 * (trailSpan - 1))));
        const bandY0 = trailStart + Math.floor(r2 * Math.max(0, trailSpan - bandHeight));
        const bandW = Math.max(1, Math.round(width * (0.5 + r3 * 0.4)));
        const bandX0 = minX + Math.floor(r4 * Math.max(0, width - bandW));
        bands.push({
          x0: bandX0,
          x1: Math.min(maxX, bandX0 + bandW - 1),
          y0: bandY0,
          y1: Math.min(maxY, bandY0 + bandHeight - 1),
          reduction: 0.18 + hash01(seed * 7.7 + 2.2) * 0.12,
        });
      }
    }
  }

  return { cols, rows, density, isEdge, bands };
}

// Built-in placeholder: a heading bar, three text lines, one wide media
// block — the media block alone clears the 18%-of-smaller-dimension
// starvation threshold, so the component never depends on caller content.
function placeholderDensity(cols: number, rows: number): Float32Array {
  const density = new Float32Array(cols * rows);
  const fillRect = (x0f: number, y0f: number, x1f: number, y1f: number) => {
    const x0 = Math.max(0, Math.floor(x0f * cols));
    const x1 = Math.min(cols, Math.ceil(x1f * cols));
    const y0 = Math.max(0, Math.floor(y0f * rows));
    const y1 = Math.min(rows, Math.ceil(y1f * rows));
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) density[y * cols + x] = 1;
    }
  };
  fillRect(0.06, 0.08, 0.52, 0.15); // heading
  fillRect(0.06, 0.24, 0.9, 0.29); // text line 1
  fillRect(0.06, 0.34, 0.82, 0.39); // text line 2
  fillRect(0.06, 0.44, 0.66, 0.49); // text line 3 (short, paragraph end)
  fillRect(0.06, 0.58, 0.86, 0.92); // wide media block — starvation source
  return density;
}

// Rasterize `host`'s children into a cols x rows density grid. Text nodes
// become thin bars from their exact per-line boxes (Range.getClientRects —
// real wrap geometry, no layout simulation); leaf elements carrying a
// visible fill (background, border, or media tag) become filled blocks.
function domDensity(host: HTMLElement, hostRect: DOMRect, cols: number, rows: number): Float32Array | null {
  const maskW = cols * SS;
  const maskH = rows * SS;
  if (maskW <= 0 || maskH <= 0) return null;
  const off = document.createElement("canvas");
  off.width = maskW;
  off.height = maskH;
  const octx = off.getContext("2d");
  if (!octx) return null;
  const scale = maskW / Math.max(1, hostRect.width);
  octx.fillStyle = "#000";
  let painted = false;

  const paintRect = (r: DOMRect) => {
    const x = (r.left - hostRect.left) * scale;
    const y = (r.top - hostRect.top) * scale;
    const w = r.width * scale;
    const h = r.height * scale;
    if (w <= 0 || h <= 0) return;
    octx.fillRect(x, y, w, h);
    painted = true;
  };

  const walker = document.createTreeWalker(host, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node: Node | null = walker.currentNode;
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (text.trim().length > 0) {
        const range = document.createRange();
        range.selectNodeContents(node);
        const rects = range.getClientRects();
        for (let i = 0; i < rects.length; i++) {
          const r = rects[i];
          // a thin bar within the line box — cap-height-ish, trimmed short
          // of full width the way a set line of prose rarely fills to the
          // pixel — this is what donates the fine "serif" edge feature
          const y = r.top + r.height * 0.15;
          const h = r.height * 0.55;
          const w = r.width * 0.92;
          paintRect(new DOMRect(r.left, y, w, h));
        }
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      if (el.children.length === 0) {
        const tag = el.tagName;
        const isMedia = tag === "IMG" || tag === "SVG" || tag === "CANVAS" || tag === "VIDEO";
        let filled = isMedia;
        if (!filled) {
          const cs = getComputedStyle(el);
          const bg = parseColorAlpha(cs.backgroundColor);
          const borderW = parseFloat(cs.borderTopWidth) || 0;
          filled = bg > 0.05 || borderW > 0;
        }
        if (filled) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) paintRect(r);
        }
      }
    }
    node = walker.nextNode();
  }

  if (!painted) return null;

  const img = octx.getImageData(0, 0, maskW, maskH).data;
  const density = new Float32Array(cols * rows);
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      let sum = 0;
      for (let sy = 0; sy < SS; sy++) {
        const py = cy * SS + sy;
        for (let sx = 0; sx < SS; sx++) {
          const px = cx * SS + sx;
          sum += img[(py * maskW + px) * 4 + 3]; // alpha channel = coverage
        }
      }
      density[cy * cols + cx] = sum / (SS * SS * 255);
    }
  }
  return density;
}

function parseColorAlpha(raw: string): number {
  const m = raw.match(/rgba?\([^)]+,\s*([\d.]+)\)/);
  if (m) return Number(m[1]);
  if (/^rgb\(/.test(raw)) return 1;
  return raw === "transparent" ? 0 : 1;
}

export function TonerFuseStreak({ children, className = "", style }: TonerFuseStreakProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const rebuildRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const measure = measureRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let disposed = false;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = mq.matches;

    let fg: RGB | null = null;
    let border: RGB | null = null;
    let dark = true;
    const derive = () => {
      dark = document.documentElement.classList.contains("dark");
      const cs = getComputedStyle(document.documentElement);
      fg = parseColor(cs.getPropertyValue("--foreground")) ?? fg;
      border = parseColor(cs.getPropertyValue("--border")) ?? border;
    };
    derive();

    let w = 0;
    let h = 0;
    let dpr = 1;
    let cellSize = 8;
    let cols = 0;
    let rows = 0;
    let mask: Mask | null = null;
    let raf = 0;
    let visible = true;
    let startedAt = performance.now();

    const buildMask = () => {
      if (cols <= 0 || rows <= 0) {
        mask = null;
        return;
      }
      let density: Float32Array | null = null;
      if (measure && measure.childElementCount > 0) {
        const hostRect = root.getBoundingClientRect();
        density = domDensity(measure, hostRect, cols, rows);
      }
      if (!density) density = placeholderDensity(cols, rows);
      mask = deriveMask(density, cols, rows);
    };

    const draw = (nowMs: number) => {
      if (!fg || !border || !mask || w <= 0 || h <= 0) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const elapsed = reduced ? FREEZE_MS : nowMs - startedAt;
      const t = ((elapsed % CYCLE_MS) + CYCLE_MS) % CYCLE_MS;
      const wipeProgress = Math.min(1, Math.max(0, t / WIPE_MS));
      const wipeLineY = wipeProgress * h;
      const inReset = t >= WIPE_MS + HOLD_MS;
      const resetFrac = inReset ? (t - WIPE_MS - HOLD_MS) / RESET_MS : 0;

      const fullAlpha = dark ? 0.95 : 0.85;
      const { cols: c, rows: r, density, isEdge, bands } = mask;

      const buckets: (Path2D | null)[] = new Array(101).fill(null);
      const addCell = (alpha: number, cx: number, cy: number, size: number) => {
        if (alpha <= 0.003) return;
        const bi = Math.min(100, Math.max(1, Math.round(alpha * 100)));
        let path = buckets[bi];
        if (!path) {
          path = new Path2D();
          buckets[bi] = path;
        }
        path.rect(cx - size / 2, cy - size / 2, size, size);
      };

      const cellDot = cellSize * 0.84;

      for (let cy = 0; cy < r; cy++) {
        const rowTop = cy * cellSize;
        const rowY = rowTop + cellSize / 2;
        for (let cx = 0; cx < c; cx++) {
          const d = density[cy * c + cx];
          if (d <= 0.01) continue;
          const colX = cx * cellSize + cellSize / 2;
          const passed = rowTop < wipeLineY;
          const sincePass = passed ? wipeLineY - rowTop : -1;

          let alpha: number;
          if (!passed) {
            // un-toned: a whisper of the shape in --border, not invisible
            alpha = 0.04 * d;
            ctx.save();
            ctx.fillStyle = `rgba(${border[0]},${border[1]},${border[2]},${alpha})`;
            ctx.fillRect(colX - cellDot / 2, rowY - cellDot / 2, cellDot, cellDot);
            ctx.restore();
            continue;
          }

          // wipe passed this row's cadence-position ago: toner catches in,
          // then edge-deletion under-tones thin features, then a
          // toner-starvation streak (if any) fades its dip in and holds
          const rampIn = Math.min(1, sincePass / RAMP_IN_MS);
          let cellAlpha = d * fullAlpha * rampIn;

          const i = cy * c + cx;
          if (isEdge[i]) {
            const under = 0.15 + hash01(i * 4.13 + 0.7) * 0.1; // 15-25%
            let edgeFactor: number;
            if (sincePass < EDGE_MS) edgeFactor = 1 - under;
            else {
              const easeT = Math.min(1, (sincePass - EDGE_MS) / EDGE_FILL_MS);
              edgeFactor = 1 - under * (1 - easeT);
            }
            cellAlpha *= edgeFactor;
          }

          for (let b = 0; b < bands.length; b++) {
            const band = bands[b];
            if (cx >= band.x0 && cx <= band.x1 && cy >= band.y0 && cy <= band.y1) {
              const fadeT = Math.min(1, sincePass / STREAK_FADE_MS);
              cellAlpha *= 1 - band.reduction * fadeT;
              break;
            }
          }

          // reset phase: fade this cycle's toned frame back to the un-toned
          // baseline before the next cycle's wipe begins at t=0
          if (inReset) {
            const baseline = 0.04 * d;
            cellAlpha = cellAlpha + (baseline - cellAlpha) * resetFrac;
          }

          addCell(cellAlpha, colX, rowY, cellDot);
        }
      }

      ctx.fillStyle = `rgb(${fg[0]},${fg[1]},${fg[2]})`;
      for (let bi = 1; bi <= 100; bi++) {
        const path = buckets[bi];
        if (!path) continue;
        ctx.globalAlpha = bi / 100;
        ctx.fill(path);
      }
      ctx.globalAlpha = 1;

      // the ONE followable event: a soft band riding the wipe line, ~6%
      // luminance over its surroundings, never --ns-accent
      if (!inReset && t < WIPE_MS) {
        const bandH = Math.max(cellSize * 2.5, h * 0.03);
        const grad = ctx.createLinearGradient(0, wipeLineY - bandH, 0, wipeLineY + bandH);
        grad.addColorStop(0, `rgba(${fg[0]},${fg[1]},${fg[2]},0)`);
        grad.addColorStop(0.5, `rgba(${fg[0]},${fg[1]},${fg[2]},${WIPE_BAND_BOOST})`);
        grad.addColorStop(1, `rgba(${fg[0]},${fg[1]},${fg[2]},0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, wipeLineY - bandH, w, bandH * 2);
      }

      // fuse flash: one soft pass at the nip roller's implied contact line,
      // FUSE_DELAY_MS after the wipe completes, decaying over FUSE_DECAY_MS
      const fuseStart = WIPE_MS + FUSE_DELAY_MS;
      const sinceFuse = t - fuseStart;
      if (sinceFuse >= 0 && sinceFuse < FUSE_SWEEP_MS + FUSE_DECAY_MS) {
        const nipY = Math.min(1, sinceFuse / FUSE_SWEEP_MS) * h;
        const decayT = Math.max(0, sinceFuse - FUSE_SWEEP_MS) / FUSE_DECAY_MS;
        const intensity = FUSE_BRIGHTEN * (1 - Math.min(1, decayT));
        if (intensity > 0.002) {
          const bandH = Math.max(cellSize * 4, h * 0.05);
          const grad = ctx.createLinearGradient(0, nipY - bandH, 0, nipY + bandH);
          grad.addColorStop(0, `rgba(${fg[0]},${fg[1]},${fg[2]},0)`);
          grad.addColorStop(0.5, `rgba(${fg[0]},${fg[1]},${fg[2]},${intensity})`);
          grad.addColorStop(1, `rgba(${fg[0]},${fg[1]},${fg[2]},0)`);
          ctx.fillStyle = grad;
          ctx.fillRect(0, Math.max(0, nipY - bandH), w, bandH * 2);
        }
      }
    };

    const loop = (now: number) => {
      draw(now);
      if (!reduced && visible) raf = requestAnimationFrame(loop);
      else raf = 0;
    };
    const wake = () => {
      if (raf === 0 && !reduced && visible) raf = requestAnimationFrame(loop);
    };

    const resize = () => {
      const rect = root.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      if (measure) measure.style.width = `${w}px`;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      const smaller = Math.min(w, h);
      cellSize = smaller > 0 ? smaller / CELLS_ACROSS : 8;
      cols = cellSize > 0 ? Math.max(1, Math.round(w / cellSize)) : 0;
      rows = cellSize > 0 ? Math.max(1, Math.round(h / cellSize)) : 0;
      buildMask();
      draw(performance.now());
    };
    rebuildRef.current = () => {
      buildMask();
      draw(performance.now());
    };

    resize();
    if (!reduced) wake();

    const ro = new ResizeObserver(resize);
    ro.observe(root);

    const mo = new MutationObserver(() => {
      derive();
      draw(performance.now());
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const onReducedChange = () => {
      reduced = mq.matches;
      if (reduced) {
        cancelAnimationFrame(raf);
        raf = 0;
        draw(performance.now());
      } else {
        startedAt = performance.now() - ((performance.now() - startedAt) % CYCLE_MS);
        wake();
      }
    };
    mq.addEventListener("change", onReducedChange);

    const onVisibility = () => {
      visible = document.visibilityState === "visible";
      if (visible) wake();
      else {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) wake();
      else {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    });
    io.observe(root);

    document.fonts.ready.then(() => {
      if (!disposed) resize();
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      io.disconnect();
      mq.removeEventListener("change", onReducedChange);
      document.removeEventListener("visibilitychange", onVisibility);
      rebuildRef.current = null;
    };
  }, []);

  // children changed: rebuild the silhouette once layout settles
  useEffect(() => {
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => rebuildRef.current?.());
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [children]);

  return (
    <div
      ref={rootRef}
      role="img"
      aria-label="Loading"
      className={`relative w-full overflow-hidden bg-background ${className}`}
      style={{ minHeight: 160, ...style }}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="block h-full w-full" />
      {children ? (
        <div
          ref={measureRef}
          aria-hidden="true"
          style={{ position: "absolute", top: 0, left: 0, visibility: "hidden", pointerEvents: "none" }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

TonerFuseStreak.displayName = "TonerFuseStreak";

export default TonerFuseStreak;
