"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// CapstanSlip — a determinate-progress alternative whose mechanic lives in
// the transport geometry itself. Side-on view of an analog tape deck: a
// capstan shaft spins at a strictly constant 0.6 rev/s (it is motor-driven —
// it never slips), a pinch roller nips the tape against it, and the tape's
// own linear speed comes from that nip, not from the shaft. Real transports
// spec wow-and-flutter under 0.05% WRMS; a glazed or eccentric roller pushes
// that far higher, heard as a periodic "wow" in pitch. Every ~1.1s (jittered
// ±0.2s) the nip compresses for ~40ms, the tape's speed drops to 40% of
// baseline for ~90ms, then springs back through one small overshoot over
// ~120ms — the roller "catching back up". Tape ticks scroll past the nip at
// a constant spawn cadence, so a slip event visibly bunches the marks that
// crossed the nip while it was slow, and that bunched patch keeps trailing
// left after the nip has recovered.
//
// Slip depth (compression + speed dip, one shared curve) is a pure function
// of elapsed ms since the active event started — reused verbatim by the live
// rAF loop and by the reduced-motion path, which runs the same tick forward
// synchronously with a seeded RNG until it lands 40ms into an event, then
// stops and renders once. Marks are a fixed-size ref pool of <line>
// elements, recycled by index, positioned with imperative setAttribute calls
// so the 60fps path never touches React state.
// ---------------------------------------------------------------------------

const BASE_SPEED = 28; // px/s baseline tape scroll speed, at card scale
const SHAFT_REV_PER_S = 0.6; // capstan drive shaft — constant, never slips
const MARK_SPACING = 22; // px between tape ticks at baseline speed
const EVENT_BASE_INTERVAL = 1100; // ms between slip events
const EVENT_JITTER = 200; // ± ms
const EVENT_DURATION = 250; // ms — full dip-then-recover length
const COMPRESS_END = 40; // ms — nip reaches peak compression
const HOLD_END = 130; // ms — 90ms hold at 40% speed ends here
const POOL = 90; // pooled mark <line> elements
const REDUCED_TARGET_EVENT = 3; // freeze 40ms into the 3rd simulated event

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

