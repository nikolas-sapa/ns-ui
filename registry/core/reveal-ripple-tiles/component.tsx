"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// RippleUnfold — media behind a coarse tile grid. A height-field wave sim
// sweeps a ripple front out from the trigger point (scroll-into-view or first
// pointer entry): tiles pop open when local amplitude crosses a threshold,
// and revealed tiles refract their source rect along the wave gradient like
// wet glass. After full reveal the cursor keeps perturbing the water.
// Single DPR-aware Canvas 2D, direct-DOM rAF loop that sleeps when the field
// and every tile spring settle. All drawn ink derives from CSS tokens at
// mount and re-derives live on documentElement class changes.
// ---------------------------------------------------------------------------

type RGB = [number, number, number];

interface Palette {
  background: RGB;
  foreground: RGB;
  surface: RGB;
  border: RGB;
  muted: RGB;
  accent: RGB;
}

const FALLBACK_DARK: Palette = {
  background: [10, 10, 10],
  foreground: [237, 237, 237],
  surface: [23, 23, 23],
  border: [46, 46, 46],
  muted: [143, 143, 143],
  accent: [0, 107, 255],
};

const FALLBACK_LIGHT: Palette = {
  background: [255, 255, 255],
  foreground: [23, 23, 23],
  surface: [250, 250, 250],
  border: [235, 235, 235],
  muted: [143, 143, 143],
  accent: [0, 107, 255],
};

const EPS = 0.004; // dual sleep epsilon for max|h| and max|v|
const SPRING_K = 90; // s^-2
const SPRING_C = 2 * 0.7 * Math.sqrt(SPRING_K); // zeta = 0.7
const SQUASH_MS = 320;
const DT_MAX = 0.033;

function css(c: RGB, a: number) {
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

// resolve a CSS custom property to rgb via an in-document probe element
function readToken(probe: HTMLElement, token: string, fallback: RGB): RGB {
  probe.style.color = "";
  probe.style.color = `var(${token})`;
  const raw = getComputedStyle(probe).color;
  let m = raw.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  if (m) return [+m[1]!, +m[2]!, +m[3]!];
  m = raw.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  if (m) {
    return [
      Math.round(+m[1]! * 255),
      Math.round(+m[2]! * 255),
      Math.round(+m[3]! * 255),
    ];
  }
  return fallback;
}

// cubic-bezier(0.22, 1, 0.36, 1) solved via Newton–Raphson
function makeBezier(p1x: number, p1y: number, p2x: number, p2y: number) {
  const cx = 3 * p1x;
  const bx = 3 * (p2x - p1x) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * p1y;
  const by = 3 * (p2y - p1y) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) {
      const s = slopeX(t);
      if (Math.abs(s) < 1e-6) break;
      t -= (sampleX(t) - x) / s;
    }
    return sampleY(Math.min(1, Math.max(0, t)));
  };
}
const glideEase = makeBezier(0.22, 1, 0.36, 1);

