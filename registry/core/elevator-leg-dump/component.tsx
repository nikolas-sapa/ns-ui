"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// ElevatorLegDump — an ambient "system is working" loader modelled on a
// bucket elevator ("leg"): a closed loop of buckets riding a chain strung
// between a bottom pulley (the boot) and a top pulley (the head). Buckets
// scoop/refill at the boot, climb the ascending straight, and at the head
// are flung outward as the pulley curves them over — dumping into a chute —
// before riding the descending straight back down empty. No percentage, no
// completion: only continuous circulation, which is the point (see the
// "must not" note in the spec — this deliberately never exposes a number).
//
// Geometry is a stadium (two straights + two semicircular pulley caps),
// parametrised by a single arc-length coordinate `s` in [0, perimeter). The
// loop's real chain speed (1.5-2.5 m/s, buckets ~200-300mm apart) would pass
// a fixed point 6-10x/second — far above paint rate — so it is deliberately
// decoupled: 8 rendered buckets complete one revolution every 8.8s, which
// puts a dump roughly every 1.1s, comfortably inside the ~1s legibility
// floor. Every bucket shares one continuous position function of elapsed
// time; there is no per-bucket state machine, only two small event windows
// (tip-and-dump at the head, fill at the boot) evaluated as pure functions
// of `s`, plus one piece of real state per bucket — its assigned fill level
// — which only changes at the instant it finishes refilling.
//
// Legibility: the ONE thing to follow is a single bucket cresting the head
// pulley, tipping out, and going empty — everything else (the seven other
// buckets, the pulleys, the track) is supporting structure. Cadence is
// fixed at 1.1s between dump events, an easy sub-second-plus interval to
// track by eye, per the round 9 cadence rule (never below ~1s).
//
// Pure DOM + SVG. Every stroke/fill reads a CSS custom property directly
// via `var(...)` in a presentation attribute — there is no JS colour
// computation anywhere (no canvas, no GLSL), so there is nothing to read
// with getComputedStyle and nothing that can paint before a token exists:
// the browser resolves the custom property natively on first paint, same
// as every other pure-SVG sibling in this registry.
// ---------------------------------------------------------------------------

const BUCKET_COUNT = 8;
const LOOP_MS = 8800; // one full chain revolution, real-time
const TIP_DOWN_MS = 220; // dump: bucket rotates -100deg relative to the chain
const TIP_RETURN_MS = 300; // rotates back to upright starting down the descent
const TIP_TOTAL_MS = TIP_DOWN_MS + TIP_RETURN_MS;
const TIP_MAX_DEG = -100;
const STREAK_FADE_MS = 260; // dump streak lingers a little past tip-down
const FILL_RISE_MS = 200; // fill-mark rises as the bucket starts back up
const FILL_SEQUENCE = [0.6, 0.85, 0.4, 1.0, 0.7]; // period-5, dump to dump

const TRACK_H_RATIO = 0.9; // track height = 0.9 * min(w,h)
const TRACK_W_RATIO = 0.35; // track width = 0.35 * min(w,h)
const BUCKET_W_RATIO = 1.25; // bucket width, relative to track radius r
const BUCKET_H_RATIO = 1.5; // bucket height, relative to track radius r
const PULLEY_R_RATIO = 0.32; // pulley hub radius, relative to r

// how far into the dump the reduced-motion freeze frame sits: mid-tip, the
// streak clearly visible, before the bucket has fully emptied
const FREEZE_TIME_SINCE_HEAD_MS = 180;

interface Geometry {
  r: number;
  straightLen: number;
  perimeter: number;
  headApexS: number;
  bootApexS: number;
  speedPxPerMs: number;
  cx: number;
  cy: number;
}

function computeGeometry(w: number, h: number): Geometry {
  const minDim = Math.min(w, h);
  const trackH = TRACK_H_RATIO * minDim;
  const trackW = TRACK_W_RATIO * minDim;
  const r = trackW / 2;
  const straightLen = Math.max(0, trackH - trackW);
  const arcLen = Math.PI * r;
  const perimeter = 2 * straightLen + 2 * arcLen;
  const headApexS = straightLen + arcLen / 2;
  const bootApexS = 2 * straightLen + arcLen + arcLen / 2;
  return {
    r,
    straightLen,
    perimeter,
    headApexS,
    bootApexS,
    speedPxPerMs: perimeter / LOOP_MS,
    cx: w / 2,
    cy: h / 2,
  };
}

