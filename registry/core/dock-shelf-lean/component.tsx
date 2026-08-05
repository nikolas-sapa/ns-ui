"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

// ---------------------------------------------------------------------------
// ShelfCant — a dock/toolbar where items behave like books leaning on a
// shelf. Hover or keyboard-focus (:focus-visible only, identical trigger for
// both) straightens the target item — rotate(0), translateY(-2px) — while
// its immediate neighbors cant away at up to 3.5deg, amplitude decaying by
// distance (3.5deg * 0.5^(d-1)), transform-origin pinned to each item's
// bottom edge so the rotation reads as a book tipping on a shelf lip. The
// straightened item also gains a 4px total margin (2px each side) so a
// breathing gap opens next to it. Emphasis is entirely rotation + spacing —
// nothing ever scales, so labels and hit areas stay put except for the 2px
// lift.
//
// Reorder is a grab/move/release cycle rather than a continuous drag math
// problem: clicking (or Space/Enter, which a native <button> turns into the
// same click event) toggles the focused item "picked" — a genuinely armed
// state (aria-pressed, data-picked, a heavier lift + accent ring, larger
// cant on its neighbors as if pulled proud of the shelf). While picked,
// ArrowLeft/ArrowRight swap it one slot at a time; each swap is animated
// with FLIP (invert the just-moved items' screen position via an untransformed
// wrapper, then let them spring to their new rest position) so the two
// swapped items visibly slide past each other — the "slump into the gap,
// push apart to receive it back" motion. Native HTML5 drag-and-drop drives
// the same move() for pointer users. A roving tabindex makes the row a
// single tab stop; arrow keys move focus among items when nothing is
// picked. An aria-live region announces every pick/move/drop.
//
// prefers-reduced-motion drops rotation, lift, gap-margin and FLIP entirely:
// the focused/hovered item gets a flat background highlight instead, and
// reorders commit with no transition.
// ---------------------------------------------------------------------------

export interface ShelfCantItem {
  /** stable id — React key and the identity FLIP/reorder track by */
  id: string;
  /** accessible name, and what aria-live announcements name it by */
  label: string;
  /** small glyph rendered in the item; falls back to the label's initial */
  icon?: ReactNode;
}

export interface ShelfCantProps {
  items: ShelfCantItem[];
  /** accessible name for the toolbar row itself */
  label?: string;
  /** fires with the new order after every reorder step (swap or drop) */
  onReorder?: (items: ShelfCantItem[]) => void;
  className?: string;
}

const LEAN_DEG = 3.5;
const LEAN_DECAY = 0.5;
const LIFT_PX = 2;
const PICKED_LIFT_PX = 6;
const GAP_PX = 2; // per side, 4px total
const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const LEAN_MS = 360;
const FLIP_MS = 420;

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = list.slice();
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
}

