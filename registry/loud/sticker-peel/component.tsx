"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

// ---------------------------------------------------------------------------
// DecalPeel — a vinyl sticker you can actually peel. The printed face is pure
// CSS/inline-SVG (accent-colored base, dark bolt monogram, halftone print
// dots, kiss-cut pale border); no image assets. Peeling is the classic CSS 3D
// two-layer trick: a perspective parent holds (1) the front face clipped by a
// clip-path polygon to the still-stuck region and (2) an adhesive-pale
// underside flap clipped to the inverse region and folded over the moving
// fold line with a 2D reflection matrix plus a rotate3d lift about the fold
// axis — the lift angle (the "curl radius") tightens as peel progress grows,
// and a specular sheen band sweeps the flap while any peel is in progress.
//
// Geometry (corner-local frame, peel corner mapped to (S,S)): peel progress
// p in [0,1] places the fold line at u = x + y = c where c = 2S(1-p). Front
// keeps u <= c; the flap is the u >= c region clipped in its own untransformed
// coordinates and then reflected across the fold line via
// matrix(0,-1,-1,0,c,c) (generalized per corner with sign flips), so the
// peeled-back copy folds exactly over the fold. rotate3d about the fold-line
// axis with transform-origin at the fold midpoint lifts the flap tip toward
// the viewer under the parent's perspective.
//
// Interaction: pointerdown grabs the nearest corner; drag distance from that
// corner sets progress; recent drag velocity tilts the whole decal
// (rotateY/rotateZ) with decay. Release below 0.7 re-sticks on an
// underdamped spring that overshoots below zero once (a slappy single flap,
// sold as a small squash pulse). Release at/after 0.7 (or a completed
// Space-hold ramp) tears the decal free: a rAF flutter phase rocks it under
// decaying oscillation while it drifts to the drop point, then a resettle
// phase blooms the drop shadow and flattens it back to fully stuck at the
// new position. Every continuous per-frame number lives in refs/locals and is
// written straight to element styles — React state only carries discrete
// facts (grab cursor, live-region text).
//
// Reduced motion: drag/hold still track progress directly (the interaction
// works), but every release lands instantly at its resolved state — no
// spring, no flutter, no sheen sweep, no velocity tilt.
// ---------------------------------------------------------------------------

export interface DecalPeelProps {
  /**
   * Self-driving mode for gallery screenshots: an internal script peels to
   * ~40% (re-stick), then ~90% (tear + flutter + resettle) on a loop, using
   * the same progress/release code paths as real input, and pauses itself
   * whenever a real pointer or keyboard interaction is active.
   */
  demo?: boolean;
  /** extra classes merged onto the rendered root element */
  className?: string;
  /** accessible name for the sticker */
  "aria-label"?: string;
}

type Phase = "stuck" | "peeling" | "restick" | "flutter" | "resettle";

interface Corner {
  kx: 0 | 1;
  ky: 0 | 1;
}

interface Engine {
  pointerDown(x: number, y: number, id: number): void;
  pointerMove(x: number, y: number, id: number): void;
  pointerUp(x: number, y: number, id: number): void;
  holdStart(): void;
  holdEnd(): void;
  autoPeel(target: number, rampMs: number): boolean;
  userActive(): boolean;
}

const S = 220; // decal size px
const TEAR = 0.7; // release at/after this progress tears free
const HOLD_RAMP_S = 1.2; // Space-hold reaches 1.0 over this long
const DRAG_NORM = S * 1.2; // drag px that maps to progress 1
const FLUTTER_S = 0.85;
const RESETTLE_S = 0.38;
const MAX_OFF = 44; // clamp for drop offsets inside the 320px root

const SCRIPT_DROPS = [
  { x: 34, y: 26 },
  { x: -30, y: 16 },
  { x: 0, y: 0 },
] as const;

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