// stadium outline as a single closed path: right straight up, head semicircle
// over the top, left straight down, boot semicircle under the bottom.
function stadiumPathD(g: Geometry): string {
  const { r, straightLen, cx, cy } = g;
  const top = cy - straightLen / 2;
  const bottom = cy + straightLen / 2;
  const right = cx + r;
  const left = cx - r;
  return [
    `M ${right} ${bottom}`,
    `L ${right} ${top}`,
    `A ${r} ${r} 0 0 1 ${left} ${top}`,
    `L ${left} ${bottom}`,
    `A ${r} ${r} 0 0 1 ${right} ${bottom}`,
    "Z",
  ].join(" ");
}

// position + heading (direction of travel, atan2 convention: 0 = +x,
// 90 = +y/down, -90 = -y/up) of a point at arc-length `s` around the loop,
// relative to the track center (cx, cy added by the caller).
function stadiumPoint(s: number, g: Geometry): { x: number; y: number; heading: number } {
  const { r, straightLen } = g;
  const arcLen = Math.PI * r;
  if (s < straightLen) {
    const u = straightLen > 0 ? s / straightLen : 0;
    return { x: r, y: straightLen / 2 - u * straightLen, heading: -90 };
  }
  if (s < straightLen + arcLen) {
    const u = (s - straightLen) / arcLen;
    const theta = u * Math.PI;
    return {
      x: r * Math.cos(theta),
      y: -straightLen / 2 - r * Math.sin(theta),
      heading: -90 - u * 180,
    };
  }
  if (s < 2 * straightLen + arcLen) {
    const u = straightLen > 0 ? (s - straightLen - arcLen) / straightLen : 0;
    return { x: -r, y: -straightLen / 2 + u * straightLen, heading: 90 };
  }
  const u = (s - 2 * straightLen - arcLen) / arcLen;
  const theta = Math.PI + u * Math.PI;
  return {
    x: r * Math.cos(theta),
    y: straightLen / 2 + r * Math.sin(theta),
    heading: 90 - u * 180,
  };
}

// extra local tip rotation (added on top of heading), a pure function of
// position along the loop — 0 everywhere except the ~520ms dump window.
function tipAngleForS(s: number, g: Geometry): number {
  const speed = g.speedPxPerMs;
  const dumpStartS = g.headApexS;
  const tipDownEndS = dumpStartS + TIP_DOWN_MS * speed;
  const tipReturnEndS = tipDownEndS + TIP_RETURN_MS * speed;
  if (s >= dumpStartS && s < tipDownEndS) {
    return TIP_MAX_DEG * ((s - dumpStartS) / (tipDownEndS - dumpStartS));
  }
  if (s >= tipDownEndS && s < tipReturnEndS) {
    const u = (s - tipDownEndS) / (tipReturnEndS - tipDownEndS);
    return TIP_MAX_DEG * (1 - u);
  }
  return 0;
}

// dump streak opacity — visible through the tip-down phase, fades shortly
// after. Never coloured: rendered with currentColor against --foreground.
function streakOpacityForS(s: number, g: Geometry): number {
  const speed = g.speedPxPerMs;
  const dumpStartS = g.headApexS;
  const tipDownEndS = dumpStartS + TIP_DOWN_MS * speed;
  const fadeEndS = tipDownEndS + STREAK_FADE_MS * speed;
  if (s < dumpStartS || s >= fadeEndS) return 0;
  if (s < tipDownEndS) return 0.7;
  const u = (s - tipDownEndS) / (fadeEndS - tipDownEndS);
  return 0.7 * (1 - u);
}

// content scale (0..1 of the bucket's assigned fill level): full on the
// ascending leg, drains to 0 across the dump window, stays 0 across the
// whole descending leg, then rises back to 1 across the fill window.
function contentScaleForS(s: number, g: Geometry): number {
  const speed = g.speedPxPerMs;
  const dumpStartS = g.headApexS;
  const dumpEndS = dumpStartS + TIP_DOWN_MS * speed;
  const fillStartS = g.bootApexS;
  const fillEndS = fillStartS + FILL_RISE_MS * speed;
  if (s >= dumpStartS && s < dumpEndS) {
    return 1 - (s - dumpStartS) / (dumpEndS - dumpStartS);
  }
  if (s >= dumpEndS && s < fillStartS) return 0;
  if (s >= fillStartS && s < fillEndS) {
    return (s - fillStartS) / (fillEndS - fillStartS);
  }
  return 1; // before the dump, or after the fill has completed
}

