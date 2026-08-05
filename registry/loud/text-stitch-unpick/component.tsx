"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

// ---------------------------------------------------------------------------
// StitchPick — a headline rendered as running-stitch embroidery that a
// passing cursor (a seam ripper) picks loose, letter by letter. Each glyph is
// two offset, dashed, fill:none SVG <text> strokes (thread texture, subtle
// two-tone shimmer via a second stroke color at low opacity) laid out on a
// monospace grid so per-letter hit zones are trivial index math, no DOM
// measurement of proportional glyph widths.
//
// Per-letter state machine, entirely local to that letter:
//   stitched  -> pointer enters its zone -> picked (thread detaches, dangles
//                on a 4-point verlet chain: gravity + a little sway, driven
//                by a shared rAF loop, direct SVG attribute writes on a path
//                ref — no React state on the physics hot path).
//   picked    -> pointer leaves before the dwell threshold -> stitched again
//                (retracts: the dangling thread fades, the dash redraws).
//             -> dwell threshold elapses while still hovered -> unraveled
//                (thread fully detaches into a static loose pile at the
//                glyph's baseline; physics stops, the pile just sits there).
//   unraveled -> click that letter, or the always-present "Re-sew" button
//                (which resews every unraveled letter at once) -> stitched,
//                dash redraws with a short per-letter delayed stagger so it
//                reads as sewn back in order rather than snapping at once.
//
// A single onPointerMove/onPointerLeave/onClick on the SVG root does the hit
// testing (glyph index = floor(localX / advance)) rather than per-glyph DOM
// listeners. Reduced motion skips the whole state machine: hover just
// brightens that letter's thread stroke opacity, instantly, no dangling,
// no pile.
// ---------------------------------------------------------------------------

type LetterState = "stitched" | "picked" | "unraveled";

export interface StitchPickProps {
  text?: string;
  /** Glyph font size in px. Default 56. */
  size?: number;
  /** Hover dwell before a picked letter fully unravels into a pile, ms. Default 650. */
  dwellMs?: number;
  className?: string;
}

const POINTS = 4;
const GRAVITY = 0.055;
const DAMPING = 0.96;
const SEGMENT = 4.2;
const CONSTRAINT_ITERS = 3;

interface ThreadSim {
  x: number[];
  y: number[];
  px: number[];
  py: number[];
  anchorX: number;
  anchorY: number;
  seed: number;
}

function makeSim(anchorX: number, anchorY: number, seed: number): ThreadSim {
  const x = new Array(POINTS).fill(anchorX);
  const y = new Array(POINTS).fill(anchorY);
  return { x, y, px: [...x], py: [...y], anchorX, anchorY, seed };
}

function stepSim(sim: ThreadSim, t: number) {
  sim.x[0] = sim.anchorX;
  sim.y[0] = sim.anchorY;
  sim.px[0] = sim.anchorX;
  sim.py[0] = sim.anchorY;

  for (let i = 1; i < POINTS; i++) {
    const vx = (sim.x[i] - sim.px[i]) * DAMPING;
    const vy = (sim.y[i] - sim.py[i]) * DAMPING;
    const sway = Math.sin(t * 0.004 + sim.seed + i) * 0.06;
    sim.px[i] = sim.x[i];
    sim.py[i] = sim.y[i];
    sim.x[i] += vx + sway;
    sim.y[i] += vy + GRAVITY;
  }

  for (let iter = 0; iter < CONSTRAINT_ITERS; iter++) {
    for (let i = 1; i < POINTS; i++) {
      const ax = sim.x[i - 1];
      const ay = sim.y[i - 1];
      const dx = sim.x[i] - ax;
      const dy = sim.y[i] - ay;
      const dist = Math.hypot(dx, dy) || 0.0001;
      const diff = (dist - SEGMENT) / dist;
      if (i === 1) {
        sim.x[i] -= dx * diff;
        sim.y[i] -= dy * diff;
      } else {
        sim.x[i] -= dx * diff * 0.5;
        sim.y[i] -= dy * diff * 0.5;
        sim.x[i - 1] += dx * diff * 0.5;
        sim.y[i - 1] += dy * diff * 0.5;
      }
    }
  }
}

function pathFor(sim: ThreadSim): string {
  let d = `M ${sim.x[0].toFixed(1)} ${sim.y[0].toFixed(1)}`;
  for (let i = 1; i < POINTS; i++) d += ` L ${sim.x[i].toFixed(1)} ${sim.y[i].toFixed(1)}`;
  return d;
}

