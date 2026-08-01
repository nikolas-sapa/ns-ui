"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// EchoSound — an empty state that behaves like sonar, not an illustration
// waiting to be swapped for a skeleton. While nothing has resolved, a thin
// SVG ring (stroked in --border) expands calmly from the stage's center on a
// slow, lightly-randomized 6-8s cadence, finds nothing, and fades — the same
// object every cycle, so emptiness is demonstrated rather than captioned.
//
// The instant data arrives, that same ring is interrupted mid-flight: its
// current radius/opacity is read once (getComputedStyle) and re-applied
// inline so nothing jumps, the CSS keyframe is swapped for a single CSS
// transition to the radius that reaches row one, and it holds there. Rows
// then scale in from that shared center point at a 60ms stagger, ease-out,
// before crossfading into the real content in place. Two timeline handoffs
// (ping -> contact, contact -> resolved) — no rAF loop, no canvas.
//
// Distinct from status-glyph-cadence: that is a small inline status lamp whose
// cadence itself IS the message, blinking in place forever. This is a full
// content region — the ring is a spatial probe INTO that region, and it is
// the arriving content, not a timer, that interrupts and answers it.
// ---------------------------------------------------------------------------

export interface EchoSoundItem {
  id: string | number;
  content: ReactNode;
}

export interface EchoSoundProps {
  /** null = nothing has resolved yet (the ring probes). An array — including
   * an empty one — means the search settled; non-empty triggers the reveal. */
  items: EchoSoundItem[] | null;
  /** Named in the empty-state copy: `No results for "${query}"`. */
  query?: string;
  /** Row height in px — also what the ring's contact radius targets. */
  rowHeight?: number;
  /** Gap between rows, px. */
  rowGap?: number;
  /** Rows the stage reserves height for while probing (usually your expected count). */
  stageRows?: number;
  className?: string;
}

type Phase = "empty" | "arriving" | "loaded";

const STAGGER_MS = 60;
const ROW_REVEAL_MS = 420;
const CONTACT_HOLD_MS = 380;
const CROSSFADE_MS = 240;
const SETTLE_HOLD_MS = 220;
const MAX_STAGGERED_ROWS = 10;

const CSS = `
.ns-echo-ring{transform-box:fill-box}
.ns-echo-pinging{animation:ns-echo-ping var(--ns-echo-period,7000ms) cubic-bezier(.32,.72,.35,1) infinite}
@keyframes ns-echo-ping{
  0%{r:3;stroke-opacity:.85}
  70%{stroke-opacity:.18}
  100%{r:47;stroke-opacity:0}
}
.ns-echo-row{position:relative}
.ns-echo-skel{
  position:absolute;inset:0;border-radius:8px;background:var(--border);
  transform:scaleX(0);transform-origin:50% 50%;opacity:0;
}
.ns-echo-row-in .ns-echo-skel{
  animation:ns-echo-row-in ${ROW_REVEAL_MS}ms cubic-bezier(.16,1,.3,1) forwards;
}
@keyframes ns-echo-row-in{
  from{transform:scaleX(0);opacity:0}
  to{transform:scaleX(1);opacity:1}
}
.ns-echo-loaded .ns-echo-skel{opacity:0;transition:opacity ${CROSSFADE_MS}ms ease-out}
.ns-echo-content{
  position:absolute;inset:0;opacity:0;transition:opacity ${CROSSFADE_MS}ms ease-out;
}
.ns-echo-loaded .ns-echo-content{opacity:1}
@media (prefers-reduced-motion: reduce){
  .ns-echo-pinging{animation:none}
  .ns-echo-row-in .ns-echo-skel{animation:none}
  .ns-echo-content,.ns-echo-loaded .ns-echo-skel{transition:none}
}
`;

// Radius (in the ring's 0-100 viewBox space) whose upward reach lands exactly
// on row one's vertical center — pure arithmetic from known row geometry, no
// DOM measurement needed. The viewBox scales non-uniformly onto the stage
// (preserveAspectRatio="none"), so this fraction maps correctly regardless of
// the stage's actual pixel width/height.
function contactRadius(rowHeight: number, rowGap: number, stageRows: number): number {
  const rows = Math.max(1, stageRows);
  const stageHeight = rows * rowHeight + Math.max(0, rows - 1) * rowGap;
  const row1CenterPct = (rowHeight / 2 / stageHeight) * 100;
  return Math.max(6, 50 - row1CenterPct);
}

