"use client";

import { useEffect, useRef, useState } from "react";

// world-space constants
const DEPTH = 4000; // tunnel length in world units
const TRAVEL = 3600; // camera travel across the full scrub
const FOCAL = 600; // perspective focal length: scale = FOCAL / (z - camZ)
const R_MIN = 120; // cylinder shell inner radius
const R_MAX = 900; // cylinder shell outer radius
const NEAR_CLIP = 24; // cull points closer than this to the camera

// streak-factor spring: k = 60, zeta = 0.8 (relaxes lines back to dots)
const SPRING_K = 60;
const SPRING_C = 2 * 0.8 * Math.sqrt(SPRING_K);

// monochrome depth ramp: alpha rises 0.3 -> 1.0 with proximity, color pinned
// to the live --foreground token so contrast against the page background is
// correct in both themes (near = full foreground opacity, far = faded toward bg).
function buildShades(rgb: { r: number; g: number; b: number }) {
  return Array.from({ length: 24 }, (_, i) => {
    const t = i / 23;
    return `rgba(${rgb.r},${rgb.g},${rgb.b},${(0.3 + 0.7 * t).toFixed(3)})`;
  });
}

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
  const m = v.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  if (m) return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
  return null;
}

function readForegroundShades() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--foreground");
  return buildShades(parseColor(raw) ?? { r: 143, g: 143, b: 143 });
}

// deterministic PRNG so the field is identical across mounts and screenshots
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// seed points in a cylinder shell (uniform over the annulus area)
function seedPoints(count: number) {
  const rand = mulberry32(0x517cc1b7);
  const px = new Float32Array(count);
  const py = new Float32Array(count);
  const pz = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const theta = rand() * Math.PI * 2;
    const r = Math.sqrt(R_MIN * R_MIN + (R_MAX * R_MAX - R_MIN * R_MIN) * rand());
    px[i] = Math.cos(theta) * r;
    py[i] = Math.sin(theta) * r;
    pz[i] = rand() * DEPTH;
  }
  return { px, py, pz };
}

function labelDepthAt(index: number, count: number) {
  return count <= 1 ? DEPTH / 2 : 700 + (index * 2700) / (count - 1);
}

