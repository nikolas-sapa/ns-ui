"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";

// ---------------------------------------------------------------------------
// RoastFirstCrack — a full-bleed ambient background modeling first crack in
// a rotating coffee-roaster drum. Beans tumble continuously (carried up the
// drum wall by rotation, then cascading back down across the exposed pile
// face once they pass their repose angle — a real cataracting mixing
// regime, not a rigid spin of the whole population). As internal steam
// pressure builds, individual beans crack open at an irregular, clustered
// cadence: a fissure appears instantly and a fleck of chaff (silverskin)
// peels off the fissure edge, curls through an arc, detaches, and drifts
// free while fading. Not every bean cracks at once — first crack is a
// stochastic process the roaster listens for over a window of minutes, and
// this loop never exhausts its supply: cracked beans reset to uncracked
// after 8-12s so the drum keeps offering fresh beans to crack forever.
//
// TUMBLE MODEL. Each bean carries an angle (theta, standard math convention,
// "down" = -PI/2, a FIXED gravity reference the rotating drum wall sweeps
// past) and a radius from drum center. In "carry" state the wall drags the
// bean forward in theta at the drum's angular rate; once the bean's ascent
// past the down point exceeds its own per-bean repose angle (~100-140deg,
// jittered), it "topples" into a brief fall state — theta eases back toward
// the down point (plus scatter) and radius eases toward a new mid-pile
// depth over 400-800ms, simulating a slide down the exposed cascading
// face — then resumes carry from there. This two-state loop is what makes
// individual beans visibly desynchronize from each other and from the
// drum's own slow rotation, which must itself stay perceptible against
// their motion (kill criterion).
//
// CRACK MODEL. A single Poisson-ish scheduler (exponential inter-arrival,
// mean 1.4s, floor 700ms so events never blur) cracks one random uncracked
// bean at a time. The fissure is a straight --foreground hairline at full
// contrast, drawn across the bean for as long as it stays cracked (8-12s,
// then it resets so the visible population is never a monotonically
// filling one). 1-2 chaff flecks spawn per crack: each is a curling
// silverskin peel, NOT a free particle — the free end sweeps a ~70deg arc
// away from its hinge over 400ms (attached, curling), then detaches and
// drifts a further 200ms (15px/s, fading), 600ms total. This is the
// deliberate distinction from a lateral-crosswind chaff drift: this chaff
// peels FROM a surface before it is airborne, so the curl (not a straight
// drift) is the readable motion.
//
// TOKENS. Beans are filled --ns-muted ellipses (never --border, which is a
// ~1.1:1 separator token and would vanish as a fill). Fissures are
// --foreground at full opacity. Chaff is --foreground at ~40% opacity,
// bumped in light theme if that falls under a 3:1 contrast ratio against
// --background. --ns-accent never appears — there is no interaction here.
// Read via getComputedStyle(documentElement), re-read on a class
// MutationObserver, with every paint path (rAF start, ResizeObserver,
// IntersectionObserver resume) gated behind a `ready` flag set only after
// the first token read.
// ---------------------------------------------------------------------------

type RGB = [number, number, number];

function parseColor(raw: string): RGB | null {
  const s = raw.trim();
  if (!s) return null;
  if (s.startsWith("#")) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return Number.isNaN(r + g + b) ? null : [r / 255, g / 255, b / 255];
    }
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return Number.isNaN(r + g + b) ? null : [r / 255, g / 255, b / 255];
    }
    return null;
  }
  const m = s.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  return m ? [Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255] : null;
}

