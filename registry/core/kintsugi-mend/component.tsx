"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

// KintsugiMend — a panel that, once it has broken and been retried back to
// health, never quite returns to pristine. On error the panel splits into
// 3-5 clip-path shards along a deterministic Voronoi crack (same seed, same
// fracture, every time — a scar has a fixed location, not a random one) and
// pulls apart to reveal the gap between them. On recovery the shards spring
// back with a back-eased overshoot, and the crack itself stays behind as a
// set of hairline seams drawn in --foreground, brightest the instant they
// land and decaying — via a single CSS @keyframes with a NEGATIVE
// animation-delay seeked to the real elapsed time, so no rAF loop and no
// polling timer is needed to age them — toward --ns-muted and then toward
// nothing over DECAY_MS. Each seam is a real, focusable <button> whose
// accessible name states the incident in full sentence form; clicking one
// opens a Geist Mono incident popover. The underlying content is rendered
// exactly once (never cloned into the shard layer's accessible tree — that
// layer is `inert` and `aria-hidden`, decorative only) so nothing about the
// fracture duplicates a live control. DOM + SVG + CSS only, no canvas.

type Pt = { x: number; y: number };
type Shard = { clipPath: string; dx: number; dy: number; rot: number };
type Seam = { pts: Pt[]; mx: number; my: number };
type Geometry = { shards: Shard[]; seams: Seam[] };

export interface KintsugiIncident {
  /** what failed, e.g. "network error" */
  reason: string;
  /** retry attempts spent before this recovery landed */
  retries: number;
  /** epoch ms the recovery completed */
  recoveredAt: number;
}

export interface KintsugiMendProps {
  /** the panel's current status. "error" -> shards visibly separate; the
   *  transition back to "ok" is the mend. */
  status: "ok" | "error";
  /** the wrapped panel content — rendered once, in its own accessible layer. */
  children: ReactNode;
  /** what failed, captured into the incident record the next time `status`
   *  goes error -> ok. Default "network error". */
  reason?: string;
  /** retry attempts spent before that recovery. Default 1. */
  retries?: number;
  /** what this panel calls itself in the one-time recovery announcement,
   *  e.g. "chart" -> "chart recovered after network error". Default "panel". */
  subject?: string;
  /** hydrate existing incident history without playing the break/mend
   *  animation — for a panel that already has a scar when it mounts. */
  initialIncident?: KintsugiIncident;
  /** deterministic crack geometry seed. Same seed, same fracture. */
  seed?: number;
  className?: string;
}

const GAP_PX = 11;
const BREAK_MS = 200;
const MEND_MS = 520;
const BREAK_EASE = "cubic-bezier(0.16, 1, 0.3, 1)"; // ease-out-expo — a snap
const MEND_EASE = "cubic-bezier(0.34, 1.56, 0.64, 1)"; // back-out — spring overshoot
const DECAY_MS = 20 * 60 * 1000; // 20 minutes to the fully-decayed floor
const PEAK_OPACITY = 0.92;
const FLOOR_OPACITY = 0.06;

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function mulberry32(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** keep the half of `poly` on the seed's side of the bisector through (mx,my) with normal (nx,ny) */
function clipHalfPlane(poly: Pt[], mx: number, my: number, nx: number, ny: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const da = (a.x - mx) * nx + (a.y - my) * ny;
    const db = (b.x - mx) * nx + (b.y - my) * ny;
    if (da <= 0) out.push(a);
    if (da <= 0 !== db <= 0) {
      const f = da / (da - db);
      out.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
    }
  }
  return out;
}

/** exact Voronoi cells (half-plane clipping, O(n^2)), clipped to the box */
function voronoiCells(seeds: Pt[], w: number, h: number): Pt[][] {
  return seeds.map((s) => {
    let poly: Pt[] = [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: h },
      { x: 0, y: h },
    ];
    for (const o of seeds) {
      if (o === s) continue;
      poly = clipHalfPlane(poly, (s.x + o.x) / 2, (s.y + o.y) / 2, o.x - s.x, o.y - s.y);
      if (poly.length === 0) break;
    }
    return poly;
  });
}

