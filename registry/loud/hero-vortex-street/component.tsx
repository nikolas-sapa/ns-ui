"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// VortexStreet — cursor fluid. Moving the pointer through a full-bleed dark
// field sheds a von Karman vortex street: alternating-sign vortex blobs spawn
// behind the cursor at speed-dependent intervals, drift downstream on a
// gentle ambient current, and decay away over a few seconds. ~600 tracer
// particles (Float32Array positions, zero per-frame allocation) are advected
// every frame by the summed Lamb-Oseen velocity field of all active vortices
// plus the ambient drift, and drawn as velocity-aligned streaks whose alpha
// scales with speed — fast tracers get an extra blue-white glow pass.
//
// The shedding "driver" is the real pointer while it has moved within the
// last 1.5s, and an internal slow Lissajous orbit otherwise — one mechanism
// gives both idle ambient motion (the field is never static) and a
// self-driving demo with no synthetic events. A real pointerdown drops a
// standing counter-rotating vortex pair at the click point with elevated
// strength that decays to nothing over exactly 3 seconds — a 3s stir.
//
// All ink is read from CSS custom properties at mount and re-read via a
// MutationObserver on documentElement's class attribute, so both themes
// render correctly. The rAF loop pauses on visibilitychange; the backing
// store is dpr-clamped(2) with a zero-size guard. No interactive controls —
// the canvas is aria-hidden decoration, matching hero-particles-webgl's precedent.
//
// prefers-reduced-motion: no rAF loop, no pointer tracking at all. One
// static frame is drawn instead: streamlines integrated once through a fixed
// four-vortex street configuration and stroked as thin curves.
// ---------------------------------------------------------------------------

export interface VortexStreetProps {
  className?: string;
}

const TRACER_COUNT = 600;
const MAX_VORTICES = 24;
const CORE_R = 34; // Lamb-Oseen core radius, px
const AMBIENT_X = 22; // ambient drift, px/s — the field is never static
const AMBIENT_Y = -7;
const SHED_MIN_SPEED = 90; // px/s driver speed before shedding starts
const SHED_SPACING = 44; // px of driver travel per shed vortex
const SHED_GAMMA_PER_SPEED = 140; // circulation = 140 * clamped speed
const SHED_SPEED_LO = 120;
const SHED_SPEED_HI = 800;
const SHED_TAU = 2.2; // s, exponential strength decay of shed vortices
const GAMMA_PRUNE = 1500; // |Γ| below this = negligible, slot freed
const CLICK_GAMMA = 90000; // elevated strength for the click pair
const CLICK_LIFE = 3; // s, exact lifetime of a click vortex
const CLICK_PAIR_OFFSET = 16; // px, half-separation of the pair
const POINTER_HOLD = 1.5; // s of pointer recency before idle orbit resumes
const DRIVER_EASE = 6; // 1/s exponential smoothing toward the target
const STREAK_K = 0.055; // s — streak length = |v| * K (≈3–5px at drift speed)
const GLOW_SPEED = 150; // px/s, above this a tracer gets the glow pass
const TWO_PI = Math.PI * 2;

