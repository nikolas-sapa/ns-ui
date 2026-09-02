"use client";

import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

// ---------------------------------------------------------------------------
// QuoinLockup — a bento grid whose interesting variable is PRESSURE, not cell
// assignment. Five tiles sit in a FIXED arrangement inside a steel chase; the
// gutters between them are real furniture with discrete quantised widths, and
// four quoins (opposing wedge pairs at the right edge and the foot) supply the
// pressure that holds the whole lockup flush. Pressure creeps down forever;
// once a tile's seeded hold value crosses the lift threshold it pies — sinks
// out of plane, tilts, grows a contact shadow — and the operator re-keys the
// quoins one at a time to bring it back. Nothing ever changes which cell a
// tile occupies: that is the entire difference from grid-bento-dense (which
// re-packs on `grid-auto-flow: dense`) and grid-bento-ascii (which re-spans a
// cell across every seam track). Here the arrangement is a constant; only the
// pressure — and, downstream of it, gutter width and tile plane — moves.
//
// D8 (round 13 decisions): this sits near letterpress the same way
// convert-foil-block does, but the two are disjoint. foil-block's variable is
// a dual TRANSFER THRESHOLD (heat + force) deciding whether a mark takes on
// paper at all; it renders no bed of type. This component's variable is
// PRESSURE distributing an already-fixed layout — it never decides whether
// content "takes", only how tightly the grid holding it is locked up.
//
// Colour is pure CSS: every value comes from --background/--foreground/
// --ns-muted/--border/--ns-accent through Tailwind utilities or an inline
// `color-mix(in srgb, var(--x), var(--y) N%)`, with light/dark deltas carried
// by a `dark:` class flipping a small custom property the color-mix reads.
// Nothing here is a raster surface, so there is no getComputedStyle/
// MutationObserver token pipeline to race against first paint — the browser
// resolves every var() and color-mix() synchronously at paint time. This
// mirrors grid-bento-dense, the nearest sibling in this collection ("All
// color from tokens via Tailwind utility classes, zero canvas").
// ---------------------------------------------------------------------------

export interface QuoinLockupTile {
  id: string;
  title: string;
  body?: string;
  href?: string;
}

export interface QuoinLockupProps {
  /** Exactly 5 tiles, fixed arrangement (2x2 hero, two elongated, two 1x1). */
  tiles?: QuoinLockupTile[];
  /** How often (in press cycles) the planer sweeps and flushes the whole form. */
  planerEvery?: number;
  className?: string;
}

const DEFAULT_TILES: QuoinLockupTile[] = [
  {
    id: "hero",
    title: "One workspace, everything in it",
    body: "Docs, tasks and reviews read from the same record, so nothing drifts out of sync between them.",
    href: "#",
  },
  { id: "tall", title: "Fast on a cold start", body: "Pages stream in as you open them, with no build step to wait on.", href: "#" },
  { id: "wide", title: "Version history", body: "Roll any document back to an earlier state without leaving the page.", href: "#" },
  { id: "a", title: "Scoped access", body: "Invite a team and choose exactly what each role can see.", href: "#" },
  { id: "b", title: "Works offline", body: "Edits queue on the device and merge cleanly the moment you reconnect.", href: "#" },
];

// -- real numbers (spec section 5) ------------------------------------------
const CHASE_INSET_F = 0.055;
const RAIL_STROKE_F = 0.012;
const U_F = 0.0125; // one pica, as a fraction of M
const LEGAL_LEVELS = [2, 3, 4, 6, 8]; // legal gutter widths, in u
const QUOIN_TRAVEL_U = 1.0;
const P_MAX = 0.93;
const P_MIN = 0.62;
const LIFT_THRESHOLD = 0.62;
const DECAY_RATE = 0.055; // P units / second
const DECAY_DURATION = (P_MAX - P_MIN) / DECAY_RATE; // ~5.64s, spec's "5.6s"
const QUOIN_COUNT = 4;
const QUOIN_INTERVAL = 0.64; // s between quoins starting their turn
const QUOIN_ROTATE = 0.32; // s for a key to turn 90deg
const QUOIN_STEP_UP = 0.19; // P per quoin, clamped at P_MAX
const REKEY_DURATION = QUOIN_COUNT * QUOIN_INTERVAL; // 2.56s, spec's "~2.6s"
const CYCLE = DECAY_DURATION + REKEY_DURATION; // ~8.2s, spec's period
const PLANER_DURATION = 0.7;
const SINK_DEPTH_F = 0.028; // fraction of M
const SINK_SCALE = 0.022; // 1 - this at full sink -> 0.978
const SINK_TILT_DEG = 0.9;
const STATIC_TIME = 6.3;