/** shared cell walls, deduped, excluding the box's own border */
function crackEdges(cells: Pt[][], w: number, h: number): { a: Pt; b: Pt }[] {
  const eps = 0.5;
  const seen = new Set<string>();
  const edges: { a: Pt; b: Pt }[] = [];
  for (const poly of cells) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      if (
        (a.x < eps && b.x < eps) ||
        (a.x > w - eps && b.x > w - eps) ||
        (a.y < eps && b.y < eps) ||
        (a.y > h - eps && b.y > h - eps)
      )
        continue;
      const ka = `${a.x.toFixed(1)},${a.y.toFixed(1)}`;
      const kb = `${b.x.toFixed(1)},${b.y.toFixed(1)}`;
      const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ a, b });
    }
  }
  return edges;
}

/** deterministic single-jag polyline — a straight break reads as a scratch, not a crack */
function jagEdge(rng: () => number, a: Pt, b: Pt): Pt[] {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  const amt = clamp(len * 0.16, 3, 12) * (rng() - 0.5) * 2;
  return [a, { x: mx + px * amt, y: my + py * amt }, b];
}

/** build the fracture once per (seed, size): 3-5 Voronoi shards radiating from
 * a seeded impact point, plus the crack polylines along their shared walls. */
function buildGeometry(seed: number, w: number, h: number): Geometry {
  if (w < 4 || h < 4) return { shards: [], seams: [] };
  const rng = mulberry32(seed);
  const count = 3 + Math.floor(rng() * 3); // 3..5
  const cx = w * (0.42 + rng() * 0.16);
  const cy = h * (0.36 + rng() * 0.24);
  const baseAngle = rng() * Math.PI * 2;
  const seeds: Pt[] = [];
  for (let i = 0; i < count; i++) {
    const angle = baseAngle + (i / count) * Math.PI * 2 + (rng() - 0.5) * 0.8;
    const radius = (0.18 + rng() * 0.3) * Math.min(w, h);
    seeds.push({
      x: clamp(cx + Math.cos(angle) * radius, w * 0.08, w * 0.92),
      y: clamp(cy + Math.sin(angle) * radius, h * 0.08, h * 0.92),
    });
  }

  const cells = voronoiCells(seeds, w, h);
  const boxCx = w / 2;
  const boxCy = h / 2;
  const shards: Shard[] = [];
  for (const poly of cells) {
    if (poly.length < 3) continue;
    let cxp = 0;
    let cyp = 0;
    for (const p of poly) {
      cxp += p.x;
      cyp += p.y;
    }
    cxp /= poly.length;
    cyp /= poly.length;
    let dx = cxp - boxCx;
    let dy = cyp - boxCy;
    const dlen = Math.hypot(dx, dy) || 1;
    dx /= dlen;
    dy /= dlen;
    const clipPath = `polygon(${poly
      .map((p) => `${((p.x / w) * 100).toFixed(2)}% ${((p.y / h) * 100).toFixed(2)}%`)
      .join(", ")})`;
    shards.push({ clipPath, dx: dx * GAP_PX, dy: dy * GAP_PX, rot: dx * 4 });
  }

  const edges = crackEdges(cells, w, h);
  const seams: Seam[] = edges.map(({ a, b }) => {
    const pts = jagEdge(rng, a, b);
    return { pts, mx: pts[1].x, my: pts[1].y };
  });

  return { shards, seams };
}

