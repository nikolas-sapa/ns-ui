"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// LooseType — a streaming-text surface where provisional tokens sit like
// loose letterpress type (off-baseline, a hair rotated, --muted) and
// physically lock into the chase the instant they're confirmed (snap to
// baseline, --foreground, a stiff low-damping spring). A corrected token
// slides out sideways as its replacement slides in, the freed width
// collapsing under it so the line reflows like a compositor swapping a
// sort — not a flash. Pure DOM/CSS transforms, no canvas.
//
// The motion IS the data: jitter vs. baseline is the only signal for
// provisional vs. committed, there's no separate status pill. Distinct from
// wet-ink (which encodes elapsed-time freshness via weight/opacity and never
// snaps) and decrypt-text (a one-shot scramble-to-reveal on a fixed string,
// no underlying state machine at all).
// ---------------------------------------------------------------------------

type Key = string | number;

export interface LooseTypeToken {
  /**
   * Stable identity. Reusing an id updates that token in place (e.g. a
   * still-provisional token settling toward its final wording without a
   * full swap). Give a *replacement* token a fresh id at the same array
   * position to represent a correction — the old id's span slides out as
   * the new id's span slides in, at that seam.
   */
  id: Key;
  text: string;
  /** Locked into the chase. Default false (provisional). */
  committed?: boolean;
}

export interface LooseTypeProps {
  /** Full ordered snapshot of the line's tokens, every render. */
  tokens: LooseTypeToken[];
  className?: string;
}

type Status = "entering" | "settled" | "removing";

interface Item {
  id: Key;
  text: string;
  committed: boolean;
  jitter: { ty: number; rot: number };
  status: Status;
  /** entering: false until the slide-in transition should start */
  animateIn?: boolean;
  /** removing: measured px width, captured before the collapse starts */
  widthPx?: number;
  /** removing: false until the collapse/slide-out transition should start */
  collapse?: boolean;
}

const ENTER_MS = 260;
const EXIT_MS = 260;
const COMMIT_MS = 420;
// A back-out curve is the pure-CSS stand-in for a stiff, low-damping spring:
// it overshoots past the resting value before settling, same read as a sort
// dropping into the chase and bouncing once against its neighbors.
const SPRING_EASE = "cubic-bezier(0.34, 1.56, 0.64, 1)";

// Deterministic per-token offset so a token's tilt/lift never rerolls across
// re-renders — "seeded per token", not per paint. Two independent floats are
// pulled from one FNV-1a hash by mixing it a second time for the pair.
function seededJitter(id: Key): { ty: number; rot: number } {
  const s = String(id);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const h2 = Math.imul(h ^ 0x9e3779b9, 0x2545f491);
  const ty = (((h >>> 0) % 2001) / 1000 - 1) * 1; // -1..1 px
  const rot = (((h2 >>> 0) % 1201) / 1000 - 0.6) * 1; // -0.6..0.6 deg
  return { ty, rot };
}

function makeEntering(t: LooseTypeToken): Item {
  return {
    id: t.id,
    text: t.text,
    committed: !!t.committed,
    jitter: seededJitter(t.id),
    status: "entering",
    animateIn: false,
  };
}

function makeSettled(t: LooseTypeToken): Item {
  return {
    id: t.id,
    text: t.text,
    committed: !!t.committed,
    jitter: seededJitter(t.id),
    status: "settled",
  };
}

function carryOver(prev: Item, t: LooseTypeToken): Item {
  return { ...prev, text: t.text, committed: !!t.committed };
}

// Walks the previous render list against the new snapshot in order. A
// surviving id is carried over in place; an id that vanished becomes (or
// stays) a "removing" ghost planted exactly where it was; a brand-new id
// is inserted as "entering" right before whatever surviving token it now
// precedes. For the common case — append-only growth, or a single tail
// token swapped for its correction — this lands the ghost and its
// replacement adjacent, at the seam, which is the whole point.
function diff(prev: Item[], tokens: LooseTypeToken[]): Item[] {
  const incoming = new Set(tokens.map((t) => t.id));
  const next: Item[] = [];
  let ti = 0;

  for (const p of prev) {
    if (incoming.has(p.id)) {
      while (ti < tokens.length && tokens[ti]!.id !== p.id) {
        next.push(makeEntering(tokens[ti]!));
        ti++;
      }
      if (ti < tokens.length && tokens[ti]!.id === p.id) {
        next.push(carryOver(p, tokens[ti]!));
        ti++;
      }
    } else if (p.status === "removing") {
      next.push(p); // already ghosted, don't restart its timer/measurement
    } else {
      next.push({ ...p, status: "removing", widthPx: undefined, collapse: false });
    }
  }
  while (ti < tokens.length) {
    next.push(makeEntering(tokens[ti]!));
    ti++;
  }
  return next;
}

