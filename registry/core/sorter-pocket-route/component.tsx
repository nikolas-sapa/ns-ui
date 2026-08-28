"use client";

// ---------------------------------------------------------------------------
// SorterPocketRoute — an ambient processing/organizing loader modeled on a
// Hollerith tabulating-machine card sorter's CHUTE, not its brush reader.
// Cards drop single-file down a center track; at a fixed gate a flap swings
// to one of five headings and the card curves off with it into a numbered
// pocket below, landing on that pocket's growing stack. The read event
// (round 9's jacquard-card-chain territory — a needle bank resolving a
// punched pattern) is deliberately absent here: nothing is "read" on
// screen, there is no bank of needles or pips, and the visible subject is
// entirely the routing mechanism — the gate's decisive swing and the
// pockets filling unevenly over time, never a card being decoded.
//
// ROUTING. Pocket assignment cycles a fixed period-17 sequence (never a
// runtime Math.random pick) weighted so the center pocket receives roughly
// 2x an outer pocket's share — uneven fill is part of what reads "alive".
// The sequence is long enough that it doesn't visibly repeat within a
// short viewing window (17 cards * 1.1s feed ~= 18.7s per full cycle).
//
// TIMING. One card feeds every 1.1s. A card's full journey — 300ms
// straight drop to the gate, then 380ms ease-in-out gate-swing + curve
// into its pocket — takes 680ms, safely inside the 1.1s feed interval, so
// exactly one card is ever mid-journey at a time and a viewer can follow
// one card start-to-finish without a second card's motion overlapping it.
// The gate flap itself swings in the same 380ms window and eases back to
// its neutral heading between cards, so the mechanism reads as "deciding"
// rather than merely decorating the card's own motion.
//
// POCKETS. Each pocket holds a rolling window of 14 visible cards, newest
// on top; a 15th arrival fades the bottom (oldest) card out over 260ms as
// the new one lands — a continuous rolling loop with no visible restart.
// Stack rise is 3px/card, capped so the tallest pocket never exceeds 70%
// of the bin's height (older cards compress toward that cap rather than
// spilling out of the bin).
//
// TOKENS. Card fill is --background, card outline --foreground at 60%
// opacity (color-mix, no literal). Pocket bin outlines are --border — a
// separator, never a fill. Stacked cards inside a pocket step from 25% to
// 55% --foreground mixed into --background, oldest to newest, so pocket
// depth reads as a value gradient. No --ns-accent anywhere: the gate's
// heading is conveyed purely by its swing angle and the card's curved
// path, never by a color cue. All colors are CSS custom properties
// referenced directly (var(...) / color-mix(...)) — nothing is read via
// getComputedStyle because nothing here needs a numeric color value, only
// a token reference the browser resolves itself.
// ---------------------------------------------------------------------------

import { useEffect, useId, useMemo, useRef, useState } from "react";

const POCKET_COUNT = 5;
// period-17 pseudo-random routing sequence, center pocket (index 2) weighted
// roughly 2x an outer pocket's share (6 hits vs ~3 each for the outer four)
const ROUTE_PATTERN = [2, 0, 3, 2, 4, 1, 2, 0, 3, 2, 1, 4, 2, 0, 3, 1, 2] as const;
const GATE_ANGLES = [-60, -30, 0, 30, 60] as const; // deg, pocket 0..4

const FEED_MS = 1100;
const DROP_MS = 300;
const ROUTE_MS = 380;
const POCKET_CAPACITY = 14;
const FADE_MS = 260;
const RISE_PX = 3;
const MAX_RISE_FRAC = 0.7; // of bin height

const ROUTE_EASE = "cubic-bezier(0.4, 0, 0.2, 1)"; // ease-in-out

interface FlightCard {
  id: number;
  pocket: number;
  phase: "drop" | "route";
}

interface LandedCard {
  id: number;
  removing: boolean;
}

