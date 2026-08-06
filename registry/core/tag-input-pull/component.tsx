"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

// ---------------------------------------------------------------------------
// BurrChip — a tag/token input whose chips attach like burrs: hooked, not
// glued. Removing one takes a deliberate pull rather than a flat delete.
// Trigger a removal (x button, Backspace/Delete on a focused chip, or a
// pointer-drag past a threshold) and the chip's trailing edge is the fixed
// anchor: a 90ms scaleX stretch to 1.15 plays first ("hooks holding"), then
// it detaches — a quick ease-in translate+fade carries it off — while every
// chip that shifts to close the gap gets its own 40ms-staggered translate on
// an ease-out-expo curve, the stagger keyed to distance from the vacated
// slot so the close reads as a ripple travelling toward the input caret.
// Pointer-drag maps |dx| directly onto the same 0->1.15 stretch and either
// releases past DRAG_THRESHOLD (continues straight into the detach from
// wherever the stretch left off) or eases back to 1 with a single curve —
// elastic, deliberately no spring oscillation. Chips form a roving-tabindex
// group: Left/Right move real focus between remove buttons (and the text
// input at either end), Backspace/Delete removes the focused chip and focus
// lands on whatever took its place, or the input if the list emptied. Every
// removal is announced through a polite live region. prefers-reduced-motion
// drops straight to the end state — tags update instantly, same
// announcements, no stretch/detach/ripple. Pure DOM + CSS, no canvas.
// ---------------------------------------------------------------------------

const STRETCH_MS = 90;
const DETACH_MS = 140;
const STAGGER_MS = 40;
const CLOSE_MS = 220;
const SNAP_BACK_MS = 140;
const DRAG_THRESHOLD = 64; // px of pointer travel that commits a drag-removal
const MAX_STRETCH = 0.15; // scaleX 1 -> 1.15

const EASE_STRETCH = "cubic-bezier(0.33,1,0.68,1)";
const EASE_DETACH = "cubic-bezier(0.55,0,1,0.45)";
const EASE_CLOSE = "cubic-bezier(0.16,1,0.3,1)";

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
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

export interface BurrChipProps {
  /** controlled tag list; omit for uncontrolled */
  value?: string[];
  /** uncontrolled initial tag list */
  defaultValue?: string[];
  /** called with the full tag list after an add or remove */
  onChange?: (tags: string[]) => void;
  /** placeholder shown only while the list is empty */
  placeholder?: string;
  /** blocks adding or removing tags */
  disabled?: boolean;
  /** extra classes merged onto the rendered root element */
  className?: string;
  /** accessible name for the chip group */
  "aria-label"?: string;
  /** accessible name for the text input */
  inputLabel?: string;
}