function parseHex(raw: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixToWhite(c: [number, number, number], t: number): [number, number, number] {
  return [
    Math.round(c[0] + (255 - c[0]) * t),
    Math.round(c[1] + (255 - c[1]) * t),
    Math.round(c[2] + (255 - c[2]) * t),
  ];
}

export function VortexStreet({ className = "" }: VortexStreetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let raf = 0;
    let running = false;
    let last = 0;
    let seeded = false;

    // ---- ink, read from tokens; re-read on theme flip ---------------------
    let fgStyle = "#888";
    let mutedStyle = "#888";
    let glowStyle = "rgb(128,180,255)";
    let fadeStyle = "rgba(10,10,10,0.32)";
    let bgStyle = "#0a0a0a";
    const readInk = () => {
      const cs = getComputedStyle(document.documentElement);
      const fg = cs.getPropertyValue("--foreground").trim();
      const muted = cs.getPropertyValue("--muted").trim();
      const bg = cs.getPropertyValue("--background").trim();
      const accent = cs.getPropertyValue("--accent").trim();
      fgStyle = fg || "#888";
      mutedStyle = muted || "#888";
      bgStyle = bg || "#0a0a0a";
      const bgRgb = parseHex(bg) ?? [10, 10, 10];
      fadeStyle = `rgba(${bgRgb[0]},${bgRgb[1]},${bgRgb[2]},0.32)`;
      // blue-white glow: the accent token pulled halfway toward white
      const g = mixToWhite(parseHex(accent) ?? [0, 107, 255], 0.5);
      glowStyle = `rgb(${g[0]},${g[1]},${g[2]})`;
    };
    readInk();

    // ---- tracers: typed arrays, mutated in place --------------------------
    const tx = new Float32Array(TRACER_COUNT);
    const ty = new Float32Array(TRACER_COUNT);

    // ---- vortex store: fixed capacity, slots reused -----------------------
    const vActive = new Uint8Array(MAX_VORTICES);
    const vx = new Float32Array(MAX_VORTICES);
    const vy = new Float32Array(MAX_VORTICES);
    const vg = new Float32Array(MAX_VORTICES); // signed initial circulation
    const vBirth = new Float32Array(MAX_VORTICES); // s
    const vKind = new Uint8Array(MAX_VORTICES); // 0 = shed, 1 = click
    const vEff = new Float32Array(MAX_VORTICES); // per-frame effective Γ
    const activeIdx = new Int32Array(MAX_VORTICES);

    const allocSlot = (): number => {
      let oldest = 0;
      let oldestBirth = Infinity;
      for (let i = 0; i < MAX_VORTICES; i++) {
        if (!vActive[i]) return i;
        if (vBirth[i] < oldestBirth) {
          oldestBirth = vBirth[i];
          oldest = i;
        }
      }
      return oldest; // full: evict the oldest
    };

    const spawnVortex = (x: number, y: number, gamma: number, kind: 0 | 1, nowS: number) => {
      const i = allocSlot();
      vActive[i] = 1;
      vx[i] = x;
      vy[i] = y;
      vg[i] = gamma;
      vBirth[i] = nowS;
      vKind[i] = kind;
    };

    // ---- driver: real pointer when fresh, Lissajous orbit otherwise -------
    let pointerX = 0;
    let pointerY = 0;
    let lastPointerT = -Infinity; // s
    let driverX = 0;
    let driverY = 0;
    let driverInit = false;
    let shedSign = 1;
    let travel = 0;

    const lissajousX = (t: number) => w * (0.5 + 0.36 * Math.sin(0.5 * t + 1.3));
    const lissajousY = (t: number) => h * (0.5 + 0.34 * Math.sin(0.34 * t));

    // ---- per-frame step ---------------------------------------------------
    const step = (nowS: number, dt: number) => {
      // decay + prune vortices, compact active indices
      let nActive = 0;
      for (let i = 0; i < MAX_VORTICES; i++) {
        if (!vActive[i]) continue;
        const age = nowS - vBirth[i];
        let eff: number;
        if (vKind[i] === 1) {
          // click vortex: gone at exactly CLICK_LIFE, quadratic ease-out
          if (age >= CLICK_LIFE) {
            vActive[i] = 0;
            continue;
          }
          const k = 1 - age / CLICK_LIFE;
          eff = vg[i] * k * k;
        } else {
          eff = vg[i] * Math.exp(-age / SHED_TAU);
        }
        if (eff > -GAMMA_PRUNE && eff < GAMMA_PRUNE) {
          vActive[i] = 0;
          continue;
        }
        vEff[i] = eff;
        activeIdx[nActive++] = i;
      }

      // drive: ease toward pointer (if fresh) or the idle orbit
      const usePointer = nowS - lastPointerT < POINTER_HOLD;
      const targetX = usePointer ? pointerX : lissajousX(nowS);
      const targetY = usePointer ? pointerY : lissajousY(nowS);
      if (!driverInit) {
        driverX = targetX;
        driverY = targetY;
        driverInit = true;
      }
      const ease = 1 - Math.exp(-DRIVER_EASE * dt);
      const px = driverX;
      const py = driverY;
      driverX += (targetX - driverX) * ease;
      driverY += (targetY - driverY) * ease;
      const dvx = driverX - px;
      const dvy = driverY - py;
      const dist = Math.sqrt(dvx * dvx + dvy * dvy);
      const speed = dt > 0 ? dist / dt : 0;

      // shed: accumulate travel above the speed threshold, alternate sign
      if (speed > SHED_MIN_SPEED) {
        travel += dist;
        if (travel >= SHED_SPACING) {
          travel -= SHED_SPACING;
          const inv = dist > 0 ? 1 / dist : 0;
          const ux = dvx * inv;
          const uy = dvy * inv;
          const s = speed < SHED_SPEED_LO ? SHED_SPEED_LO : speed > SHED_SPEED_HI ? SHED_SPEED_HI : speed;
          // behind the driver, offset to alternating sides — the two rows
          // of the street
          spawnVortex(
            driverX - ux * 12 - uy * 10 * shedSign,
            driverY - uy * 12 + ux * 10 * shedSign,
            shedSign * SHED_GAMMA_PER_SPEED * s,
            0,
            nowS
          );
          shedSign = -shedSign;
        }
      } else {
        travel = 0;
      }

      // paint: translucent background fill leaves short-lived trails
      ctx.globalAlpha = 1;
      ctx.fillStyle = fadeStyle;
      ctx.fillRect(0, 0, w, h);

      // faint rotating glyph rings hint at the invisible vortex centers
      ctx.strokeStyle = mutedStyle;
      ctx.lineWidth = 1;
      for (let a = 0; a < nActive; a++) {
        const i = activeIdx[a];
        const eff = vEff[i];
        const mag = eff < 0 ? -eff : eff;
        const alpha = 0.1 * (mag > 40000 ? 1 : mag / 40000);
        if (alpha < 0.008) continue;
        const r = CORE_R * 0.85;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(vx[i], vy[i], r, 0, TWO_PI);
        ctx.stroke();
        const ang = (eff > 0 ? 1 : -1) * nowS * 1.4 + i * 1.7;
        const ca = Math.cos(ang);
        const sa = Math.sin(ang);
        ctx.beginPath();
        ctx.moveTo(vx[i] + ca * r, vy[i] + sa * r);
        ctx.lineTo(vx[i] + ca * (r + 5), vy[i] + sa * (r + 5));
        ctx.stroke();
      }

      // advect + draw tracers as velocity-aligned streaks
      const coreR2 = CORE_R * CORE_R;
      ctx.lineWidth = 1.1;
      for (let p = 0; p < TRACER_COUNT; p++) {
        const x = tx[p];
        const y = ty[p];
        let velX = AMBIENT_X;
        let velY = AMBIENT_Y;
        for (let a = 0; a < nActive; a++) {
          const i = activeIdx[a];
          const dx = x - vx[i];
          const dy = y - vy[i];
          let r2 = dx * dx + dy * dy;
          if (r2 < 1e-6) r2 = 1e-6;
          // Lamb-Oseen: v_theta = (Γ / 2πr)(1 − e^{−(r/rc)²}), tangential —
          // as a multiplier on (−dy, dx) that's Γ(1 − e)/(2πr²)
          const f = (vEff[i] * (1 - Math.exp(-r2 / coreR2))) / (TWO_PI * r2);
          velX += -dy * f;
          velY += dx * f;
        }
        let nx = x + velX * dt;
        let ny = y + velY * dt;
        // wrap with a small margin
        if (nx < -6) nx = w + 6;
        else if (nx > w + 6) nx = -6;
        if (ny < -6) ny = h + 6;
        else if (ny > h + 6) ny = -6;
        tx[p] = nx;
        ty[p] = ny;

        const sp = Math.sqrt(velX * velX + velY * velY);
        const alpha = sp * 0.003 + 0.08;
        const x0 = nx - velX * STREAK_K;
        const y0 = ny - velY * STREAK_K;
        if (sp > GLOW_SPEED) {
          // blue-white glow pass under fast streaks
          ctx.strokeStyle = glowStyle;
          ctx.lineWidth = 3;
          ctx.globalAlpha = Math.min(0.4, (sp - GLOW_SPEED) * 0.0016 + 0.12);
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(nx, ny);
          ctx.stroke();
          ctx.lineWidth = 1.1;
        }
        ctx.strokeStyle = fgStyle;
        ctx.globalAlpha = alpha > 0.85 ? 0.85 : alpha;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(nx, ny);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };

    const loop = (t: number) => {
      const dt = Math.min((t - (last || t)) / 1000, 1 / 30);
      last = t;
      step(t / 1000, dt);
      raf = requestAnimationFrame(loop);
    };
    const wake = () => {
      if (!running) {
        running = true;
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    const sleep = () => {
      cancelAnimationFrame(raf);
      running = false;
    };

    // ---- reduced motion: one static frame of integrated streamlines -------
    const drawStatic = () => {
      ctx.fillStyle = bgStyle;
      ctx.fillRect(0, 0, w, h);
      // fixed vortex street: four alternating vortices along the midline
      const sx = [0.3, 0.44, 0.58, 0.72];
      const sg = [52000, -52000, 52000, -52000];
      const coreR2 = CORE_R * CORE_R;
      const vel = (x: number, y: number): [number, number] => {
        let ax = AMBIENT_X * 2.4;
        let ay = 0;
        for (let i = 0; i < 4; i++) {
          const cx0 = sx[i] * w;
          const cy0 = h * (i % 2 === 0 ? 0.44 : 0.56);
          const dx = x - cx0;
          const dy = y - cy0;
          let r2 = dx * dx + dy * dy;
          if (r2 < 1e-6) r2 = 1e-6;
          const f = (sg[i] * (1 - Math.exp(-r2 / coreR2))) / (TWO_PI * r2);
          ax += -dy * f;
          ay += dx * f;
        }
        return [ax, ay];
      };
      // integrate seed points through the frozen field, stroke as curves
      ctx.strokeStyle = fgStyle;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.32;
      const seeds = 26;
      for (let s = 0; s < seeds; s++) {
        let x = -4;
        let y = (h * (s + 0.5)) / seeds;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let k = 0; k < 300; k++) {
          const [ux, uy] = vel(x, y);
          x += ux * 0.02;
          y += uy * 0.02;
          if (x < -8 || x > w + 8 || y < -8 || y > h + 8) break;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      // ring hints at the vortex centers
      ctx.strokeStyle = mutedStyle;
      ctx.globalAlpha = 0.3;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(sx[i] * w, h * (i % 2 === 0 ? 0.44 : 0.56), CORE_R * 0.85, 0, TWO_PI);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };

    // ---- pointer (attached only when motion is allowed) -------------------
    const onPointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      pointerX = e.clientX - rect.left;
      pointerY = e.clientY - rect.top;
      lastPointerT = performance.now() / 1000;
    };
    const onPointerDown = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const nowS = performance.now() / 1000;
      // standing counter-rotating pair — stirs the field for 3s
      spawnVortex(cx - CLICK_PAIR_OFFSET, cy, CLICK_GAMMA, 1, nowS);
      spawnVortex(cx + CLICK_PAIR_OFFSET, cy, -CLICK_GAMMA, 1, nowS);
      pointerX = cx;
      pointerY = cy;
      lastPointerT = nowS;
    };

    // ---- mode plumbing ----------------------------------------------------
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = mq.matches;
    let listening = false;
    const applyMode = () => {
      if (reduced) {
        sleep();
        if (listening) {
          container.removeEventListener("pointermove", onPointerMove);
          container.removeEventListener("pointerdown", onPointerDown);
          listening = false;
        }
        if (w > 0 && h > 0) drawStatic();
      } else {
        if (!listening) {
          container.addEventListener("pointermove", onPointerMove);
          container.addEventListener("pointerdown", onPointerDown);
          listening = true;
        }
        if (w > 0 && h > 0) wake();
      }
    };
    const onMq = () => {
      reduced = mq.matches;
      applyMode();
    };
    mq.addEventListener("change", onMq);

    const resize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) return; // zero-size guard
      w = rect.width;
      h = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!seeded) {
        for (let p = 0; p < TRACER_COUNT; p++) {
          tx[p] = Math.random() * w;
          ty[p] = Math.random() * h;
        }
        seeded = true;
      }
      // resizing clears the canvas — repaint an opaque base so trails don't
      // start from transparency
      ctx.fillStyle = bgStyle;
      ctx.fillRect(0, 0, w, h);
      applyMode();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    const themeObserver = new MutationObserver(() => {
      readInk();
      if (w <= 0 || h <= 0) return;
      // flush old-theme trail pixels immediately
      ctx.fillStyle = bgStyle;
      ctx.fillRect(0, 0, w, h);
      if (reduced) drawStatic();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const onVis = () => {
      if (document.hidden) sleep();
      else if (!reduced) wake();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      ro.disconnect();
      themeObserver.disconnect();
      mq.removeEventListener("change", onMq);
      document.removeEventListener("visibilitychange", onVis);
      if (listening) {
        container.removeEventListener("pointermove", onPointerMove);
        container.removeEventListener("pointerdown", onPointerDown);
      }
      sleep();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full overflow-hidden bg-background ${className}`}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      />
    </div>
  );
}
