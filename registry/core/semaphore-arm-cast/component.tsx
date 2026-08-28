"use client";

import { useEffect, useId, useRef } from "react";

// ---------------------------------------------------------------------------
// SemaphoreArmCast — the Chappe optical telegraph, France 1794: a mast
// carries a horizontal regulator bar with a pivoting indicator arm at each
// end, each arm swinging to one of 8 positions (45deg increments). The
// two-arm angle pair is the symbol; a relay tower held one pair at a time,
// legible from the next tower down the line, then swung to the next.
//
// A single rAF loop drives a two-phase clock: SWING (arm 1 starts moving
// immediately, arm 2 starts 150ms later, each takes 550ms of eased travel)
// then DWELL (1.6s fully settled) before the next symbol begins. Both arm
// angles are computed directly from phase-elapsed time every frame — never
// a CSS transition kicked off by a timer — so pausing on IntersectionObserver
// or document visibility simply stops time from accumulating and resuming
// picks the swing back up exactly where it left off, with no re-trigger.
//
// The mast and regulator bar are the fixed frame; only the two arms move,
// so "which two lines just rotated" stays unambiguous from "what never
// moves at all" — the one thing a viewer needs to follow at a glance.
// ---------------------------------------------------------------------------

export interface SemaphoreArmCastProps {
  className?: string;
  style?: React.CSSProperties;
}

// 8 discrete positions per arm, 0/45/.../315deg, 0 = pointing straight up
// from its pivot, positive = clockwise.
type Angle = 0 | 45 | 90 | 135 | 180 | 225 | 270 | 315;

// 9-symbol loop. Index 3 is the fixed reduced-motion freeze frame: a wide,
// asymmetric spread (135/270) chosen because several of the others place
// both arms near-vertical, which reads as "off" rather than as a held
// signal. The rest are picked to keep consecutive pairs visually distinct.
const SYMBOLS: ReadonlyArray<readonly [Angle, Angle]> = [
  [0, 180],
  [45, 225],
  [90, 270],
  [135, 270], // reduced-motion freeze frame
  [225, 45],
  [315, 135],
  [180, 0],
  [90, 45],
  [270, 315],
];

const FREEZE_SYMBOL_INDEX = 3;

const SWING_MS = 550;
const STAGGER_MS = 150;
const SWING_PHASE_MS = STAGGER_MS + SWING_MS; // 700ms: arm2 is the last to settle
const DWELL_MS = 1600;