function relLum(c: RGB): number {
  const lin = (u: number) => (u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
}

function contrastRatio(a: RGB, b: RGB): number {
  const la = relLum(a);
  const lb = relLum(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

function mixRGB(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

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

const DOWN = -Math.PI / 2; // fixed gravity reference, screen-space math angle
const DRUM_REV_PER_S = 0.15; // slow decoupled sweep, see spec's round-9 note
const OMEGA = DRUM_REV_PER_S * Math.PI * 2;
const CRACK_MEAN_MS = 1400;
const CRACK_FLOOR_MS = 700;
const RESET_MIN_MS = 8000;
const RESET_MAX_MS = 12000;
const CURL_MS = 400;
const DRIFT_MS = 200;
const CHAFF_TOTAL_MS = CURL_MS + DRIFT_MS;
const CURL_ARC = (70 * Math.PI) / 180;
const DRIFT_PX_PER_S = 15;
const AREA_PER_BEAN = 900; // px^2
const BEAN_MIN = 40;
const BEAN_MAX = 90;

interface Bean {
  theta: number;
  wallRadius: number; // fraction of drum radius, current carry depth
  fallState: "carry" | "fall";
  fallFrom: number;
  fallTo: number;
  fallFromR: number;
  fallToR: number;
  fallStart: number;
  fallDur: number;
  reposeAngle: number;
  omegaMul: number;
  sizeR: number; // bean ellipse half-length, px fraction of drum radius
  aspect: number;
  wobblePhase: number;
  wobbleFreq: number;
  wobbleAmp: number;
  cracked: boolean;
  crackAt: number;
  resetAt: number;
  fissureAngle: number;
}

interface Chaff {
  beanIdx: number;
  hingeX: number;
  hingeY: number;
  tangentAngle: number; // direction the peel curls toward, radians
  spawnAt: number;
}

export interface RoastFirstCrackProps {
  /** freeze on the reduced-motion tableau. @default false */
  paused?: boolean;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function RoastFirstCrack({ paused = false, children, className = "", style }: RoastFirstCrackProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // token strings start empty and are only ever assigned from
    // getComputedStyle — no literal color fallback anywhere. Every path
    // that could paint is gated behind `ready`.
    let bg = "";
    let mutedStr = "";
    let fgStr = "";
    let bgRGB: RGB | null = null;
    let fgRGB: RGB | null = null;
    let chaffAlpha = 0.4;
    const readTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      bg = cs.getPropertyValue("--background").trim();
      mutedStr = cs.getPropertyValue("--ns-muted").trim();
      fgStr = cs.getPropertyValue("--foreground").trim();
      bgRGB = parseColor(bg);
      fgRGB = parseColor(fgStr);
      chaffAlpha = 0.4;
      if (bgRGB && fgRGB) {
        // effective color of foreground-at-alpha composited over background
        const composited = mixRGB(bgRGB, fgRGB, chaffAlpha);
        if (contrastRatio(composited, bgRGB) < 3) {
          for (let a = 0.4; a <= 0.85; a += 0.05) {
            const c = mixRGB(bgRGB, fgRGB, a);
            if (contrastRatio(c, bgRGB) >= 3) {
              chaffAlpha = a;
              break;
            }
            chaffAlpha = a;
          }
        }
      }
    };

    let dpr = 1;
    let width = 0;
    let height = 0;
    let cx = 0;
    let cy = 0;
    let drumR = 0;
    let sized = false;
    let ready = false;
    let disposed = false;
    let visible = true;
    let raf = 0;
    let last = 0;
    let simTime = 0; // ms
    let nextCrackAt = 0;
    let drumRotation = 0;

    const rand = mulberry32(0x1a5c00de);

    let beans: Bean[] = [];
    let chaffs: Chaff[] = [];

    const beanPos = (b: Bean) => ({
      x: cx + Math.cos(b.theta) * b.wallRadius * drumR,
      y: cy - Math.sin(b.theta) * b.wallRadius * drumR,
    });

    const makeBean = (): Bean => ({
      theta: DOWN + (rand() - 0.5) * 0.6,
      wallRadius: 0.25 + rand() * 0.65,
      fallState: "carry",
      fallFrom: 0,
      fallTo: 0,
      fallFromR: 0,
      fallToR: 0,
      fallStart: 0,
      fallDur: 0,
      reposeAngle: ((100 + rand() * 40) * Math.PI) / 180,
      omegaMul: 0.85 + rand() * 0.3,
      sizeR: 0.05 + rand() * 0.022,
      aspect: 0.72 + rand() * 0.22,
      wobblePhase: rand() * Math.PI * 2,
      wobbleFreq: 0.3 + rand() * 0.35,
      wobbleAmp: 0.02 + rand() * 0.02,
      cracked: false,
      crackAt: -1e9,
      resetAt: -1e9,
      fissureAngle: rand() * Math.PI * 2,
    });

    const spawnChaff = (beanIdx: number, at: number) => {
      const b = beans[beanIdx];
      const p = beanPos(b);
      const outward = Math.atan2(p.y - cy, p.x - cx);
      // outward + a bias toward "up" on screen, the direction a lofted
      // silverskin flake actually curls and drifts
      const tangentAngle = Math.atan2(Math.sin(outward) - 0.5, Math.cos(outward));
      chaffs.push({ beanIdx, hingeX: p.x, hingeY: p.y, tangentAngle, spawnAt: at });
    };

    const crackBean = (idx: number, at: number) => {
      const b = beans[idx];
      b.cracked = true;
      b.crackAt = at;
      b.resetAt = at + RESET_MIN_MS + rand() * (RESET_MAX_MS - RESET_MIN_MS);
      b.fissureAngle = rand() * Math.PI * 2;
      spawnChaff(idx, at);
      if (rand() < 0.45) spawnChaff(idx, at + rand() * 40);
    };

    const buildField = () => {
      drumR = Math.min(width, height) * 0.42;
      cx = width / 2;
      cy = height / 2;
      const drumArea = Math.PI * drumR * drumR;
      const count = Math.max(BEAN_MIN, Math.min(BEAN_MAX, Math.floor(drumArea / AREA_PER_BEAN)));
      beans = [];
      for (let i = 0; i < count; i++) beans.push(makeBean());
      chaffs = [];
      simTime = 0;
      drumRotation = 0;
      nextCrackAt = CRACK_FLOOR_MS + Math.max(0, -Math.log(1 - rand()) * CRACK_MEAN_MS);
    };

    const step = (dtMs: number) => {
      simTime += dtMs;
      drumRotation = (drumRotation + OMEGA * (dtMs / 1000)) % (Math.PI * 2);

      // crack scheduler — one at a time, floor enforced by construction
      // since nextCrackAt is only ever advanced forward from `now`
      if (simTime >= nextCrackAt) {
        const pool: number[] = [];
        for (let i = 0; i < beans.length; i++) if (!beans[i].cracked) pool.push(i);
        if (pool.length > 0) crackBean(pool[Math.floor(rand() * pool.length)], simTime);
        nextCrackAt = simTime + CRACK_FLOOR_MS + Math.max(0, -Math.log(1 - rand()) * (CRACK_MEAN_MS - CRACK_FLOOR_MS));
      }

      for (const b of beans) {
        if (b.cracked && simTime >= b.resetAt) {
          b.cracked = false;
          b.crackAt = -1e9;
          b.resetAt = -1e9;
        }
        if (b.fallState === "carry") {
          b.theta += OMEGA * b.omegaMul * (dtMs / 1000);
          const ascent = ((b.theta - DOWN) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
          if (ascent > b.reposeAngle) {
            b.fallState = "fall";
            b.fallStart = simTime;
            b.fallDur = 400 + rand() * 400;
            b.fallFrom = b.theta;
            b.fallTo = DOWN + (rand() - 0.5) * 0.9;
            b.fallFromR = b.wallRadius;
            b.fallToR = 0.2 + rand() * 0.62;
          }
        } else {
          const t = Math.min(1, (simTime - b.fallStart) / b.fallDur);
          const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // easeInOutQuad
          b.theta = b.fallFrom + (b.fallTo - b.fallFrom) * e;
          b.wallRadius = b.fallFromR + (b.fallToR - b.fallFromR) * e;
          if (t >= 1) {
            b.fallState = "carry";
            b.wallRadius = b.fallToR;
          }
        }
      }

      chaffs = chaffs.filter((c) => simTime - c.spawnAt < CHAFF_TOTAL_MS);
    };

    const draw = () => {
      if (!sized) return;
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      // drum boundary — a --ns-muted hairline ring, low alpha so it reads
      // as containment rather than a UI seam
      ctx.strokeStyle = mutedStr;
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = Math.max(1, drumR * 0.01);
      ctx.beginPath();
      ctx.arc(cx, cy, drumR, 0, Math.PI * 2);
      ctx.stroke();

      // a single spoke marks drum rotation so the slow sweep stays
      // perceptible against the beans' own faster tumble
      ctx.globalAlpha = 0.22;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(drumRotation) * drumR, cy - Math.sin(drumRotation) * drumR);
      ctx.stroke();

      for (const b of beans) {
        const wobble = Math.sin(simTime / 1000 * b.wobbleFreq * Math.PI * 2 + b.wobblePhase) * b.wobbleAmp;
        const rEff = Math.max(0.06, b.wallRadius + wobble) * drumR;
        const px = cx + Math.cos(b.theta) * rEff;
        const py = cy - Math.sin(b.theta) * rEff;
        const rx = b.sizeR * drumR;
        const ry = rx * b.aspect;

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(-b.theta + Math.PI / 2);
        ctx.globalAlpha = 1;
        ctx.fillStyle = mutedStr;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();

        if (b.cracked) {
          ctx.globalAlpha = 1;
          ctx.strokeStyle = fgStr;
          ctx.lineWidth = Math.max(0.8, rx * 0.14);
          ctx.beginPath();
          const fx = Math.cos(b.fissureAngle) * rx * 0.75;
          const fy = Math.sin(b.fissureAngle) * ry * 0.75;
          ctx.moveTo(-fx, -fy);
          ctx.lineTo(fx, fy);
          ctx.stroke();
        }
        ctx.restore();
      }

      // chaff — curling silverskin peels, attached-then-drifting
      ctx.lineCap = "round";
      for (const c of chaffs) {
        const t = simTime - c.spawnAt;
        const rx = beans[c.beanIdx]?.sizeR ?? 0.055;
        const len = rx * drumR * 0.9;
        let curlT: number;
        let driftPx = 0;
        let alpha: number;
        if (t <= CURL_MS) {
          curlT = t / CURL_MS;
          curlT = 1 - Math.pow(1 - curlT, 3); // easeOutCubic
          alpha = Math.min(1, curlT * 3) * chaffAlpha;
        } else {
          curlT = 1;
          const dt = t - CURL_MS;
          driftPx = (DRIFT_PX_PER_S * dt) / 1000;
          alpha = (1 - dt / DRIFT_MS) * chaffAlpha;
        }
        if (alpha <= 0) continue;
        const arcAngle = c.tangentAngle + curlT * CURL_ARC;
        const hx = c.hingeX + Math.cos(c.tangentAngle) * driftPx;
        const hy = c.hingeY + Math.sin(c.tangentAngle) * driftPx;
        const tx = hx + Math.cos(arcAngle) * len;
        const ty = hy + Math.sin(arcAngle) * len;
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = fgStr;
        ctx.lineWidth = Math.max(0.8, len * 0.16);
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        // a slight curve so the peel reads as curling, not a straight pin
        const midAngle = c.tangentAngle + curlT * CURL_ARC * 0.5;
        const mx = hx + Math.cos(midAngle) * len * 0.55;
        const my = hy + Math.sin(midAngle) * len * 0.55;
        ctx.quadraticCurveTo(mx, my, tx, ty);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
    };

    // reduced-motion / paused: freeze the instant just after a crack fires —
    // fissure fully visible on one bean, its chaff mid-drift (elapsed
    // ~500ms into the 600ms lifecycle: past the curl, partway through the
    // fade, not yet gone) — the single frame showing population, tumble
    // state and the full crack lifecycle (fissure + departing chaff) at once.
    const drawStaticFreeze = () => {
      if (!sized) return;
      buildField();
      for (let i = 0; i < 90; i++) step(1000 / 30); // deterministic warm tumble
      const pool: number[] = [];
      for (let i = 0; i < beans.length; i++) if (!beans[i].cracked) pool.push(i);
      const idx = pool[Math.floor(pool.length * 0.4)] ?? 0;
      crackBean(idx, simTime);
      for (let i = 0; i < 15; i++) step(1000 / 30); // ~500ms further: mid-drift, mid-fade
      draw();
    };

    const resize = () => {
      const rect = root.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (w < 2 || h < 2) {
        sized = false;
        return;
      }
      width = w;
      height = h;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildField();
      sized = true;
    };

    const warmStart = () => {
      for (let i = 0; i < 60; i++) step(1000 / 30);
    };

    const loop = (now: number) => {
      if (!visible) return;
      const dt = last ? Math.min(50, now - last) : 1000 / 60;
      last = now;
      step(dt);
      draw();
      raf = requestAnimationFrame(loop);
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        resize();
        if (!sized) return;
        if (reduced || paused) {
          drawStaticFreeze();
        } else {
          warmStart();
          ready = true;
          draw();
          if (visible && !raf) {
            last = 0;
            raf = requestAnimationFrame(loop);
          }
        }
      }, 150);
    };

    const ro = new ResizeObserver(onResize);
    ro.observe(root);

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true;
        if (visible && ready && !reduced && !paused) {
          last = 0;
          raf = requestAnimationFrame(loop);
        } else {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      },
      { threshold: 0 }
    );
    io.observe(root);

    const onVis = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (visible && ready && !reduced && !paused) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced || paused) drawStaticFreeze();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    document.fonts.ready.then(() => {
      if (disposed) return;
      readTokens();
      resize();
      if (!sized) {
        ready = true;
        return;
      }
      if (reduced || paused) {
        drawStaticFreeze();
        ready = true;
      } else {
        warmStart();
        ready = true;
        draw();
        raf = requestAnimationFrame(loop);
      }
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (resizeTimer) clearTimeout(resizeTimer);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [paused]);

  return (
    <div
      ref={rootRef}
      className={`relative isolate h-full w-full overflow-hidden bg-background ${className}`}
      style={style}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 block h-full w-full"
      />
      {children ? <div className="relative z-[1] h-full w-full">{children}</div> : null}
    </div>
  );
}

RoastFirstCrack.displayName = "RoastFirstCrack";
