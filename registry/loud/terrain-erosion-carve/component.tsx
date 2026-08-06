"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// deterministic 2-octave value noise — no deps, stable across frames
// ---------------------------------------------------------------------------
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
  return 0.65 * vnoise(x, y) + 0.35 * vnoise(x * 2.1 + 19.7, y * 2.1 + 7.3);
}

// ---------------------------------------------------------------------------
// ErosionTrail — the cursor is a river. Dragging across a live topographic
// map carves a channel into a 96x96 heightfield (base noise − carve delta);
// marching-squares isolines reflow per frame into canyon walls around the
// path, with a faint waterline while carving. Release and sediment heals the
// field back (exponential decay, tau ≈ 2.2s). Canvas 2D, refs only — the rAF
// loop is the sole writer and sleeps once the field has healed.
// ---------------------------------------------------------------------------
export function ErosionTrail({
  gridSize = 96,
  contourStep = 0.08,
  brushSigma = 28,
  carveRate = 0.9,
  healTau = 2.2,
  showReadout = true,
  className = "h-96",
  "aria-label": ariaLabel = "Topographic map — drag to carve a river channel",
}: {
  /** heightfield resolution per axis (nodes) */
  gridSize?: number;
  /** elevation gap between isolines; every 5th index line renders brighter */
  contourStep?: number;
  /** gaussian carve-brush radius (sigma) in screen px */
  brushSigma?: number;
  /** carve rate in elevation units per second at full depth */
  carveRate?: number;
  /** healing time constant in seconds (95% healed ≈ 3·tau) */
  healTau?: number;
  /** font-mono corner readout of cursor grid coords */
  showReadout?: boolean;
  /** extra classes merged onto the rendered root element */
  className?: string;
  /** accessible name for the terrain */
  "aria-label"?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readoutRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const N = Math.max(8, Math.floor(gridSize));
    const NN = N * N;
    const base = new Float32Array(NN);
    const delta = new Float32Array(NN); // positive carve depth per node
    const field = new Float32Array(NN); // base − delta, rebuilt per frame
    const freq = 3.4 / (N - 1); // ~3.4 noise features across the sheet
    for (let gy = 0; gy < N; gy++) {
      for (let gx = 0; gx < N; gx++) {
        base[gy * N + gx] = noise2(gx * freq + 11.8, gy * freq + 5.2);
      }
    }

    // ambient drift — a static per-node phase map; sampling sin(phase − t·speed)
    // reads as slow traveling ripples through the contours, alive at rest
    const driftFreq = 0.9 / (N - 1);
    const driftPhase = new Float32Array(NN);
    for (let gy = 0; gy < N; gy++) {
      for (let gx = 0; gx < N; gx++) {
        driftPhase[gy * N + gx] =
          noise2(gx * driftFreq + 41.3, gy * driftFreq + 27.6) * Math.PI * 2;
      }
    }
    const ambientAmp = contourStep * 0.42;
    const driftSpeed = (Math.PI * 2) / 10; // one full drift cycle ≈ 10s

    let w = 0;
    let h = 0;
    let dpr = 1;
    let cellW = 1;
    let cellH = 1;
    const resize = () => {
      const rect = root.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      cellW = w / (N - 1);
      cellH = h / (N - 1);
    };
    resize();

    // hot-path state — locals only, never React state
    let raf = 0;
    let last = 0;
    let elapsed = 0;
    let visible = true;
    let down = false;
    let rawX = 0;
    let rawY = 0;
    let sx = 0; // velocity-smoothed trail head (lerp 0.25/sample)
    let sy = 0;
    let lastSx = 0;
    let lastSy = 0;
    const TRAIL_MAX = 10;
    const trailX = new Float32Array(TRAIL_MAX);
    const trailY = new Float32Array(TRAIL_MAX);
    let trailLen = 0;

    // ambient sediment — a handful of specks trickling downhill along the
    // static base gradient, independent of drag; the idle "alive" layer.
    // Skipped entirely under reduced motion (arrays stay zero-length).
    const P = reduced ? 0 : 42;
    const partX = new Float32Array(P);
    const partY = new Float32Array(P);
    const partAge = new Float32Array(P);
    const partLife = new Float32Array(P);
    const spawnParticle = (i: number) => {
      partX[i] = Math.random() * w;
      partY[i] = Math.random() * h;
      partAge[i] = 0;
      partLife[i] = 3 + Math.random() * 4;
    };
    for (let i = 0; i < P; i++) spawnParticle(i);

    const updateParticles = (dt: number) => {
      for (let i = 0; i < P; i++) {
        const gx = Math.min(N - 2, Math.max(1, Math.round(partX[i]! / cellW)));
        const gy = Math.min(N - 2, Math.max(1, Math.round(partY[i]! / cellH)));
        const row = gy * N;
        const dHdx = (base[row + gx + 1]! - base[row + gx - 1]!) / (2 * cellW);
        const dHdy = (base[row + N + gx]! - base[row - N + gx]!) / (2 * cellH);
        let vx = -dHdx * 2600;
        let vy = -dHdy * 2600;
        const sp = Math.hypot(vx, vy);
        if (sp > 26) {
          vx = (vx / sp) * 26;
          vy = (vy / sp) * 26;
        } else if (sp < 4) {
          // near-flat ground — a slow noise-driven nudge so it never stalls
          const a =
            noise2(partX[i]! * 0.01, partY[i]! * 0.01 + elapsed * 0.15) *
            Math.PI *
            2;
          vx = Math.cos(a) * 6;
          vy = Math.sin(a) * 6;
        }
        partX[i]! += vx * dt;
        partY[i]! += vy * dt;
        partAge[i]! += dt;
        if (
          partAge[i]! > partLife[i]! ||
          partX[i]! < 0 ||
          partX[i]! > w ||
          partY[i]! < 0 ||
          partY[i]! > h
        ) {
          spawnParticle(i);
        }
      }
    };

    const carveSegment = (dt: number) => {
      const segLen = Math.hypot(sx - lastSx, sy - lastSy);
      const speed = segLen / Math.max(dt, 1e-4); // px/s
      // full depth below 80 px/s, tapering to 0.25x at 400 px/s
      const speedScale =
        speed <= 80
          ? 1
          : speed >= 400
            ? 0.25
            : 1 - 0.75 * ((speed - 80) / 320);
      const total = carveRate * dt * speedScale;
      const stamps = Math.max(1, Math.ceil(segLen / (brushSigma * 0.5)));
      const dep = total / stamps;
      const reach = brushSigma * 3;
      const inv2s2 = 1 / (2 * brushSigma * brushSigma);
      for (let s = 0; s < stamps; s++) {
        const f = stamps === 1 ? 1 : s / (stamps - 1);
        const px = lastSx + (sx - lastSx) * f;
        const py = lastSy + (sy - lastSy) * f;
        const gx0 = Math.max(0, Math.floor((px - reach) / cellW));
        const gx1 = Math.min(N - 1, Math.ceil((px + reach) / cellW));
        const gy0 = Math.max(0, Math.floor((py - reach) / cellH));
        const gy1 = Math.min(N - 1, Math.ceil((py + reach) / cellH));
        for (let gy = gy0; gy <= gy1; gy++) {
          const dy = gy * cellH - py;
          const row = gy * N;
          for (let gx = gx0; gx <= gx1; gx++) {
            const dx = gx * cellW - px;
            const wgt = Math.exp(-(dx * dx + dy * dy) * inv2s2);
            if (wgt < 0.01) continue;
            const v = delta[row + gx]! + dep * wgt;
            delta[row + gx] = v > 1 ? 1 : v;
          }
        }
      }
      // record the trail head for the waterline proximity test
      if (trailLen < TRAIL_MAX) {
        trailX[trailLen] = sx;
        trailY[trailLen] = sy;
        trailLen++;
      } else {
        for (let i = 1; i < TRAIL_MAX; i++) {
          trailX[i - 1] = trailX[i]!;
          trailY[i - 1] = trailY[i]!;
        }
        trailX[TRAIL_MAX - 1] = sx;
        trailY[TRAIL_MAX - 1] = sy;
      }
    };

    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      let minH = Infinity;
      let maxH = -Infinity;
      for (let i = 0; i < NN; i++) {
        const v =
          base[i]! -
          delta[i]! +
          ambientAmp * Math.sin(driftPhase[i]! - elapsed * driftSpeed);
        field[i] = v;
        if (v < minH) minH = v;
        if (v > maxH) maxH = v;
      }

      // waterline: carved cells near the active trail, pointer down only —
      // the single accent, earned by interaction
      if (down && trailLen > 0) {
        let bx0 = Infinity;
        let bx1 = -Infinity;
        let by0 = Infinity;
        let by1 = -Infinity;
        for (let i = 0; i < trailLen; i++) {
          const tx = trailX[i]!;
          const ty = trailY[i]!;
          if (tx < bx0) bx0 = tx;
          if (tx > bx1) bx1 = tx;
          if (ty < by0) by0 = ty;
          if (ty > by1) by1 = ty;
        }
        const R = 40;
        const R2 = R * R;
        const gx0 = Math.max(0, Math.floor((bx0 - R) / cellW));
        const gx1 = Math.min(N - 1, Math.ceil((bx1 + R) / cellW));
        const gy0 = Math.max(0, Math.floor((by0 - R) / cellH));
        const gy1 = Math.min(N - 1, Math.ceil((by1 + R) / cellH));
        ctx.fillStyle = "rgba(0,107,255,0.35)";
        for (let gy = gy0; gy <= gy1; gy++) {
          const ny = gy * cellH;
          const row = gy * N;
          for (let gx = gx0; gx <= gx1; gx++) {
            if (delta[row + gx]! <= 0.12) continue;
            const nx = gx * cellW;
            let near = false;
            for (let i = 0; i < trailLen; i++) {
              const dx = nx - trailX[i]!;
              const dy = ny - trailY[i]!;
              if (dx * dx + dy * dy < R2) {
                near = true;
                break;
              }
            }
            if (near) {
              ctx.fillRect(nx - cellW / 2, ny - cellH / 2, cellW + 1, cellH + 1);
            }
          }
        }
      }

      // marching squares on the coarse grid, one level per contourStep;
      // batched into two paths — hairline minors, every 5th index major
      const minor = new Path2D();
      const major = new Path2D();
      const kMin = Math.ceil(minH / contourStep);
      const kMax = Math.floor(maxH / contourStep);
      for (let k = kMin; k <= kMax; k++) {
        const t = k * contourStep;
        const path = k % 5 === 0 ? major : minor;
        for (let gy = 0; gy < N - 1; gy++) {
          const rowA = gy * N;
          const rowB = rowA + N;
          const y0 = gy * cellH;
          const y1 = y0 + cellH;
          for (let gx = 0; gx < N - 1; gx++) {
            const a = field[rowA + gx]!;
            const b = field[rowA + gx + 1]!;
            const c = field[rowB + gx + 1]!;
            const d = field[rowB + gx]!;
            const code =
              (a > t ? 8 : 0) | (b > t ? 4 : 0) | (c > t ? 2 : 0) | (d > t ? 1 : 0);
            if (code === 0 || code === 15) continue;
            const x0 = gx * cellW;
            const x1 = x0 + cellW;
            // lazily interpolated edge crossings (only for crossed edges)
            const topX = () => x0 + (cellW * (t - a)) / (b - a);
            const rightY = () => y0 + (cellH * (t - b)) / (c - b);
            const botX = () => x0 + (cellW * (t - d)) / (c - d);
            const leftY = () => y0 + (cellH * (t - a)) / (d - a);
            switch (code) {
              case 1:
              case 14:
                path.moveTo(x0, leftY());
                path.lineTo(botX(), y1);
                break;
              case 2:
              case 13:
                path.moveTo(botX(), y1);
                path.lineTo(x1, rightY());
                break;
              case 3:
              case 12:
                path.moveTo(x0, leftY());
                path.lineTo(x1, rightY());
                break;
              case 4:
              case 11:
                path.moveTo(topX(), y0);
                path.lineTo(x1, rightY());
                break;
              case 5:
                path.moveTo(topX(), y0);
                path.lineTo(x1, rightY());
                path.moveTo(x0, leftY());
                path.lineTo(botX(), y1);
                break;
              case 6:
              case 9:
                path.moveTo(topX(), y0);
                path.lineTo(botX(), y1);
                break;
              case 7:
              case 8:
                path.moveTo(topX(), y0);
                path.lineTo(x0, leftY());
                break;
              case 10:
                path.moveTo(topX(), y0);
                path.lineTo(x0, leftY());
                path.moveTo(botX(), y1);
                path.lineTo(x1, rightY());
                break;
            }
          }
        }
      }
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#2e2e2e";
      ctx.lineWidth = 0.75;
      ctx.stroke(minor);
      ctx.strokeStyle = "#8f8f8f";
      ctx.lineWidth = 1;
      ctx.stroke(major);

      // ambient sediment specks — soft in/out fade over their lifespan
      if (P > 0) {
        ctx.fillStyle = "#8f8f8f";
        for (let i = 0; i < P; i++) {
          const life = partLife[i]!;
          const age = partAge[i]!;
          const fadeIn = Math.min(1, age / 0.6);
          const fadeOut = Math.min(1, (life - age) / 0.6);
          const alpha = Math.max(0, Math.min(fadeIn, fadeOut)) * 0.5;
          if (alpha <= 0.01) continue;
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.arc(partX[i]!, partY[i]!, 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    };

    const loop = (now: number) => {
      const dt = last === 0 ? 1 / 60 : Math.min(0.05, (now - last) / 1000);
      last = now;
      elapsed += dt;

      if (down) {
        // velocity-smoothed trail head prevents scalloping
        sx += (rawX - sx) * 0.25;
        sy += (rawY - sy) * 0.25;
        carveSegment(dt);
        lastSx = sx;
        lastSy = sy;
      }

      // sediment heals: per-node exponential decay of the carve delta
      let maxDelta = 0;
      const decay = Math.exp(-dt / healTau);
      for (let i = 0; i < NN; i++) {
        const v = delta[i]! * decay;
        delta[i] = v;
        if (v > maxDelta) maxDelta = v;
      }
      if (!down && maxDelta <= 0.002) delta.fill(0);

      updateParticles(dt);
      draw();

      // ambient drift + sediment keep this looping while visible — it only
      // sleeps once scrolled offscreen or under reduced motion (never enters)
      if (visible) {
        raf = requestAnimationFrame(loop);
      } else {
        raf = 0;
        last = 0;
      }
    };

    const wake = () => {
      if (reduced) return;
      if (!raf) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    const updateReadout = (x: number, y: number) => {
      const el = readoutRef.current;
      if (!el) return;
      const gx = Math.min(N - 1, Math.max(0, Math.round(x / cellW)));
      const gy = Math.min(N - 1, Math.max(0, Math.round(y / cellH)));
      el.textContent = `GRID ${String(gx).padStart(2, "0")}·${String(gy).padStart(2, "0")}`;
    };
    const clearReadout = () => {
      const el = readoutRef.current;
      if (el) el.textContent = "GRID --·--";
    };

    const toLocal = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      rawX = e.clientX - rect.left;
      rawY = e.clientY - rect.top;
    };

    const onDown = (e: PointerEvent) => {
      if (reduced) return;
      toLocal(e);
      root.setPointerCapture(e.pointerId);
      down = true;
      sx = rawX;
      sy = rawY;
      lastSx = rawX;
      lastSy = rawY;
      trailLen = 0;
      updateReadout(rawX, rawY);
      wake();
    };
    const onMove = (e: PointerEvent) => {
      toLocal(e);
      updateReadout(rawX, rawY);
    };
    const endDrag = () => {
      down = false;
      trailLen = 0;
    };
    const onUp = () => endDrag();
    const onLeave = () => {
      clearReadout();
    };

    const ro = new ResizeObserver(() => {
      resize();
      draw();
    });
    ro.observe(root);

    // ambient motion pauses off-screen — the loop is the only thing that
    // should ever spin while nothing is looking at it
    const io = reduced
      ? null
      : new IntersectionObserver(
          (entries) => {
            const entry = entries[0];
            if (!entry) return;
            visible = entry.isIntersecting;
            if (visible) {
              wake();
            } else if (raf) {
              cancelAnimationFrame(raf);
              raf = 0;
              last = 0;
            }
          },
          { threshold: 0 }
        );
    if (io) io.observe(root);

    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave);
    if (!reduced) {
      root.addEventListener("pointerdown", onDown);
      root.addEventListener("pointerup", onUp);
      root.addEventListener("pointercancel", onUp);
      root.addEventListener("lostpointercapture", onUp);
    }

    // reduced motion renders once and stays put — a real static fallback;
    // otherwise the ambient loop starts immediately, alive before any input
    if (reduced) {
      draw();
    } else {
      wake();
    }

    return () => {
      cancelAnimationFrame(raf);
      raf = 0;
      ro.disconnect();
      if (io) io.disconnect();
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      if (!reduced) {
        root.removeEventListener("pointerdown", onDown);
        root.removeEventListener("pointerup", onUp);
        root.removeEventListener("pointercancel", onUp);
        root.removeEventListener("lostpointercapture", onUp);
      }
    };
  }, [gridSize, contourStep, brushSigma, carveRate, healTau]);

  return (
    <div
      ref={rootRef}
      role="img"
      aria-label={ariaLabel}
      className={`relative w-full cursor-crosshair touch-none select-none overflow-hidden ${className}`}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        className="absolute inset-0 h-full w-full"
      />
      {showReadout && (
        <div
          ref={readoutRef}
          aria-hidden
          className="pointer-events-none absolute right-3 top-3 font-mono text-[10px] tracking-widest text-ns-muted"
        >
          GRID --·--
        </div>
      )}
    </div>
  );
}