// fixed seed, never Math.random: same tile always loosens first
const JITTER = [-0.62, 0.35, -0.88, 0.71, 0.08];
const TILT_SIGN = [1, -1, 1, -1, 1];

type GutterKey = "gx1" | "gx2" | "gy1" | "gy2" | "gy3";
const FULL_GUTTERS: GutterKey[] = ["gx1", "gx2", "gy1", "gy2", "gy3"];
const COMPACT_GUTTERS: GutterKey[] = ["gx1", "gy1"];

// which gutters border each tile, so hover/focus can step just those down a
// legal size — nothing about the grid ever re-assigns, only these widths
const FULL_TILE_GUTTERS: GutterKey[][] = [
  ["gx2", "gy2"], // hero: 2x2, cols 1-2 rows 1-2
  ["gx2", "gy2"], // tall: 1x2, col 3 rows 1-2
  ["gy2", "gy3"], // wide: 2x1, cols 1-2 row 3
  ["gx2", "gy2", "gy3"], // a: 1x1, col 3 row 3
  ["gy3"], // b: full-width foot course, row 4
];
const COMPACT_TILE_GUTTERS: GutterKey[][] = [
  ["gy1"], // wide: 2x1, cols 1-2 row 1
  ["gx1", "gy1"], // a: 1x1, col 1 row 2
  ["gx1", "gy1"], // b: 1x1, col 2 row 2
];

function quantize(target: number): number {
  let best = LEGAL_LEVELS[0];
  let bestDist = Infinity;
  for (const level of LEGAL_LEVELS) {
    const d = Math.abs(level - target);
    if (d < bestDist) {
      bestDist = d;
      best = level;
    }
  }
  return best;
}

// legal gutter width, in u, for a given pressure: tighter lockup -> narrower
// furniture. Quantised, so this never reports a continuous value.
function gutterLevelFor(p: number): number {
  const clamped = Math.min(1, Math.max(0, p));
  const target = 2 + (1 - clamped) * (8 - 2);
  return quantize(target);
}

