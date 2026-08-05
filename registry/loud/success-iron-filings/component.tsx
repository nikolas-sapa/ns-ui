"use client";

import { useEffect, useRef, useState } from "react";

// Success moment as magnetism: a field of scattered iron filings drifts
// aimlessly until the action confirms — then a field switches on and the
// filings migrate and ALIGN, drawing the checkmark as revealed field lines.
// Filings near the path snap onto it; the rest stay put but rotate to the
// local field direction, so the check emerges from the whole field, not a
// stamped glyph. All canvas ink is read from CSS tokens at mount and on
// theme change.

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  // assigned on confirm
  tx: number;
  ty: number;
  tAngle: number;
  delay: number;
  onPath: boolean;
  // idle drift
  dx: number;
  dy: number;
  spin: number;
  seed: number;
};

const COUNT = 520;
// checkmark polyline, normalized to the field box
const CHECK: [number, number][] = [
  [0.3, 0.55],
  [0.45, 0.72],
  [0.72, 0.3],
];

function nearestOnCheck(
  x: number,
  y: number,
  w: number,
  h: number
): { px: number; py: number; tangent: number; dist: number } {
  let best = { px: 0, py: 0, tangent: 0, dist: Infinity };
  for (let s = 0; s < CHECK.length - 1; s++) {
    const ax = CHECK[s][0] * w;
    const ay = CHECK[s][1] * h;
    const bx = CHECK[s + 1][0] * w;
    const by = CHECK[s + 1][1] * h;
    const abx = bx - ax;
    const aby = by - ay;
    const len2 = abx * abx + aby * aby;
    const t = Math.max(
      0,
      Math.min(1, ((x - ax) * abx + (y - ay) * aby) / len2)
    );
    const px = ax + abx * t;
    const py = ay + aby * t;
    const d = Math.hypot(x - px, y - py);
    if (d < best.dist) {
      best = { px, py, tangent: Math.atan2(aby, abx), dist: d };
    }
  }
  return best;
}