// shortest signed angular delta, so a swing always travels the short way
// around the 8 positions rather than occasionally spinning the long way.
function shortestDelta(from: number, to: number) {
  return (((to - from + 540) % 360) + 360) % 360 - 180;
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function SemaphoreArmCast({ className = "", style }: SemaphoreArmCastProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const mastRef = useRef<SVGLineElement | null>(null);
  const barRef = useRef<SVGLineElement | null>(null);
  const pivotLeftRef = useRef<SVGCircleElement | null>(null);
  const pivotRightRef = useRef<SVGCircleElement | null>(null);
  const arm1Ref = useRef<SVGGElement | null>(null);
  const arm2Ref = useRef<SVGGElement | null>(null);
  const uid = useId();

  useEffect(() => {
    const wrap = wrapRef.current;
    const svg = svgRef.current;
    const mast = mastRef.current;
    const bar = barRef.current;
    const pivotLeft = pivotLeftRef.current;
    const pivotRight = pivotRightRef.current;
    const arm1 = arm1Ref.current;
    const arm2 = arm2Ref.current;
    if (!wrap || !svg || !mast || !bar || !pivotLeft || !pivotRight || !arm1 || !arm2) return;

    let disposed = false;
    let raf = 0;
    let running = false;
    let staticMode = false;

    let w = 0;
    let h = 0;
    let size = 0; // min(w, h)
    let cx = 0;
    let cy = 0;
    let mastHeight = 0;
    let armLength = 0;
    let mastTopY = 0;
    let barY = 0;
    let pivotOffset = 0;

    // ---- geometry, derived from the container's smaller dimension --------
    const applySize = () => {
      const rect = wrap.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      w = rect.width;
      h = rect.height;
      size = Math.min(w, h);
      cx = w / 2;
      cy = h / 2;
      mastHeight = size * 0.8;
      armLength = size * 0.28;
      mastTopY = cy - mastHeight / 2;
      barY = mastTopY + mastHeight * 0.14;
      pivotOffset = armLength * 0.9;

      svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
      svg.setAttribute("width", String(w));
      svg.setAttribute("height", String(h));

      const mastStroke = Math.max(1.25, size * 0.01);
      const armStroke = mastStroke * 1.8;
      const pivotR = Math.max(1.5, armStroke * 0.85);

      mast.setAttribute("x1", String(cx));
      mast.setAttribute("y1", String(mastTopY));
      mast.setAttribute("x2", String(cx));
      mast.setAttribute("y2", String(cy + mastHeight / 2));
      mast.setAttribute("stroke-width", String(mastStroke));

      bar.setAttribute("x1", String(cx - pivotOffset));
      bar.setAttribute("y1", String(barY));
      bar.setAttribute("x2", String(cx + pivotOffset));
      bar.setAttribute("y2", String(barY));
      bar.setAttribute("stroke-width", String(mastStroke));

      pivotLeft.setAttribute("cx", String(cx - pivotOffset));
      pivotLeft.setAttribute("cy", String(barY));
      pivotLeft.setAttribute("r", String(pivotR));
      pivotRight.setAttribute("cx", String(cx + pivotOffset));
      pivotRight.setAttribute("cy", String(barY));
      pivotRight.setAttribute("r", String(pivotR));

      const armLine1 = arm1.firstElementChild as SVGLineElement | null;
      const armLine2 = arm2.firstElementChild as SVGLineElement | null;
      const px1 = cx - pivotOffset;
      const px2 = cx + pivotOffset;
      if (armLine1) {
        armLine1.setAttribute("x1", String(px1));
        armLine1.setAttribute("y1", String(barY));
        armLine1.setAttribute("x2", String(px1));
        armLine1.setAttribute("y2", String(barY - armLength));
        armLine1.setAttribute("stroke-width", String(armStroke));
      }
      if (armLine2) {
        armLine2.setAttribute("x1", String(px2));
        armLine2.setAttribute("y1", String(barY));
        armLine2.setAttribute("x2", String(px2));
        armLine2.setAttribute("y2", String(barY - armLength));
        armLine2.setAttribute("stroke-width", String(armStroke));
      }
      arm1.dataset.px = String(px1);
      arm1.dataset.py = String(barY);
      arm2.dataset.px = String(px2);
      arm2.dataset.py = String(barY);

      applyArmTransform(arm1, currentAngle1);
      applyArmTransform(arm2, currentAngle2);
    };

    const applyArmTransform = (g: SVGGElement, angle: number) => {
      const px = g.dataset.px ?? "0";
      const py = g.dataset.py ?? "0";
      g.setAttribute("transform", `rotate(${angle} ${px} ${py})`);
    };

    // ---- symbol sequence state ---------------------------------------------
    let symbolIndex = 0;
    let fromAngle1: number = SYMBOLS[0][0];
    let fromAngle2: number = SYMBOLS[0][1];
    let toAngle1: number = SYMBOLS[0][0];
    let toAngle2: number = SYMBOLS[0][1];
    let currentAngle1: number = SYMBOLS[0][0];
    let currentAngle2: number = SYMBOLS[0][1];
    let phase: "dwell" | "swing" = "dwell";
    let phaseMs = 0;

    const armAngleAt = (from: number, to: number, startOffsetMs: number, elapsedMs: number) => {
      const local = elapsedMs - startOffsetMs;
      if (local <= 0) return from;
      if (local >= SWING_MS) return from + shortestDelta(from, to);
      const t = easeInOutCubic(local / SWING_MS);
      return from + shortestDelta(from, to) * t;
    };

    const drawFrame = () => {
      if (phase === "swing") {
        currentAngle1 = armAngleAt(fromAngle1, toAngle1, 0, phaseMs);
        currentAngle2 = armAngleAt(fromAngle2, toAngle2, STAGGER_MS, phaseMs);
      } else {
        currentAngle1 = toAngle1;
        currentAngle2 = toAngle2;
      }
      applyArmTransform(arm1, currentAngle1);
      applyArmTransform(arm2, currentAngle2);
    };

    const setSymbol = (index: number, immediate: boolean) => {
      symbolIndex = index;
      const [a1, a2] = SYMBOLS[symbolIndex]!;
      if (immediate) {
        fromAngle1 = a1;
        fromAngle2 = a2;
        toAngle1 = a1;
        toAngle2 = a2;
        currentAngle1 = a1;
        currentAngle2 = a2;
        phase = "dwell";
        phaseMs = 0;
        drawFrame();
      } else {
        fromAngle1 = currentAngle1;
        fromAngle2 = currentAngle2;
        toAngle1 = a1;
        toAngle2 = a2;
        phase = "swing";
        phaseMs = 0;
      }
    };

    const drawStaticFrame = () => {
      setSymbol(FREEZE_SYMBOL_INDEX, true);
    };

    // ---- main loop ----------------------------------------------------------
    let lastMs = 0;

    const loop = (nowMs: number) => {
      const dt = Math.min(50, lastMs ? nowMs - lastMs : 16);
      lastMs = nowMs;
      phaseMs += dt;

      if (phase === "swing" && phaseMs >= SWING_PHASE_MS) {
        phase = "dwell";
        phaseMs = 0;
      } else if (phase === "dwell" && phaseMs >= DWELL_MS) {
        const next = (symbolIndex + 1) % SYMBOLS.length;
        setSymbol(next, false);
      }

      drawFrame();
      raf = requestAnimationFrame(loop);
    };

    const wake = () => {
      if (running || disposed) return;
      running = true;
      lastMs = 0;
      raf = requestAnimationFrame(loop);
    };
    const sleep = () => {
      cancelAnimationFrame(raf);
      running = false;
    };

    const applyMode = () => {
      if (reduced || pausedOffscreenOrHidden()) {
        if (reduced) {
          staticMode = true;
          sleep();
          drawStaticFrame();
        } else {
          sleep();
        }
      } else {
        staticMode = false;
        wake();
      }
    };

    let onScreen = true;
    let docVisible = !document.hidden;
    const pausedOffscreenOrHidden = () => !onScreen || !docVisible;

    const ro = new ResizeObserver(applySize);
    ro.observe(wrap);
    applySize();

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = mq.matches;
    const onMq = () => {
      reduced = mq.matches;
      applyMode();
    };
    mq.addEventListener("change", onMq);

    const io = new IntersectionObserver(
      (entries) => {
        onScreen = entries.some((en) => en.isIntersecting);
        applyMode();
      },
      { threshold: 0 }
    );
    io.observe(wrap);

    const onVis = () => {
      docVisible = !document.hidden;
      applyMode();
    };
    document.addEventListener("visibilitychange", onVis);

    applyMode();

    return () => {
      disposed = true;
      ro.disconnect();
      io.disconnect();
      mq.removeEventListener("change", onMq);
      document.removeEventListener("visibilitychange", onVis);
      sleep();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={wrapRef}
      data-semaphore-arm-cast={uid}
      role="img"
      aria-label="Optical telegraph relay, cycling through signal positions"
      className={`relative flex h-full w-full items-center justify-center overflow-hidden bg-background ${className}`}
      style={style}
    >
      <svg ref={svgRef} aria-hidden="true" className="block">
        <line ref={mastRef} stroke="var(--foreground)" strokeLinecap="round" />
        <line ref={barRef} stroke="var(--foreground)" strokeLinecap="round" />
        <g ref={arm1Ref}>
          <line stroke="var(--foreground)" strokeLinecap="round" />
        </g>
        <g ref={arm2Ref}>
          <line stroke="var(--foreground)" strokeLinecap="round" />
        </g>
        <circle ref={pivotLeftRef} fill="var(--foreground)" />
        <circle ref={pivotRightRef} fill="var(--foreground)" />
      </svg>
    </div>
  );
}

SemaphoreArmCast.displayName = "SemaphoreArmCast";