export function LooseType({ tokens, className = "" }: LooseTypeProps) {
  const [items, setItemsState] = useState<Item[]>(() => tokens.map(makeSettled));
  const itemsRef = useRef(items);
  // synchronous init so a mount with provisional tokens already present under
  // prefers-reduced-motion never paints the jittered branch on the first frame
  const reducedRef = useRef(
    typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const nodesRef = useRef(new Map<Key, HTMLSpanElement>());
  const measuredRef = useRef(new Set<Key>());
  const flippedRef = useRef(new Set<Key>());

  const setItems = useCallback((next: Item[]) => {
    itemsRef.current = next;
    setItemsState(next);
  }, []);

  useEffect(() => {
    reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const sig = useMemo(
    () => tokens.map((t) => `${t.id}:${t.committed ? 1 : 0}:${t.text}`).join(""),
    [tokens]
  );

  useEffect(() => {
    if (reducedRef.current) {
      setItems(tokens.map(makeSettled));
      return;
    }
    setItems(diff(itemsRef.current, tokens));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  // Entering tokens: flip from the pre-slide style to the animated one a
  // frame after mount, so the browser actually observes a style change to
  // transition from (setting the "final" style on the same paint as mount
  // would just render there, no motion).
  useLayoutEffect(() => {
    if (reducedRef.current) return;
    const pending = items.filter((it) => it.status === "entering" && !it.animateIn && !flippedRef.current.has(it.id));
    if (!pending.length) return;
    for (const it of pending) flippedRef.current.add(it.id);
    const raf = requestAnimationFrame(() => {
      setItems(
        itemsRef.current.map((it) =>
          it.status === "entering" && pending.some((p) => p.id === it.id) ? { ...it, animateIn: true } : it
        )
      );
    });
    return () => cancelAnimationFrame(raf);
  }, [items, setItems]);

  // Removing tokens: measure the natural width first (so the collapse has a
  // real px start point — "auto" can't be transitioned), then flip to the
  // collapsed target a frame later.
  useLayoutEffect(() => {
    if (reducedRef.current) return;
    const toMeasure = items.filter((it) => it.status === "removing" && it.widthPx === undefined && !measuredRef.current.has(it.id));
    if (!toMeasure.length) return;
    for (const it of toMeasure) measuredRef.current.add(it.id);
    const widths = new Map<Key, number>();
    for (const it of toMeasure) {
      const node = nodesRef.current.get(it.id);
      widths.set(it.id, node ? node.offsetWidth : 0);
    }
    setItems(
      itemsRef.current.map((it) => (widths.has(it.id) ? { ...it, widthPx: widths.get(it.id) } : it))
    );
  }, [items, setItems]);

  useEffect(() => {
    if (reducedRef.current) return;
    const toCollapse = items.filter((it) => it.status === "removing" && it.widthPx !== undefined && !it.collapse);
    if (!toCollapse.length) return;
    const raf = requestAnimationFrame(() => {
      setItems(
        itemsRef.current.map((it) =>
          it.status === "removing" && toCollapse.some((p) => p.id === it.id) ? { ...it, collapse: true } : it
        )
      );
    });
    return () => cancelAnimationFrame(raf);
  }, [items, setItems]);

  const onGhostTransitionEnd = useCallback(
    (id: Key, e: React.TransitionEvent<HTMLSpanElement>) => {
      if (e.propertyName !== "max-width") return;
      measuredRef.current.delete(id);
      nodesRef.current.delete(id);
      setItems(itemsRef.current.filter((it) => it.id !== id));
    },
    [setItems]
  );

  const onEnterTransitionEnd = useCallback(
    (id: Key, e: React.TransitionEvent<HTMLSpanElement>) => {
      if (e.propertyName !== "opacity") return;
      flippedRef.current.delete(id);
      setItems(itemsRef.current.map((it) => (it.id === id && it.status === "entering" ? { ...it, status: "settled" } : it)));
    },
    [setItems]
  );

  const committedText = tokens
    .filter((t) => t.committed)
    .map((t) => t.text)
    .join(" ");

  return (
    <div className={`ns-loose-type ${className}`}>
      <div aria-live="polite" className="sr-only">
        {committedText}
      </div>
      <div aria-hidden="true" className="flex flex-wrap items-baseline">
        {items.map((it) => {
          const reduced = reducedRef.current;
          const base: React.CSSProperties = {
            display: "inline-block",
            marginRight: "0.28em",
            marginBottom: "0.15em",
          };

          if (reduced) {
            return (
              <span
                key={it.id}
                className={it.committed ? "ns-loose-type-token text-foreground" : "ns-loose-type-token ns-loose-type-provisional text-muted"}
                style={base}
              >
                {it.text}
              </span>
            );
          }

          if (it.status === "entering") {
            const style: React.CSSProperties = it.animateIn
              ? {
                  ...base,
                  transform: `translateX(0) translateY(${it.jitter.ty}px) rotate(${it.jitter.rot}deg)`,
                  opacity: 1,
                  transitionProperty: "transform, opacity",
                  transitionDuration: `${ENTER_MS}ms`,
                  transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                }
              : {
                  ...base,
                  transform: "translateX(0.4em)",
                  opacity: 0,
                  transition: "none",
                };
            return (
              <span
                key={it.id}
                ref={(node) => {
                  if (node) nodesRef.current.set(it.id, node);
                }}
                className={it.committed ? "ns-loose-type-token text-foreground" : "ns-loose-type-token ns-loose-type-provisional text-muted"}
                style={style}
                onTransitionEnd={(e) => onEnterTransitionEnd(it.id, e)}
              >
                {it.text}
              </span>
            );
          }

          if (it.status === "removing") {
            const style: React.CSSProperties = it.collapse
              ? {
                  ...base,
                  maxWidth: 0,
                  marginRight: 0,
                  opacity: 0,
                  transform: "translateX(-0.4em)",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  transitionProperty: "max-width, margin-right, opacity, transform",
                  transitionDuration: `${EXIT_MS}ms`,
                  transitionTimingFunction: "ease-out",
                }
              : {
                  ...base,
                  maxWidth: it.widthPx !== undefined ? `${it.widthPx}px` : undefined,
                  opacity: 1,
                  transform: "translateX(0)",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  transition: "none",
                };
            return (
              <span
                key={it.id}
                ref={(node) => {
                  if (node) nodesRef.current.set(it.id, node);
                }}
                className={it.committed ? "ns-loose-type-token text-foreground" : "ns-loose-type-token ns-loose-type-provisional text-muted"}
                style={style}
                onTransitionEnd={(e) => onGhostTransitionEnd(it.id, e)}
              >
                {it.text}
              </span>
            );
          }

          // settled: the resting spring lives here permanently, so a
          // provisional -> committed flip animates purely off the
          // `committed` boolean with no extra phase to schedule.
          return (
            <span
              key={it.id}
              className={it.committed ? "ns-loose-type-token text-foreground" : "ns-loose-type-token ns-loose-type-provisional text-muted"}
              style={{
                ...base,
                transform: it.committed ? "translateY(0) rotate(0deg)" : `translateY(${it.jitter.ty}px) rotate(${it.jitter.rot}deg)`,
                transitionProperty: "transform, color",
                transitionDuration: `${COMMIT_MS}ms, 200ms`,
                transitionTimingFunction: `${SPRING_EASE}, ease-out`,
              }}
            >
              {it.text}
            </span>
          );
        })}
      </div>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.ns-loose-type-provisional{
  text-decoration: none;
}
@media (prefers-reduced-motion: reduce){
  .ns-loose-type-provisional{
    text-decoration: underline;
    text-decoration-style: dotted;
    text-underline-offset: 3px;
  }
}
`;