export function IronFilings({ className = "" }: { className?: string }) {
  const [phase, setPhase] = useState<"idle" | "pending" | "done">("idle");
  const fieldRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const reduced = useRef(false);
  const confirmAt = useRef(0);

  useEffect(() => {
    const field = fieldRef.current;
    const canvas = canvasRef.current;
    if (!field || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    reduced.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let w = 0;
    let h = 0;
    let ink = { fg: "#888", muted: "#888" };
    let raf = 0;
    let last = 0;
    let running = false;

    const readInk = () => {
      const cs = getComputedStyle(document.documentElement);
      ink = {
        fg: cs.getPropertyValue("--foreground").trim() || "#888",
        muted: cs.getPropertyValue("--ns-muted").trim() || "#888",
      };
    };
    readInk();

    // deterministic-ish scatter, reseeded per mount
    const rand = (() => {
      let s = 1234567;
      return () => {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return s / 0x7fffffff;
      };
    })();

    const particles: Particle[] = Array.from({ length: COUNT }, () => ({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      angle: rand() * Math.PI,
      tx: 0,
      ty: 0,
      tAngle: 0,
      delay: 0,
      onPath: false,
      dx: (rand() - 0.5) * 5,
      dy: (rand() - 0.5) * 5,
      spin: (rand() - 0.5) * 0.35,
      seed: rand(),
    }));
    let seeded = false;

    const resize = () => {
      const rect = field.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) return;
      w = rect.width;
      h = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!seeded) {
        for (const p of particles) {
          p.x = rand() * w;
          p.y = rand() * h;
        }
        seeded = true;
      }
      if (phaseRef.current === "done") assignTargets();
      wake();
    };

    const assignTargets = () => {
      // 68% land on the stroke itself, the rest align in place as halo
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.onPath = p.seed < 0.68;
        if (p.onPath) {
          const t = (i / particles.length + p.seed * 0.13) % 1;
          // walk the polyline by arc length
          const l1 = Math.hypot(
            (CHECK[1][0] - CHECK[0][0]) * w,
            (CHECK[1][1] - CHECK[0][1]) * h
          );
          const l2 = Math.hypot(
            (CHECK[2][0] - CHECK[1][0]) * w,
            (CHECK[2][1] - CHECK[1][1]) * h
          );
          const d = t * (l1 + l2);
          const seg = d < l1 ? 0 : 1;
          const st = seg === 0 ? d / l1 : (d - l1) / l2;
          const ax = CHECK[seg][0] * w;
          const ay = CHECK[seg][1] * h;
          const bx = CHECK[seg + 1][0] * w;
          const by = CHECK[seg + 1][1] * h;
          const tangent = Math.atan2(by - ay, bx - ax);
          // thickness: gaussian-ish normal offset builds a soft stroke
          const off =
            (p.seed - 0.5 + (((p.seed * 7919) % 1) - 0.5)) * 7;
          p.tx = ax + (bx - ax) * st + Math.cos(tangent + Math.PI / 2) * off;
          p.ty = ay + (by - ay) * st + Math.sin(tangent + Math.PI / 2) * off;
          p.tAngle = tangent + (p.seed - 0.5) * 0.3;
          p.delay = t * 0.45 + p.seed * 0.15;
        } else {
          const near = nearestOnCheck(p.x, p.y, w, h);
          // halo filings creep slightly toward the field, mostly rotate
          p.tx = p.x + (near.px - p.x) * 0.12;
          p.ty = p.y + (near.py - p.y) * 0.12;
          p.tAngle = near.tangent;
          p.delay = p.seed * 0.5;
        }
      }
      confirmAt.current = performance.now();
    };

    const K = 130;
    const ZETA = 0.82;
    const draw = (dt: number, now: number) => {
      ctx.clearRect(0, 0, w, h);
      const done = phaseRef.current === "done";
      const elapsed = (now - confirmAt.current) / 1000;
      let settled = true;
      for (const p of particles) {
        if (done) {
          if (elapsed > p.delay) {
            const c = 2 * ZETA * Math.sqrt(K);
            p.vx += (K * (p.tx - p.x) - c * p.vx) * dt;
            p.vy += (K * (p.ty - p.y) - c * p.vy) * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            let dA = p.tAngle - p.angle;
            while (dA > Math.PI / 2) dA -= Math.PI;
            while (dA < -Math.PI / 2) dA += Math.PI;
            p.angle += dA * Math.min(1, dt * 7);
            if (
              Math.abs(p.tx - p.x) > 0.4 ||
              Math.abs(p.vx) > 3 ||
              Math.abs(dA) > 0.02
            )
              settled = false;
          } else {
            // pre-delay: burst velocity coasts under drag, so a replay's
            // outward fling is visible before the field pulls back
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vx -= p.vx * 3 * dt;
            p.vy -= p.vy * 3 * dt;
            settled = false;
          }
        } else {
          // aimless drift, wrapped
          p.x += p.dx * dt;
          p.y += p.dy * dt;
          p.angle += p.spin * dt;
          if (p.x < -4) p.x = w + 4;
          if (p.x > w + 4) p.x = -4;
          if (p.y < -4) p.y = h + 4;
          if (p.y > h + 4) p.y = -4;
          settled = false;
        }
        const len = p.onPath && done ? 3.4 : 2.8;
        const alpha = done ? (p.onPath ? 0.95 : 0.28) : 0.4;
        ctx.strokeStyle = done && p.onPath ? ink.fg : ink.muted;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(
          p.x - Math.cos(p.angle) * len,
          p.y - Math.sin(p.angle) * len
        );
        ctx.lineTo(
          p.x + Math.cos(p.angle) * len,
          p.y + Math.sin(p.angle) * len
        );
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      return settled;
    };

    const loop = (t: number) => {
      const dt = Math.min((t - (last || t)) / 1000, 1 / 30);
      last = t;
      const settled = draw(dt, t);
      if (settled || (reduced.current && phaseRef.current !== "done")) {
        running = false;
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    const wake = () => {
      if (!running) {
        running = true;
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    // reduced motion: skip migration entirely — jump to the final frame
    const snapToFinal = () => {
      for (const p of particles) {
        p.x = p.tx;
        p.y = p.ty;
        p.angle = p.tAngle;
        p.vx = p.vy = 0;
        p.delay = 0;
      }
      confirmAt.current = -Infinity;
      draw(0, performance.now());
    };

    const api = {
      confirm: () => {
        assignTargets();
        if (reduced.current) snapToFinal();
        else wake();
      },
      replay: () => {
        // burst outward, then re-align — the celebration replays
        for (const p of particles) {
          p.vx += (p.seed - 0.5) * 1600;
          p.vy += (((p.seed * 7919) % 1) - 0.5) * 1600;
        }
        assignTargets();
        if (reduced.current) snapToFinal();
        else wake();
      },
    };
    (
      field as HTMLDivElement & { __filings?: typeof api }
    ).__filings = api;

    const ro = new ResizeObserver(resize);
    ro.observe(field);
    resize();

    const themeObserver = new MutationObserver(() => {
      readInk();
      wake();
      if (reduced.current) draw(0, performance.now());
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    const onVis = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        running = false;
      } else wake();
    };
    document.addEventListener("visibilitychange", onVis);
    if (!reduced.current) wake();
    else draw(0, performance.now());

    return () => {
      ro.disconnect();
      themeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      cancelAnimationFrame(raf);
      delete (field as HTMLDivElement & { __filings?: typeof api })
        .__filings;
    };
  }, []);

  const act = (fn: "confirm" | "replay") => {
    (
      fieldRef.current as
        | (HTMLDivElement & {
            __filings?: { confirm: () => void; replay: () => void };
          })
        | null
    )?.__filings?.[fn]();
  };

  const onClick = () => {
    if (phase === "pending") return;
    if (phase === "done") {
      act("replay");
      return;
    }
    setPhase("pending");
    window.setTimeout(() => {
      setPhase("done");
      act("confirm");
    }, 350);
  };

  return (
    <div
      className={`relative overflow-hidden rounded-md border border-border bg-background ${className}`}
    >
      {/* the field */}
      <div ref={fieldRef} className="relative h-64 w-full">
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
        />
        <div
          aria-live="polite"
          className="absolute inset-x-0 bottom-4 text-center"
        >
          {phase === "done" && (
            <p
              data-filings-done=""
              className="font-mono text-xs uppercase tracking-[0.2em] text-foreground"
            >
              Payment confirmed
            </p>
          )}
          {phase === "pending" && (
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
              Processing
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border px-5 py-4">
        <div
          className={`transition-opacity duration-300 ${phase === "done" ? "opacity-40" : ""}`}
        >
          <p className="text-sm font-medium text-foreground">Order #1284</p>
          <p className="font-mono text-xs text-ns-muted">3 items · $148.00</p>
        </div>
        <button
          type="button"
          onClick={onClick}
          disabled={phase === "pending"}
          className="rounded-sm bg-ns-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ns-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent disabled:opacity-60 disabled:pointer-events-none"
        >
          {phase === "done"
            ? "Replay"
            : phase === "pending"
              ? "Processing…"
              : "Confirm payment"}
        </button>
      </div>
    </div>
  );
}
