"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

// ---------------------------------------------------------------------------
// OverflowChipMux — the list/tag "+N more" overflow indicator, replaced with
// the real NES PPU hardware limit it is named after. The 2C02 PPU can only
// evaluate 8 hardware sprites per scanline; a 9th object contending for that
// scanline in a given frame is silently dropped from the frame entirely —
// a hardware limit, not a software choice. Games with more on-screen objects
// than that worked around it with SPRITE MULTIPLEXING: round-robin which
// subset of contending objects gets the 8 available slots each frame,
// cycling on a fixed schedule (commonly every few frames, not every single
// frame, to stay legible instead of an unreadable strobe) so every object
// gets its turn some fraction of the time. That round-robin flicker — not a
// static "+N" pill — is this component's entire mechanic.
//
// SLOT_BUDGET = 8 fixed chip DOM nodes are rendered at all times (keyed by
// slot index, never by item identity), each slot just swapping WHICH item's
// label it currently shows. This avoids remounting a chip's DOM node per
// swap: only its text content and a one-shot CSS flicker animation change,
// so there is no layout thrash and no accessibility-tree churn per tick —
// the accessible content lives entirely in the always-present sr-only list
// and the always-visible plain-text count below, neither of which is
// touched by the interval.
//
// Round-robin model: each of the SLOT_BUDGET slots tracks an `age` in
// ticks since it last changed. Every SWAP_INTERVAL_MS, the single oldest
// non-pinned slot is evicted (the item it held goes to the back of a FIFO
// queue of every other contending item) and the item at the front of that
// queue takes its place — exactly one item rotates in/out per tick, not
// the whole overflow set reshuffling at once, so a full cycle back to the
// starting arrangement takes exactly N * SWAP_INTERVAL_MS for N total items.
// ---------------------------------------------------------------------------

export interface OverflowChipItem {
  id: string;
  label: string;
}

export interface OverflowChipMuxProps {
  /** contending items — supply MORE than slotBudget to see multiplexing engage */
  items?: OverflowChipItem[];
  /** visible slot count — the real PPU per-scanline limit is 8 */
  slotBudget?: number;
  /** ms between round-robin swaps — real multiplexing throttled well below 60Hz */
  swapIntervalMs?: number;
  /** accessible label for the chip row's group role */
  ariaLabel?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
  /** inline styles merged onto the root element */
  style?: CSSProperties;
}

interface Slot {
  itemIndex: number;
  pinned: boolean;
  age: number;
  flashKey: number;
}

const SLOT_BUDGET = 8; // NES PPU sprites-per-scanline hardware limit
const SWAP_INTERVAL_MS = 130; // ~7.7Hz decimated round-robin cadence

const DEFAULT_ITEMS: OverflowChipItem[] = [
  "goomba", "koopa", "piranha-plant", "buzzy-beetle", "lakitu", "spiny",
  "bullet-bill", "hammer-bro", "boo", "cheep-cheep", "podoboo", "blooper",
  "para-goomba", "dry-bones",
].map((label, i) => ({ id: `${i}-${label}`, label }));

export function OverflowChipMux({
  items = DEFAULT_ITEMS,
  slotBudget = SLOT_BUDGET,
  swapIntervalMs = SWAP_INTERVAL_MS,
  ariaLabel = "Tags",
  className = "",
  style,
}: OverflowChipMuxProps) {
  const budget = Math.max(1, Math.min(slotBudget, items.length || 1));
  const queueRef = useRef<number[]>([]);
  const [slots, setSlots] = useState<Slot[]>(() =>
    Array.from({ length: budget }, (_, i) => ({
      itemIndex: i,
      pinned: false,
      age: budget - i,
      flashKey: 0,
    }))
  );

  useEffect(() => {
    // rebuild the round-robin from index 0 whenever the item set or budget
    // changes — this is also exactly the reduced-motion freeze frame below
    queueRef.current = items.slice(budget).map((_, i) => budget + i);
    setSlots(
      Array.from({ length: budget }, (_, i) => ({
        itemIndex: i,
        pinned: false,
        age: budget - i,
        flashKey: 0,
      }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, budget]);

  useEffect(() => {
    if (items.length <= budget) return; // no overflow — matches real hardware, which only drops the 9th sprite

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer = 0;

    const tick = () => {
      setSlots((prev) => {
        const queue = queueRef.current;
        if (queue.length === 0) return prev;
        let evictIdx = -1;
        let maxAge = -1;
        for (let i = 0; i < prev.length; i++) {
          const s = prev[i];
          if (s && !s.pinned && s.age > maxAge) {
            maxAge = s.age;
            evictIdx = i;
          }
        }
        if (evictIdx === -1) {
          // every visible slot is pinned right now — nothing can rotate
          return prev.map((s) => ({ ...s, age: s.age + 1 }));
        }
        const evicted = prev[evictIdx];
        if (!evicted) return prev;
        const nextItemIndex = queue[0] as number;
        queueRef.current = [...queue.slice(1), evicted.itemIndex];
        return prev.map((s, i) =>
          i === evictIdx
            ? { itemIndex: nextItemIndex, pinned: false, age: 0, flashKey: evicted.flashKey + 1 }
            : { ...s, age: s.age + 1 }
        );
      });
    };

    const start = () => {
      window.clearInterval(timer);
      timer = window.setInterval(tick, swapIntervalMs);
    };
    const stop = () => window.clearInterval(timer);

    if (!mq.matches) start();

    const onReducedChange = () => {
      if (mq.matches) stop();
      else start();
    };
    mq.addEventListener("change", onReducedChange);

    return () => {
      stop();
      mq.removeEventListener("change", onReducedChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, budget, swapIntervalMs]);

  const setPinned = (slotIdx: number, pinned: boolean) => {
    setSlots((prev) =>
      prev.map((s, i) => (i === slotIdx ? { ...s, pinned, age: pinned ? s.age : 0 } : s))
    );
  };

  const visibleCount = Math.min(budget, items.length);
  const total = items.length;

  return (
    <div className={`w-full ${className}`} style={style}>
      <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-1.5">
        {slots.map((slot, i) => {
          const item = items[slot.itemIndex];
          if (!item) return null;
          return (
            <button
              key={i}
              type="button"
              tabIndex={0}
              onPointerEnter={() => setPinned(i, true)}
              onPointerLeave={() => setPinned(i, false)}
              onFocus={() => setPinned(i, true)}
              onBlur={() => setPinned(i, false)}
              data-pinned={slot.pinned || undefined}
              className="ns-ocm-chip inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground transition-colors duration-150 hover:border-foreground/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
            >
              <span key={slot.flashKey} className="ns-ocm-flash max-w-[16ch] truncate">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-2 font-mono text-[11px] text-ns-muted">
        {visibleCount} of {total} shown, {total} total
      </p>

      {/* always in the DOM: the true, fully enumerable list — this is what
          the "+N more" pattern always guaranteed and this replaces */}
      <ul className="sr-only">
        {items.map((item) => (
          <li key={item.id}>{item.label}</li>
        ))}
      </ul>

      <style>{`
        .ns-ocm-flash {
          display: inline-block;
          animation: ns-ocm-flicker 90ms ease-out;
        }
        @keyframes ns-ocm-flicker {
          0% { opacity: 0.25; }
          100% { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ns-ocm-flash { animation: none; }
        }
      `}</style>
    </div>
  );
}

OverflowChipMux.displayName = "OverflowChipMux";

export default OverflowChipMux;