function bucketPathD(bw: number, bh: number): string {
  // open-top cup: no top edge drawn, so the mouth reads as open
  return `M ${-bw / 2} ${-bh / 2} L ${-bw * 0.36} ${bh / 2} L ${bw * 0.36} ${bh / 2} L ${bw / 2} ${-bh / 2}`;
}

export interface ElevatorLegDumpProps {
  /** extra classes merged onto the rendered root element */
  className?: string;
  /** accessible label for the ambient status region */
  "aria-label"?: string;
}

export function ElevatorLegDump({
  className = "",
  "aria-label": ariaLabel = "Working",
}: ElevatorLegDumpProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const trackRef = useRef<SVGPathElement>(null);
  const headHubRef = useRef<SVGCircleElement>(null);
  const bootHubRef = useRef<SVGCircleElement>(null);
  const bucketGroupRefs = useRef<(SVGGElement | null)[]>([]);
  const bucketOutlineRefs = useRef<(SVGPathElement | null)[]>([]);
  const bucketFillRefs = useRef<(SVGRectElement | null)[]>([]);
  const bucketStreakRefs = useRef<(SVGLineElement | null)[]>([]);

  useEffect(() => {
    const root = rootRef.current;
    const svg = svgRef.current;
    const track = trackRef.current;
    const headHub = headHubRef.current;
    const bootHub = bootHubRef.current;
    if (!root || !svg || !track || !headHub || !bootHub) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let disposed = false;
    let visible = true;
    let raf = 0;
    let start = 0;
    let geo: Geometry | null = null;

    // one real state value per bucket: which of the 5 fixed fill levels it
    // is currently carrying, set the instant its own fill window completes.
    const fillLevel = new Array<number>(BUCKET_COUNT)
      .fill(0)
      .map((_, i) => FILL_SEQUENCE[i % FILL_SEQUENCE.length] ?? 0.7);
    const prevTimeSinceBoot = new Array<number>(BUCKET_COUNT).fill(-1);
    const dumpCount = new Array<number>(BUCKET_COUNT).fill(0);

    const drawStatic = (w: number, h: number) => {
      geo = computeGeometry(w, h);
      svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
      track.setAttribute("d", stadiumPathD(geo));
      const hubR = geo.r * PULLEY_R_RATIO;
      headHub.setAttribute("cx", String(geo.cx));
      headHub.setAttribute("cy", String(geo.cy - geo.straightLen / 2));
      headHub.setAttribute("r", String(hubR));
      bootHub.setAttribute("cx", String(geo.cx));
      bootHub.setAttribute("cy", String(geo.cy + geo.straightLen / 2));
      bootHub.setAttribute("r", String(hubR));
    };

    const paintBucket = (i: number, s: number, g: Geometry) => {
      const group = bucketGroupRefs.current[i];
      const outline = bucketOutlineRefs.current[i];
      const fillRect = bucketFillRefs.current[i];
      const streak = bucketStreakRefs.current[i];
      if (!group || !outline || !fillRect || !streak) return;

      const { x, y, heading } = stadiumPoint(s, g);
      const tip = tipAngleForS(s, g);
      group.setAttribute(
        "transform",
        `translate(${(g.cx + x).toFixed(2)} ${(g.cy + y).toFixed(2)}) rotate(${(heading + 90 + tip).toFixed(2)})`
      );

      const bw = g.r * BUCKET_W_RATIO;
      const bh = g.r * BUCKET_H_RATIO;
      outline.setAttribute("d", bucketPathD(bw, bh));

      const content = contentScaleForS(s, g);
      const level = fillLevel[i] ?? 0.7;
      const fillH = Math.max(0, bh * 0.82 * level * content);
      const floorY = bh / 2 - bh * 0.08;
      fillRect.setAttribute("x", String(-bw * 0.3));
      fillRect.setAttribute("width", String(bw * 0.6));
      fillRect.setAttribute("y", String(floorY - fillH));
      fillRect.setAttribute("height", String(fillH));

      streak.setAttribute("x1", "0");
      streak.setAttribute("y1", String(-bh / 2));
      streak.setAttribute("x2", "0");
      streak.setAttribute("y2", String(-bh / 2 - g.r * 0.9));
      streak.style.opacity = String(streakOpacityForS(s, g));

      // discrete fill-level update: only at the moment this bucket's own
      // fill window opens, so a fresh dump-to-dump value takes hold exactly
      // once per revolution rather than every frame.
      const speed = g.speedPxPerMs;
      const timeSinceBoot = (s - g.bootApexS) / speed;
      const prev = prevTimeSinceBoot[i] ?? -1;
      if (prev < 0 && timeSinceBoot >= 0) {
        dumpCount[i] = (dumpCount[i] ?? 0) + 1;
        fillLevel[i] = FILL_SEQUENCE[(dumpCount[i] ?? 0) % FILL_SEQUENCE.length] ?? 0.7;
      }
      prevTimeSinceBoot[i] = timeSinceBoot;
    };

    const paintAll = (elapsedMs: number) => {
      if (!geo) return;
      const t = (elapsedMs % LOOP_MS) / LOOP_MS;
      for (let i = 0; i < BUCKET_COUNT; i++) {
        const s = ((t * geo.perimeter + (i * geo.perimeter) / BUCKET_COUNT) % geo.perimeter + geo.perimeter) % geo.perimeter;
        paintBucket(i, s, geo);
      }
    };

    const loop = (now: number) => {
      raf = 0;
      if (!visible || disposed) return;
      if (start === 0) start = now;
      paintAll(now - start);
      raf = requestAnimationFrame(loop);
    };

    const runReducedFrame = () => {
      if (!geo) return;
      const speed = geo.speedPxPerMs;
      const freezeS = (geo.headApexS + FREEZE_TIME_SINCE_HEAD_MS * speed) % geo.perimeter;
      const tFreeze = freezeS / geo.perimeter;
      // seed fill levels as if history had already happened, so buckets
      // that haven't crossed the boot yet in this synthetic frame still
      // read as holding a plausible (not blank) level
      for (let i = 0; i < BUCKET_COUNT; i++) {
        fillLevel[i] = FILL_SEQUENCE[i % FILL_SEQUENCE.length] ?? 0.7;
        prevTimeSinceBoot[i] = 1; // treat as "already settled", skip the edge-detect bump
      }
      paintAll(tFreeze * LOOP_MS);
    };

    const measureAndDraw = () => {
      const rect = root.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      if (w < 2 || h < 2) return;
      drawStatic(w, h);
      if (reduced) {
        runReducedFrame();
      } else if (visible && !raf) {
        start = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    let resizeTimer = 0;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(measureAndDraw, 80);
    });
    ro.observe(root);

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && !reduced && !raf && geo) {
        start = 0;
        raf = requestAnimationFrame(loop);
      }
    });
    io.observe(root);

    document.fonts.ready.then(() => {
      if (!disposed) measureAndDraw();
    });
    measureAndDraw();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      window.clearTimeout(resizeTimer);
      ro.disconnect();
      io.disconnect();
    };
    // mount-once engine
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={rootRef} role="status" aria-label={ariaLabel} className={`relative h-full w-full ${className}`}>
      <svg ref={svgRef} aria-hidden="true" focusable="false" className="h-full w-full" data-elevator-leg-svg>
        <path ref={trackRef} d="" fill="none" stroke="var(--border)" strokeWidth={1} />
        <circle ref={headHubRef} cx={0} cy={0} r={0} fill="none" stroke="var(--border)" strokeWidth={1} />
        <circle ref={bootHubRef} cx={0} cy={0} r={0} fill="none" stroke="var(--border)" strokeWidth={1} />
        <g style={{ color: "var(--foreground)" }}>
          {Array.from({ length: BUCKET_COUNT }, (_, i) => (
            <g
              key={i}
              ref={(el) => {
                bucketGroupRefs.current[i] = el;
              }}
            >
              <line
                ref={(el) => {
                  bucketStreakRefs.current[i] = el;
                }}
                x1={0}
                y1={0}
                x2={0}
                y2={0}
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                style={{ opacity: 0 }}
              />
              <rect
                ref={(el) => {
                  bucketFillRefs.current[i] = el;
                }}
                x={0}
                y={0}
                width={0}
                height={0}
                fill="currentColor"
              />
              <path
                ref={(el) => {
                  bucketOutlineRefs.current[i] = el;
                }}
                d=""
                fill="none"
                stroke="currentColor"
                strokeWidth={1.25}
                strokeLinejoin="round"
              />
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
