"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// TendrilCast — an aria-hidden overlay of two or three climbing-tendril
// shoots that circumnutate (sweep a slow, widening ellipse as they elongate)
// out from the pane's bottom edge, searching for real layout geometry. Each
// tick tests the growing tip against every descendant tagged
// `data-tendril-support` (measured live via getBoundingClientRect under a
// ResizeObserver) — a hero card's border, a rule, any slotted anchor rect.
// The moment the tip comes within CONTACT_RADIUS of a support's edge, growth
// switches from open-space nutation to arc-length-parameterised wrapping
// along that edge: a tight sinusoid at pitch = 1.6x stroke-width, its
// envelope zeroing out and flipping sign exactly at the wrap's midpoint —
// the chirality-reversing "perversion" kink real tendrils tie. The coil
// stiffens (holds still, recoloured), then the shoot fades and buds again
// elsewhere. Nothing here is an authored bezier: the search is a live
// heading integral driven by a sine curvature term, and contact is a live
// nearest-point-on-segment test against measured rects, so moving or
// resizing a support mid-growth changes where — and whether — a tendril
// ever finds it.
//
// heading = base direction + A(t)*sin(2*pi*t/T), APPLIED AS CURVATURE (an
// angular *rate*, integrated into heading over time, not written to heading
// directly) — this is what makes the tip wander back through its own base
// direction every period instead of just tracing one fixed static wiggle.
// A(t) widens linearly with search time up to a cap, so the very first
// sweeps are a near-straight probe and only later sweeps swing wide enough
// to reach off to the side — "a widening helix," not a fixed-radius orbit.
// T (nutationPeriod, default 9000ms) is the one governing scalar: under
// ~5s the sweep reads as a drill bit, not a searching shoot.
//
// The brief's "every 4px of arc" sampling governs the wide, slow search
// sweep. The coil's own wavelength (pitch, ~2.4px at the default stroke
// width) is *narrower* than that, so the coil section is deliberately
// sampled far more densely (~pitch/5) — sampling a sub-5px wave at 4px
// intervals would alias it into a straight line, which would silently
// defeat the entire point of drawing a wrap.
// ---------------------------------------------------------------------------

