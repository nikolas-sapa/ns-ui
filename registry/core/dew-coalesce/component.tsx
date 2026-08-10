"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

// ---------------------------------------------------------------------------
// DewCoalesce — an empty state as condensation on cold glass, not an
// illustration standing in for absence. A field of droplets (plain SVG
// circles stroked in --border) nucleates across the panel from a seeded
// PRNG, grows imperceptibly on a slow tick, jitters, and merges with a
// close neighbour into one droplet of the combined area plus a brief settle
// wobble. The instant a droplet's radius crosses the runoff threshold it
// stops growing, streaks down along a slightly meandering path, and that
// exact path becomes a rounded-pill hole cut into an SVG mask — the fog
// (a low-opacity --ns-muted veil painted through that mask) is genuinely
// wiped where the droplet ran, then slowly re-fogs. A second, permanent
// hole stays cut around the heading/body/CTA block, so the copy is legible
// because the glass was cleared there, not merely because it happens to sit
// on top in z-order.
//
// All physics is driven by a single setInterval tick (no rAF, no canvas):
// each tick is a pure function over the previous droplet array, and CSS
// transitions on cx/cy/r smooth the sub-pixel deltas between ticks into
// visible, organic motion. Runoff and track-fade are handled by two small
// per-item subcomponents (RunoffDroplet, TrackRect) using the same
// mount-then-flip-state "settle" idiom already used elsewhere in this
// registry (see empty-state-pegboard's Slot) rather than manual DOM writes.
//
// Distinct from empty-state-sonar: sonar actively pings outward from a
// center and is interrupted the instant data arrives — a probing/loading
// state machine. dew-coalesce has no data-arrival handoff at all; it is a
// permanently ambient decorative background for a static empty state, and
// its one event (runoff) is a quiet reveal, not a signal.
// ---------------------------------------------------------------------------