function smoothstep(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

/** Normalised slip depth for ms elapsed since an event started. 1 = full
 * compression / 40% speed, 0 = at rest, briefly negative = the recovery
 * overshoot (nip springs slightly past neutral, tape briefly over-speeds).
 * Shared by the live loop and the reduced-motion simulate pass. */
function slipDepth(elapsed: number): number {
  if (elapsed < 0 || elapsed >= EVENT_DURATION) return 0;
  if (elapsed < COMPRESS_END) return smoothstep(elapsed / COMPRESS_END);
  if (elapsed < HOLD_END) return 1;
  const u = (elapsed - HOLD_END) / (EVENT_DURATION - HOLD_END);
  return Math.exp(-3.2 * u) * Math.cos(5.5 * u);
}

interface MarkState {
  x: number;
  active: boolean;
}

export interface CapstanSlipProps {
  /** shown above the transport as a small mono label */
  label?: string;
  /** hover-triggered numeric callout of the real professional-deck spec */
  showReadout?: boolean;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function CapstanSlip({
  label = "TRANSPORT",
  showReadout = true,
  className = "",
}: CapstanSlipProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const shaftGroupRef = useRef<SVGGElement>(null);
  const rollerGroupRef = useRef<SVGGElement>(null);
  const tapeGroupRef = useRef<SVGGElement>(null);
  const markRefs = useRef<(SVGLineElement | null)[]>([]);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    const svg = svgRef.current;
    const shaftGroup = shaftGroupRef.current;
    const rollerGroup = rollerGroupRef.current;
    const tapeGroup = tapeGroupRef.current;
    if (!root || !svg || !shaftGroup || !rollerGroup || !tapeGroup) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let disposed = false;
    let visible = true;
    let raf = 0;
    let last = 0;

    let W = 0;
    let H = 0;
    let S = 1; // smaller dimension — every geometric constant derives from this
    let shaftR = 1;
    let rollerR = 1;
    let nipX = 0;
    let tapeY = 0;
    let tapeHalfH = 1;
    let restGap = 1;
    let compressMax = 2;
    let markMargin = 40;
    let shaftCx = 0;
    let shaftCy = 0;
    let rollerCx = 0;
    let rollerCy0 = 0; // roller's built (rest) center — fixed rotation pivot

    const marks: MarkState[] = Array.from({ length: POOL }, () => ({ x: 0, active: false }));
    let spawnAcc = 0;
    let shaftAngle = 0;
    let rollerAngle = 0;
    let nextEventAt = 0; // ms, on the loop's own running clock
    let eventStart = -Infinity;
    let clock = 0; // ms, running total since mount/resize

    const measure = () => {
      const rect = root.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      S = Math.max(1, Math.min(W, H));
      shaftR = Math.min(S * 0.13, W * 0.22);
      rollerR = shaftR * 0.72;
      tapeHalfH = Math.max(4, Math.min(S * 0.05, 14));
      restGap = Math.max(2, S * 0.012);
      compressMax = Math.max(1.5, Math.min(S * 0.014, 5));
      nipX = W * 0.6;
      tapeY = H * 0.52;
      markMargin = MARK_SPACING * 2;
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    };

    const applyLine = (el: SVGLineElement | null, x: number) => {
      if (!el) return;
      el.setAttribute("x1", x.toFixed(1));
      el.setAttribute("x2", x.toFixed(1));
      el.setAttribute("y1", (tapeY - tapeHalfH * 0.8).toFixed(1));
      el.setAttribute("y2", (tapeY + tapeHalfH * 0.8).toFixed(1));
      el.setAttribute("opacity", x < -markMargin || x > W + markMargin ? "0" : "1");
    };

    const scheduleNextEvent = (fromMs: number, rand: () => number) => {
      eventStart = fromMs;
      nextEventAt = fromMs + EVENT_BASE_INTERVAL + (rand() * 2 - 1) * EVENT_JITTER;
    };

    /** One simulation step of dtMs at running clock time nowMs. Advances
     * shaft/roller rotation, the mark pool, and the event schedule. Pure
     * mutation of closure state — no DOM writes here, render() does those. */
    const advance = (dtMs: number, nowMs: number, rand: () => number) => {
      shaftAngle = (shaftAngle + (dtMs / 1000) * SHAFT_REV_PER_S * 360) % 360;

      const elapsed = nowMs - eventStart;
      const slip = slipDepth(elapsed);
      const vel = BASE_SPEED * (1 - 0.6 * slip);

      rollerAngle = (rollerAngle + (dtMs / 1000) * ((vel / (2 * Math.PI * rollerR)) * 360)) % 360;

      const dx = (vel * dtMs) / 1000;
      for (const m of marks) {
        if (!m.active) continue;
        m.x -= dx;
        if (m.x < -markMargin) m.active = false;
      }

      spawnAcc += dtMs;
      const spawnInterval = (MARK_SPACING / BASE_SPEED) * 1000;
      while (spawnAcc >= spawnInterval) {
        spawnAcc -= spawnInterval;
        const slot = marks.find((m) => !m.active);
        if (slot) {
          slot.active = true;
          slot.x = W + markMargin;
        }
      }

      if (nowMs >= nextEventAt) scheduleNextEvent(nowMs, rand);
    };

    const rollerOffset = (nowMs: number) => {
      const slip = slipDepth(nowMs - eventStart);
      return compressMax * Math.max(-0.3, slip);
    };

    const render = (nowMs: number) => {
      shaftGroup.setAttribute("transform", `rotate(${shaftAngle.toFixed(2)} ${shaftCx.toFixed(1)} ${shaftCy.toFixed(1)})`);
      // rotate about the roller's fixed rest pivot first, THEN translate by
      // the compression offset — translate is the leftmost transform, so it
      // is applied last, after the (already correctly pivoted) rotation.
      const dy = -rollerOffset(nowMs);
      rollerGroup.setAttribute("transform", `translate(0 ${dy.toFixed(2)}) rotate(${rollerAngle.toFixed(2)} ${rollerCx.toFixed(1)} ${rollerCy0.toFixed(1)})`);
      for (let i = 0; i < POOL; i++) {
        const m = marks[i];
        if (m) applyLine(markRefs.current[i] ?? null, m.active ? m.x : -9999);
      }
    };

    const buildStaticShapes = () => {
      while (shaftGroup.firstChild) shaftGroup.removeChild(shaftGroup.firstChild);
      while (rollerGroup.firstChild) rollerGroup.removeChild(rollerGroup.firstChild);
      while (tapeGroup.firstChild) tapeGroup.removeChild(tapeGroup.firstChild);
      // shaft body + spoke, roller body + spoke are positioned once here at
      // their rest coordinates; their groups only ever receive `transform`
      // afterward (rotation, and — for the roller — the compression offset).
      shaftCx = nipX;
      shaftCy = tapeY + tapeHalfH + shaftR - restGap;
      rollerCx = nipX;
      rollerCy0 = tapeY - tapeHalfH - rollerR + restGap;

      const ns = "http://www.w3.org/2000/svg";

      const topEdge = document.createElementNS(ns, "line");
      topEdge.setAttribute("x1", "0");
      topEdge.setAttribute("x2", String(W));
      topEdge.setAttribute("y1", String(tapeY - tapeHalfH));
      topEdge.setAttribute("y2", String(tapeY - tapeHalfH));
      topEdge.setAttribute("stroke", "var(--foreground)");
      topEdge.setAttribute("stroke-width", "1");
      topEdge.setAttribute("opacity", "0.35");
      tapeGroup.appendChild(topEdge);
      const bottomEdge = topEdge.cloneNode() as SVGLineElement;
      bottomEdge.setAttribute("y1", String(tapeY + tapeHalfH));
      bottomEdge.setAttribute("y2", String(tapeY + tapeHalfH));
      tapeGroup.appendChild(bottomEdge);
      const rail = document.createElementNS(ns, "line");
      rail.setAttribute("x1", "0");
      rail.setAttribute("x2", String(W));
      rail.setAttribute("y1", String(H - 1));
      rail.setAttribute("y2", String(H - 1));
      rail.setAttribute("stroke", "var(--border)");
      rail.setAttribute("stroke-width", "1");
      tapeGroup.appendChild(rail);

      const shaftCircle = document.createElementNS(ns, "circle");
      shaftCircle.setAttribute("cx", String(shaftCx));
      shaftCircle.setAttribute("cy", String(shaftCy));
      shaftCircle.setAttribute("r", String(shaftR));
      shaftCircle.setAttribute("fill", "var(--background)");
      shaftCircle.setAttribute("stroke", "var(--foreground)");
      shaftCircle.setAttribute("stroke-width", "1.6");
      shaftGroup.appendChild(shaftCircle);
      const shaftSpoke = document.createElementNS(ns, "line");
      shaftSpoke.setAttribute("x1", String(shaftCx));
      shaftSpoke.setAttribute("y1", String(shaftCy));
      shaftSpoke.setAttribute("x2", String(shaftCx));
      shaftSpoke.setAttribute("y2", String(shaftCy - shaftR * 0.86));
      shaftSpoke.setAttribute("stroke", "var(--foreground)");
      shaftSpoke.setAttribute("stroke-width", "1.6");
      shaftSpoke.setAttribute("stroke-linecap", "round");
      shaftGroup.appendChild(shaftSpoke);

      const rollerCircle = document.createElementNS(ns, "circle");
      rollerCircle.setAttribute("cx", String(rollerCx));
      rollerCircle.setAttribute("cy", String(rollerCy0));
      rollerCircle.setAttribute("r", String(rollerR));
      rollerCircle.setAttribute("fill", "var(--background)");
      rollerCircle.setAttribute("stroke", "var(--foreground)");
      rollerCircle.setAttribute("stroke-width", "1.6");
      rollerGroup.appendChild(rollerCircle);
      const rollerSpoke = document.createElementNS(ns, "line");
      rollerSpoke.setAttribute("x1", String(rollerCx));
      rollerSpoke.setAttribute("y1", String(rollerCy0));
      rollerSpoke.setAttribute("x2", String(rollerCx));
      rollerSpoke.setAttribute("y2", String(rollerCy0 + rollerR * 0.82));
      rollerSpoke.setAttribute("stroke", "var(--foreground)");
      rollerSpoke.setAttribute("stroke-width", "1.6");
      rollerSpoke.setAttribute("stroke-linecap", "round");
      rollerGroup.appendChild(rollerSpoke);
    };

    const resetAndBuild = () => {
      measure();
      buildStaticShapes();
    };

    const startLive = () => {
      resetAndBuild();
      const rand = Math.random;
      for (const m of marks) m.active = false;
      spawnAcc = 0;
      shaftAngle = 0;
      rollerAngle = 0;
      clock = 0;
      scheduleNextEvent(EVENT_BASE_INTERVAL * 0.5, rand);
      // pre-roll a couple of seconds so the tape is never empty at t0
      let t = 0;
      const preroll = 2600;
      while (t < preroll) {
        advance(16, t, rand);
        t += 16;
      }
      clock = t;
      last = 0;
      if (!raf) raf = requestAnimationFrame(loop);
    };

    const loop = (now: number) => {
      raf = 0;
      if (!visible) return;
      if (last === 0) last = now;
      const dt = Math.min(80, now - last);
      last = now;
      const rand = Math.random;
      clock += dt;
      advance(dt, clock, rand);
      render(clock);
      raf = requestAnimationFrame(loop);
    };

    const runReduced = () => {
      resetAndBuild();
      const rand = mulberry32(0xc4b57a11);
      for (const m of marks) m.active = false;
      spawnAcc = 0;
      shaftAngle = 0;
      rollerAngle = 0;
      let t = 0;
      scheduleNextEvent(EVENT_BASE_INTERVAL * 0.5, rand);
      let eventCount = 0;
      let lastEventStart = eventStart;
      const dt = 8;
      const hardCap = 20000;
      while (t < hardCap) {
        advance(dt, t, rand);
        if (eventStart !== lastEventStart) {
          // an event just fired at the OLD eventStart before advance()
          // rolled it forward — count that completed one.
          eventCount += 1;
          lastEventStart = eventStart;
        }
        t += dt;
        if (eventCount >= REDUCED_TARGET_EVENT) break;
      }
      // eventStart now marks the most recent slip; land 40ms into it.
      const target = eventStart + COMPRESS_END;
      while (t < target) {
        advance(dt, t, rand);
        t += dt;
      }
      render(target);
    };

    if (reduced) {
      runReduced();
    } else {
      startLive();
    }

    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (disposed) return;
        cancelAnimationFrame(raf);
        raf = 0;
        if (reduced) runReduced();
        else startLive();
      }, 120);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(root);

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && !reduced && !raf) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    });
    io.observe(root);

    document.fonts?.ready?.then(() => {
      if (!disposed) onResize();
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      window.clearTimeout(resizeTimer);
      ro.disconnect();
      io.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={rootRef}
      className={`relative overflow-hidden rounded-md border border-border bg-surface ${className}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-center justify-between px-4 pt-3">
        <p className="font-mono text-[11px] tracking-widest text-ns-muted">{label}</p>
        {showReadout && (
          <p
            className="font-mono text-[11px] text-ns-muted transition-opacity duration-200"
            style={{ opacity: hovered ? 1 : 0 }}
          >
            0.05% WRMS <span className="text-foreground">ref</span>
          </p>
        )}
      </div>
      <svg ref={svgRef} className="h-full w-full" style={{ minHeight: 160 }} aria-hidden="true" focusable="false">
        <g ref={tapeGroupRef} />
        <g>
          {Array.from({ length: POOL }).map((_, i) => (
            <line
              key={i}
              ref={(el) => {
                markRefs.current[i] = el;
              }}
              stroke="var(--foreground)"
              strokeWidth={1.4}
              strokeLinecap="round"
              opacity={0}
            />
          ))}
        </g>
        <g ref={shaftGroupRef} />
        <g ref={rollerGroupRef} />
      </svg>
    </div>
  );
}