export function BurrChip({
  value,
  defaultValue = [],
  onChange,
  placeholder = "Add a tag…",
  disabled = false,
  className = "",
  "aria-label": ariaLabel = "Tags",
  inputLabel = "Add tag",
}: BurrChipProps) {
  const liveId = useId();
  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  const isControlled = value !== undefined;
  const [internalTags, setInternalTags] = useState<string[]>(defaultValue);
  const tags = isControlled ? (value as string[]) : internalTags;

  const [inputValue, setInputValue] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [removingTag, setRemovingTag] = useState<string | null>(null);
  const [focusedTag, setFocusedTag] = useState<string | null>(null);
  const rovingTag = focusedTag && tags.includes(focusedTag) ? focusedTag : (tags[0] ?? null);

  const chipRefs = useRef(new Map<string, HTMLDivElement>());
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());
  const inputRef = useRef<HTMLInputElement>(null);
  const flipRef = useRef<{ before: Map<string, DOMRect>; removedIndex: number } | null>(null);

  const commitTags = (next: string[]) => {
    if (!isControlled) setInternalTags(next);
    onChange?.(next);
  };

  const finalizeRemoval = (tag: string) => {
    const idx = tags.indexOf(tag);
    const survivors = tags.filter((t) => t !== tag);
    if (!reducedRef.current) {
      const before = new Map<string, DOMRect>();
      survivors.forEach((t) => {
        const el = chipRefs.current.get(t);
        if (el) before.set(t, el.getBoundingClientRect());
      });
      flipRef.current = { before, removedIndex: idx };
    }
    commitTags(survivors);
    setAnnouncement(`Removed tag ${tag}, ${survivors.length} remaining`);
    setRemovingTag(null);
    requestAnimationFrame(() => {
      if (survivors.length === 0) {
        inputRef.current?.focus();
        return;
      }
      const nextTag = survivors[idx] ?? survivors[survivors.length - 1];
      buttonRefs.current.get(nextTag)?.focus();
    });
  };

  const removeTag = (tag: string, opts?: { skipStretch?: boolean }) => {
    if (removingTag) return;
    if (!tags.includes(tag)) return;
    const el = chipRefs.current.get(tag);
    if (reducedRef.current || !el) {
      finalizeRemoval(tag);
      return;
    }
    setRemovingTag(tag);
    const doDetach = () => {
      el.style.transition = `transform ${DETACH_MS}ms ${EASE_DETACH}, opacity ${DETACH_MS}ms ${EASE_DETACH}`;
      el.style.transform = "translateX(14px) scaleX(1.15)";
      el.style.opacity = "0";
      window.setTimeout(() => finalizeRemoval(tag), DETACH_MS);
    };
    if (opts?.skipStretch) {
      doDetach();
    } else {
      el.style.transformOrigin = "right center";
      el.style.transition = `transform ${STRETCH_MS}ms ${EASE_STRETCH}`;
      el.style.transform = "scaleX(1.15)";
      window.setTimeout(doDetach, STRETCH_MS);
    }
  };

  // FLIP: after a removal lands, the survivors that shifted get an inverse
  // transform applied instantly, then eased back to zero with a stagger keyed
  // to distance from the vacated slot — the closing "ripple".
  useLayoutEffect(() => {
    const flip = flipRef.current;
    if (!flip) return;
    flipRef.current = null;
    const { before, removedIndex } = flip;
    tags.forEach((t, newIdx) => {
      const el = chipRefs.current.get(t);
      const beforeRect = before.get(t);
      if (!el || !beforeRect) return;
      const afterRect = el.getBoundingClientRect();
      const dx = beforeRect.left - afterRect.left;
      const dy = beforeRect.top - afterRect.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
      const delay = Math.max(0, newIdx - removedIndex) * STAGGER_MS;
      el.style.transition = "none";
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      void el.getBoundingClientRect(); // force reflow before re-enabling transition
      el.style.transition = `transform ${CLOSE_MS}ms ${EASE_CLOSE} ${delay}ms`;
      el.style.transform = "translate(0px, 0px)";
      window.setTimeout(() => {
        el.style.transition = "";
        el.style.transform = "";
      }, delay + CLOSE_MS + 40);
    });
  }, [tags]);

  const handleChipPointerDown = (e: ReactPointerEvent<HTMLDivElement>, tag: string) => {
    if (disabled || removingTag) return;
    const targetEl = e.target as HTMLElement;
    if (targetEl.closest("button")) return; // the x button owns its own click
    const el = chipRefs.current.get(tag);
    if (!el) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    let dx = 0;
    let settled = false;
    el.style.transformOrigin = "right center";
    el.style.transition = "none";

    const onMove = (ev: PointerEvent) => {
      dx = ev.clientX - startX;
      if (reducedRef.current) return;
      const frac = clamp(Math.abs(dx) / DRAG_THRESHOLD, 0, 1);
      el.style.transform = `scaleX(${(1 + frac * MAX_STRETCH).toFixed(3)})`;
    };
    const finish = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      if (settled) return;
      settled = true;
      if (Math.abs(dx) >= DRAG_THRESHOLD) {
        removeTag(tag, { skipStretch: true });
        return;
      }
      el.style.transition = `transform ${SNAP_BACK_MS}ms ${EASE_STRETCH}`;
      el.style.transform = "scaleX(1)";
      window.setTimeout(() => {
        el.style.transition = "";
        el.style.transform = "";
      }, SNAP_BACK_MS + 20);
    };
    const onUp = () => finish();
    const onCancel = () => finish();
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
  };

  const onButtonKeyDown = (e: KeyboardEvent<HTMLButtonElement>, tag: string, idx: number) => {
    switch (e.key) {
      case "ArrowRight": {
        e.preventDefault();
        const next = tags[idx + 1];
        if (next) buttonRefs.current.get(next)?.focus();
        else inputRef.current?.focus();
        break;
      }
      case "ArrowLeft": {
        const prev = tags[idx - 1];
        if (prev) {
          e.preventDefault();
          buttonRefs.current.get(prev)?.focus();
        }
        break;
      }
      case "Home": {
        e.preventDefault();
        buttonRefs.current.get(tags[0])?.focus();
        break;
      }
      case "End": {
        e.preventDefault();
        buttonRefs.current.get(tags[tags.length - 1])?.focus();
        break;
      }
      case "Backspace":
      case "Delete":
        e.preventDefault();
        removeTag(tag);
        break;
      default:
        break;
    }
  };

  const onInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const val = inputValue.trim();
      if (val && !tags.includes(val)) commitTags([...tags, val]);
      setInputValue("");
      return;
    }
    if (e.key === "Backspace" && inputValue === "" && tags.length > 0) {
      e.preventDefault();
      removeTag(tags[tags.length - 1]);
      return;
    }
    if (e.key === "ArrowLeft") {
      const el = inputRef.current;
      if (el && el.selectionStart === 0 && el.selectionEnd === 0 && tags.length > 0) {
        e.preventDefault();
        buttonRefs.current.get(tags[tags.length - 1])?.focus();
      }
    }
  };

  return (
    <div className={className}>
      <div
        role="group"
        aria-label={ariaLabel}
        className={`flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 transition-colors duration-150 focus-within:border-foreground/30 ${
          disabled ? "pointer-events-none opacity-50" : ""
        }`}
      >
        {tags.map((tag, idx) => {
          const isRemoving = removingTag === tag;
          return (
            <div
              key={tag}
              ref={(el) => {
                if (el) chipRefs.current.set(tag, el);
                else chipRefs.current.delete(tag);
              }}
              data-tag-input-pull
              onPointerDown={(e) => handleChipPointerDown(e, tag)}
              className="inline-flex select-none items-center gap-1.5 rounded-full border border-border bg-background py-1 pl-3 pr-1.5 text-sm text-foreground will-change-transform"
              style={{ touchAction: "pan-y" }}
            >
              <span className="max-w-[10rem] truncate">{tag}</span>
              <span aria-hidden className="h-3 w-px bg-border" />
              <button
                ref={(el) => {
                  if (el) buttonRefs.current.set(tag, el);
                  else buttonRefs.current.delete(tag);
                }}
                type="button"
                data-tag-input-pull-remove
                tabIndex={tag === rovingTag ? 0 : -1}
                disabled={disabled || isRemoving}
                aria-label={`Remove ${tag}`}
                onFocus={() => setFocusedTag(tag)}
                onClick={() => removeTag(tag)}
                onKeyDown={(e) => onButtonKeyDown(e, tag, idx)}
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-ns-muted transition-colors duration-150 hover:bg-border hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent disabled:pointer-events-none"
              >
                <svg aria-hidden viewBox="0 0 10 10" className="h-2.5 w-2.5">
                  <path
                    d="M1 1l8 8M9 1l-8 8"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
              </button>
            </div>
          );
        })}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          disabled={disabled}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={onInputKeyDown}
          placeholder={tags.length === 0 ? placeholder : ""}
          aria-label={inputLabel}
          className="min-w-[6rem] flex-1 bg-transparent text-sm text-foreground placeholder:text-ns-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
        />
      </div>
      <span id={liveId} role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  );
}
