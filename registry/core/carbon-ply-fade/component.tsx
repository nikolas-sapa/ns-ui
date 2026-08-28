"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// CarbonPlyFade — an activity feed rendered as a carbon-paper multi-part
// form. Ply 1 through ply N are stacked as full-width, fully-visible rows
// inside one bordered form (a real stack, contiguous rows rather than
// overlapping cards — overlap would bury a lower ply's text under the
// opaque ply above it, which is the one thing that must stay legible: the
// falloff has to be readable on every ply at once). Each row is nudged
// ~2px right per ply below it (the spec's "2px right per ply behind it")
// to read as a peeled multi-part slip. A "strike" (one event) lands on ply
// 1 at full density and propagates down through the stack 90ms per row,
// each ply's registered density = the one above it x0.68 — the real
// force-dissipation falloff of a pressure-copy stack, not a chemical or
// optical fade. A ply's content flashes to its peak density INSTANTLY on
// arrival and holds there (carbon transfer is permanent per pull, it does
// not fade back out); only the row itself gives a small physical squash
// (scaleY 0.985, 60ms) and spring-back (140ms) on impact. Between strikes
// every ply is static for the remaining ~700ms of the 1.1s cadence.
// Geometry (row height, offset, font size, ply count) derives from the
// container's smaller dimension so it reads at card scale. Hovering ply 1
// pauses the cadence without touching what's already registered; the
// strike never uses --ns-accent, density is luminance-only. prefers-
// reduced-motion freezes on a fully-propagated strike, 90ms x3 after it
// lands, every ply settled and none mid-transit.
// ---------------------------------------------------------------------------

const STRIKE_INTERVAL_MS = 1100; // top-of-cadence, one strike per interval
const PROPAGATION_DELAY_MS = 90; // per-ply registration delay below the one above
const FALLOFF_RATIO = 0.68; // ply(N) peak density = ply(N-1) peak density * this
const MIN_OPACITY = 0.12; // floor so a deep ply reads "faint", never "absent"
const ROW_HEIGHT = 40; // px, one ply's readable row height at card scale, before scale
const MIN_PLY_COUNT = 4;
const MAX_PLY_COUNT = 5;
const OFFSET_X = 2; // px per ply, horizontal peel, before scale
const COMPRESS_MS = 60;
const SPRING_BACK_MS = 140;

const DEFAULT_EVENTS = [
  "Invoice #4471 → Billing, Ops, Archive",
  "Order #8825 → Warehouse, Shipping",
  "Ticket #221 → Support, Escalations",
  "Memo 6B → Legal, Compliance, Records",
  "Claim #503 → Underwriting, Adjuster",
];

function opacityForPly(i: number): number {
  return Math.max(MIN_OPACITY, Math.pow(FALLOFF_RATIO, i));
}

type PlyNode = {
  cardEl: HTMLDivElement | null;
  textEl: HTMLParagraphElement | null;
};

export interface CarbonPlyFadeProps {
  className?: string;
  /** accessible name for the live region carried by ply 1. Default "Recent activity". */
  "aria-label"?: string;
  /** rotating pool of event labels the strikes pull from; defaults to a built-in set */
  events?: string[];
}