function smoothstep(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

interface QuoinLockupState {
  p: number;
  cyclePos: number;
  rekeyActive: boolean;
  activeQuoin: number; // -1 when none mid-turn
  quoinTravel: number[]; // 0..1, one per quoin, uniform
  keyDock: number; // which quoin the key sits at when idle (last one turned)
  keyRotate: number; // 0..1 (0..90deg) for the quoin mid-turn
  planerActive: boolean;
  planerX: number; // 0..1 across the form
}

// Pure function of absolute time: no integration, so the same t always
// produces the same frame. This is what makes STATIC_TIME byte-stable.
function stateAt(t: number, planerEvery: number): QuoinLockupState {
  const cycleIndex = Math.floor(t / CYCLE);
  const cyclePos = t - cycleIndex * CYCLE;
  const isPlanerCycle = planerEvery > 0 && (cycleIndex + 1) % planerEvery === 0;

  let p: number;
  let rekeyActive = false;
  let activeQuoin = -1;
  const quoinTravel = [0, 0, 0, 0];
  let keyDock = QUOIN_COUNT - 1;
  let keyRotate = 0;
  let planerActive = false;
  let planerX = 0;

  if (cyclePos < DECAY_DURATION) {
    p = P_MAX - DECAY_RATE * cyclePos;
    // wedges ease back toward their resting travel as pressure relaxes
    const travel = smoothstep((p - P_MIN) / (P_MAX - P_MIN));
    quoinTravel[0] = quoinTravel[1] = quoinTravel[2] = quoinTravel[3] = travel;
    keyDock = -1; // key is out, riding the last quoin from the previous cycle
  } else {
    rekeyActive = true;
    const rk = cyclePos - DECAY_DURATION;
    p = LIFT_THRESHOLD;
    for (let i = 0; i < QUOIN_COUNT; i++) {
      const start = i * QUOIN_INTERVAL;
      if (rk < start) {
        quoinTravel[i] = 0;
        continue;
      }
      const local = rk - start;
      const turnProgress = smoothstep(local / QUOIN_ROTATE);
      quoinTravel[i] = turnProgress;
      if (local < QUOIN_ROTATE) {
        activeQuoin = i;
        keyRotate = turnProgress;
      } else {
        keyDock = i;
      }
      // the +0.19 step begins 140ms into the turn and completes over the
      // remaining 180ms (critically damped ease, approximated by smoothstep);
      // each later quoin's iteration overwrites p with its own cumulative
      // total, so the last quoin whose turn has started wins, which is
      // exactly the running pressure after i completed steps plus this one
      const stepProgress = smoothstep((local - 0.14) / 0.18);
      p = Math.min(P_MAX, LIFT_THRESHOLD + i * QUOIN_STEP_UP + QUOIN_STEP_UP * stepProgress);
    }
    if (isPlanerCycle && rk < PLANER_DURATION) {
      planerActive = true;
      planerX = smoothstep(rk / PLANER_DURATION);
    }
  }

  return { p, cyclePos, rekeyActive, activeQuoin, quoinTravel, keyDock, keyRotate, planerActive, planerX };
}

function sinkFracFor(p: number, index: number): number {
  const h = p + 0.1 * JITTER[index];
  if (h >= LIFT_THRESHOLD) return 0;
  return Math.min(1, (LIFT_THRESHOLD - h) / LIFT_THRESHOLD);
}

// tile x-position, as a fraction of the chase width, used only to decide when
// the planer bar has swept past a given tile (left column vs right column)
const FULL_TILE_X: number[] = [0.28, 0.83, 0.28, 0.83, 0.5];
const COMPACT_TILE_X: number[] = [0.5, 0.25, 0.75];

export function QuoinLockup({ tiles = DEFAULT_TILES, planerEvery = 3, className = "" }: QuoinLockupProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [m, setM] = useState(0);
  const [compact, setCompact] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  const gridRef = useRef<HTMLDivElement | null>(null);
  const tileRefs = useRef(new Map<string, HTMLAnchorElement | HTMLButtonElement>());
  const quoinRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null]);
  const keyRef = useRef<HTMLDivElement | null>(null);
  const planerRef = useRef<HTMLDivElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);

  const rows = compact ? tiles.slice(0, 3) : tiles.slice(0, 5);
  const gutterKeys = compact ? COMPACT_GUTTERS : FULL_GUTTERS;
  const tileGutters = compact ? COMPACT_TILE_GUTTERS : FULL_TILE_GUTTERS;
  const tileX = compact ? COMPACT_TILE_X : FULL_TILE_X;

  // measure before paint so the form is never shown at the wrong size
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const measure = (w: number) => {
      setM(w);
      setCompact(w < 320);
    };
    const rect = host.getBoundingClientRect();
    measure(Math.min(rect.width, rect.height) || rect.width);
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const box = entry.contentRect;
      measure(Math.min(box.width, box.height) || box.width);
    });
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const u = m * U_F;

  const applyFrame = useMemo(
    () => (t: number) => {
      const st = stateAt(t, planerEvery);

      // gutters: pressure-derived legal width, minus one legal step for
      // whichever gutters border the currently hovered/focused tile
      const hoveredIndex = hoveredId ? rows.findIndex((c) => c.id === hoveredId) : -1;
      const hoveredKeys = hoveredIndex >= 0 ? tileGutters[hoveredIndex] : [];
      const baseLevel = gutterLevelFor(st.p);
      const grid = gridRef.current;
      if (grid) {
        for (const key of gutterKeys) {
          let level = baseLevel;
          if (hoveredKeys.includes(key)) {
            const idx = LEGAL_LEVELS.indexOf(level);
            level = LEGAL_LEVELS[Math.max(0, idx - 1)];
          }
          // the track size lives on the grid container's own custom
          // property — a property set on a gutter cell would not be
          // inherited upward by its ancestor's grid-template
          grid.style.setProperty(`--gw-${key}`, `${level * u}px`);
        }
      }

      // tiles: sink, tilt, contact shadow, planer override
      rows.forEach((tile, i) => {
        const el = tileRefs.current.get(tile.id);
        if (!el) return;
        let sink = sinkFracFor(st.p, i);
        if (st.planerActive && st.planerX >= tileX[i]) sink = 0;
        const sinkPx = sink * SINK_DEPTH_F * m;
        const scale = 1 - SINK_SCALE * sink;
        const tilt = SINK_TILT_DEG * sink * TILT_SIGN[i];
        el.style.setProperty("--sink", `${sinkPx}px`);
        el.style.setProperty("--tile-scale", `${scale}`);
        el.style.setProperty("--tile-tilt", `${tilt}deg`);
        el.style.setProperty("--shadow-o", `${sink}`);
        el.style.setProperty("--edge-o", `${1 - sink}`);
      });

      // quoins + key
      for (let i = 0; i < QUOIN_COUNT; i++) {
        const el = quoinRefs.current[i];
        if (el) el.style.setProperty("--travel", `${st.quoinTravel[i] * QUOIN_TRAVEL_U * u}px`);
      }
      if (keyRef.current) {
        const dockIndex = st.activeQuoin >= 0 ? st.activeQuoin : Math.max(0, st.keyDock);
        keyRef.current.style.setProperty("--key-slot", `${dockIndex}`);
        keyRef.current.style.setProperty("--key-rotate", `${st.keyRotate * 90}deg`);
        keyRef.current.style.opacity = st.rekeyActive ? "1" : "0";
      }
      if (planerRef.current) {
        planerRef.current.style.opacity = st.planerActive ? "1" : "0";
        planerRef.current.style.setProperty("--planer-x", `${st.planerX * 100}%`);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [m, u, compact, hoveredId, planerEvery]
  );

  useLayoutEffect(() => {
    if (m <= 0) return;

    if (reducedMotion) {
      applyFrame(STATIC_TIME);
      return;
    }

    let raf = 0;
    let running = false;
    const origin = performance.now();

    const loop = (now: number) => {
      applyFrame((now - origin) / 1000);
      raf = requestAnimationFrame(loop);
    };
    const wake = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(loop);
    };
    const sleep = () => {
      cancelAnimationFrame(raf);
      running = false;
    };

    const host = hostRef.current;
    let onScreen = true;
    const io = host
      ? new IntersectionObserver(
          (entries) => {
            onScreen = entries.some((en) => en.isIntersecting);
            if (!onScreen) sleep();
            else if (!document.hidden) wake();
          },
          { threshold: 0 }
        )
      : null;
    if (host && io) io.observe(host);

    const onVis = () => {
      if (document.hidden) sleep();
      else if (onScreen) wake();
    };
    document.addEventListener("visibilitychange", onVis);
    wake();

    return () => {
      sleep();
      io?.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [m, reducedMotion, applyFrame]);

  const onKeyDown = (e: KeyboardEvent<HTMLElement>, index: number) => {
    const count = rows.length;
    let next = index;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        next = (index + 1) % count;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        next = (index - 1 + count) % count;
        break;
      default:
        return;
    }
    setActiveIdx(next);
    const el = tileRefs.current.get(rows[next].id);
    el?.focus();
  };

  // grid-column/row spans are module-level constants, never written after
  // mount — pressure changes gutter TRACK SIZE (the --gw-* custom
  // properties, set imperatively on the grid container in applyFrame), spans
  // never change.
  const fullTemplateCols = "minmax(0,1fr) var(--gw-gx1,3px) minmax(0,1fr) var(--gw-gx2,3px) minmax(0,1fr)";
  const fullTemplateRows =
    "minmax(0,1fr) var(--gw-gy1,3px) minmax(0,1fr) var(--gw-gy2,3px) minmax(0,1fr) var(--gw-gy3,3px) minmax(0,1fr)";
  const compactTemplateCols = "minmax(0,1fr) var(--gw-gx1,3px) minmax(0,1fr)";
  const compactTemplateRows = "minmax(0,1fr) var(--gw-gy1,3px) minmax(0,1fr)";

  return (
    <div ref={hostRef} className={`relative h-full w-full min-h-[240px] ${className}`}>
      {/* frame layer: chase rail + quoins + key + planer. Positioned as
          fractions of the chase, so it needs nothing from the tile grid. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
        <div
          ref={railRef}
          className="absolute [--rail-a:72%] dark:[--rail-a:100%]"
          style={{
            inset: m * CHASE_INSET_F,
            borderWidth: Math.max(1, m * RAIL_STROKE_F),
            borderStyle: "solid",
            borderColor: "color-mix(in srgb, var(--foreground) var(--rail-a), transparent)",
            borderRadius: 2,
          }}
        />
        {[0, 1, 2, 3].map((i) => {
          const edge = i < 2 ? "right" : "foot";
          const along = edge === "right" ? (i === 0 ? 0.32 : 0.68) : i === 2 ? 0.32 : 0.68;
          const len = u * 3;
          const thick = u * 1.4;
          return (
            <div
              key={i}
              ref={(el) => {
                quoinRefs.current[i] = el;
              }}
              className="absolute [--travel:0px]"
              style={
                edge === "right"
                  ? {
                      right: m * CHASE_INSET_F - thick * 0.4,
                      top: `calc(${along * 100}% - ${len / 2}px)`,
                      width: thick,
                      height: len,
                    }
                  : {
                      bottom: m * CHASE_INSET_F - thick * 0.4,
                      left: `calc(${along * 100}% - ${len / 2}px)`,
                      height: thick,
                      width: len,
                    }
              }
            >
              <div
                className="absolute inset-0 [--wedge-a:46%] dark:[--wedge-a:58%]"
                style={{
                  background: "color-mix(in srgb, var(--background), var(--foreground) var(--wedge-a))",
                  transform: edge === "right" ? "skewY(-14deg)" : "skewX(-14deg)",
                }}
              />
              <div
                className="absolute inset-0 [--wedge-b:34%] dark:[--wedge-b:46%]"
                style={{
                  background: "color-mix(in srgb, var(--background), var(--foreground) var(--wedge-b))",
                  transform:
                    edge === "right"
                      ? "skewY(-14deg) translateY(var(--travel))"
                      : "skewX(-14deg) translateX(var(--travel))",
                }}
              />
            </div>
          );
        })}
        <div
          ref={keyRef}
          className="absolute h-[1.6em] w-[1.6em] max-h-4 max-w-4 border-2 border-ns-muted transition-[opacity] duration-200"
          style={{
            right: m * CHASE_INSET_F - 8,
            bottom: `calc(20% + var(--key-slot, 0) * 15%)`,
            transform: "rotate(var(--key-rotate, 0deg))",
            opacity: 0,
          }}
        />
        <div
          ref={planerRef}
          className="absolute top-0 h-full w-[3px] bg-ns-muted transition-[opacity] duration-150"
          style={{ left: "var(--planer-x, 0%)", opacity: 0 }}
        />
      </div>

      <div
        ref={gridRef}
        role="group"
        aria-label="Bento grid locked by four quoins. Arrow keys move between tiles."
        className="relative z-[1] grid h-full w-full gap-0"
        style={{
          padding: m * CHASE_INSET_F + Math.max(1, m * RAIL_STROKE_F) * 2,
          gridTemplateColumns: compact ? compactTemplateCols : fullTemplateCols,
          gridTemplateRows: compact ? compactTemplateRows : fullTemplateRows,
        }}
      >
        {gutterKeys.map((key) => (
          <div
            key={key}
            aria-hidden
            className="[--fill-a:40%]"
            style={{
              gridColumn: gridAreaFor(key, compact, "col"),
              gridRow: gridAreaFor(key, compact, "row"),
              backgroundColor: "color-mix(in srgb, var(--background), var(--foreground) var(--fill-a))",
              backgroundImage:
                key.startsWith("gx")
                  ? `repeating-linear-gradient(to bottom, transparent 0, transparent calc(${Math.max(
                      1,
                      m * 0.11
                    )}px - 1px), color-mix(in srgb, var(--border), var(--foreground) 30%) calc(${Math.max(
                      1,
                      m * 0.11
                    )}px - 1px), color-mix(in srgb, var(--border), var(--foreground) 30%) ${Math.max(1, m * 0.11)}px)`
                  : `repeating-linear-gradient(to right, transparent 0, transparent calc(${Math.max(
                      1,
                      m * 0.11
                    )}px - 1px), color-mix(in srgb, var(--border), var(--foreground) 30%) calc(${Math.max(
                      1,
                      m * 0.11
                    )}px - 1px), color-mix(in srgb, var(--border), var(--foreground) 30%) ${Math.max(1, m * 0.11)}px)`,
            }}
          />
        ))}

        {rows.map((tile, i) => {
          const isHero = !compact && i === 0;
          const commonProps = {
            ref: (el: HTMLAnchorElement | HTMLButtonElement | null) => {
              if (el) tileRefs.current.set(tile.id, el);
              else tileRefs.current.delete(tile.id);
            },
            tabIndex: i === activeIdx ? 0 : -1,
            onFocus: () => setActiveIdx(i),
            onMouseEnter: () => setHoveredId(tile.id),
            onMouseLeave: () => setHoveredId((cur) => (cur === tile.id ? null : cur)),
            onKeyDown: (e: KeyboardEvent<HTMLElement>) => onKeyDown(e, i),
            className:
              "quoin-lockup-tile group relative isolate flex flex-col justify-start gap-1 overflow-hidden rounded-sm border p-3 text-left transition-colors duration-150 " +
              "[--face-mix:10%] dark:[--face-mix:16%] " +
              "border-transparent hover:[--face-mix:12%] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent",
            style: {
              gridColumn: gridAreaFor(`tile-${i}`, compact, "col"),
              gridRow: gridAreaFor(`tile-${i}`, compact, "row"),
              backgroundColor: "color-mix(in srgb, var(--background), var(--foreground) var(--face-mix))",
              borderTopColor: "color-mix(in srgb, var(--foreground) calc(var(--edge-o, 1) * 22%), transparent)",
              transform:
                "translateY(var(--sink, 0px)) scale(var(--tile-scale, 1)) rotate(var(--tile-tilt, 0deg))",
              boxShadow: "0 calc(var(--sink, 0px) * 0.6) calc(var(--sink, 0px) * 1.8) color-mix(in srgb, var(--foreground) calc(var(--shadow-o, 0) * 38%), transparent)",
              zIndex: i,
            } as React.CSSProperties,
            "aria-label": tile.title,
            "data-tile-id": tile.id,
          };
          const content = (
            <>
              <h3 className={`font-medium leading-snug text-foreground ${isHero ? "text-base" : "text-sm"}`}>
                {tile.title}
              </h3>
              {tile.body && (
                <p className={`text-ns-muted ${isHero ? "max-w-[34ch] text-sm leading-snug" : "text-xs leading-snug"}`}>
                  {tile.body}
                </p>
              )}
            </>
          );
          return tile.href ? (
            <a key={tile.id} {...commonProps} href={tile.href}>
              {content}
            </a>
          ) : (
            <button key={tile.id} {...commonProps} type="button">
              {content}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Raw grid line coordinates for the fixed arrangement. Content track i (1..n)
// sits at raw line [2i-1, 2i] once gutter tracks are interleaved between
// every pair of content tracks. These are constants — never recomputed by
// pressure state, only read once per render.
function gridAreaFor(key: string, compact: boolean, axis: "col" | "row"): string {
  const rawLine = (content: number) => `${2 * content - 1} / ${2 * content + 1}`;
  if (compact) {
    const colOf = (c1: number, c2 = c1) => `${2 * c1 - 1} / ${2 * c2}`;
    const rowOf = (r1: number, r2 = r1) => `${2 * r1 - 1} / ${2 * r2}`;
    if (key === "gx1") return axis === "col" ? "2 / 3" : "1 / 4";
    if (key === "gy1") return axis === "row" ? "2 / 3" : "1 / 4";
    switch (key) {
      case "tile-0": // wide: cols 1-2, row 1
        return axis === "col" ? colOf(1, 2) : rowOf(1);
      case "tile-1": // a: col 1, row 2
        return axis === "col" ? colOf(1) : rowOf(2);
      case "tile-2": // b: col 2, row 2
        return axis === "col" ? colOf(2) : rowOf(2);
      default:
        return "1 / 2";
    }
  }
  const colOf = (c1: number, c2 = c1) => `${2 * c1 - 1} / ${2 * c2}`;
  const rowOf = (r1: number, r2 = r1) => `${2 * r1 - 1} / ${2 * r2}`;
  if (key === "gx1") return axis === "col" ? "2 / 3" : "1 / 7";
  if (key === "gx2") return axis === "col" ? "4 / 5" : "1 / 6";
  if (key === "gy1") return axis === "row" ? "2 / 3" : "1 / 6";
  if (key === "gy2") return axis === "row" ? "4 / 5" : "1 / 6";
  if (key === "gy3") return axis === "row" ? "6 / 7" : "1 / 6";
  switch (key) {
    case "tile-0": // hero: cols 1-2, rows 1-2
      return axis === "col" ? colOf(1, 2) : rowOf(1, 2);
    case "tile-1": // tall: col 3, rows 1-2
      return axis === "col" ? colOf(3) : rowOf(1, 2);
    case "tile-2": // wide: cols 1-2, row 3
      return axis === "col" ? colOf(1, 2) : rowOf(3);
    case "tile-3": // a: col 3, row 3
      return axis === "col" ? colOf(3) : rowOf(3);
    case "tile-4": // b: cols 1-3, row 4 — the foot course runs the full width,
      // so the chase is packed edge to edge and no cell is left inert
      return axis === "col" ? colOf(1, 3) : rowOf(4);
    default:
      return rawLine(1);
  }
}

QuoinLockup.displayName = "QuoinLockup";