export function RippleUnfold({
  src,
  tileSize = 32,
  threshold = 0.12,
  refraction = 6,
  impulse = 0.35,
  className = "aspect-[16/10]",
  "aria-label": ariaLabel = "Media revealed by a ripple wave",
}: {
  /** image URL; omitted → a token-derived generative artwork is drawn */
  src?: string;
  /** target tile edge in px; cols/rows derive from container size */
  tileSize?: number;
  /** |h| a tile must see before it pops open */
  threshold?: number;
  /** max source-rect refraction offset in px per unit wave gradient */
  refraction?: number;
  /** wave height injected per cursor move after full reveal */
  impulse?: number;
  className?: string;
  "aria-label"?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const off = document.createElement("canvas");
    const octx = off.getContext("2d");
    if (!octx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // hot-path state — locals only, the rAF loop is the sole writer
    let w = 0;
    let h = 0;
    let dpr = 1;
    let cols = 0;
    let rows = 0;
    let tw = 0;
    let th = 0;
    let total = 0;
    let hf = new Float32Array(0); // wave height
    let vf = new Float32Array(0); // wave velocity
    let stateArr = new Uint8Array(0); // 0 closed, 1 open/scheduled
    let scaleArr = new Float32Array(0); // tile spring scale
    let svelArr = new Float32Array(0); // tile spring velocity
    let openAtArr = new Float64Array(0); // timestamp the tile starts opening
    let openedCount = 0;
    let triggered = false;
    let trigCol = 0;
    let trigRow = 0;
    let maxH = 0;
    let maxV = 0;
    let pendingPointer = -1; // cell index — throttles impulses to one/frame
    let raf = 0;
    let last = 0;
    let visible = true;
    let disposed = false;
    let img: HTMLImageElement | null = null;
    let imgReady = false;

    // theme ink — derived from CSS tokens, re-derived on theme class change
    let pal: Palette = FALLBACK_DARK;
    let borderStroke = "";
    let fgFaint = "";
    let accentPrefix = "";

    const deriveColors = () => {
      const dark = document.documentElement.classList.contains("dark");
      const fb = dark ? FALLBACK_DARK : FALLBACK_LIGHT;
      const probe = document.createElement("span");
      probe.style.display = "none";
      root.appendChild(probe);
      pal = {
        background: readToken(probe, "--background", fb.background),
        foreground: readToken(probe, "--foreground", fb.foreground),
        surface: readToken(probe, "--surface", fb.surface),
        border: readToken(probe, "--border", fb.border),
        muted: readToken(probe, "--ns-muted", fb.muted),
        accent: readToken(probe, "--ns-accent", fb.accent),
      };
      probe.remove();
      borderStroke = css(pal.border, 1);
      fgFaint = css(pal.foreground, 0.05);
      accentPrefix = `rgba(${pal.accent[0]},${pal.accent[1]},${pal.accent[2]},`;
    };

    // token-derived generative artwork used when no src is provided —
    // monochrome orbital study so the demo needs no network fetch
    const paintArtwork = () => {
      const W = off.width;
      const H = off.height;
      if (W < 2 || H < 2) return;
      const o = octx;
      const m = Math.min(W, H);
      o.setTransform(1, 0, 0, 1, 0, 0);
      o.fillStyle = css(pal.surface, 1);
      o.fillRect(0, 0, W, H);

      // diagonal hatch field, lower-left
      o.strokeStyle = css(pal.foreground, 0.05);
      o.lineWidth = Math.max(1, m / 640);
      o.beginPath();
      const hatch = m * 0.022;
      for (let x = -H; x < W * 0.6; x += hatch) {
        o.moveTo(x, H);
        o.lineTo(x + H * 0.9, H * 0.1);
      }
      o.stroke();

      // concentric orbit rings
      const ocx = W * 0.63;
      const ocy = H * 0.4;
      for (let i = 0; i < 7; i++) {
        o.strokeStyle = css(pal.muted, 0.55 - i * 0.065);
        o.lineWidth = Math.max(1, m / 520);
        o.beginPath();
        o.arc(ocx, ocy, m * (0.07 + 0.075 * i), 0, Math.PI * 2);
        o.stroke();
      }
      // core disc + satellite on the third ring
      o.fillStyle = css(pal.foreground, 0.92);
      o.beginPath();
      o.arc(ocx, ocy, m * 0.048, 0, Math.PI * 2);
      o.fill();
      const orbitR = m * (0.07 + 0.075 * 3);
      o.beginPath();
      o.arc(
        ocx + Math.cos(-0.6) * orbitR,
        ocy + Math.sin(-0.6) * orbitR,
        m * 0.016,
        0,
        Math.PI * 2
      );
      o.fill();

      // instrumentation baseline + ticks
      const by = H * 0.82;
      o.strokeStyle = css(pal.muted, 0.7);
      o.lineWidth = Math.max(1, m / 640);
      o.beginPath();
      o.moveTo(W * 0.08, by);
      o.lineTo(W * 0.92, by);
      o.stroke();
      o.strokeStyle = css(pal.foreground, 0.6);
      o.beginPath();
      for (let i = 0; i <= 12; i++) {
        const tx = W * 0.08 + (W * 0.84 * i) / 12;
        o.moveTo(tx, by - m * 0.012);
        o.lineTo(tx, by + m * 0.012);
      }
      o.stroke();

      // inset frame
      o.strokeStyle = css(pal.muted, 0.3);
      o.lineWidth = Math.max(1, m / 640);
      o.strokeRect(m * 0.035, m * 0.035, W - m * 0.07, H - m * 0.07);
    };

    const paintOffscreen = () => {
      if (off.width < 2 || off.height < 2) return;
      if (imgReady && img && img.naturalWidth > 0 && img.naturalHeight > 0) {
        const sc = Math.max(
          off.width / img.naturalWidth,
          off.height / img.naturalHeight
        );
        const dw = img.naturalWidth * sc;
        const dh = img.naturalHeight * sc;
        octx.setTransform(1, 0, 0, 1, 0, 0);
        octx.fillStyle = css(pal.surface, 1);
        octx.fillRect(0, 0, off.width, off.height);
        octx.drawImage(img, (off.width - dw) / 2, (off.height - dh) / 2, dw, dh);
        return;
      }
      paintArtwork();
    };

    const revealAll = () => {
      for (let idx = 0; idx < total; idx++) {
        stateArr[idx] = 1;
        scaleArr[idx] = 1;
        svelArr[idx] = 0;
        openAtArr[idx] = -1e6; // squash long finished
      }
      openedCount = total;
    };

    const rebuildGrid = () => {
      cols = Math.max(2, Math.min(96, Math.round(w / Math.max(8, tileSize))));
      rows = Math.max(2, Math.min(96, Math.round(h / Math.max(8, tileSize))));
      tw = w / cols;
      th = h / rows;
      total = cols * rows;
      hf = new Float32Array(total);
      vf = new Float32Array(total);
      stateArr = new Uint8Array(total);
      scaleArr = new Float32Array(total);
      svelArr = new Float32Array(total);
      openAtArr = new Float64Array(total);
      openedCount = 0;
      maxH = 0;
      maxV = 0;
      pendingPointer = -1;
      // resizing mid-reveal restarts nothing: an already-triggered surface
      // settles straight to fully revealed
      if (triggered) revealAll();
    };

    const resize = () => {
      const rect = root.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) {
        // zero-size guard — no canvas work until we have real bounds
        w = 0;
        h = 0;
        total = 0;
        return;
      }
      w = rect.width;
      h = rect.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      off.width = canvas.width;
      off.height = canvas.height;
      paintOffscreen();
      rebuildGrid();
    };

    // classic discrete wave equation, Neumann edges, damping 0.985/step
    // (0.95/step once every tile has opened — nothing is visibly changing
    // by then, so the idle tail decays below EPS in under a second instead
    // of several)
    const step = () => {
      const c = cols;
      const damping = openedCount >= total ? 0.95 : 0.985;
      for (let j = 0; j < rows; j++) {
        const row = j * c;
        for (let i = 0; i < c; i++) {
          const idx = row + i;
          const hc = hf[idx]!;
          const l = i > 0 ? hf[idx - 1]! : hc;
          const r = i < c - 1 ? hf[idx + 1]! : hc;
          const u = j > 0 ? hf[idx - c]! : hc;
          const d = j < rows - 1 ? hf[idx + c]! : hc;
          vf[idx] = (vf[idx]! + ((l + r + u + d) * 0.25 - hc) * 0.5) * damping;
        }
      }
      maxH = 0;
      maxV = 0;
      for (let idx = 0; idx < total; idx++) {
        const nh = hf[idx]! + vf[idx]!;
        hf[idx] = nh;
        const ah = nh < 0 ? -nh : nh;
        const av = vf[idx]! < 0 ? -vf[idx]! : vf[idx]!;
        if (ah > maxH) maxH = ah;
        if (av > maxV) maxV = av;
      }
    };

    const openTile = (idx: number, at: number) => {
      stateArr[idx] = 1;
      scaleArr[idx] = 0.6;
      svelArr[idx] = 0;
      openAtArr[idx] = at;
      openedCount++;
    };

    // safeguard: a coarse wave can die below threshold before reaching the
    // far corners — schedule the stragglers outward from the trigger cell
    const flush = (now: number) => {
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const idx = j * cols + i;
          if (stateArr[idx] === 0) {
            openTile(idx, now + Math.hypot(i - trigCol, j - trigRow) * 16);
          }
        }
      }
    };

    // draw + tile springs; returns whether anything still animates
    const render = (now: number, dt: number): boolean => {
      let animating = false;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1;
      const offW = off.width;
      const offH = off.height;
      const swD = tw * dpr;
      const shD = th * dpr;
      const maxSx = Math.max(0, offW - swD);
      const maxSy = Math.max(0, offH - shD);

      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const idx = j * cols + i;
          const x = i * tw;
          const y = j * th;
          const opened = stateArr[idx] === 1 && now >= openAtArr[idx]!;

          if (!opened) {
            if (stateArr[idx] === 1) animating = true; // scheduled, waiting
            // closed tile: faint fg lift + border hairline + accent shimmer
            ctx.fillStyle = fgFaint;
            ctx.fillRect(x + 0.5, y + 0.5, tw - 1, th - 1);
            const amp = Math.abs(hf[idx] ?? 0);
            if (amp > 0.012) {
              ctx.fillStyle =
                accentPrefix + Math.min(0.4, amp * 0.85).toFixed(3) + ")";
              ctx.fillRect(x + 0.5, y + 0.5, tw - 1, th - 1);
            }
            ctx.strokeStyle = borderStroke;
            ctx.strokeRect(x + 0.5, y + 0.5, tw - 1, th - 1);
            continue;
          }

          // open spring: k = 90 s^-2, zeta = 0.7, scale 0.6 → 1
          let s = scaleArr[idx]!;
          let sv = svelArr[idx]!;
          if (s !== 1 || sv !== 0) {
            sv += (SPRING_K * (1 - s) - SPRING_C * sv) * dt;
            s += sv * dt;
            if (Math.abs(1 - s) < 0.002 && Math.abs(sv) < 0.02) {
              s = 1;
              sv = 0;
            } else {
              animating = true;
            }
            scaleArr[idx] = s;
            svelArr[idx] = sv;
          }
          // vertical squash 35% → 0 over 320ms, glide ease
          const tq = (now - openAtArr[idx]!) / SQUASH_MS;
          let squash = 1;
          if (tq < 1) {
            squash = 0.65 + 0.35 * glideEase(Math.max(0, tq));
            animating = true;
          }

          // wet-glass refraction: source rect offset by the wave gradient
          const hc = hf[idx]!;
          const l = i > 0 ? hf[idx - 1]! : hc;
          const r = i < cols - 1 ? hf[idx + 1]! : hc;
          const u = j > 0 ? hf[idx - cols]! : hc;
          const d = j < rows - 1 ? hf[idx + cols]! : hc;
          const sx = Math.min(
            Math.max(x * dpr + (r - l) * 0.5 * refraction * dpr, 0),
            maxSx
          );
          const sy = Math.min(
            Math.max(y * dpr + (d - u) * 0.5 * refraction * dpr, 0),
            maxSy
          );

          if (s === 1 && squash === 1) {
            ctx.drawImage(off, sx, sy, swD, shD, x, y, tw, th);
          } else {
            ctx.save();
            ctx.translate(x + tw / 2, y + th / 2);
            ctx.scale(s, s * squash);
            ctx.drawImage(off, sx, sy, swD, shD, -tw / 2, -th / 2, tw, th);
            ctx.restore();
          }
        }
      }
      return animating;
    };

    const loop = (now: number) => {
      raf = 0;
      if (disposed || w === 0 || total === 0) return;
      const dt = Math.min(Math.max((now - last) / 1000, 0), DT_MAX);
      last = now;
      let animating = false;

      if (triggered) {
        if (pendingPointer >= 0 && pendingPointer < total) {
          hf[pendingPointer] = Math.min(1.5, hf[pendingPointer]! + impulse);
          pendingPointer = -1;
        }
        step();
        step();
        if (maxH > EPS || maxV > EPS) {
          animating = true;
        } else if (maxH > 0 || maxV > 0) {
          // settle hard so refraction offsets are exactly zero at rest
          hf.fill(0);
          vf.fill(0);
          maxH = 0;
          maxV = 0;
        }
        if (openedCount < total) {
          for (let idx = 0; idx < total; idx++) {
            if (stateArr[idx] === 0 && Math.abs(hf[idx]!) > threshold) {
              openTile(idx, now);
            }
          }
          if (openedCount < total && maxH < threshold * 0.5) flush(now);
          animating = true;
        }
      }

      if (render(now, dt)) animating = true;
      if (animating && visible) raf = requestAnimationFrame(loop);
    };

    const wake = () => {
      if (raf === 0 && visible && !disposed && w > 0) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };

    const drawOnce = () => {
      if (w > 0 && total > 0) render(performance.now(), 0);
    };

    const repaint = () => {
      if (reduced) drawOnce();
      else wake();
    };

    const trigger = (ci: number, ri: number) => {
      if (triggered || disposed) return;
      triggered = true;
      if (total === 0) return; // grid rebuild reveals on next real size
      if (reduced) {
        // reduced motion: single instant paint, zero wave distortion
        revealAll();
        drawOnce();
        return;
      }
      trigCol = Math.min(Math.max(ci, 0), cols - 1);
      trigRow = Math.min(Math.max(ri, 0), rows - 1);
      hf[trigRow * cols + trigCol] = 1;
      maxH = 1;
      wake();
    };

    const cellAt = (e: PointerEvent): [number, number] | null => {
      if (total === 0) return null;
      const rect = root.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return null;
      const ci = Math.min(
        Math.max(Math.floor(((e.clientX - rect.left) / rect.width) * cols), 0),
        cols - 1
      );
      const ri = Math.min(
        Math.max(Math.floor(((e.clientY - rect.top) / rect.height) * rows), 0),
        rows - 1
      );
      return [ci, ri];
    };

    const onPointer = (e: PointerEvent) => {
      if (!triggered) {
        const c = cellAt(e);
        trigger(c ? c[0] : cols >> 1, c ? c[1] : rows >> 1);
        return;
      }
      // cursor keeps perturbing the water only after full reveal;
      // pendingPointer throttles injection to one impulse per frame
      if (reduced || openedCount < total || total === 0) return;
      const c = cellAt(e);
      if (!c) return;
      pendingPointer = c[1] * cols + c[0];
      wake();
    };

    deriveColors();
    resize();
    repaint();

    // scroll trigger at 0.35 visibility + offscreen pause
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          visible = e.isIntersecting;
          if (!triggered && e.intersectionRatio >= 0.35) {
            trigger(cols >> 1, rows >> 1);
          }
        }
        if (visible) {
          if (!reduced) wake();
        } else if (raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      },
      { threshold: [0, 0.35] }
    );
    io.observe(root);

    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      if (!e) return;
      if (
        Math.abs(e.contentRect.width - w) < 1 &&
        Math.abs(e.contentRect.height - h) < 1
      ) {
        return;
      }
      resize();
      repaint();
    });
    ro.observe(root);

    // live theme re-derive: watch documentElement class changes
    const mo = new MutationObserver(() => {
      deriveColors();
      if (!imgReady) paintOffscreen(); // artwork ink is token-derived
      repaint();
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    root.addEventListener("pointerenter", onPointer);
    root.addEventListener("pointermove", onPointer);
    root.addEventListener("pointerdown", onPointer);

    if (src) {
      img = new Image();
      img.decoding = "async";
      img.onload = () => {
        if (disposed) return;
        imgReady = true;
        paintOffscreen();
        repaint();
      };
      img.onerror = () => {
        // keep the generative artwork — never a blank surface
        imgReady = false;
      };
      img.src = src;
    }

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      io.disconnect();
      ro.disconnect();
      mo.disconnect();
      root.removeEventListener("pointerenter", onPointer);
      root.removeEventListener("pointermove", onPointer);
      root.removeEventListener("pointerdown", onPointer);
      if (img) {
        img.onload = null;
        img.onerror = null;
      }
    };
  }, [src, tileSize, threshold, refraction, impulse]);

  return (
    <div
      ref={rootRef}
      role="img"
      aria-label={ariaLabel}
      className={`relative w-full select-none overflow-hidden ${className}`}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        className="absolute inset-0 h-full w-full"
      />
    </div>
  );
}