export function ShelfCant({
  items,
  label = "Shelf",
  onReorder,
  className = "",
}: ShelfCantProps) {
  const [order, setOrder] = useState(items);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [focusIdx, setFocusIdx] = useState<number | null>(null);
  const [rovingIdx, setRovingIdx] = useState(0);
  const [pickedIdx, setPickedIdx] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [reduced, setReduced] = useState(false);

  const wrapperRefs = useRef(new Map<string, HTMLDivElement>());
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());
  const prevRectsRef = useRef<Map<string, DOMRect> | null>(null);
  const dragFromRef = useRef<number | null>(null);

  useEffect(() => setOrder(items), [items]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // FLIP: invert to the pre-reorder screen position on the wrapper (never
  // the button, which owns the lean transform independently), then release
  // to the natural position on the next frame with a spring transition.
  useLayoutEffect(() => {
    const prev = prevRectsRef.current;
    prevRectsRef.current = null;
    if (!prev || reduced) return;
    order.forEach((item) => {
      const el = wrapperRefs.current.get(item.id);
      const oldRect = prev.get(item.id);
      if (!el || !oldRect) return;
      const newRect = el.getBoundingClientRect();
      const dx = oldRect.left - newRect.left;
      if (Math.abs(dx) < 0.5) return;
      el.style.transition = "none";
      el.style.transform = `translateX(${dx}px)`;
      // force reflow so the instant invert commits before we animate away from it
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      el.getBoundingClientRect();
      requestAnimationFrame(() => {
        el.style.transition = `transform ${FLIP_MS}ms ${SPRING}`;
        el.style.transform = "";
      });
    });
  }, [order, reduced]);

  const captureRects = useCallback(() => {
    const map = new Map<string, DOMRect>();
    order.forEach((item) => {
      const el = wrapperRefs.current.get(item.id);
      if (el) map.set(item.id, el.getBoundingClientRect());
    });
    prevRectsRef.current = map;
  }, [order]);

  const commitOrder = useCallback(
    (next: ShelfCantItem[]) => {
      setOrder(next);
      onReorder?.(next);
    },
    [onReorder]
  );

  const togglePick = useCallback(
    (i: number) => {
      setPickedIdx((cur) => {
        if (cur === i) {
          setAnnouncement(`Dropped ${order[i]?.label} at position ${i + 1}`);
          return null;
        }
        setAnnouncement(`Picked up ${order[i]?.label}`);
        return i;
      });
      setRovingIdx(i);
    },
    [order]
  );

  const stepPicked = useCallback(
    (from: number, dir: 1 | -1) => {
      const to = clamp(from + dir, 0, order.length - 1);
      if (to === from) return;
      captureRects();
      const moved = order[from];
      commitOrder(moveItem(order, from, to));
      setPickedIdx(to);
      setRovingIdx(to);
      setAnnouncement(`Moved ${moved?.label} to position ${to + 1}`);
    },
    [order, captureRects, commitOrder]
  );

  const focusAt = useCallback((i: number) => {
    const id = order[i]?.id;
    const btn = id ? buttonRefs.current.get(id) : undefined;
    btn?.focus();
  }, [order]);

  const handleKeyDown = useCallback(
    (i: number) => (e: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const dir = e.key === "ArrowRight" ? 1 : -1;
        if (pickedIdx === i) {
          stepPicked(i, dir);
        } else {
          const next = clamp(i + dir, 0, order.length - 1);
          setRovingIdx(next);
          focusAt(next);
        }
      } else if (e.key === "Escape" && pickedIdx === i) {
        e.preventDefault();
        setPickedIdx(null);
        setAnnouncement(`Dropped ${order[i]?.label} at position ${i + 1}`);
      }
    },
    [pickedIdx, order, stepPicked, focusAt]
  );

  const handleDragStart = useCallback(
    (i: number) => (e: ReactDragEvent<HTMLButtonElement>) => {
      dragFromRef.current = i;
      setPickedIdx(i);
      e.dataTransfer.effectAllowed = "move";
      // Firefox requires data to be set for the drag to start at all.
      e.dataTransfer.setData("text/plain", order[i]?.id ?? "");
    },
    [order]
  );

  const handleDragOver = useCallback(
    (i: number) => (e: ReactDragEvent<HTMLButtonElement>) => {
      e.preventDefault();
      const from = dragFromRef.current;
      if (from === null || from === i) return;
      captureRects();
      commitOrder(moveItem(order, from, i));
      dragFromRef.current = i;
      setPickedIdx(i);
    },
    [order, captureRects, commitOrder]
  );

  const handleDragEnd = useCallback(() => {
    const from = dragFromRef.current;
    dragFromRef.current = null;
    setPickedIdx(null);
    if (from !== null) {
      setAnnouncement(`Dropped ${order[from]?.label ?? ""} at position ${from + 1}`);
    }
  }, [order]);

  const activeIdx = pickedIdx ?? hoverIdx ?? focusIdx ?? null;

  return (
    <div
      role="toolbar"
      aria-label={label}
      aria-orientation="horizontal"
      className={`flex items-end gap-2 rounded-md border border-border bg-surface p-3 ${className}`}
    >
      {order.map((item, i) => {
        const isActive = activeIdx === i;
        const isPicked = pickedIdx === i;
        let leanStyle: CSSProperties = {};
        if (!reduced) {
          if (activeIdx === null) {
            leanStyle = { transform: "rotate(0deg) translateY(0px)" };
          } else if (isActive) {
            const lift = isPicked ? PICKED_LIFT_PX : LIFT_PX;
            leanStyle = {
              transform: `rotate(0deg) translateY(-${lift}px)`,
              marginInline: GAP_PX,
            };
          } else {
            const d = i - activeIdx;
            const ad = Math.abs(d);
            // neighbors cant a little harder for a picked item than a merely
            // hovered one — reads as "pulled proud of the shelf" vs. a glance
            const pulledFactor = pickedIdx !== null ? 1.15 : 1;
            const amp = LEAN_DEG * Math.pow(LEAN_DECAY, ad - 1) * pulledFactor;
            const sign = Math.sign(d);
            leanStyle =
              amp < 0.05
                ? { transform: "rotate(0deg) translateY(0px)" }
                : { transform: `rotate(${sign * amp}deg) translateY(0px)` };
          }
        }

        return (
          <div
            key={item.id}
            ref={(el) => {
              if (el) wrapperRefs.current.set(item.id, el);
              else wrapperRefs.current.delete(item.id);
            }}
            className="relative"
          >
            <button
              ref={(el) => {
                if (el) buttonRefs.current.set(item.id, el);
                else buttonRefs.current.delete(item.id);
              }}
              type="button"
              aria-label={item.label}
              aria-pressed={isPicked}
              data-shelf-idx={i}
              data-picked={isPicked ? "true" : undefined}
              tabIndex={rovingIdx === i ? 0 : -1}
              draggable
              onDragStart={handleDragStart(i)}
              onDragOver={handleDragOver(i)}
              onDragEnd={handleDragEnd}
              onDrop={(e) => e.preventDefault()}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx((h) => (h === i ? null : h))}
              onFocus={(e) => {
                setRovingIdx(i);
                if (e.currentTarget.matches(":focus-visible")) setFocusIdx(i);
              }}
              onBlur={() => setFocusIdx((f) => (f === i ? null : f))}
              onKeyDown={handleKeyDown(i)}
              onClick={() => togglePick(i)}
              style={{
                transformOrigin: "bottom center",
                transitionProperty: reduced ? "background-color" : "transform, margin",
                transitionDuration: `${LEAN_MS}ms`,
                transitionTimingFunction: SPRING,
                ...leanStyle,
              }}
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-sm border font-mono text-sm text-ns-muted transition-colors will-change-transform hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent motion-reduce:transition-colors ${
                isPicked
                  ? "border-ns-accent bg-background text-foreground shadow-[0_10px_20px_-8px_rgba(0,0,0,0.35)]"
                  : reduced && isActive
                    ? "border-border bg-border text-foreground"
                    : "border-border bg-background"
              }`}
            >
              <span aria-hidden className="pointer-events-none select-none">
                {item.icon ?? item.label.slice(0, 1).toUpperCase()}
              </span>
            </button>
          </div>
        );
      })}

      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </div>
  );
}