export function CarbonPlyFade({
  className = "",
  "aria-label": ariaLabel = "Recent activity",
  events = DEFAULT_EVENTS,
}: CarbonPlyFadeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const plyRefs = useRef<PlyNode[]>([]);
  const timeoutsRef = useRef<number[]>([]);
  const strikeTimeoutRef = useRef<number | null>(null);
  const eventIdxRef = useRef(-1);
  const pausedRef = useRef(false);
  const reducedRef = useRef(false);
  const runStrikeRef = useRef<() => void>(() => {});
  const [plyCount, setPlyCount] = useState(MIN_PLY_COUNT);
  const [scale, setScale] = useState(1);

  const plyIndices = useMemo(() => Array.from({ length: plyCount }, (_, i) => i), [plyCount]);

  const clearAllTimeouts = useCallback(() => {
    for (const id of timeoutsRef.current) window.clearTimeout(id);
    timeoutsRef.current = [];
    if (strikeTimeoutRef.current !== null) {
      window.clearTimeout(strikeTimeoutRef.current);
      strikeTimeoutRef.current = null;
    }
  }, []);

  const registerPly = useCallback((i: number, text: string) => {
    const ply = plyRefs.current[i];
    if (!ply?.textEl || !ply.cardEl) return;
    ply.textEl.textContent = text;
    ply.textEl.style.opacity = String(opacityForPly(i));
    const row = ply.cardEl;
    row.style.transition = `transform ${COMPRESS_MS}ms ease-out`;
    row.style.transform = "scaleY(0.985)";
    const bounce = window.setTimeout(() => {
      row.style.transition = `transform ${SPRING_BACK_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1)`;
      row.style.transform = "scaleY(1)";
    }, COMPRESS_MS);
    timeoutsRef.current.push(bounce);
  }, []);

  const runStrike = useCallback(() => {
    if (pausedRef.current) {
      strikeTimeoutRef.current = window.setTimeout(() => runStrikeRef.current(), STRIKE_INTERVAL_MS);
      return;
    }
    eventIdxRef.current = (eventIdxRef.current + 1) % events.length;
    const text = events[eventIdxRef.current];
    for (let i = 0; i < plyRefs.current.length; i++) {
      const id = window.setTimeout(() => registerPly(i, text), i * PROPAGATION_DELAY_MS);
      timeoutsRef.current.push(id);
    }
    strikeTimeoutRef.current = window.setTimeout(() => runStrikeRef.current(), STRIKE_INTERVAL_MS);
  }, [events, registerPly]);

  runStrikeRef.current = runStrike;

  // reduced motion: paint one fully-propagated, fully-settled strike and
  // never schedule another — the deliberately chosen non-t0 freeze frame.
  const paintReducedFrame = useCallback(() => {
    const text = events[0] ?? "";
    plyRefs.current.forEach((ply, i) => {
      if (!ply?.textEl || !ply.cardEl) return;
      ply.textEl.textContent = text;
      ply.textEl.style.opacity = String(opacityForPly(i));
      ply.cardEl.style.transition = "none";
      ply.cardEl.style.transform = "scaleY(1)";
    });
  }, [events]);

  // geometry: ply count and scale derive from the container's smaller
  // dimension so this reads at card scale rather than at a fixed pixel size.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const smaller = Math.min(rect.width, rect.height || rect.width);
      const nextScale = Math.max(0.8, Math.min(1.15, smaller / 300));
      const usableHeight = rect.height || ROW_HEIGHT * MIN_PLY_COUNT;
      const fitCount = Math.floor(usableHeight / (ROW_HEIGHT * nextScale));
      const nextCount = Math.max(MIN_PLY_COUNT, Math.min(MAX_PLY_COUNT, fitCount || MIN_PLY_COUNT));
      setScale(nextScale);
      setPlyCount(nextCount);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    const onChange = (e: MediaQueryListEvent) => {
      reducedRef.current = e.matches;
      clearAllTimeouts();
      if (e.matches) {
        paintReducedFrame();
      } else {
        eventIdxRef.current = -1;
        runStrikeRef.current();
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [clearAllTimeouts, paintReducedFrame]);

  useEffect(() => {
    clearAllTimeouts();
    if (reducedRef.current) {
      paintReducedFrame();
      return;
    }
    eventIdxRef.current = -1;
    runStrikeRef.current();
    return clearAllTimeouts;
    // plyCount/scale change the geometry every registered ply reads, and a
    // resize mid-cascade should restart cleanly rather than leave stale
    // in-flight timeouts targeting the old scale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plyCount, scale, clearAllTimeouts, paintReducedFrame]);

  const onPointerEnter = useCallback(() => {
    pausedRef.current = true;
  }, []);
  const onPointerLeave = useCallback(() => {
    pausedRef.current = false;
  }, []);

  return (
    <div
      ref={containerRef}
      className={`flex h-full w-full items-start justify-center p-4 ${className}`}
      style={{ minHeight: ROW_HEIGHT * MIN_PLY_COUNT }}
    >
      <div className="w-full max-w-sm overflow-hidden rounded-md border border-border bg-background">
        {plyIndices.map((i) => (
          <div
            key={i}
            ref={(el) => {
              plyRefs.current[i] = { cardEl: el, textEl: plyRefs.current[i]?.textEl ?? null };
            }}
            onPointerEnter={i === 0 ? onPointerEnter : undefined}
            onPointerLeave={i === 0 ? onPointerLeave : undefined}
            className={`flex items-center px-3.5 ${i < plyCount - 1 ? "border-b border-border/60" : ""}`}
            style={{
              height: ROW_HEIGHT * scale,
              transformOrigin: "50% 50%",
              paddingLeft: 14 + OFFSET_X * i * scale,
            }}
            aria-hidden={i === 0 ? undefined : true}
            {...(i === 0 ? { role: "status", "aria-live": "polite", "aria-label": ariaLabel } : {})}
          >
            <p
              ref={(el) => {
                plyRefs.current[i] = { cardEl: plyRefs.current[i]?.cardEl ?? null, textEl: el };
              }}
              className="truncate font-mono text-[12px] text-foreground"
              style={{ opacity: opacityForPly(i) }}
            >
              {" "}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
