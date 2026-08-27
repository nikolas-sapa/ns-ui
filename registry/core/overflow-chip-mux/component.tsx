"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";

// ---------------------------------------------------------------------------
// OverflowChipMux — the list/tag "+N more" overflow indicator, replaced with
// the real NES PPU hardware limit it is named after. The 2C02 PPU can only
// evaluate 8 hardware sprites per scanline; a 9th object contending for that
// scanline in a given frame is silently dropped from the frame entirely —
// a hardware limit, not a software choice. Games with more on-screen objects
// than that worked around it with SPRITE MULTIPLEXING: round-robin which
// subset of contending objects gets the 8 available slots each frame,
// cycling on a schedule so every object gets its turn some fraction of the
// time. That round-robin rotation — not a static "+N" pill — is this
// component's entire mechanic.
//
// SLOT_BUDGET = 8 fixed chip DOM nodes are rendered at all times (keyed by
// slot index, never by item identity); a swap changes only which item a
// slot currently shows. Everything about a swap — which slot is chosen, its
// content, and its leave/arrive animation — runs imperatively off refs, not
// React state, so ticking never re-renders the tree: no layout thrash, no
// accessibility-tree churn, and the leave/arrive transition is driven by
// real CSS transitions rather than a state machine racing a render.
//
// Cadence: real 8-bit multiplexing code cycled every few FRAMES (roughly
// 130ms at 60fps), but reproduced at that literal rate on a screen it reads
// as noise, not a legible mechanic, to anyone not already told what they're
// looking at — a real usability failure, not a stylistic choice. This
// component keeps the same round-robin/FIFO/pin-on-hover mechanic but at a
// cadence and per-swap animation slow enough to actually watch: one slot
// changes at a time, its old label visibly slides up and out, then the new
// label visibly slides up and in, before the row rests again.
//
// Round-robin model: each of the SLOT_BUDGET slots tracks an `age` in ticks
// since it last changed. Every SWAP_INTERVAL_MS, the single oldest
// non-pinned, currently-idle slot is evicted (the item it held goes to the
// back of a FIFO queue of every other contending item) and the item at the
// front of that queue takes its place — exactly one item rotates in/out per
// tick, not the whole overflow set reshuffling at once, so a full cycle
// back to the starting arrangement takes N * SWAP_INTERVAL_MS for N items.
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
  /** ms between round-robin swaps — slow enough to visually track one slot at a time */
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
  phase: "idle" | "out" | "in";
}