export function EchoSound({
  items,
  query = "",
  rowHeight = 52,
  rowGap = 10,
  stageRows = 4,
  className = "",
}: EchoSoundProps) {
  const labelId = useId();
  const ringRef = useRef<SVGCircleElement | null>(null);
  const timers = useRef<number[]>([]);
  const [reduced, setReduced] = useState(false);
  const [phase, setPhase] = useState<Phase>(items && items.length > 0 ? "loaded" : "empty");
  const [revealCount, setRevealCount] = useState(0);
  const [announce, setAnnounce] = useState("");
  const [displayItems, setDisplayItems] = useState<EchoSoundItem[]>(items ?? []);
  const wasEmpty = useRef(phase === "empty");
  // 7000ms until the client settles on its own randomized 6-8s cadence post-
  // mount — picking the random value during the initial render would differ
  // between server and client and trip a hydration mismatch.
  const [period, setPeriod] = useState(7000);

  useEffect(() => {
    setPeriod(Math.round(6000 + Math.random() * 2000));
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const clearTimers = () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };

    const hasItems = !!items && items.length > 0;

    if (!hasItems) {
      clearTimers();
      // release any inline overrides left by a previous freeze so the CSS
      // keyframe class governs the ring again on the next empty stretch
      const ring = ringRef.current;
      if (ring) {
        ring.style.removeProperty("animation");
        ring.style.removeProperty("transition");
        ring.style.removeProperty("r");
        ring.style.removeProperty("stroke-opacity");
      }
      setPhase("empty");
      setRevealCount(0);
      wasEmpty.current = true;
      return clearTimers;
    }

    if (!wasEmpty.current) {
      // already showing content — a fresh batch just swaps in, no replay
      setDisplayItems(items!);
      setPhase("loaded");
      return clearTimers;
    }

    wasEmpty.current = false;
    setAnnounce(`${items!.length} result${items!.length === 1 ? "" : "s"} loaded`);
    setDisplayItems(items!);

    if (reduced) {
      setPhase("loaded");
      return clearTimers;
    }

    setPhase("arriving");

    // handoff 1 — ping to contact: snapshot the ring's mid-flight radius and
    // opacity, freeze them inline (so nothing jumps), then hand off to a
    // single CSS transition to the row-one contact radius. One read, one
    // write; no per-frame loop.
    const ring = ringRef.current;
    if (ring) {
      const cs = getComputedStyle(ring);
      const snapR = cs.getPropertyValue("r") || "3px";
      const snapOpacity = cs.getPropertyValue("stroke-opacity") || "1";
      ring.style.animation = "none";
      ring.style.setProperty("r", snapR);
      ring.style.setProperty("stroke-opacity", snapOpacity);
      void ring.getBoundingClientRect(); // commit the frozen values before transitioning
      ring.style.transition = `r ${CONTACT_HOLD_MS}ms cubic-bezier(.16,1,.3,1), stroke-opacity ${CONTACT_HOLD_MS}ms ease-out`;
      const targetR = contactRadius(rowHeight, rowGap, stageRows);
      requestAnimationFrame(() => {
        ring.style.setProperty("r", `${targetR}px`);
        ring.style.setProperty("stroke-opacity", "0.55");
      });
    }

    // handoff 2 — contact to resolved: rows scale in one at a time, then the
    // whole row crossfades from skeleton to real content.
    const rowCount = Math.min(items!.length, MAX_STAGGERED_ROWS);
    let revealed = 0;
    const stepRow = () => {
      revealed += 1;
      setRevealCount(revealed);
      if (revealed < rowCount) {
        timers.current.push(window.setTimeout(stepRow, STAGGER_MS));
      }
    };
    timers.current.push(
      window.setTimeout(stepRow, CONTACT_HOLD_MS),
      window.setTimeout(
        () => setPhase("loaded"),
        CONTACT_HOLD_MS + rowCount * STAGGER_MS + ROW_REVEAL_MS + SETTLE_HOLD_MS
      )
    );

    return clearTimers;
    // items is an external reference the caller owns; reduced/rowHeight/rowGap/
    // stageRows rarely change mid-flight and re-running this is idempotent
    // once wasEmpty guards a replay.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, reduced, rowHeight, rowGap, stageRows]);

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
    },
    []
  );

  const emptyText = query ? `No results for "${query}"` : "Nothing here yet";
  const loadedText = `${displayItems.length} result${displayItems.length === 1 ? "" : "s"}${
    query ? ` for "${query}"` : ""
  }`;
  const stageHeight = stageRows * rowHeight + Math.max(0, stageRows - 1) * rowGap;

  return (
    <div className={`ns-echo relative w-full ${className}`}>
      <style>{CSS}</style>

      <div role="region" aria-labelledby={labelId} className="flex w-full flex-col items-center gap-4">
        <div className="relative w-full" style={{ height: reduced ? undefined : stageHeight }}>
          {phase !== "loaded" && !reduced && (
            <svg
              aria-hidden="true"
              focusable="false"
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <circle
                ref={ringRef}
                r={3}
                cx={50}
                cy={50}
                vectorEffect="non-scaling-stroke"
                className={phase === "empty" ? "ns-echo-ring ns-echo-pinging" : "ns-echo-ring"}
                style={
                  {
                    fill: "none",
                    stroke: "var(--border)",
                    strokeWidth: 1,
                    "--ns-echo-period": `${period}ms`,
                  } as CSSProperties
                }
              />
            </svg>
          )}

          {(phase === "arriving" || phase === "loaded") && (
            <ul
              className={`relative flex w-full list-none flex-col ${phase === "loaded" ? "ns-echo-loaded" : ""}`}
              style={{ gap: rowGap }}
            >
              {displayItems.map((item, i) => (
                <li
                  key={item.id}
                  className={`ns-echo-row ${phase === "loaded" || i < revealCount ? "ns-echo-row-in" : ""}`}
                  style={{ height: rowHeight }}
                >
                  <div className="ns-echo-skel" aria-hidden="true" />
                  <div className="ns-echo-content" aria-hidden={phase !== "loaded"}>
                    {item.content}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p id={labelId} className={phase === "empty" ? "text-center text-sm text-muted" : "sr-only"}>
          {phase === "empty" ? emptyText : loadedText}
        </p>
      </div>

      <span role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </div>
  );
}