export function StitchPick({ text = "UNRAVEL", size = 56, dwellMs = 650, className = "" }: StitchPickProps) {
  const glyphs = useMemo(() => Array.from(text), [text]);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const measureRef = useRef<SVGTextElement | null>(null);
  const threadPathRefs = useRef<(SVGPathElement | null)[]>([]);
  const reducedRef = useRef(false);

  const [advance, setAdvance] = useState(size * 0.62);
  const [states, setStates] = useState<LetterState[]>(() => glyphs.map(() => "stitched"));
  const statesRef = useRef(states);
  statesRef.current = states;

  const [brightIndex, setBrightIndex] = useState(-1);
  const hoveredRef = useRef(-1);
  const dwellTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const sims = useRef<Record<number, ThreadSim>>({});
  // Indices currently animating, tracked independently of `states` — the rAF
  // loop reads this ref directly instead of deriving liveness from
  // statesRef, since a pointermove-triggered setState is not guaranteed to
  // flush before the next animation frame runs.
  const activeRef = useRef<Set<number>>(new Set());
  const rafRef = useRef<number | undefined>(undefined);

  const fontSize = size;
  const height = fontSize * 1.7;
  const baseline = fontSize * 1.05;
  const width = Math.max(1, glyphs.length) * advance;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    const onChange = () => {
      reducedRef.current = mq.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const measure = useCallback(() => {
    const el = measureRef.current;
    if (!el) return;
    const len = el.getComputedTextLength();
    if (len > 0) setAdvance(len);
  }, []);

  useEffect(() => {
    measure();
    if (typeof document !== "undefined" && "fonts" in document) {
      document.fonts.ready.then(measure).catch(() => {});
    }
  }, [measure, size]);

  const runLoop = useCallback(() => {
    const loop = (t: number) => {
      for (const i of activeRef.current) {
        const sim = sims.current[i];
        if (!sim) continue;
        stepSim(sim, t);
        const el = threadPathRefs.current[i];
        if (el) el.setAttribute("d", pathFor(sim));
      }
      if (activeRef.current.size > 0) {
        rafRef.current = requestAnimationFrame(loop);
      } else {
        rafRef.current = undefined;
      }
    };
    if (rafRef.current === undefined) {
      rafRef.current = requestAnimationFrame(loop);
    }
  }, []);

  useEffect(
    () => () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
      Object.values(dwellTimers.current).forEach((id) => clearTimeout(id));
    },
    []
  );

  // Reset per-letter state when the headline text itself changes — states
  // is a fixed-length array seeded once from the initial glyph count, so a
  // later prop change would otherwise leave extra/changed glyphs stuck with
  // no state entry (invisible, inert to hover).
  const lastTextRef = useRef(text);
  useEffect(() => {
    if (lastTextRef.current === text) return;
    lastTextRef.current = text;
    Object.values(dwellTimers.current).forEach((id) => clearTimeout(id));
    dwellTimers.current = {};
    sims.current = {};
    activeRef.current.clear();
    hoveredRef.current = -1;
    setStates(glyphs.map(() => "stitched"));
  }, [text, glyphs]);

  const setLetterState = useCallback((i: number, next: LetterState) => {
    setStates((prev) => {
      if (prev[i] === next) return prev;
      const copy = prev.slice();
      copy[i] = next;
      return copy;
    });
  }, []);

  const enterLetter = useCallback(
    (i: number) => {
      if (i < 0 || i >= glyphs.length || glyphs[i] === " ") return;
      if (statesRef.current[i] !== "stitched") return;
      const anchorX = i * advance + advance / 2;
      const anchorY = baseline + 2;
      sims.current[i] = makeSim(anchorX, anchorY, i * 1.37);
      activeRef.current.add(i);
      setLetterState(i, "picked");
      runLoop();
      clearTimeout(dwellTimers.current[i]);
      dwellTimers.current[i] = setTimeout(() => {
        if (statesRef.current[i] === "picked") {
          activeRef.current.delete(i);
          setLetterState(i, "unraveled");
        }
      }, dwellMs);
    },
    [advance, baseline, dwellMs, glyphs, runLoop, setLetterState]
  );

  const leaveLetter = useCallback(
    (i: number) => {
      if (i < 0 || i >= glyphs.length) return;
      if (statesRef.current[i] === "picked") {
        clearTimeout(dwellTimers.current[i]);
        activeRef.current.delete(i);
        setLetterState(i, "stitched");
      }
    },
    [glyphs.length, setLetterState]
  );

  const indexAt = (clientX: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || advance <= 0) return -1;
    const idx = Math.floor((clientX - rect.left) / advance);
    return Math.min(glyphs.length - 1, Math.max(0, idx));
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const idx = indexAt(e.clientX);
    if (reducedRef.current) {
      if (idx !== brightIndex) setBrightIndex(idx);
      return;
    }
    if (idx === hoveredRef.current) return;
    leaveLetter(hoveredRef.current);
    enterLetter(idx);
    hoveredRef.current = idx;
  };

  const onPointerLeave = () => {
    if (reducedRef.current) {
      setBrightIndex(-1);
      return;
    }
    leaveLetter(hoveredRef.current);
    hoveredRef.current = -1;
  };

  const onClickLetter = (e: ReactMouseEvent<SVGSVGElement>) => {
    const idx = indexAt(e.clientX);
    if (idx >= 0 && statesRef.current[idx] === "unraveled") {
      clearTimeout(dwellTimers.current[idx]);
      setLetterState(idx, "stitched");
    }
  };

  const resewAll = () => {
    Object.values(dwellTimers.current).forEach((id) => clearTimeout(id));
    dwellTimers.current = {};
    setStates((prev) => prev.map(() => "stitched" as LetterState));
  };

  const anyUnraveled = states.some((s) => s === "unraveled");

  return (
    <div className={`inline-flex flex-col items-center gap-4 ${className}`}>
      <style>{CSS}</style>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="ns-stitch-svg select-none"
        role="img"
        aria-label={text}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        onClick={onClickLetter}
      >
        <text
          ref={measureRef}
          x={-9999}
          y={-9999}
          fontFamily="var(--font-mono)"
          fontSize={fontSize}
          fontWeight={700}
          aria-hidden="true"
        >
          {"M"}
        </text>

        {glyphs.map((ch, i) => {
          const cx = i * advance;
          const state = states[i];
          if (ch === " ") return null;
          const bright = i === brightIndex;
          return (
            <g key={i} data-letter-state={state}>
              <g
                className="ns-stitch-thread"
                style={{
                  opacity: state === "stitched" ? 1 : 0,
                  transitionDelay: state === "stitched" ? `${i * 18}ms` : "0ms",
                }}
              >
                <text
                  x={cx}
                  y={baseline}
                  fontFamily="var(--font-mono)"
                  fontSize={fontSize}
                  fontWeight={700}
                  fill="none"
                  stroke="var(--foreground)"
                  strokeOpacity={bright ? 1 : 0.85}
                  strokeWidth={1.6}
                  strokeDasharray="3 2.4"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  {ch}
                </text>
                <text
                  x={cx + 0.6}
                  y={baseline - 0.6}
                  fontFamily="var(--font-mono)"
                  fontSize={fontSize}
                  fontWeight={700}
                  fill="none"
                  stroke="var(--ns-accent)"
                  strokeOpacity={bright ? 0.4 : 0.22}
                  strokeWidth={1}
                  strokeDasharray="3 2.4"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  {ch}
                </text>
              </g>

              {state === "picked" && (
                <path
                  ref={(el) => {
                    threadPathRefs.current[i] = el;
                  }}
                  d={`M ${cx + advance / 2} ${baseline + 2} L ${cx + advance / 2} ${baseline + 2}`}
                  fill="none"
                  stroke="var(--foreground)"
                  strokeWidth={1.4}
                  strokeDasharray="2 2"
                  strokeLinecap="round"
                  aria-hidden="true"
                />
              )}

              {state === "unraveled" && (
                <g className="ns-stitch-pile" aria-hidden="true">
                  <path
                    d={`M ${cx + advance * 0.16} ${baseline - 2}
                        q ${advance * 0.16} 12 ${advance * 0.34} 6
                        q ${advance * 0.22} -9 ${advance * 0.42} 3
                        q -${advance * 0.1} 9 ${advance * 0.1} 13
                        q ${advance * 0.14} -5 ${advance * 0.28} 0`}
                    fill="none"
                    stroke="var(--foreground)"
                    strokeWidth={1.5}
                    strokeDasharray="2.2 2.2"
                    strokeLinecap="round"
                  />
                  <path
                    d={`M ${cx + advance * 0.22} ${baseline + 1}
                        q ${advance * 0.12} 8 ${advance * 0.3} 4`}
                    fill="none"
                    stroke="var(--ns-accent)"
                    strokeOpacity={0.3}
                    strokeWidth={1}
                    strokeDasharray="2 2"
                    strokeLinecap="round"
                  />
                </g>
              )}
            </g>
          );
        })}
      </svg>

      <button
        type="button"
        onClick={resewAll}
        className="ns-stitch-resew rounded-[6px] border border-border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide text-foreground hover:bg-border/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
      >
        {anyUnraveled ? "Re-sew" : "Re-sew (nothing loose)"}
      </button>
    </div>
  );
}

const CSS = `
.ns-stitch-thread{transition:opacity 200ms ease-out;}
.ns-stitch-thread text{transition:stroke-opacity 150ms ease-out;}
.ns-stitch-pile{animation:ns-stitch-settle 220ms cubic-bezier(0.16,1,0.3,1);}
@keyframes ns-stitch-settle{from{opacity:0;transform:translateY(-3px) scale(0.9);}to{opacity:1;transform:none;}}
@media (prefers-reduced-motion: reduce){
  .ns-stitch-thread{transition:opacity 0ms;}
  .ns-stitch-thread text{transition:stroke-opacity 120ms linear;}
  .ns-stitch-pile{animation:none;}
}
.ns-stitch-svg text{paint-order:stroke;}
`;
