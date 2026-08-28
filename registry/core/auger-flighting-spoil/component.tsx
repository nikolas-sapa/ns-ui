"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// AugerFlightingSpoil — a continuous-work loader: a helical auger scrolls a
// diagonal-band texture (standing in for its flighting) while material it
// conveys discharges at the top, free-falls, and settles into a growing
// spoil pile whose silhouette is governed by a real angle-of-repose check
// (37deg), the accumulating pile itself being the byproduct that makes the
// loop read as ongoing work rather than a bare spinner.
//
// The auger's real rotation (50 RPM / 0.83 rev/s) is never driven 1:1 as
// discrete flight geometry — that is a genuine aliasing risk against a
// ~60Hz paint. Instead the helix is a repeating diagonal-band texture whose
// scroll offset advances a continuous, sub-pixel-per-frame amount each
// frame (pitch length x rev/s x dt), so the visible motion is always smooth
// regardless of paint rate: the real RPM sets the scroll SPEED, never a
// per-turn step count. Discharge is the actual discrete event a viewer
// tracks — one particle every 420ms, slow enough to watch depart the chute,
// fall, and land individually.
//
// Pile mechanics: columns of a coarse heightmap across the spoil zone track
// settled height. A landing particle raises its column; any adjacent-column
// height difference steeper than the 37deg repose angle (in px, threshold =
// column width * tan(37deg)) is relaxed by transferring the excess to the
// shorter neighbor, which is what turns a straight-down discharge into a
// symmetric cone instead of a single spike. Once the tallest column reaches
// 85% of the available spoil-zone height, every subsequent landing retires
// the oldest still-settled particle (600ms fade + a matching heightmap
// decrement) at the same rate new ones land, holding the pile in steady-
// state turnover rather than ever overflowing or emptying.
// ---------------------------------------------------------------------------

interface Tokens {
  foreground: string;
  muted: string;
}

type DotState = "falling" | "settled" | "retiring";

interface Dot {
  x: number;
  y: number;
  vy: number;
  r: number;
  col: number;
  amount: number;
  state: DotState;
  retireStart: number;
}

const REV_PER_SEC = 50 / 60; // 50 RPM, texture scroll only — never a discrete step
const DISCHARGE_MS = 420; // one particle per interval
const GRAVITY_REF_S = 400; // reference smaller-dimension size for the gravity scale
const GRAVITY_BASE = 800; // px/s^2 at the reference height
const REPOSE_DEG = 37;
const CAP_RATIO = 0.85;
const RETIRE_MS = 600;
const COLUMNS = 26;
const CONTRIBUTION_RATIO = 0.045; // fraction of cap height added per landing
const MAX_DOTS = 60;

/** No literal-colour fallback — an empty read means "not ready to paint yet",
 * never a hardcoded stand-in colour. */