export interface SorterPocketRouteProps {
  /** text announced via the component's own aria-live region */
  label?: string;
  /** freeze on the reduced-motion tableau regardless of the OS setting */
  paused?: boolean;
  /** extra classes merged onto the rendered root element */
  className?: string;
  style?: React.CSSProperties;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

// hand-authored STATIC_PHASE: one card frozen mid-chute at the 60%-through
// point of its gate-swing (its translate sits between the vertical drop
// line and its pocket's horizontal offset, so it reads angled, neither
// vertical nor horizontal), and five pockets showing a distinctly uneven
// fill — never all-empty, never all-equal.
const STATIC_POCKET_COUNTS = [4, 9, 3, 11, 6];
const STATIC_FROZEN_POCKET = 4;
const STATIC_PROGRESS = 0.6;

export function SorterPocketRoute({
  label = "Sorting",
  paused = false,
  className = "",
  style,
}: SorterPocketRouteProps) {
  const uid = useId();
  const reducedMotion = useReducedMotion();
  const frozen = reducedMotion || paused;

  const rootRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 320, h: 220 });

  const [pockets, setPockets] = useState<LandedCard[][]>(() =>
    Array.from({ length: POCKET_COUNT }, () => []),
  );
  const [flight, setFlight] = useState<FlightCard | null>(null);
  const [gatePocket, setGatePocket] = useState<number | null>(null);

  const nextIdRef = useRef(0);
  const routeCountRef = useRef(0);
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const addTimer = (fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timersRef.current.delete(id);
      fn();
    }, ms);
    timersRef.current.add(id);
    return id;
  };
  const clearAllTimers = () => {
    timersRef.current.forEach((id) => clearTimeout(id));
    timersRef.current.clear();
  };

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect || rect.width < 2 || rect.height < 2) return;
      setSize({ w: rect.width, h: rect.height });
    });
    ro.observe(root);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (frozen) {
      clearAllTimers();
      setFlight(null);
      setGatePocket(null);
      return;
    }

    const spawn = () => {
      const pocket = ROUTE_PATTERN[routeCountRef.current % ROUTE_PATTERN.length]!;
      routeCountRef.current += 1;
      const id = nextIdRef.current++;
      setFlight({ id, pocket, phase: "drop" });

      addTimer(() => {
        setFlight((f) => (f && f.id === id ? { ...f, phase: "route" } : f));
        setGatePocket(pocket);
      }, DROP_MS);

      addTimer(() => {
        setFlight((f) => (f && f.id === id ? null : f));
        setGatePocket((p) => (p === pocket ? null : p));
        setPockets((prev) => {
          const next = prev.map((bin) => bin.slice());
          next[pocket]!.push({ id, removing: false });
          if (next[pocket]!.length > POCKET_CAPACITY) {
            const oldest = next[pocket]![0]!;
            oldest.removing = true;
            const oldestId = oldest.id;
            addTimer(() => {
              setPockets((p2) => {
                const n2 = p2.map((bin) => bin.slice());
                n2[pocket] = n2[pocket]!.filter((c) => c.id !== oldestId);
                return n2;
              });
            }, FADE_MS);
          }
          return next;
        });
      }, DROP_MS + ROUTE_MS);
    };

    // first card feeds immediately so the loader isn't empty at mount
    spawn();
    const interval = setInterval(spawn, FEED_MS);
    return () => {
      clearInterval(interval);
      clearAllTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frozen]);

  useEffect(() => clearAllTimers, []);

  // -------------------------------------------------------------------
  // geometry — pocket width from container width (leaves a gutter), card
  // height derived from pocket width, so the whole assembly compresses
  // together at narrow container widths rather than any piece clipping.
  // -------------------------------------------------------------------
  const geo = useMemo(() => {
    const w = size.w;
    const h = size.h;
    const pocketW = w / 5.5;
    const cardH = pocketW * 0.4;
    const cardW = pocketW * 0.72;
    const gutter = POCKET_COUNT > 1 ? (w - POCKET_COUNT * pocketW) / (POCKET_COUNT - 1) : 0;
    const pocketLeft = (i: number) => i * (pocketW + gutter);
    const pocketCenterX = (i: number) => pocketLeft(i) + pocketW / 2;
    const trackX = w / 2;
    const gateY = h * 0.32;
    const binTop = h * 0.4;
    const binHeight = h * 0.58;
    const binBottom = binTop + binHeight;
    const rise = Math.min(RISE_PX, (binHeight * MAX_RISE_FRAC) / POCKET_CAPACITY);
    return { w, h, pocketW, cardH, cardW, pocketLeft, pocketCenterX, trackX, gateY, binTop, binHeight, binBottom, rise };
  }, [size]);

  const landY = (pocket: number, indexFromBottom: number) => geo.binBottom - geo.cardH / 2 - indexFromBottom * geo.rise;

  const flightStyle = (): React.CSSProperties | null => {
    if (!flight) return null;
    const startX = geo.trackX;
    const startY = geo.cardH / 2;
    if (flight.phase === "drop") {
      return {
        left: startX - geo.cardW / 2,
        top: 0,
        width: geo.cardW,
        height: geo.cardH,
        transform: `translateY(${geo.gateY - geo.cardH / 2}px) rotate(0deg)`,
        transition: `transform ${DROP_MS}ms linear`,
      };
    }
    const targetX = geo.pocketCenterX(flight.pocket);
    const targetY = landY(flight.pocket, pockets[flight.pocket]?.length ?? 0);
    return {
      left: startX - geo.cardW / 2,
      top: 0,
      width: geo.cardW,
      height: geo.cardH,
      transform: `translate(${targetX - startX}px, ${targetY}px) rotate(-6deg)`,
      transition: `transform ${ROUTE_MS}ms ${ROUTE_EASE}`,
    };
  };

  const frozenFlightStyle = (): React.CSSProperties => {
    const startX = geo.trackX;
    const targetX = geo.pocketCenterX(STATIC_FROZEN_POCKET);
    const targetY = landY(STATIC_FROZEN_POCKET, STATIC_POCKET_COUNTS[STATIC_FROZEN_POCKET]!);
    const t = STATIC_PROGRESS;
    return {
      left: startX - geo.cardW / 2,
      top: 0,
      width: geo.cardW,
      height: geo.cardH,
      transform: `translate(${(targetX - startX) * t}px, ${geo.gateY - geo.cardH / 2 + (targetY - (geo.gateY - geo.cardH / 2)) * t}px) rotate(${-6 * t}deg)`,
    };
  };

  const gateAngle = frozen
    ? GATE_ANGLES[STATIC_FROZEN_POCKET]! * STATIC_PROGRESS
    : gatePocket === null
      ? 0
      : GATE_ANGLES[gatePocket]!;

  const activePockets: LandedCard[][] = frozen
    ? STATIC_POCKET_COUNTS.map((n) =>
        Array.from({ length: n }, (_, i) => ({ id: i, removing: false })),
      )
    : pockets;

  return (
    <div
      ref={rootRef}
      role="status"
      aria-live="polite"
      className={`relative h-[220px] w-full select-none ${className}`}
      style={style}
    >
      <span className="sr-only">{label}</span>
      <div className="relative h-full w-full" aria-hidden="true">
        {/* gate + flap — the mechanism, not the card, is the decision-maker */}
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{ top: geo.gateY - 1 }}
        >
          <div
            className="h-[2px] origin-left rounded-full"
            style={{
              width: geo.pocketW * 0.55,
              backgroundColor: "var(--foreground)",
              transform: `rotate(${gateAngle}deg)`,
              transition: frozen ? "none" : `transform ${ROUTE_MS}ms ${ROUTE_EASE}`,
            }}
          />
        </div>

        {/* flying card */}
        {frozen ? (
          <div
            className="absolute rounded-[2px] border"
            style={{
              ...frozenFlightStyle(),
              backgroundColor: "var(--background)",
              borderColor: "color-mix(in srgb, var(--foreground) 60%, transparent)",
            }}
          />
        ) : (
          flight && (
            <div
              className="absolute rounded-[2px] border"
              style={{
                ...(flightStyle() as React.CSSProperties),
                backgroundColor: "var(--background)",
                borderColor: "color-mix(in srgb, var(--foreground) 60%, transparent)",
              }}
            />
          )
        )}

        {/* pockets row */}
        <div className="absolute inset-x-0" style={{ top: geo.binTop, height: geo.binHeight }}>
          {Array.from({ length: POCKET_COUNT }).map((_, p) => (
            <div
              key={p}
              className="absolute rounded-[3px] border"
              style={{
                left: geo.pocketLeft(p),
                width: geo.pocketW,
                top: 0,
                height: geo.binHeight,
                borderColor: "var(--border)",
              }}
            >
              {activePockets[p]!.map((card, i) => {
                const pct = 25 + (30 * i) / Math.max(1, POCKET_CAPACITY - 1);
                return (
                  <div
                    key={`${uid}-${p}-${card.id}`}
                    className="absolute rounded-[1px]"
                    style={{
                      left: (geo.pocketW - geo.cardW) / 2,
                      width: geo.cardW,
                      height: geo.cardH,
                      bottom: i * geo.rise,
                      backgroundColor: `color-mix(in srgb, var(--foreground) ${pct}%, var(--background))`,
                      opacity: card.removing ? 0 : 1,
                      transition: card.removing ? `opacity ${FADE_MS}ms ease` : undefined,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

SorterPocketRoute.displayName = "SorterPocketRoute";