export interface DewCoalesceProps {
  /** Headline — what is missing. */
  title?: string;
  /** One line of supporting copy. */
  description?: string;
  /** Label of the single accent CTA. Pass an empty string to omit the button. */
  actionLabel?: string;
  onAction?: () => void;
  /** Optional mark above the headline — an icon, a glyph, anything small. */
  icon?: ReactNode;
  /** Seeds the initial droplet field so the panel's starting arrangement is reproducible. */
  seed?: number;
  className?: string;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type DropletState = "grow" | "settle" | "runoff";

interface Droplet {
  id: number;
  x: number;
  y: number;
  r: number;
  state: DropletState;
  settleTicks: number;
  runDX?: number;
  runDY?: number;
  runMs?: number;
}

interface TrackSpec {
  x: number;
  y: number;
  width: number;
  height: number;
  rot: number;
}

interface Track extends TrackSpec {
  id: number;
}

const TICK_MS = 380;
const RUNOFF_R = 7.6;
const MERGE_FACTOR = 0.85;
const GROW_MIN = 0.05;
const GROW_MAX = 0.16;
const JITTER_IDLE = 0.15;
const JITTER_SETTLE = 0.6;
const SETTLE_TICKS = 3;
const MAX_TRACKS = 6;
const TRACK_GROW_MS = 900;
const TRACK_HOLD_MS = 2600;
const TRACK_REFOG_MS = 5200;
const PATCH_PAD = 22;

const CSS = `
.ns-dew-drop{fill:none;stroke:var(--border);stroke-width:1;vector-effect:non-scaling-stroke;transition:cx 340ms ease-out,cy 340ms ease-out,r 340ms ease-out}
.ns-dew-runoff{fill:none;stroke:var(--border);stroke-width:1;vector-effect:non-scaling-stroke;animation-name:ns-dew-runoff;animation-timing-function:cubic-bezier(.4,0,.2,1);animation-fill-mode:forwards;transform-box:fill-box}
@keyframes ns-dew-runoff{
  0%{transform:translate(0,0);opacity:.85}
  35%{transform:translate(calc(var(--dew-dx) * .5),calc(var(--dew-dy) * .4))}
  70%{transform:translate(calc(var(--dew-dx) * -.25),calc(var(--dew-dy) * .78))}
  100%{transform:translate(0,var(--dew-dy));opacity:0}
}
@media (prefers-reduced-motion: reduce){
  .ns-dew-drop{transition:none}
  .ns-dew-runoff{animation:none}
}
`;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function inRect(x: number, y: number, r: Rect | null, pad: number): boolean {
  if (!r) return false;
  return x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad;
}

function spawnOne(rng: () => number, w: number, h: number, avoid: Rect | null, id: number): Droplet {
  let x = w / 2;
  let y = h / 2;
  for (let tries = 0; tries < 6; tries++) {
    x = 6 + rng() * Math.max(1, w - 12);
    y = 6 + rng() * Math.max(1, h - 12);
    if (!inRect(x, y, avoid, 12)) break;
  }
  return { id, x, y, r: 1 + rng() * 2.2, state: "grow", settleTicks: 0 };
}

// Pure over the previous frame: grow/jitter every non-runoff droplet, merge
// close pairs into one (combined area, settle wobble), promote any droplet
// that crossed the runoff threshold, and occasionally nucleate a
// replacement toward the field's target count. No side effects — the
// caller decides what to do with the returned tracks.
function tickPhysics(
  prev: Droplet[],
  rng: () => number,
  w: number,
  h: number,
  targetCount: number,
  avoid: Rect | null,
  nextId: () => number
): { droplets: Droplet[]; newTracks: TrackSpec[] } {
  const arr: Droplet[] = prev.map((d) => {
    if (d.state === "runoff") return d;
    const jitter = d.state === "settle" ? JITTER_SETTLE : JITTER_IDLE;
    const x = clamp(d.x + (rng() - 0.5) * jitter, 4, Math.max(4, w - 4));
    const y = clamp(d.y + (rng() - 0.5) * jitter, 4, Math.max(4, h - 4));
    const r = d.r + GROW_MIN + rng() * (GROW_MAX - GROW_MIN);
    let settleTicks = d.settleTicks;
    let state = d.state;
    if (state === "settle") {
      settleTicks -= 1;
      if (settleTicks <= 0) state = "grow";
    }
    return { ...d, x, y, r, state, settleTicks };
  });

  // proximity merge — one pass, at most one merge per droplet per tick
  for (let i = 0; i < arr.length; i++) {
    const a = arr[i]!;
    if (a.state === "runoff") continue;
    for (let j = i + 1; j < arr.length; j++) {
      const b = arr[j]!;
      if (b.state === "runoff") continue;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (dist < (a.r + b.r) * MERGE_FACTOR) {
        const areaSum = a.r * a.r + b.r * b.r;
        const nr = Math.sqrt(areaSum);
        const nx = (a.x * a.r * a.r + b.x * b.r * b.r) / areaSum;
        const ny = (a.y * a.r * a.r + b.y * b.r * b.r) / areaSum;
        arr[i] = { ...a, x: nx, y: ny, r: nr, state: "settle", settleTicks: SETTLE_TICKS };
        arr.splice(j, 1);
        break;
      }
    }
  }

  const newTracks: TrackSpec[] = [];
  for (let i = 0; i < arr.length; i++) {
    const d = arr[i]!;
    if (d.state === "runoff" || d.r < RUNOFF_R) continue;
    const dy = Math.max(50, h - d.y) * (0.55 + rng() * 0.35);
    const dx = (rng() - 0.5) * 2 * (14 + rng() * 12);
    const ms = 850 + rng() * 480;
    newTracks.push({ x: d.x, y: d.y, width: d.r * 2.4, height: dy, rot: clamp(dx * 0.4, -14, 14) });
    arr[i] = { ...d, state: "runoff", runDX: dx, runDY: dy, runMs: ms };
  }

  const activeCount = arr.reduce((n, d) => (d.state === "runoff" ? n : n + 1), 0);
  if (activeCount < targetCount && rng() < 0.6) {
    arr.push(spawnOne(rng, w, h, avoid, nextId()));
  }

  return { droplets: arr, newTracks };
}

function RunoffDroplet({ d, onDone }: { d: Droplet; onDone: (id: number) => void }) {
  return (
    <circle
      className="ns-dew-runoff"
      cx={d.x}
      cy={d.y}
      r={d.r}
      style={
        {
          "--dew-dx": `${d.runDX ?? 0}px`,
          "--dew-dy": `${d.runDY ?? 0}px`,
          animationDuration: `${d.runMs ?? 1000}ms`,
        } as CSSProperties
      }
      onAnimationEnd={() => onDone(d.id)}
    />
  );
}

// Grows from height 0 to its target on mount (the same double-rAF
// mount-then-flip idiom empty-state-pegboard's Slot uses to get a real CSS
// transition on first paint), holds, then fades back to fog — dew re-forms.
function TrackRect({ track, onFaded }: { track: Track; onFaded: (id: number) => void }) {
  const [grown, setGrown] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setGrown(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, []);

  useEffect(() => {
    if (!grown) return;
    const t = window.setTimeout(() => setFading(true), TRACK_HOLD_MS);
    return () => window.clearTimeout(t);
  }, [grown]);

  return (
    <rect
      x={track.x - track.width / 2}
      y={track.y}
      width={track.width}
      height={grown ? track.height : 0}
      rx={track.width / 2}
      fill="black"
      style={{
        transformOrigin: `${track.x}px ${track.y}px`,
        transform: `rotate(${track.rot}deg)`,
        opacity: fading ? 0 : 1,
        transition: `height ${TRACK_GROW_MS}ms cubic-bezier(.16,1,.3,1), opacity ${TRACK_REFOG_MS}ms ease-out`,
      }}
      onTransitionEnd={(e) => {
        if (e.propertyName === "opacity" && fading) onFaded(track.id);
      }}
    />
  );
}

export function DewCoalesce({
  title = "Nothing here yet",
  description = "Items you create will show up here.",
  actionLabel = "Create your first item",
  onAction,
  icon,
  seed = 1337,
  className = "",
}: DewCoalesceProps) {
  const uid = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const contentRectRef = useRef<Rect | null>(null);
  const dropletsRef = useRef<Droplet[]>([]);
  const nextDropletId = useRef(0);
  const nextTrackId = useRef(0);
  const seededOnceRef = useRef(false);
  const rngRef = useRef<(() => number) | null>(null);
  if (rngRef.current === null) rngRef.current = mulberry32(seed);

  const [reduced, setReduced] = useState(false);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [contentRect, setContentRect] = useState<Rect | null>(null);
  const [droplets, setDroplets] = useState<Droplet[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);

  const targetCount = useMemo(
    () => (size ? clamp(Math.round((size.w * size.h) / 5200), 10, 26) : 14),
    [size]
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const measure = useCallback(() => {
    const root = rootRef.current;
    const content = contentRef.current;
    if (!root) return;
    const r = root.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const w = Math.round(r.width);
    const h = Math.round(r.height);
    setSize((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }));
    if (content) {
      const c = content.getBoundingClientRect();
      const rect: Rect = {
        x: c.left - r.left - PATCH_PAD,
        y: c.top - r.top - PATCH_PAD,
        w: c.width + PATCH_PAD * 2,
        h: c.height + PATCH_PAD * 2,
      };
      contentRectRef.current = rect;
      setContentRect((prev) =>
        prev && prev.x === rect.x && prev.y === rect.y && prev.w === rect.w && prev.h === rect.h ? prev : rect
      );
    }
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    if (contentRef.current) ro.observe(contentRef.current);
    return () => ro.disconnect();
  }, [measure]);

  // Seed the field once the panel has a real size; on later resizes, clamp
  // existing droplets into the new bounds rather than regenerating them.
  useEffect(() => {
    if (!size) return;
    const rng = rngRef.current!;
    if (!seededOnceRef.current) {
      seededOnceRef.current = true;
      const count = reduced ? Math.min(9, targetCount) : targetCount;
      const initial = Array.from({ length: count }, () =>
        spawnOne(rng, size.w, size.h, contentRectRef.current, nextDropletId.current++)
      );
      dropletsRef.current = initial;
      setDroplets(initial);
      return;
    }
    const clamped = dropletsRef.current.map((d) => ({
      ...d,
      x: clamp(d.x, 4, Math.max(4, size.w - 4)),
      y: clamp(d.y, 4, Math.max(4, size.h - 4)),
    }));
    dropletsRef.current = clamped;
    setDroplets(clamped);
    // rng is a stable ref and targetCount/reduced only matter at the very
    // first seed above; re-running this for later size changes is the
    // intended clamp path.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  // The physics tick: growth, jitter, merge, runoff. Off entirely under
  // reduced motion, which keeps the once-seeded static field as-is.
  useEffect(() => {
    if (reduced || !size) return;
    const rng = rngRef.current!;
    const id = window.setInterval(() => {
      const result = tickPhysics(
        dropletsRef.current,
        rng,
        size.w,
        size.h,
        targetCount,
        contentRectRef.current,
        () => nextDropletId.current++
      );
      dropletsRef.current = result.droplets;
      setDroplets(result.droplets);
      if (result.newTracks.length) {
        const withIds: Track[] = result.newTracks.map((t) => ({ ...t, id: nextTrackId.current++ }));
        setTracks((prev) => {
          const merged = [...prev, ...withIds];
          return merged.length > MAX_TRACKS ? merged.slice(merged.length - MAX_TRACKS) : merged;
        });
      }
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [reduced, size, targetCount]);

  const handleRunoffDone = useCallback((id: number) => {
    dropletsRef.current = dropletsRef.current.filter((d) => d.id !== id);
    setDroplets(dropletsRef.current);
  }, []);

  const handleTrackFaded = useCallback((id: number) => {
    setTracks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <div
      ref={rootRef}
      className={["relative isolate overflow-hidden rounded-[16px] border border-border bg-background", className].join(
        " "
      )}
    >
      <style>{CSS}</style>

      {size ? (
        <svg
          aria-hidden="true"
          focusable="false"
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox={`0 0 ${size.w} ${size.h}`}
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <filter id={`${uid}-feather`} x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="3.5" />
            </filter>
            <mask id={`${uid}-mask`} maskContentUnits="userSpaceOnUse">
              <rect x={0} y={0} width={size.w} height={size.h} fill="white" />
              {contentRect ? (
                <rect
                  x={contentRect.x}
                  y={contentRect.y}
                  width={Math.max(0, contentRect.w)}
                  height={Math.max(0, contentRect.h)}
                  rx={18}
                  fill="black"
                  filter={`url(#${uid}-feather)`}
                />
              ) : null}
              {!reduced ? tracks.map((t) => <TrackRect key={t.id} track={t} onFaded={handleTrackFaded} />) : null}
            </mask>
          </defs>

          <rect
            x={0}
            y={0}
            width={size.w}
            height={size.h}
            fill="var(--ns-muted)"
            opacity={0.5}
            mask={`url(#${uid}-mask)`}
          />

          <g>
            {droplets
              .filter((d) => d.state !== "runoff")
              .map((d) => (
                <circle key={d.id} className="ns-dew-drop" cx={d.x} cy={d.y} r={d.r} />
              ))}
            {droplets
              .filter((d) => d.state === "runoff")
              .map((d) => (
                <RunoffDroplet key={d.id} d={d} onDone={handleRunoffDone} />
              ))}
          </g>
        </svg>
      ) : null}

      <div ref={contentRef} className="relative flex flex-col items-center gap-1.5 px-8 py-14 text-center">
        {icon ? (
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-sm border border-border text-ns-muted">
            {icon}
          </div>
        ) : null}
        <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
        {description ? <p className="mt-1 max-w-[36ch] text-sm leading-relaxed text-ns-muted">{description}</p> : null}
        {actionLabel ? (
          <button
            type="button"
            onClick={onAction}
            className="mt-5 inline-flex items-center justify-center rounded-sm bg-ns-accent px-4 py-2 text-sm font-medium text-white transition-[background-color,transform,box-shadow] duration-200 ease-out hover:-translate-y-px hover:bg-ns-accent-hover hover:shadow-[0_0_0_1px_var(--ns-accent)] active:translate-y-0 active:bg-ns-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