function readTokens(): Tokens {
  const s = getComputedStyle(document.documentElement);
  return {
    foreground: s.getPropertyValue("--foreground").trim(),
    muted: s.getPropertyValue("--ns-muted").trim(),
  };
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface AugerFlightingSpoilProps {
  className?: string;
}

export function AugerFlightingSpoil({ className = "" }: AugerFlightingSpoilProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rand = mulberry32(0x0a09e5);

    let disposed = false;
    let visible = true;
    let sized = false;
    let width = 0;
    let height = 0;
    let dpr = 1;

    const tokens: Tokens = readTokens(); // token read BEFORE any paint
    const mo = new MutationObserver(() => {
      Object.assign(tokens, readTokens());
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    // geometry — recomputed on resize, absolute sizes derived from the
    // container's smaller dimension so it reads correctly at card scale
    let tubeX = 0;
    let tubeTop = 0;
    let tubeBottom = 0;
    let tubeW = 0;
    let dropX = 0;
    let floorY = 0;
    let zoneTop = 0;
    let zoneLeft = 0;
    let zoneWidth = 0;
    let colWidth = 0;
    let capHeight = 0;
    let maxDiffAllowed = 0;
    let contribution = 0;
    let particleR = 0;
    let gravity = GRAVITY_BASE;
    let bandPeriod = 20;

    let heights: number[] = new Array(COLUMNS).fill(0);
    let dots: Dot[] = [];
    let helixOffset = 0;
    let lastDischargeAt = 0;

    let raf = 0;
    let last = 0;

    const relax = () => {
      for (let pass = 0; pass < COLUMNS * 3; pass++) {
        let moved = false;
        for (let i = 0; i < COLUMNS - 1; i++) {
          const a = heights[i] ?? 0;
          const b = heights[i + 1] ?? 0;
          const diff = a - b;
          if (Math.abs(diff) > maxDiffAllowed) {
            const excess = (Math.abs(diff) - maxDiffAllowed) / 2;
            if (diff > 0) {
              heights[i] = a - excess;
              heights[i + 1] = b + excess;
            } else {
              heights[i] = a + excess;
              heights[i + 1] = b - excess;
            }
            moved = true;
          }
        }
        if (!moved) break;
      }
      for (let i = 0; i < COLUMNS; i++) heights[i] = Math.max(0, heights[i] ?? 0);
    };

    const seedPile = (fraction: number) => {
      heights = new Array(COLUMNS).fill(0);
      const center = columnOf(dropX); // apex sits under the live feed point
      const peak = capHeight * fraction;
      const slope = colWidth * Math.tan((REPOSE_DEG * Math.PI) / 180);
      for (let i = 0; i < COLUMNS; i++) {
        const h = peak - Math.abs(i - center) * slope;
        heights[i] = Math.max(0, h);
      }
    };

    const columnOf = (x: number) => {
      const c = Math.floor((x - zoneLeft) / colWidth);
      return Math.max(0, Math.min(COLUMNS - 1, c));
    };

    const measure = () => {
      const rect = container.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      if (width < 2 || height < 2) {
        sized = false;
        return;
      }
      sized = true;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // every extent below is a fraction of S (the smaller dimension) and
      // centred on the container centre, so the whole scene scales as a
      // unit regardless of the card's aspect ratio — a tall-narrow card
      // never balloons the spoil zone's vertical span relative to the
      // horizontal room the cone actually has to spread into.
      const s = Math.min(width, height);
      const cx = width / 2;
      const cy = height / 2;
      tubeW = s * 0.13;
      tubeX = cx - s * 0.22;
      tubeTop = cy - s * 0.34;
      tubeBottom = cy + s * 0.1;
      dropX = tubeX + tubeW * 1.6;
      floorY = cy + s * 0.38;
      zoneTop = tubeBottom;
      // spoil zone is centred on the drop point (not the container), and
      // wide enough that a full-cap 37deg cone has real slack on both
      // flanks: capHeight/tan(37deg) <= zoneWidth/2 with margin.
      zoneWidth = s * 0.9;
      zoneLeft = dropX - zoneWidth / 2;
      colWidth = zoneWidth / COLUMNS;
      capHeight = (floorY - zoneTop) * CAP_RATIO;
      maxDiffAllowed = colWidth * Math.tan((REPOSE_DEG * Math.PI) / 180);
      contribution = capHeight * CONTRIBUTION_RATIO;
      particleR = Math.max(1.6, s * 0.016);
      gravity = GRAVITY_BASE * (s / GRAVITY_REF_S);
      bandPeriod = tubeW * 0.45; // one full light/dark cycle — ~8 turns over the tube's height

      seedPile(reduced ? 1 : 0.4);
      dots = [];
      helixOffset = bandPeriod * 0.37; // arbitrary phase, never aligned to a start
      lastDischargeAt = 0;

      if (reduced) {
        // sprinkle settled dots along the seeded surface so the frozen
        // frame reads as the same granular pile as the live loop, not a
        // smooth triangle
        for (let i = 0; i < 34; i++) {
          const col = Math.floor(rand() * COLUMNS);
          const h = heights[col] ?? 0;
          if (h <= 0) continue;
          const x = zoneLeft + col * colWidth + rand() * colWidth;
          const y = floorY - rand() * h;
          dots.push({
            x,
            y,
            vy: 0,
            r: particleR,
            col,
            amount: contribution,
            state: "settled",
            retireStart: 0,
          });
        }
      } else {
        // a few particles already mid-fall at t0, matching the spec's
        // "not starting from an empty pile" resting-loop description
        for (let i = 0; i < 3; i++) {
          const jitteredX = dropX + (rand() - 0.5) * colWidth * 1.4;
          dots.push({
            x: jitteredX,
            y: tubeTop + rand() * (floorY - zoneTop) * 0.35,
            vy: rand() * 60,
            r: particleR,
            col: columnOf(jitteredX),
            amount: contribution,
            state: "falling",
            retireStart: 0,
          });
        }
      }
    };

    const spawn = () => {
      if (dots.filter((d) => d.state !== "retiring").length >= MAX_DOTS) return;
      const jitteredX = dropX + (rand() - 0.5) * colWidth * 1.4;
      dots.push({
        x: jitteredX,
        y: tubeTop,
        vy: 0,
        r: particleR,
        col: columnOf(jitteredX),
        amount: contribution,
        state: "falling",
        retireStart: 0,
      });
    };

    const retireOldest = (now: number) => {
      for (const d of dots) {
        if (d.state === "settled") {
          d.state = "retiring";
          d.retireStart = now;
          return;
        }
      }
    };

    const step = (dt: number, now: number) => {
      helixOffset += bandPeriod * REV_PER_SEC * dt;

      if (now - lastDischargeAt >= DISCHARGE_MS) {
        lastDischargeAt = now;
        spawn();
      }

      for (const d of dots) {
        if (d.state !== "falling") continue;
        d.vy += gravity * dt;
        d.y += d.vy * dt;
        const surfaceY = floorY - (heights[d.col] ?? 0);
        if (d.y + d.r >= surfaceY) {
          d.y = surfaceY - d.r;
          d.state = "settled";
          heights[d.col] = (heights[d.col] ?? 0) + d.amount;
          relax();
          const maxH = Math.max(...heights);
          if (maxH >= capHeight) retireOldest(now);
        }
      }

      let anyRetired = false;
      for (const d of dots) {
        if (d.state === "retiring" && now - d.retireStart >= RETIRE_MS) {
          heights[d.col] = Math.max(0, (heights[d.col] ?? 0) - d.amount);
          anyRetired = true;
        }
      }
      if (anyRetired) relax();
      dots = dots.filter((d) => !(d.state === "retiring" && now - d.retireStart >= RETIRE_MS));
    };

    const drawTube = () => {
      ctx.save();
      ctx.strokeStyle = tokens.foreground;
      ctx.globalAlpha = 0.65;
      ctx.lineWidth = 1;
      ctx.strokeRect(tubeX - tubeW / 2, tubeTop, tubeW, tubeBottom - tubeTop);
      ctx.restore();

      // helix: two alternating diagonal bands, each half the pitch, filling
      // the tube edge-to-edge with no gap. Both bands read the SAME token
      // (--foreground) at two widely separated alphas rather than crossing
      // two different tokens — a single token composites monotonically
      // against --background in both themes, so the step between the two
      // bands is guaranteed to survive a theme flip instead of the two
      // bands happening to land at the same composited value in one theme.
      ctx.save();
      ctx.beginPath();
      ctx.rect(tubeX - tubeW / 2, tubeTop, tubeW, tubeBottom - tubeTop);
      ctx.clip();
      const pitch = bandPeriod;
      const offset = ((helixOffset % pitch) + pitch) % pitch;
      const diag = tubeBottom - tubeTop + tubeW;
      const bandRhomb = (yTop: number, h: number) => {
        ctx.beginPath();
        ctx.moveTo(tubeX - tubeW / 2, yTop);
        ctx.lineTo(tubeX + tubeW / 2, yTop - tubeW);
        ctx.lineTo(tubeX + tubeW / 2, yTop - tubeW + h);
        ctx.lineTo(tubeX - tubeW / 2, yTop + h);
        ctx.closePath();
        ctx.fill();
      };
      ctx.fillStyle = tokens.foreground;
      for (let y = tubeTop - diag - offset; y < tubeBottom + tubeW; y += pitch) {
        ctx.globalAlpha = 0.18;
        bandRhomb(y, pitch / 2);
        ctx.globalAlpha = 0.55;
        bandRhomb(y + pitch / 2, pitch / 2);
      }
      ctx.restore();

      // discharge chute — short static connector from tube top to drop point
      ctx.save();
      ctx.strokeStyle = tokens.muted;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tubeX, tubeTop);
      ctx.lineTo(dropX, tubeTop);
      ctx.stroke();
      ctx.restore();
    };

    const drawPile = () => {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(zoneLeft, floorY);
      for (let i = 0; i < COLUMNS; i++) {
        const x = zoneLeft + i * colWidth + colWidth / 2;
        const y = floorY - (heights[i] ?? 0);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(zoneLeft + zoneWidth, floorY);
      ctx.closePath();
      ctx.fillStyle = tokens.muted;
      ctx.globalAlpha = 0.28;
      ctx.fill();
      ctx.strokeStyle = tokens.foreground;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    };

    const drawDots = (now: number) => {
      for (const d of dots) {
        let alpha = d.state === "settled" ? 0.8 : d.state === "falling" ? 0.9 : 0.8;
        if (d.state === "retiring") {
          const t = Math.min(1, (now - d.retireStart) / RETIRE_MS);
          alpha *= 1 - t;
        }
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = d.state === "falling" ? tokens.foreground : tokens.muted;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    };

    const draw = (now: number) => {
      if (!tokens.foreground || !tokens.muted) Object.assign(tokens, readTokens());
      if (!tokens.foreground || !tokens.muted) return; // no paint before a real token read
      ctx.clearRect(0, 0, width, height);
      drawTube();
      drawPile();
      drawDots(now);
    };

    const loop = (now: number) => {
      raf = 0;
      if (!visible || !sized) return;
      if (last === 0) last = now;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      step(dt, now);
      draw(now);
      raf = requestAnimationFrame(loop);
    };

    const paintReducedOnce = () => {
      Object.assign(tokens, readTokens());
      if (!tokens.foreground || !tokens.muted) {
        raf = requestAnimationFrame(paintReducedOnce);
        return;
      }
      raf = 0;
      // steady-state cone, no mid-air particles, no scroll — the single
      // most structured frame of the mechanic
      draw(performance.now());
    };

    measure();
    if (sized) {
      if (reduced) {
        paintReducedOnce();
      } else {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    }

    let resizeTimer = 0;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (disposed) return;
        measure();
        if (sized) {
          if (reduced) {
            paintReducedOnce();
          } else if (visible && !raf) {
            last = 0;
            raf = requestAnimationFrame(loop);
          }
        }
      }, 100);
    });
    ro.observe(container);

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && sized && !reduced && !raf) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    });
    io.observe(container);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      window.clearTimeout(resizeTimer);
      mo.disconnect();
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef} className={`relative h-full w-full overflow-hidden bg-background ${className}`}>
      <canvas ref={canvasRef} className="h-full w-full" aria-hidden="true" />
    </div>
  );
}