// Scroll scrubs a camera through a monochrome point tunnel. Scroll velocity
// stretches dots into motion streaks, cursor drift adds parallax, and mono
// labels sit at fixed world depths, snapping into focus as the camera passes.
// Direct-DOM rAF loop — no React state on the hot path; sleeps when settled.
export function ParticleTunnelScrub({
  labels = ["01 SIGNAL", "02 NOISE", "03 FIELD", "04 VOID"],
  pointCount = 3000,
  className = "",
}: {
  /** section labels pinned at fixed depths along the tunnel */
  labels?: string[];
  /** points seeded in the cylinder shell */
  pointCount?: number;
  className?: string;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // full motion path
  useEffect(() => {
    if (reduced) return;
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    if (!section || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { px, py, pz } = seedPoints(pointCount);
    const prevX = new Float32Array(pointCount);
    const prevY = new Float32Array(pointCount);
    const dirX = new Float32Array(pointCount);
    const dirY = new Float32Array(pointCount);
    let hasPrev = false;
    let shades = readForegroundShades();

    const labelCount = labels.length;
    const labelDepths = labels.map((_, i) => labelDepthAt(i, labelCount));

    let w = 0;
    let h = 0;
    let p = 0; // scroll progress 0..1
    let lastCamZ = 0;
    let vel = 0; // EMA of camZ delta per 60fps frame
    let streak = 0; // spring-smoothed streak length (px)
    let streakV = 0;
    let camX = 0;
    let camY = 0;
    let tX = 0; // parallax targets (world units)
    let tY = 0;
    let raf = 0;
    let lastT = 0;
    let dirty = true;

    const frame = (now: number) => {
      const dt = Math.min(0.05, lastT ? (now - lastT) / 1000 : 1 / 60);
      lastT = now;
      const frames = dt * 60;
      dirty = false;

      // camera scrub + scroll-velocity EMA (alpha = 0.12)
      const camZ = p * TRAVEL;
      const inst = frames > 0 ? (camZ - lastCamZ) / frames : 0;
      lastCamZ = camZ;
      vel += 0.12 * (inst - vel);

      // streak spring toward clamp(|v| * 0.06, 0, 40) px
      const target = Math.min(40, Math.abs(vel) * 0.06);
      streakV += (SPRING_K * (target - streak) - SPRING_C * streakV) * dt;
      streak += streakV * dt;
      if (streak < 0) streak = 0;

      // cursor parallax: lerp 0.08/frame toward pointer offset
      const k = 1 - Math.pow(1 - 0.08, frames);
      camX += (tX - camX) * k;
      camY += (tY - camY) * k;

      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const drawStreaks = streak > 0.5;

      for (let i = 0; i < pointCount; i++) {
        const dz = pz[i] - camZ;
        if (dz < NEAR_CLIP) continue; // behind or grazing the camera
        const s = FOCAL / dz;
        const sx = cx + (px[i] - camX) * s;
        const sy = cy + (py[i] - camY) * s;
        if (sx < -60 || sx > w + 60 || sy < -60 || sy > h + 60) {
          prevX[i] = sx;
          prevY[i] = sy;
          continue;
        }
        if (hasPrev) {
          const mx = sx - prevX[i];
          const my = sy - prevY[i];
          const md = Math.hypot(mx, my);
          if (md > 0.3) {
            dirX[i] = mx / md;
            dirY[i] = my / md;
          }
        }
        prevX[i] = sx;
        prevY[i] = sy;

        const near = Math.min(1, 420 / dz);
        const shade = shades[Math.min(23, (near * 23) | 0)] ?? "#8f8f8f";
        const size = Math.min(3.2, Math.max(0.6, s * 1.5));
        if (drawStreaks && (dirX[i] !== 0 || dirY[i] !== 0)) {
          ctx.strokeStyle = shade;
          ctx.lineWidth = size;
          ctx.beginPath();
          ctx.moveTo(sx - dirX[i] * streak, sy - dirY[i] * streak);
          ctx.lineTo(sx, sy);
          ctx.stroke();
        } else {
          ctx.fillStyle = shade;
          ctx.fillRect(sx - size / 2, sy - size / 2, size, size);
        }
      }
      hasPrev = true;

      // labels: focus window +-300 units, fall to blur 6px over the next 900,
      // scale runs 0.92 -> 1.08 through the pass so they fly by
      for (let i = 0; i < labelCount; i++) {
        const el = labelRefs.current[i];
        if (!el) continue;
        const d = (labelDepths[i] ?? 0) - camZ;
        const ad = Math.abs(d);
        let opacity = 0;
        let blur = 6;
        if (ad <= 300) {
          opacity = 1;
          blur = 0;
        } else if (ad <= 1200) {
          const t = (ad - 300) / 900;
          opacity = 1 - t;
          blur = 6 * t;
        }
        const scale = Math.min(1.08, Math.max(0.92, 1 - (d / 1200) * 0.08));
        el.style.opacity = opacity.toFixed(3);
        el.style.filter = blur > 0.02 ? `blur(${blur.toFixed(2)}px)` : "none";
        el.style.transform = `scale(${scale.toFixed(4)})`;
      }

      // sleep when scroll, parallax, and the streak spring are all settled
      const parallaxSettled = Math.abs(tX - camX) < 0.05 && Math.abs(tY - camY) < 0.05;
      const springSettled = streak < 0.05 && Math.abs(streakV) < 0.05 && Math.abs(vel) < 0.05;
      if (!dirty && parallaxSettled && springSettled) {
        raf = 0;
        lastT = 0;
        return;
      }
      raf = requestAnimationFrame(frame);
    };

    const wake = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = "round";
      dirty = true;
      wake();
    };

    const readScroll = () => {
      const rect = section.getBoundingClientRect();
      const track = rect.height - window.innerHeight;
      p = track > 0 ? Math.min(1, Math.max(0, -rect.top / track)) : 0;
      dirty = true;
      wake();
    };

    const onPointer = (e: PointerEvent) => {
      tX = (e.clientX - w / 2) * 0.04;
      tY = (e.clientY - h / 2) * 0.04;
      wake();
    };

    // re-derive the shade ramp from --foreground whenever the theme class
    // flips on <html>, so light/dark contrast stays correct without a remount
    const onThemeChange = () => {
      shades = readForegroundShades();
      dirty = true;
      wake();
    };
    const themeObserver = new MutationObserver(onThemeChange);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    resize();
    readScroll();
    lastCamZ = p * TRAVEL; // no phantom velocity on mount mid-page
    wake();

    window.addEventListener("scroll", readScroll, { passive: true });
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointer, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      themeObserver.disconnect();
      window.removeEventListener("scroll", readScroll);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, pointCount, labels.length]);

  // reduced motion: one static starfield frame, no loop
  useEffect(() => {
    if (!reduced) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { px, py, pz } = seedPoints(pointCount);
    let shades = readForegroundShades();
    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const camZ = DEPTH * 0.3;
      for (let i = 0; i < pointCount; i++) {
        const dz = pz[i] - camZ;
        if (dz < NEAR_CLIP) continue;
        const s = FOCAL / dz;
        const sx = w / 2 + px[i] * s;
        const sy = h / 2 + py[i] * s;
        if (sx < -10 || sx > w + 10 || sy < -10 || sy > h + 10) continue;
        const near = Math.min(1, 420 / dz);
        ctx.fillStyle = shades[Math.min(23, (near * 23) | 0)] ?? "#8f8f8f";
        const size = Math.min(3.2, Math.max(0.6, s * 1.5));
        ctx.fillRect(sx - size / 2, sy - size / 2, size, size);
      }
    };
    draw();
    const onThemeChange = () => {
      shades = readForegroundShades();
      draw();
    };
    const themeObserver = new MutationObserver(onThemeChange);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    window.addEventListener("resize", draw);
    return () => {
      themeObserver.disconnect();
      window.removeEventListener("resize", draw);
    };
  }, [reduced, pointCount]);

  // reduced motion: labels fade in 200ms via IntersectionObserver
  useEffect(() => {
    if (!reduced) return;
    const els = labelRefs.current
      .slice(0, labels.length)
      .filter((el): el is HTMLSpanElement => el !== null);
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          (entry.target as HTMLElement).style.opacity = entry.isIntersecting ? "1" : "0";
        }
      },
      { threshold: 0.4 }
    );
    for (const el of els) {
      el.style.transition = "opacity 200ms ease-out";
      io.observe(el);
    }
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, labels.length]);

  return (
    <section
      ref={sectionRef}
      className={`relative h-[400vh] bg-background ${className}`}
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at center, transparent 40%, var(--background) 96%)",
          }}
        />
        {!reduced &&
          labels.map((label, i) => (
            <div
              key={`${label}-${i}`}
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
            >
              <span
                ref={(el) => {
                  labelRefs.current[i] = el;
                }}
                className="font-mono text-sm tracking-widest text-foreground will-change-[transform,opacity,filter]"
                style={{ opacity: 0 }}
              >
                {label}
              </span>
            </div>
          ))}
      </div>
      {reduced && (
        <div className="absolute inset-0">
          {labels.map((label, i) => (
            <span
              key={`${label}-${i}`}
              ref={(el) => {
                labelRefs.current[i] = el;
              }}
              className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-sm tracking-widest text-foreground"
              style={{ top: `${((i + 0.5) * 100) / labels.length}%`, opacity: 0 }}
            >
              {label}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