function poly(pts: [number, number][]): string {
  return `polygon(${pts
    .map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`)
    .join(", ")})`;
}

export function DecalPeel({
  demo = false,
  className = "",
  "aria-label": ariaLabel = "Peel sticker — drag a corner, or press and hold Space",
}: DecalPeelProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const shadowRef = useRef<HTMLDivElement | null>(null);
  const frontRef = useRef<HTMLDivElement | null>(null);
  const castRef = useRef<HTMLDivElement | null>(null);
  const flapRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<Engine | null>(null);

  const parityRef = useRef(false);
  const [announceText, setAnnounceText] = useState("");
  const [grabbing, setGrabbing] = useState(false);

  // Zero-width-space parity toggle: repeated identical messages still change
  // the text node, which is what actually re-triggers an aria-live read.
  const announce = useCallback((msg: string) => {
    parityRef.current = !parityRef.current;
    setAnnounceText(msg + (parityRef.current ? "​" : ""));
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const wrap = wrapRef.current;
    const shadow = shadowRef.current;
    const front = frontRef.current;
    const cast = castRef.current;
    const flap = flapRef.current;
    if (!root || !wrap || !shadow || !front || !cast || !flap) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = mq.matches;
    const onMq = () => {
      reduced = mq.matches;
    };
    mq.addEventListener("change", onMq);

    // -- hot-path state: locals only, never React state ---------------------
    let phase: Phase = "stuck";
    let progress = 0;
    let corner: Corner = { kx: 1, ky: 1 };
    let homeX = 0; // decal center offset from root center; persists after tear
    let homeY = 0;
    let raf = 0;
    let last = 0;
    let peelClass = false;

    let drag: {
      id: number;
      px: number;
      py: number;
      cx: number;
      cy: number;
    } | null = null;
    let velX = 0;
    let velY = 0;
    let lastMoveT = 0;
    let tiltY = 0;
    let tiltZ = 0;

    let hold = false;
    let script: { target: number; rate: number; releaseAt: number } | null =
      null;
    let scriptDrop = 0;

    let restick: { q: number; v: number; silent: boolean } | null = null;
    let squash = 1;
    let flut: {
      t: number;
      sx: number;
      sy: number;
      tx: number;
      ty: number;
      p0: number;
      silent: boolean;
    } | null = null;
    let fx = 0;
    let fy = 0;
    let flutRot = 0;
    let resettleT = -1;
    let resettleSilent = false;
    let shadowBloom = 0;

    const timeouts = new Set<number>();
    const later = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        timeouts.delete(id);
        fn();
      }, ms);
      timeouts.add(id);
    };

    const applyCornerStyle = () => {
      const { kx, ky } = corner;
      // underside shading: darker at the fold, palest at the flap tip corner
      const angle = kx ? (ky ? 135 : 45) : ky ? 225 : 315;
      flap.style.setProperty("--dp-flap-angle", `${angle}deg`);
    };

    // -- renderers ----------------------------------------------------------
    const renderPeel = (pRaw: number) => {
      const p = clamp(pRaw, 0, 1);
      const { kx, ky } = corner;
      const mapPt = (x: number, y: number): [number, number] => [
        kx ? x : S - x,
        ky ? y : S - y,
      ];
      const wantClass = p > 0.01;
      if (wantClass !== peelClass) {
        peelClass = wantClass;
        wrap.classList.toggle("ns-dp-peeling", wantClass);
      }
      if (p <= 0.004) {
        front.style.clipPath = "";
        cast.style.backgroundImage = "";
        flap.style.opacity = "0";
        return;
      }
      const c = 2 * S * (1 - p); // fold line: x~ + y~ = c in corner-local frame
      let frontPts: [number, number][];
      let flapPts: [number, number][];
      if (c > S) {
        frontPts = [
          [0, 0],
          [S, 0],
          [S, c - S],
          [c - S, S],
          [0, S],
        ];
        flapPts = [
          [S, c - S],
          [S, S],
          [c - S, S],
        ];
      } else if (c > 0.5) {
        frontPts = [
          [0, 0],
          [c, 0],
          [0, c],
        ];
        flapPts = [
          [c, 0],
          [S, 0],
          [S, S],
          [0, S],
          [0, c],
        ];
      } else {
        frontPts = [
          [0, 0],
          [0.1, 0],
          [0, 0.1],
        ];
        flapPts = [
          [0, 0],
          [S, 0],
          [S, S],
          [0, S],
        ];
      }
      front.style.clipPath = poly(frontPts.map(([x, y]) => mapPt(x, y)));
      flap.style.clipPath = poly(flapPts.map(([x, y]) => mapPt(x, y)));
      flap.style.opacity = "1";
      // reflection across the fold line, generalized from the bottom-right
      // corner via sign flips: x' = m*y + ex*k, y' = m*x + ey*k
      const ex = kx ? 1 : -1;
      const ey = ky ? 1 : -1;
      const ox = kx ? 0 : S;
      const oy = ky ? 0 : S;
      const k = c - ox - oy;
      const m = -ex * ey;
      // curl radius tightens with progress: steeper lift the further you peel
      const lift = ex * ey * (10 + 42 * p);
      const fmx = kx ? c / 2 : S - c / 2;
      const fmy = ky ? c / 2 : S - c / 2;
      flap.style.transformOrigin = `${fmx.toFixed(1)}px ${fmy.toFixed(1)}px`;
      flap.style.transform = `matrix(0, ${m}, ${m}, 0, ${(ex * k).toFixed(2)}, ${(ey * k).toFixed(2)}) rotate3d(${ex}, ${-ey}, 0, ${lift.toFixed(2)}deg)`;
      // cast shadow on the still-stuck face just beyond the fold line
      const ax = kx ? S : 0;
      const ay = ky ? S : 0;
      const r = Math.SQRT2 * S * p;
      cast.style.backgroundImage = `radial-gradient(circle at ${ax}px ${ay}px, rgba(0,0,0,0.36) ${(r * 0.9).toFixed(1)}px, rgba(0,0,0,0) ${(r * 1.3).toFixed(1)}px)`;
    };

    const renderPose = () => {
      wrap.style.transform = `translate3d(${(homeX + fx).toFixed(2)}px, ${(homeY + fy).toFixed(2)}px, 0) rotateY(${tiltY.toFixed(2)}deg) rotateZ(${(tiltZ + flutRot).toFixed(2)}deg) scale(${squash.toFixed(3)})`;
    };

    const renderShadow = () => {
      const p = clamp(progress, 0, 1);
      let dy = 10 + p * 12;
      let blur = 24 + p * 26;
      let a = 0.38 - p * 0.06;
      if (flut) {
        dy = 28;
        blur = 52;
        a = 0.24;
      }
      blur += 30 * shadowBloom;
      a += 0.12 * shadowBloom;
      shadow.style.boxShadow = `0 ${dy.toFixed(1)}px ${blur.toFixed(1)}px rgba(0,0,0,${a.toFixed(3)})`;
    };

    // -- release outcomes ---------------------------------------------------
    const doRestick = (silent: boolean) => {
      script = null;
      phase = "restick";
      if (reduced) {
        progress = 0;
        phase = "stuck";
        renderPeel(0);
        renderPose();
        renderShadow();
        if (!silent) announce("Re-stuck");
        return;
      }
      restick = { q: progress, v: 0, silent };
      wake();
    };

    const tear = (drop: { x: number; y: number }, silent: boolean) => {
      script = null;
      const tx = clamp(drop.x, -MAX_OFF, MAX_OFF);
      const ty = clamp(drop.y, -MAX_OFF, MAX_OFF);
      if (!silent) announce("Torn free");
      if (reduced) {
        homeX = tx;
        homeY = ty;
        progress = 0;
        fx = 0;
        fy = 0;
        flutRot = 0;
        phase = "stuck";
        renderPeel(0);
        renderPose();
        renderShadow();
        if (!silent) later(() => announce("Re-adhered"), 350);
        return;
      }
      phase = "flutter";
      flut = {
        t: 0,
        sx: homeX,
        sy: homeY,
        tx,
        ty,
        p0: clamp(progress, 0, 1),
        silent,
      };
      wake();
    };

    // -- rAF loop -----------------------------------------------------------
    const loop = (now: number) => {
      raf = 0;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      let active = false;

      if (drag) {
        const dist = Math.hypot(drag.px - drag.cx, drag.py - drag.cy);
        progress = clamp(dist / DRAG_NORM, 0, 1);
        velX *= Math.exp(-5 * dt);
        velY *= Math.exp(-5 * dt);
        active = true;
      }
      if (hold) {
        progress = clamp(progress + dt / HOLD_RAMP_S, 0, 1);
        if (progress >= 1) {
          // natural completion of the hold ramp: same tear path as a release
          hold = false;
          setGrabbing(false);
          tear({ x: homeX + 8, y: homeY + 30 }, false);
        }
        active = true;
      }
      if (script) {
        progress = reduced
          ? script.target
          : Math.min(script.target, progress + script.rate * dt);
        if (progress >= script.target - 1e-4) {
          if (script.releaseAt === 0) {
            // brief apex hold so the pose is legible before release
            script.releaseAt = now + (reduced ? 600 : 150);
          } else if (now >= script.releaseAt) {
            const t = script.target;
            script = null;
            if (t >= TEAR) {
              const d = SCRIPT_DROPS[scriptDrop % SCRIPT_DROPS.length]!;
              scriptDrop += 1;
              tear({ x: d.x, y: d.y }, true);
            } else {
              doRestick(true);
            }
          }
        }
        active = true;
      }

      // velocity tilt, decaying back to level when the pointer rests
      if (!reduced) {
        const peeling = drag || hold || script;
        const peelTilt = peeling
          ? -4 * clamp(progress, 0, 1) * (corner.kx ? 1 : -1)
          : 0;
        const tyT = clamp(velX * 0.018, -12, 12) + peelTilt;
        const tzT = clamp(velX * 0.008 - velY * 0.008, -8, 8);
        tiltY += (tyT - tiltY) * Math.min(1, dt * 9);
        tiltZ += (tzT - tiltZ) * Math.min(1, dt * 9);
        if (Math.abs(tiltY) > 0.03 || Math.abs(tiltZ) > 0.03) active = true;
      } else {
        tiltY = 0;
        tiltZ = 0;
      }

      if (restick) {
        // underdamped spring: one overshoot below zero = the corner flapping
        // once as the adhesive slaps back down
        const K = 210;
        const Z = 0.42;
        const cDamp = 2 * Z * Math.sqrt(K);
        restick.v += (-K * restick.q - cDamp * restick.v) * dt;
        restick.q += restick.v * dt;
        progress = Math.max(0, restick.q);
        squash = restick.q < 0 ? 1 + Math.min(0.05, -restick.q * 0.35) : 1;
        if (Math.abs(restick.q) < 0.004 && Math.abs(restick.v) < 0.03) {
          const silent = restick.silent;
          restick = null;
          squash = 1;
          progress = 0;
          phase = "stuck";
          if (!silent) announce("Re-stuck");
        } else {
          active = true;
        }
      }

      if (flut) {
        flut.t += dt;
        const u = clamp(flut.t / FLUTTER_S, 0, 1);
        const e = easeOutCubic(u); // fast detach, air-resistance deceleration
        fx = (flut.tx - flut.sx) * e + Math.sin(flut.t * 9) * 9 * (1 - u);
        fy = (flut.ty - flut.sy) * e;
        flutRot = 16 * Math.exp(-2.2 * flut.t) * Math.sin(flut.t * 9.5);
        progress = flut.p0 * (1 - e); // the sticker flattens as it falls
        if (u >= 1) {
          homeX = flut.tx;
          homeY = flut.ty;
          const silent = flut.silent;
          flut = null;
          fx = 0;
          fy = 0;
          flutRot = 0;
          progress = 0;
          phase = "resettle";
          resettleT = 0;
          resettleSilent = silent;
        }
        active = true;
      }

      if (resettleT >= 0) {
        resettleT += dt;
        const s = clamp(resettleT / RESETTLE_S, 0, 1);
        shadowBloom = Math.sin(Math.PI * s); // bloom, then flatten
        squash = 1 + 0.045 * Math.sin(Math.PI * s);
        if (s >= 1) {
          resettleT = -1;
          shadowBloom = 0;
          squash = 1;
          phase = "stuck";
          if (!resettleSilent) announce("Re-adhered");
        }
        active = true;
      }

      renderPeel(progress);
      renderPose();
      renderShadow();
      if (active) raf = requestAnimationFrame(loop);
      else last = 0;
    };

    const wake = () => {
      if (!raf) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    const rootCenter = () => {
      const r = root.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };

    // -- public api ---------------------------------------------------------
    const api: Engine = {
      pointerDown(x, y, id) {
        if (phase === "flutter" || phase === "resettle") return;
        script = null;
        restick = null;
        squash = 1;
        const c0 = rootCenter();
        const cx0 = c0.x + homeX;
        const cy0 = c0.y + homeY;
        corner = { kx: x >= cx0 ? 1 : 0, ky: y >= cy0 ? 1 : 0 };
        applyCornerStyle();
        drag = {
          id,
          px: x,
          py: y,
          cx: cx0 + (corner.kx ? S / 2 : -S / 2),
          cy: cy0 + (corner.ky ? S / 2 : -S / 2),
        };
        velX = 0;
        velY = 0;
        lastMoveT = performance.now();
        hold = false;
        phase = "peeling";
        setGrabbing(true);
        announce("Peeling");
        wake();
      },
      pointerMove(x, y, id) {
        if (!drag || drag.id !== id) return;
        const now = performance.now();
        const dtm = Math.max(1, now - lastMoveT) / 1000;
        velX += ((x - drag.px) / dtm - velX) * 0.4;
        velY += ((y - drag.py) / dtm - velY) * 0.4;
        lastMoveT = now;
        drag.px = x;
        drag.py = y;
        wake();
      },
      pointerUp(x, y, id) {
        if (!drag || drag.id !== id) return;
        drag = null;
        setGrabbing(false);
        if (progress >= TEAR) {
          const c0 = rootCenter();
          tear({ x: x - c0.x, y: y - c0.y }, false); // re-adheres where dropped
        } else {
          doRestick(false);
        }
        wake();
      },
      holdStart() {
        if (hold || drag) return;
        if (phase === "flutter" || phase === "resettle") return;
        script = null;
        restick = null;
        squash = 1;
        corner = { kx: 1, ky: 1 };
        applyCornerStyle();
        hold = true;
        phase = "peeling";
        setGrabbing(true);
        announce("Peeling");
        wake();
      },
      holdEnd() {
        if (!hold) return;
        hold = false;
        setGrabbing(false);
        if (progress >= TEAR) tear({ x: homeX + 8, y: homeY + 30 }, false);
        else doRestick(false);
      },
      autoPeel(target, rampMs) {
        if (drag || hold) return false;
        if (phase !== "stuck") return false;
        corner = { kx: 1, ky: 1 };
        applyCornerStyle();
        phase = "peeling";
        script = { target, rate: target / (rampMs / 1000), releaseAt: 0 };
        wake();
        return true;
      },
      userActive: () => Boolean(drag || hold),
    };
    engineRef.current = api;

    const onVis = () => {
      if (!document.hidden) wake();
    };
    document.addEventListener("visibilitychange", onVis);

    applyCornerStyle();
    renderPeel(0);
    renderPose();
    renderShadow();

    return () => {
      cancelAnimationFrame(raf);
      mq.removeEventListener("change", onMq);
      document.removeEventListener("visibilitychange", onVis);
      timeouts.forEach((id) => window.clearTimeout(id));
      timeouts.clear();
      engineRef.current = null;
    };
  }, [announce]);

  // Self-driving demo script: same code paths as real input, guarded so it
  // pauses while any real pointer/keyboard interaction is in progress.
  useEffect(() => {
    if (!demo) return;
    let alive = true;
    let timer: number | undefined;
    const STEPS = [
      { target: 0.42, ramp: 800, wait: 2400 }, // partial peel -> spring re-stick
      { target: 0.92, ramp: 900, wait: 3400 }, // past threshold -> tear + flutter
    ];
    let i = 0;
    const tick = () => {
      if (!alive) return;
      const eng = engineRef.current;
      const step = STEPS[i % STEPS.length]!;
      if (eng && !eng.userActive() && eng.autoPeel(step.target, step.ramp)) {
        i += 1;
        timer = window.setTimeout(tick, step.ramp + step.wait);
      } else {
        timer = window.setTimeout(tick, 900);
      }
    };
    timer = window.setTimeout(tick, 1000);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [demo]);

  return (
    <div
      ref={rootRef}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      className={`ns-dp-root ${grabbing ? "ns-dp-grabbing" : ""} ${className}`}
      onPointerDown={(e: ReactPointerEvent<HTMLDivElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        engineRef.current?.pointerDown(e.clientX, e.clientY, e.pointerId);
      }}
      onPointerMove={(e: ReactPointerEvent<HTMLDivElement>) =>
        engineRef.current?.pointerMove(e.clientX, e.clientY, e.pointerId)
      }
      onPointerUp={(e: ReactPointerEvent<HTMLDivElement>) =>
        engineRef.current?.pointerUp(e.clientX, e.clientY, e.pointerId)
      }
      onPointerCancel={(e: ReactPointerEvent<HTMLDivElement>) =>
        engineRef.current?.pointerUp(e.clientX, e.clientY, e.pointerId)
      }
      onKeyDown={(e: ReactKeyboardEvent<HTMLDivElement>) => {
        if (e.key === " " || e.code === "Space") {
          e.preventDefault();
          if (!e.repeat) engineRef.current?.holdStart();
        }
      }}
      onKeyUp={(e: ReactKeyboardEvent<HTMLDivElement>) => {
        if (e.key === " " || e.code === "Space") {
          e.preventDefault();
          engineRef.current?.holdEnd();
        }
      }}
      onBlur={() => engineRef.current?.holdEnd()}
    >
      <style>{CSS}</style>
      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announceText}
      </span>

      <div ref={wrapRef} className="ns-dp-wrap" aria-hidden="true">
        <div ref={shadowRef} className="ns-dp-shadow" />
        <div ref={frontRef} className="ns-dp-front">
          <div className="ns-dp-gloss" />
          <div className="ns-dp-dots" />
          <div className="ns-dp-art">
            <svg
              width="110"
              height="110"
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M13 2 L4 14 H11 L10 22 L20 9 H12.5 Z"
                fill="var(--background)"
                fillOpacity="0.92"
                stroke="rgba(0,0,0,0.25)"
                strokeWidth="0.4"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div ref={castRef} className="ns-dp-cast" />
        </div>
        <div ref={flapRef} className="ns-dp-flap">
          <div className="ns-dp-sheen" />
        </div>
      </div>
    </div>
  );
}

const CSS = `
.ns-dp-root{
  position:relative;
  width:320px;height:320px;
  display:flex;align-items:center;justify-content:center;
  border-radius:16px;
  border:1px solid var(--border);
  background:color-mix(in srgb, var(--foreground) 3%, var(--background));
  box-shadow:0 6px 20px rgba(0,0,0,0.25);
  cursor:grab;
  touch-action:none;
  user-select:none;
  -webkit-user-select:none;
  perspective:900px;
  overflow:hidden;
  transition:border-color .18s ease, box-shadow .18s ease, transform .18s cubic-bezier(0.16,1,0.3,1);
}
.ns-dp-root:hover{
  transform:translateY(-3px);
  border-color:color-mix(in srgb, var(--foreground) 30%, var(--border));
  box-shadow:0 18px 44px rgba(0,0,0,0.5);
}
.ns-dp-root:focus-visible{outline:2px solid var(--ns-accent);outline-offset:4px;}
.ns-dp-root.ns-dp-grabbing{cursor:grabbing;}
.ns-dp-wrap{
  position:relative;width:220px;height:220px;
  transform-style:preserve-3d;
  pointer-events:none;
  will-change:transform;
}
.ns-dp-shadow{position:absolute;inset:8px;border-radius:16px;}
.ns-dp-front{
  position:absolute;inset:0;border-radius:16px;
  background:var(--ns-accent);
  border:7px solid color-mix(in srgb, var(--foreground) 90%, var(--background));
  will-change:clip-path;
}
.ns-dp-gloss{
  position:absolute;inset:0;border-radius:9px;
  background:linear-gradient(120deg, rgba(255,255,255,0.30), rgba(255,255,255,0.06) 40%, rgba(255,255,255,0) 60%);
}
.ns-dp-dots{
  position:absolute;inset:0;border-radius:9px;
  background-image:radial-gradient(circle, rgba(0,0,0,0.32) 1px, rgba(0,0,0,0) 1.5px);
  background-size:7px 7px;
  opacity:0.35;
}
.ns-dp-art{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;}
.ns-dp-cast{position:absolute;inset:-7px;border-radius:16px;pointer-events:none;}
.ns-dp-flap{
  position:absolute;inset:0;border-radius:16px;opacity:0;
  background:linear-gradient(var(--dp-flap-angle,135deg),
    color-mix(in srgb, white 25%, var(--ns-accent)) 0%,
    color-mix(in srgb, white 55%, var(--ns-accent)) 55%,
    color-mix(in srgb, var(--background) 90%, var(--foreground)) 100%);
  box-shadow:inset 0 0 14px rgba(0,0,0,0.18);
  will-change:transform,clip-path;
}
.ns-dp-sheen{
  position:absolute;inset:0;border-radius:16px;opacity:0.85;
  background:linear-gradient(115deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.55) 45%, rgba(255,255,255,0.10) 53%, rgba(255,255,255,0) 64%);
  background-size:240% 240%;
  background-position:130% 130%;
}
.ns-dp-peeling .ns-dp-sheen{animation:ns-dp-sweep 1.7s linear infinite;}
@keyframes ns-dp-sweep{
  from{background-position:130% 130%;}
  to{background-position:-40% -40%;}
}
@media (prefers-reduced-motion: reduce){
  .ns-dp-root{transition:none;}
  .ns-dp-root:hover{transform:none;}
  .ns-dp-peeling .ns-dp-sheen{animation:none;}
}
`;