function formatRelativeTime(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

/** the JS-computed resting appearance — authoritative under reduced motion
 * (where the CSS @keyframes below is disabled outright); otherwise it only
 * matters as the pre-hydration / no-animation fallback frame. */
function decayStyle(elapsedMs: number): CSSProperties {
  const t = clamp(elapsedMs / DECAY_MS, 0, 1);
  const opacity = PEAK_OPACITY - (PEAK_OPACITY - FLOOR_OPACITY) * (1 - (1 - t) * (1 - t));
  const mixT = Math.round(clamp(t / 0.6, 0, 1) * 100);
  return {
    opacity,
    stroke:
      mixT <= 0
        ? "var(--foreground)"
        : mixT >= 100
          ? "var(--ns-muted)"
          : `color-mix(in srgb, var(--foreground) ${100 - mixT}%, var(--ns-muted) ${mixT}%)`,
  };
}

type Phase = "pristine" | "broken" | "mending" | "healed";

export function KintsugiMend({
  status,
  children,
  reason = "network error",
  retries = 1,
  subject = "panel",
  initialIncident,
  seed = 1,
  className = "",
}: KintsugiMendProps) {
  const uid = useId();
  const stageRef = useRef<HTMLDivElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const seamRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [phase, setPhase] = useState<Phase>(
    initialIncident ? "healed" : status === "error" ? "broken" : "pristine"
  );
  const [separated, setSeparated] = useState(status === "error");
  const [incident, setIncident] = useState<KintsugiIncident | null>(initialIncident ?? null);
  const [incidentCount, setIncidentCount] = useState(initialIncident ? 1 : 0);
  const [announce, setAnnounce] = useState("");
  const [openSeamIndex, setOpenSeamIndex] = useState<number | null>(null);
  const [reduced, setReduced] = useState(false);

  const prevStatusRef = useRef(status);
  const mendTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const separateFrameRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastOpenSeamRef = useRef<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize((prev) =>
        Math.abs(prev.w - r.width) > 1 || Math.abs(prev.h - r.height) > 1
          ? { w: r.width, h: r.height }
          : prev
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const geometry = useMemo(() => buildGeometry(seed, size.w, size.h), [seed, size.w, size.h]);

  // status-driven phase machine: this owns the whole break -> mend -> heal cycle.
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;
    if (prev === status) return;

    clearTimeout(mendTimerRef.current);
    clearTimeout(separateFrameRef.current);

    if (status === "error") {
      setOpenSeamIndex(null);
      setPhase("broken");
      if (reduced) {
        setSeparated(true);
      } else {
        setSeparated(false);
        separateFrameRef.current = setTimeout(() => setSeparated(true), 16);
      }
      return;
    }

    // error -> ok: the mend. capture the incident the instant it resolves.
    const recoveredAt = Date.now();
    setIncident({ reason, retries, recoveredAt });
    setIncidentCount((n) => n + 1);
    setAnnounce(`${subject} recovered after ${reason}`);

    if (reduced) {
      setSeparated(false);
      setPhase("healed");
      return;
    }
    setPhase("mending");
    setSeparated(false);
    mendTimerRef.current = setTimeout(() => setPhase("healed"), MEND_MS);
  }, [status, reason, retries, subject, reduced]);

  useEffect(
    () => () => {
      clearTimeout(mendTimerRef.current);
      clearTimeout(separateFrameRef.current);
    },
    []
  );

  // Both ages below are deliberately never computed from Date.now() during
  // render: this is a "use client" component but Next still renders it on
  // the server for the initial HTML, and a value that depends on wall-clock
  // time would let server and client render passes disagree right at a
  // rounding boundary (149.5s -> "2 minutes ago" on one side, "3" on the
  // other) — a hydration-mismatch console.error, which fails the gate
  // outright. Both start at 0 (identical on server and client) and are set
  // for real only from an effect, strictly after mount.

  // frozen once per incident: feeds the CSS negative animation-delay seek
  // (a fresh recovery seeks to ~0, a hydrated `initialIncident` seeks
  // straight to its already-decayed frame) without any ongoing polling.
  const [seekMs, setSeekMs] = useState(0);
  useEffect(() => {
    if (incident) setSeekMs(Date.now() - incident.recoveredAt);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately keyed to incidentCount, not incident, so it seeks exactly once per incident
  }, [incidentCount]);

  // continuously (if slowly) refreshed: feeds every human-readable "N
  // minutes ago" — the seam labels and the popover — plus the reduced-motion
  // resting frame, which has no running CSS animation to age it on its own.
  const [agedMs, setAgedMs] = useState(0);
  useEffect(() => {
    if (!incident) return;
    setAgedMs(Date.now() - incident.recoveredAt);
    if (phase !== "healed") return;
    const id = setInterval(() => {
      const e = Date.now() - incident.recoveredAt;
      setAgedMs(e);
      if (reduced && e >= DECAY_MS) clearInterval(id);
    }, 15000);
    return () => clearInterval(id);
  }, [incident, phase, reduced]);

  // popover lifecycle: Escape and outside-pointerdown close it from anywhere;
  // a seam click only ever OPENS (never toggles closed on its own click) so
  // a prior synthetic press on the same seam can never leave the gate's own
  // click unable to (re)open it.
  useEffect(() => {
    if (openSeamIndex === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      lastOpenSeamRef.current = openSeamIndex;
      setOpenSeamIndex(null);
    };
    const onDown = (e: PointerEvent) => {
      const pop = popoverRef.current;
      const outer = outerRef.current;
      if (!outer || !(e.target instanceof Node)) return;
      if (pop?.contains(e.target)) return;
      if (!outer.contains(e.target)) {
        setOpenSeamIndex(null);
        return;
      }
      // inside outer but not the popover and not a seam button: outside the popover, close
      const isSeamButton = seamRefs.current.some((b) => b === e.target || b?.contains(e.target as Node));
      if (!isSeamButton) setOpenSeamIndex(null);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [openSeamIndex]);

  useEffect(() => {
    if (openSeamIndex === null) return;
    const id = requestAnimationFrame(() => popoverRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(id);
  }, [openSeamIndex]);

  useEffect(() => {
    if (openSeamIndex !== null) return;
    if (lastOpenSeamRef.current === null) return;
    seamRefs.current[lastOpenSeamRef.current]?.focus();
    lastOpenSeamRef.current = null;
  }, [openSeamIndex]);

  const w = size.w;
  const h = size.h;
  const relTime = incident ? formatRelativeTime(agedMs) : "";
  const dialogId = `${uid}-incident`;

  return (
    <div ref={outerRef} className={`relative ${className}`}>
      <div
        ref={stageRef}
        className="relative overflow-hidden rounded-md border border-border bg-background"
      >
        <div
          className="relative"
          style={{ opacity: phase === "broken" ? 0 : 1, transition: "opacity 150ms ease-out" }}
          inert={phase === "broken" ? true : undefined}
        >
          {children}
        </div>

        {(phase === "broken" || phase === "mending") && geometry.shards.length > 0 && (
          <div aria-hidden inert className="pointer-events-none absolute inset-0">
            {geometry.shards.map((s, i) => (
              <div
                key={i}
                className="absolute inset-0"
                style={{
                  clipPath: s.clipPath,
                  transform: separated
                    ? `translate(${s.dx}px, ${s.dy}px) rotate(${s.rot}deg)`
                    : "translate(0px, 0px) rotate(0deg)",
                  transition: reduced
                    ? "none"
                    : `transform ${separated ? BREAK_MS : MEND_MS}ms ${separated ? BREAK_EASE : MEND_EASE}`,
                }}
              >
                {children}
              </div>
            ))}
          </div>
        )}

        {phase === "healed" && geometry.seams.length > 0 && w > 0 && h > 0 && (
          <svg
            aria-hidden
            focusable="false"
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox={`0 0 ${w} ${h}`}
            preserveAspectRatio="none"
          >
            {geometry.seams.map((seam, i) => (
              <polyline
                key={`${incidentCount}-${i}`}
                points={seam.pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
                fill="none"
                strokeWidth={1}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                className={reduced ? undefined : "ns-kintsugi-mend-seam-line"}
                style={
                  reduced
                    ? decayStyle(agedMs)
                    : {
                        animationDuration: `${DECAY_MS}ms`,
                        animationDelay: `-${seekMs}ms`,
                      }
                }
              />
            ))}
          </svg>
        )}

        {phase === "healed" &&
          geometry.seams.map((seam, i) => (
            <button
              key={i}
              ref={(el) => {
                seamRefs.current[i] = el;
              }}
              type="button"
              data-kintsugi-seam
              aria-haspopup="dialog"
              aria-expanded={openSeamIndex === i}
              aria-controls={openSeamIndex === i ? dialogId : undefined}
              aria-label={
                incident
                  ? `recovered from ${incident.reason}, ${relTime}, ${incident.retries} ${incident.retries === 1 ? "retry" : "retries"} — fracture ${i + 1} of ${geometry.seams.length}`
                  : `fracture ${i + 1} of ${geometry.seams.length}`
              }
              onClick={() => setOpenSeamIndex(i)}
              className="absolute flex h-6 w-6 items-center justify-center rounded-full outline-none transition-colors hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              style={{ left: seam.mx, top: seam.my, transform: "translate(-50%, -50%)" }}
            />
          ))}

        <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {announce}
        </span>
      </div>

      {openSeamIndex !== null && incident && (
        <div
          ref={popoverRef}
          role="dialog"
          id={dialogId}
          tabIndex={-1}
          aria-label={`Incident: ${incident.reason}`}
          className="absolute z-10 w-64 rounded-md border border-border bg-background p-3 font-mono text-xs text-foreground shadow-[0_8px_24px_-8px_color-mix(in_srgb,var(--foreground)_45%,transparent)] outline-none"
          style={{
            left: clamp(geometry.seams[openSeamIndex]?.mx ?? w / 2, 132, Math.max(132, w - 132)),
            top:
              (geometry.seams[openSeamIndex]?.my ?? h / 2) > h * 0.6
                ? (geometry.seams[openSeamIndex]?.my ?? 0) - 10
                : (geometry.seams[openSeamIndex]?.my ?? 0) + 10,
            transform:
              (geometry.seams[openSeamIndex]?.my ?? h / 2) > h * 0.6
                ? "translate(-50%, -100%)"
                : "translate(-50%, 0%)",
          }}
        >
          <p className="uppercase tracking-widest text-ns-muted">Incident</p>
          <p className="mt-1.5 text-foreground">{incident.reason}</p>
          <dl className="mt-2 space-y-1 text-ns-muted">
            <div className="flex justify-between gap-2">
              <dt>recovered</dt>
              <dd className="text-foreground">{relTime}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>retries</dt>
              <dd className="text-foreground">{incident.retries}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>this session</dt>
              <dd className="text-foreground">
                {incidentCount} recover{incidentCount === 1 ? "y" : "ies"}
              </dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={() => {
              lastOpenSeamRef.current = openSeamIndex;
              setOpenSeamIndex(null);
            }}
            className="mt-3 w-full rounded-sm border border-border px-2 py-1 text-foreground outline-none transition-colors hover:border-foreground/25 focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Close
          </button>
        </div>
      )}

      <style>{`
        @keyframes ns-kintsugi-mend-decay {
          0%   { opacity: ${PEAK_OPACITY}; stroke: var(--foreground); }
          20%  { opacity: 0.7; stroke: color-mix(in srgb, var(--foreground) 70%, var(--ns-muted) 30%); }
          55%  { opacity: 0.4; stroke: color-mix(in srgb, var(--foreground) 22%, var(--ns-muted) 78%); }
          100% { opacity: ${FLOOR_OPACITY}; stroke: var(--ns-muted); }
        }
        .ns-kintsugi-mend-seam-line {
          animation-name: ns-kintsugi-mend-decay;
          animation-timing-function: linear;
          animation-fill-mode: forwards;
        }
        @media (prefers-reduced-motion: reduce) {
          .ns-kintsugi-mend-seam-line { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