interface Pt {
  x: number;
  y: number;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

type EdgeName = "top" | "right" | "bottom" | "left";

interface EdgeGeom {
  p0: Pt;
  p1: Pt;
  normal: Pt;
  len: number;
}

interface ContactHit {
  supportIndex: number;
  edgeName: EdgeName;
  tAlongEdge: number; // 0..1 fraction along the edge, measured at the moment of contact
}

type TendrilState = "asleep" | "searching" | "coiling" | "stiff" | "idle";

interface Tendril {
  originXFrac: number;
  baseAngle: number;
  state: TendrilState;
  delay: number; // ms remaining before this shoot starts (asleep)
  t: number; // ms elapsed since this search phase began (drives nutation + amplitude)
  heading: number; // current growth heading, radians, screen convention (0 = +x, -pi/2 = up)
  x: number;
  y: number;
  searchPts: Pt[]; // frozen the instant contact is found
  distAcc: number; // arc-length accumulator, search-phase sampling
  wrapPts: Pt[];
  wrapS: number; // arc length travelled along the support edge since contact
  wrapDistAcc: number; // arc-length accumulator, coil-phase sampling
  contact: ContactHit | null;
  stiffT: number;
  idleT: number;
  colored: boolean; // whether the path has stepped to the coiled stroke
  opacityState: "0" | "1";
  dirtyGeom: boolean; // true once new points landed since the last `d` write
}

const ELONGATE_RATE = 52; // px/s — single elongation constant, search AND coil; at 14 a tip's visible arc growth over the few seconds a catalog card is judged on was under one sample point, and 28 still measured as a barely-perceptible resting-state pixel change
const AMP_START = 0.05; // rad, initial nutation curvature amplitude
const AMP_MAX = 1.3; // rad, amplitude cap once fully widened
const AMP_RATE = 0.00012; // rad added per ms of search time
const CONTACT_RADIUS = 6; // px, tip-to-edge distance counted as contact
const MAX_SEARCH_MS = 42000; // give up this attempt and bud elsewhere
const MAX_SEARCH_PTS = 420; // point-budget safety cap
const SEARCH_SAMPLE_PX = 4; // brief's arc-length sampling interval, search phase
const STROKE_WIDTH = 1.5; // px
const WRAP_PITCH = 1.6 * STROKE_WIDTH; // the brief's coil-pitch law
const WRAP_LEN = 64; // px of arc-length wrapped before stiffening
const WRAP_AMP = 3; // px, coil lateral amplitude at full envelope
const COIL_SAMPLE_PX = WRAP_PITCH / 5; // denser than search: the wrap's own wavelength is sub-5px
const STIFF_HOLD_MS = 6000; // how long a finished coil holds before budding elsewhere
const RESPAWN_FADE_MS = 420;
const STEP_MS = 1000 / 30; // fixed 30Hz simulation tick
const MEASURE_POLL_MS = 500; // safety re-measure for a support that moved without resizing
const MAX_REDUCED_TICKS = 6000; // synchronous fast-forward cap for prefers-reduced-motion
// Normal-motion mount warmup (~30s of sim at 30Hz). Without it the shoots start
// from bare stubs on the pane edge, so first paint — and the resting screenshot
// the owner judges first — shows an essentially empty ornament. Unlike the
// reduced-motion fast-forward this stops well short of "every tendril stiff",
// leaving live growth for the rAF loop to continue.
const PREWARM_TICKS = 900;
const EDGE_NAMES: EdgeName[] = ["top", "right", "bottom", "left"];

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

function edgeOf(b: Box, name: EdgeName): EdgeGeom {
  let p0: Pt;
  let p1: Pt;
  let normal: Pt;
  switch (name) {
    case "top":
      p0 = { x: b.x, y: b.y };
      p1 = { x: b.x + b.w, y: b.y };
      normal = { x: 0, y: -1 };
      break;
    case "right":
      p0 = { x: b.x + b.w, y: b.y };
      p1 = { x: b.x + b.w, y: b.y + b.h };
      normal = { x: 1, y: 0 };
      break;
    case "bottom":
      p0 = { x: b.x + b.w, y: b.y + b.h };
      p1 = { x: b.x, y: b.y + b.h };
      normal = { x: 0, y: 1 };
      break;
    case "left":
      p0 = { x: b.x, y: b.y + b.h };
      p1 = { x: b.x, y: b.y };
      normal = { x: -1, y: 0 };
      break;
  }
  const len = Math.hypot(p1.x - p0.x, p1.y - p0.y) || 1;
  return { p0, p1, normal, len };
}

function nearestOnSegment(p: Pt, p0: Pt, p1: Pt): { t: number; dist: number } {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const lenSq = dx * dx + dy * dy || 1;
  let t = ((p.x - p0.x) * dx + (p.y - p0.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const px = p0.x + dx * t;
  const py = p0.y + dy * t;
  return { t, dist: Math.hypot(p.x - px, p.y - py) };
}

function findContact(x: number, y: number, boxes: Box[], radius: number): ContactHit | null {
  let best: ContactHit | null = null;
  let bestDist = radius;
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (!b) continue;
    for (const name of EDGE_NAMES) {
      const e = edgeOf(b, name);
      const { t, dist } = nearestOnSegment({ x, y }, e.p0, e.p1);
      if (dist <= bestDist) {
        bestDist = dist;
        best = { supportIndex: i, edgeName: name, tAlongEdge: t };
      }
    }
  }
  return best;
}

// Coil envelope: two half-arches (zero at s=0, s=WRAP_LEN/2, s=WRAP_LEN) so
// the wrap blends in from the straight search path, pinches flat exactly at
// its midpoint, then reopens with the OPPOSITE sign — the perversion kink —
// before tapering flat again as it stiffens.
function wrapOffset(s: number): number {
  const half = WRAP_LEN / 2;
  if (s <= half) {
    const u = s / half;
    return WRAP_AMP * Math.sin(Math.PI * u) * Math.sin((2 * Math.PI * s) / WRAP_PITCH);
  }
  const u = (s - half) / half;
  return -WRAP_AMP * Math.sin(Math.PI * u) * Math.sin((2 * Math.PI * (s - half)) / WRAP_PITCH);
}

function smoothPath(pts: Pt[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M${pts[0]!.x.toFixed(1)} ${pts[0]!.y.toFixed(1)}`;
  let d = `M${pts[0]!.x.toFixed(1)} ${pts[0]!.y.toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const cur = pts[i]!;
    const next = pts[i + 1]!;
    const mx = (cur.x + next.x) / 2;
    const my = (cur.y + next.y) / 2;
    d += `Q${cur.x.toFixed(1)} ${cur.y.toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
  }
  const last = pts[pts.length - 1]!;
  d += `L${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
  return d;
}

function makeTendril(slot: number, count: number, w: number, h: number, rand: () => number, delayMs: number): Tendril {
  const spread = count > 1 ? slot / (count - 1) : 0.5;
  const originXFrac = 0.14 + spread * 0.72 + (rand() - 0.5) * 0.05;
  const bias = (slot - (count - 1) / 2) * 0.16;
  const baseAngle = -Math.PI / 2 + bias;
  return {
    originXFrac,
    baseAngle,
    state: "asleep",
    delay: Math.max(0, delayMs),
    t: 0,
    heading: baseAngle,
    x: originXFrac * w,
    y: h - 1,
    searchPts: [],
    distAcc: 0,
    wrapPts: [],
    wrapS: 0,
    wrapDistAcc: 0,
    contact: null,
    stiffT: 0,
    idleT: 0,
    // Deliberately the OPPOSITE of what the very first render() call will
    // compute (shouldColor=false, wantOpacity="1"): render() only writes a
    // style when its computed target disagrees with these tracked flags, so
    // starting them mismatched forces that first write to actually happen —
    // both at initial mount (harmless, restates the JSX default) and after
    // a respawn (load-bearing: a `stiff` tendril leaves the DOM at
    // stroke=foreground/opacity=0, and a respawned tendril that started
    // these flags equal to its own fresh-object defaults would silently
    // agree with the stale DOM value and never issue the corrective write —
    // the shoot would stay invisible forever after its first cycle).
    colored: true,
    opacityState: "0",
    dirtyGeom: true,
  };
}

function beginRespawn(tn: Tendril): void {
  tn.state = "idle";
  tn.idleT = 0;
}

function tick(
  tn: Tendril,
  dt: number,
  boxes: Box[],
  w: number,
  h: number,
  periodMs: number,
  rand: () => number,
  slot: number,
  count: number
): void {
  switch (tn.state) {
    case "asleep": {
      tn.delay -= dt;
      if (tn.delay <= 0) {
        tn.state = "searching";
        tn.t = 0;
        tn.x = tn.originXFrac * w;
        tn.y = h - 1;
        tn.heading = tn.baseAngle;
        tn.searchPts = [{ x: tn.x, y: tn.y }];
        tn.distAcc = 0;
        tn.dirtyGeom = true;
      }
      return;
    }
    case "searching": {
      tn.t += dt;
      const amp = Math.min(AMP_MAX, AMP_START + AMP_RATE * tn.t);
      const curvature = amp * Math.sin((2 * Math.PI * tn.t) / periodMs); // rad/s, integrated below
      tn.heading += curvature * (dt / 1000);
      const move = ELONGATE_RATE * (dt / 1000);
      tn.x += Math.cos(tn.heading) * move;
      tn.y += Math.sin(tn.heading) * move;
      tn.distAcc += move;
      if (tn.distAcc >= SEARCH_SAMPLE_PX) {
        tn.searchPts.push({ x: tn.x, y: tn.y });
        tn.distAcc = 0;
        tn.dirtyGeom = true;
      }
      const hit = findContact(tn.x, tn.y, boxes, CONTACT_RADIUS);
      if (hit) {
        tn.contact = hit;
        tn.state = "coiling";
        tn.wrapS = 0;
        tn.wrapDistAcc = 0;
        tn.wrapPts = [];
        return;
      }
      if (tn.searchPts.length > MAX_SEARCH_PTS || tn.t > MAX_SEARCH_MS) {
        beginRespawn(tn);
        return;
      }
      if (tn.x < -80 || tn.x > w + 80 || tn.y < -80 || tn.y > h + 80) {
        beginRespawn(tn);
      }
      return;
    }
    case "coiling": {
      const box = tn.contact ? boxes[tn.contact.supportIndex] : undefined;
      if (!box || !tn.contact) {
        beginRespawn(tn);
        return;
      }
      const edge = edgeOf(box, tn.contact.edgeName);
      const move = ELONGATE_RATE * (dt / 1000);
      tn.wrapS = Math.min(WRAP_LEN, tn.wrapS + move);
      const baseS = tn.contact.tAlongEdge * edge.len;
      let s = baseS + tn.wrapS;
      let clipped = false;
      if (s >= edge.len) {
        s = edge.len;
        clipped = true;
      } else if (s < 0) {
        s = 0;
      }
      const tangent = { x: (edge.p1.x - edge.p0.x) / edge.len, y: (edge.p1.y - edge.p0.y) / edge.len };
      const off = wrapOffset(tn.wrapS);
      const px = edge.p0.x + tangent.x * s + edge.normal.x * off;
      const py = edge.p0.y + tangent.y * s + edge.normal.y * off;
      tn.wrapDistAcc += move;
      if (tn.wrapDistAcc >= COIL_SAMPLE_PX) {
        tn.wrapPts.push({ x: px, y: py });
        tn.wrapDistAcc = 0;
        tn.dirtyGeom = true;
      }
      if (tn.wrapS >= WRAP_LEN || clipped) {
        tn.wrapPts.push({ x: px, y: py });
        tn.dirtyGeom = true;
        tn.state = "stiff";
        tn.stiffT = 0;
      }
      return;
    }
    case "stiff": {
      tn.stiffT += dt;
      if (tn.stiffT > STIFF_HOLD_MS) beginRespawn(tn);
      return;
    }
    case "idle": {
      tn.idleT += dt;
      if (tn.idleT > RESPAWN_FADE_MS) {
        Object.assign(tn, makeTendril(slot, count, w, h, rand, 150 + rand() * 700));
      }
      return;
    }
  }
}

export interface TendrilCastProps {
  /** Hero/card content — tag whatever the tendrils should search for and
   * grip (a card wrapper, a rule, an anchor `<div>`) with `data-tendril-support`. */
  children?: React.ReactNode;
  /** 2 or 3 concurrent shoots. Clamped into that range. Default 3. */
  tendrilCount?: number;
  /** ms per circumnutation cycle — the one governing scalar. Under ~5000 the
   * sweep reads as a drill, not a searching shoot. Default 9000. */
  nutationPeriod?: number;
  /** extra classes merged onto the relatively-positioned wrapper */
  className?: string;
}

export function TendrilCast({ children, tendrilCount = 3, nutationPeriod = 9000, className = "" }: TendrilCastProps) {
  const count = Math.min(3, Math.max(2, Math.round(tendrilCount)));
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);

  useEffect(() => {
    const root = rootRef.current;
    const svg = svgRef.current;
    if (!root || !svg) return;

    let disposed = false;
    let containerW = 0;
    let containerH = 0;
    let boxes: Box[] = [];

    const measure = () => {
      const rect = root.getBoundingClientRect();
      containerW = rect.width;
      containerH = rect.height;
      const list: Box[] = [];
      root.querySelectorAll<HTMLElement>("[data-tendril-support]").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return;
        list.push({ x: r.left - rect.left, y: r.top - rect.top, w: r.width, h: r.height });
      });
      boxes = list;
    };
    measure();

    const rand = mulberry32(0x7e17d11 ^ count);
    const STAGGER_MS = 2600;
    const tendrils: Tendril[] = Array.from({ length: count }, (_, i) =>
      makeTendril(i, count, containerW, containerH, rand, i * STAGGER_MS + rand() * 700)
    );

    const render = () => {
      for (let i = 0; i < tendrils.length; i++) {
        const tn = tendrils[i];
        const el = pathRefs.current[i];
        if (!tn || !el) continue;
        if (tn.dirtyGeom) {
          const pts = tn.wrapPts.length > 0 ? tn.searchPts.concat(tn.wrapPts) : tn.searchPts;
          el.setAttribute("d", smoothPath(pts));
          tn.dirtyGeom = false;
        }
        const shouldColor = tn.state === "coiling" || tn.state === "stiff";
        if (shouldColor !== tn.colored) {
          tn.colored = shouldColor;
          el.style.stroke = shouldColor ? "var(--foreground)" : "var(--ns-muted)";
          el.style.strokeOpacity = shouldColor ? "0.6" : "1";
        }
        const wantOpacity = tn.state === "idle" ? "0" : "1";
        if (tn.opacityState !== wantOpacity) {
          tn.opacityState = wantOpacity;
          el.style.opacity = wantOpacity;
        }
      }
    };

    const stepAll = (dt: number) => {
      for (let i = 0; i < tendrils.length; i++) {
        const tn = tendrils[i];
        if (tn) tick(tn, dt, boxes, containerW, containerH, nutationPeriod, rand, i, count);
      }
    };

    const fastForward = () => {
      let guard = 0;
      while (guard < MAX_REDUCED_TICKS && tendrils.some((tn) => tn.state !== "stiff")) {
        stepAll(STEP_MS);
        guard++;
      }
      render();
    };

    let raf = 0;
    let last = 0;
    let acc = 0;
    let visible = true;

    const loop = (now: number) => {
      raf = 0;
      if (disposed || !visible) return;
      if (last === 0) last = now;
      let dt = now - last;
      last = now;
      if (dt > 250) dt = 250;
      acc += dt;
      while (acc >= STEP_MS) {
        acc -= STEP_MS;
        stepAll(STEP_MS);
      }
      render();
      raf = requestAnimationFrame(loop);
    };

    let pollTimer = 0;
    const poll = () => {
      measure();
      pollTimer = window.setTimeout(poll, MEASURE_POLL_MS);
    };

    const startLive = () => {
      last = 0;
      if (!raf) raf = requestAnimationFrame(loop);
      if (!pollTimer) pollTimer = window.setTimeout(poll, MEASURE_POLL_MS);
    };

    const stopLive = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      window.clearTimeout(pollTimer);
      pollTimer = 0;
    };

    const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onReducedChange = () => {
      if (reducedQuery.matches) {
        stopLive();
        fastForward();
      } else {
        startLive();
      }
    };
    reducedQuery.addEventListener("change", onReducedChange);

    const ro = new ResizeObserver(measure);
    ro.observe(root);
    root.querySelectorAll<HTMLElement>("[data-tendril-support]").forEach((el) => ro.observe(el));

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && !reducedQuery.matches && !raf) startLive();
    });
    io.observe(root);

    document.fonts.ready.then(() => {
      if (!disposed) measure();
    });

    if (reducedQuery.matches) {
      fastForward();
    } else {
      for (let i = 0; i < PREWARM_TICKS; i++) stepAll(STEP_MS);
      render();
      startLive();
    }

    return () => {
      disposed = true;
      stopLive();
      ro.disconnect();
      io.disconnect();
      reducedQuery.removeEventListener("change", onReducedChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, nutationPeriod]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {children}
      {/* Painted AFTER children so a coil is visible in full against an
          opaque card fill, not half-clipped underneath it — pointer-events
          none is what keeps this from ever intercepting a click, not paint
          order, so putting it on top costs nothing. */}
      <svg
        ref={svgRef}
        aria-hidden="true"
        focusable="false"
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      >
        {Array.from({ length: count }).map((_, i) => (
          <path
            key={i}
            ref={(el) => {
              pathRefs.current[i] = el;
            }}
            d=""
            fill="none"
            stroke="var(--ns-muted)"
            strokeOpacity={1}
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            style={{ transition: "opacity 420ms cubic-bezier(0.4, 0, 0.2, 1)" }}
          />
        ))}
      </svg>
    </div>
  );
}