const SLOT_BUDGET = 8; // NES PPU sprites-per-scanline hardware limit
const SWAP_INTERVAL_MS = 1100; // slow enough to watch one slot change at a time
const OUT_MS = 220; // outgoing label's visible leave
const IN_MS = 260; // incoming label's visible arrive

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
  const slotsRef = useRef<Slot[]>([]);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    if (items.length <= budget) {
      slotsRef.current = [];
      return; // no overflow — matches real hardware, which only drops the 9th sprite
    }

    const slots: Slot[] = Array.from({ length: budget }, (_, i) => ({
      itemIndex: i,
      pinned: false,
      age: budget - i,
      phase: "idle",
    }));
    slotsRef.current = slots;
    let queue = items.slice(budget).map((_, i) => budget + i);

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let interval = 0;
    const outTimers: number[] = new Array(budget).fill(0);
    const inTimers: number[] = new Array(budget).fill(0);
    const rafs: number[] = new Array(budget).fill(0);

    const setLabelText = (i: number, itemIndex: number) => {
      const el = labelRefs.current[i];
      const item = items[itemIndex];
      if (el && item) el.textContent = item.label;
    };

    // three explicit visual states, driven by real CSS transitions rather
    // than a keyframe, so "leave" and "arrive" are genuinely two separate,
    // watchable motions rather than one blink standing in for both
    const paint = (i: number, phase: "idle" | "out" | "in-start" | "in") => {
      const el = labelRefs.current[i];
      if (!el) return;
      if (phase === "out") {
        el.style.transition = `opacity ${OUT_MS}ms ease-in, transform ${OUT_MS}ms ease-in`;
        el.style.opacity = "0";
        el.style.transform = "translateY(-7px)";
      } else if (phase === "in-start") {
        el.style.transition = "none";
        el.style.opacity = "0";
        el.style.transform = "translateY(7px)";
      } else if (phase === "in") {
        void el.offsetHeight; // force the in-start style to commit before transitioning
        el.style.transition = `opacity ${IN_MS}ms ease-out, transform ${IN_MS}ms ease-out`;
        el.style.opacity = "1";
        el.style.transform = "translateY(0)";
      } else {
        el.style.transition = "none";
        el.style.opacity = "1";
        el.style.transform = "translateY(0)";
      }
    };

    const startSwap = (i: number) => {
      const slot = slots[i];
      if (!slot) return;
      slot.phase = "out";
      paint(i, "out");
      outTimers[i] = window.setTimeout(() => {
        const nextItemIndex = queue.shift();
        if (nextItemIndex === undefined) return;
        queue.push(slot.itemIndex);
        slot.itemIndex = nextItemIndex;
        setLabelText(i, nextItemIndex);
        paint(i, "in-start");
        rafs[i] = requestAnimationFrame(() => paint(i, "in"));
        inTimers[i] = window.setTimeout(() => {
          slot.phase = "idle";
          slot.age = 0;
        }, IN_MS);
      }, OUT_MS);
    };

    const tick = () => {
      let evictIdx = -1;
      let maxAge = -1;
      for (let i = 0; i < slots.length; i++) {
        const s = slots[i];
        if (s && s.phase === "idle" && !s.pinned) {
          s.age += 1;
          if (s.age > maxAge) {
            maxAge = s.age;
            evictIdx = i;
          }
        }
      }
      if (evictIdx === -1 || queue.length === 0) return; // nothing eligible this tick
      startSwap(evictIdx);
    };

    const start = () => {
      window.clearInterval(interval);
      interval = window.setInterval(tick, swapIntervalMs);
    };
    const stop = () => window.clearInterval(interval);

    if (!mq.matches) start();

    const onReducedChange = () => {
      if (mq.matches) stop();
      else start();
    };
    mq.addEventListener("change", onReducedChange);

    return () => {
      stop();
      mq.removeEventListener("change", onReducedChange);
      for (let i = 0; i < budget; i++) {
        window.clearTimeout(outTimers[i]);
        window.clearTimeout(inTimers[i]);
        const raf = rafs[i];
        if (raf) cancelAnimationFrame(raf);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, budget, swapIntervalMs]);

  const setPinned = (slotIdx: number, pinned: boolean) => {
    const slot = slotsRef.current[slotIdx];
    if (!slot) return;
    slot.pinned = pinned;
    if (!pinned) slot.age = 0;
    const btn = buttonRefs.current[slotIdx];
    if (btn) {
      if (pinned) btn.dataset.pinned = "true";
      else delete btn.dataset.pinned;
    }
  };

  const visibleCount = Math.min(budget, items.length);
  const total = items.length;

  return (
    <div className={`w-full ${className}`} style={style}>
      <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-1.5">
        {Array.from({ length: budget }, (_, i) => {
          const item = items[i];
          if (!item) return null;
          return (
            <button
              key={i}
              type="button"
              tabIndex={0}
              ref={(el) => {
                buttonRefs.current[i] = el;
              }}
              onPointerEnter={() => setPinned(i, true)}
              onPointerLeave={() => setPinned(i, false)}
              onFocus={() => setPinned(i, true)}
              onBlur={() => setPinned(i, false)}
              className="ns-ocm-chip inline-flex items-center overflow-hidden rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground transition-colors duration-150 hover:border-foreground/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent data-[pinned]:border-foreground/35"
            >
              <span
                ref={(el) => {
                  labelRefs.current[i] = el;
                }}
                className="inline-block max-w-[16ch] truncate"
              >
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
    </div>
  );
}

OverflowChipMux.displayName = "OverflowChipMux";

export default OverflowChipMux;
