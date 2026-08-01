"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// TearTab — a tag input where every chip hangs from a perforated edge (a
// column of short SVG dashes, stroke --border) instead of carrying an x
// icon. At rest the perforation itself reads "removable." Deletion has two
// paths that both end at the same place (tag gone, siblings closed the gap,
// action announced, Ctrl+Z reverses it):
//
//   - Pointer sugar: drag a chip down. Pointer distance maps 1:1 to a 0-1
//     tear progress; each dash flips from one intact line to two offset
//     stubs the instant progress passes its own index/DASH_COUNT threshold,
//     with a brief 1px translate jitter on the dash that just snapped. On
//     release, progress >= 0.8 commits the tear — the chip rotates 4deg and
//     drops (ease-in, gravity-flavored) via a short-lived fixed-position
//     ghost while the real chip is already gone from flow; progress < 0.8
//     springs the whole thing back to 0 and the dashes re-knit in reverse,
//     for free, because "broken" is just `progress >= threshold` — no
//     separate reverse-animation path to keep in sync with forward.
//   - Keyboard, the only required path: Tab/arrow keys rove focus across
//     chips (role=option in a role=listbox), Delete/Backspace on a focused
//     chip removes it via a fast 150ms opacity fade, no tear theater. This
//     is also where reduced-motion and a duplicate-safety net both land —
//     see the reducedRef guards below.
//
// Sibling reflow uses a hand-rolled FLIP: before every tags-array mutation
// (add, either removal path, undo) the surviving chips' rects are snapshotted;
// after React commits the new layout, each chip is offset back to its old
// position and released on a spring-approximating cubic-bezier (the same
// honest-approximation call this registry already made in drill-down-spines/
// slider-range-shear — a real spring integrator wasn't worth it for a one-shot
// settle). Ctrl+Z / Cmd+Z pops a small undo stack (tag + its removal index)
// and re-inserts, reusing the same FLIP path. Pure DOM + inline SVG + CSS;
// no canvas, no dependencies.
// ---------------------------------------------------------------------------

const DASH_COUNT = 7;
const CHIP_H = 28; // px, fixed — keeps the SVG viewBox in real px, no scaling
const TEAR_DISTANCE = 64; // px of downward drag for progress 0 -> 1
const RELEASE_AT = 0.8;
const FALL_MS = 340;
const FADE_MS = 150;
const FLIP_MS = 380;
const JITTER_MS = 120;
const SPRING_K = 260; // s^-2
const SPRING_ZETA = 0.5;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

interface UndoEntry {
  tag: string;
  index: number;
}

interface GhostRect {
  tag: string;
  left: number;
  top: number;
  width: number;
}

export interface TearTabProps {
  defaultTags?: string[];
  placeholder?: string;
  /** accessible name for the chip listbox */
  label?: string;
  onChange?: (tags: string[]) => void;
  className?: string;
}

function Perforation({
  progress,
  jitterIndex,
  armed,
}: {
  progress: number;
  jitterIndex: number | null;
  armed: boolean;
}) {
  const stroke = armed ? "var(--accent)" : "var(--border)";
  return (
    <svg
      aria-hidden
      width={9}
      height={CHIP_H}
      viewBox={`0 0 9 ${CHIP_H}`}
      className="block shrink-0"
    >
      {Array.from({ length: DASH_COUNT }, (_, i) => {
        const cy = 4 + (i * (CHIP_H - 8)) / (DASH_COUNT - 1);
        const threshold = (i + 1) / DASH_COUNT;
        const torn = progress >= threshold;
        const jittering = jitterIndex === i;
        return torn ? (
          <g key={i} className={jittering ? "tag-input-tear-jitter" : undefined}>
            <line x1={1.5} x2={3.6} y1={cy - 1} y2={cy - 1} stroke={stroke} strokeWidth={1.3} strokeLinecap="round" />
            <line x1={4.4} x2={7.2} y1={cy + 1} y2={cy + 1} stroke={stroke} strokeWidth={1.3} strokeLinecap="round" />
          </g>
        ) : (
          <line key={i} x1={1.5} x2={7.2} y1={cy} y2={cy} stroke={stroke} strokeWidth={1.3} strokeLinecap="round" />
        );
      })}
    </svg>
  );
}

export function TearTab({
  defaultTags = [],
  placeholder = "Add a tag…",
  label = "Tags",
  onChange,
  className = "",
}: TearTabProps) {
  const [tags, setTagsState] = useState<string[]>(defaultTags);
  const [draft, setDraft] = useState("");
  const [fadingIds, setFadingIds] = useState<Set<string>>(new Set());
  const [ghost, setGhost] = useState<GhostRect | null>(null);
  const [announce, setAnnounce] = useState("");
  const [focusedTag, setFocusedTag] = useState<string | null>(null);

  // hot-path drag state lives in refs; dragProgress is mirrored to state
  // purely so the dragged chip re-renders as the pointer moves
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragProgress, setDragProgressState] = useState(0);
  const [jitterIndex, setJitterIndex] = useState<number | null>(null);

  const tagsRef = useRef(tags);
  tagsRef.current = tags;
  const dragIdRef = useRef<string | null>(null);
  const dragProgressRef = useRef(0);
  const dragStartYRef = useRef(0);
  const prevBrokenRef = useRef<boolean[]>(new Array(DASH_COUNT).fill(false));
  const undoStackRef = useRef<UndoEntry[]>([]);
  const chipRefs = useRef(new Map<string, HTMLLIElement>());
  const prevRectsRef = useRef(new Map<string, DOMRect>());
  const inputRef = useRef<HTMLInputElement>(null);
  const timersRef = useRef(new Set<ReturnType<typeof setTimeout>>());
  const rafRef = useRef(0);
  const jitterTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // window-level pointermove/up/cancel handlers, kept fresh via refs so a
  // single mount-time listener never goes stale — see the drag effect below
  // for why this has to live on window instead of the chip element.
  const onWindowPointerMoveRef = useRef<(e: PointerEvent) => void>(() => {});
  const onWindowPointerUpRef = useRef<(e: PointerEvent) => void>(() => {});
  const onWindowPointerCancelRef = useRef<(e: PointerEvent) => void>(() => {});

  const reducedRef = useRef(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(clearTimeout);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (jitterTimerRef.current) clearTimeout(jitterTimerRef.current);
    };
  }, []);

  const track = (ms: number, fn: () => void) => {
    const t = setTimeout(() => {
      timersRef.current.delete(t);
      fn();
    }, ms);
    timersRef.current.add(t);
    return t;
  };

  const snapshotRects = (excludeTag?: string) => {
    const map = new Map<string, DOMRect>();
    chipRefs.current.forEach((el, id) => {
      if (id === excludeTag) return;
      map.set(id, el.getBoundingClientRect());
    });
    prevRectsRef.current = map;
  };

  // FLIP: replays position deltas captured just before the last tags mutation
  useEffect(() => {
    const prev = prevRectsRef.current;
    if (prev.size === 0) return;
    prevRectsRef.current = new Map();
    if (reducedRef.current) return;
    chipRefs.current.forEach((el, id) => {
      const before = prev.get(id);
      if (!before) return;
      const after = el.getBoundingClientRect();
      const dx = before.left - after.left;
      const dy = before.top - after.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
      el.style.transition = "none";
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      void el.offsetHeight; // force reflow before releasing the transition
      el.style.transition = `transform ${FLIP_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1)`;
      el.style.transform = "";
      const clear = () => {
        el.style.transition = "";
      };
      el.addEventListener("transitionend", clear, { once: true });
    });
  }, [tags]);

  const setTags = (next: string[]) => {
    setTagsState(next);
    onChange?.(next);
  };

  const focusNeighborOf = (tag: string) => {
    const idx = tagsRef.current.indexOf(tag);
    const neighbor = tagsRef.current[idx + 1] ?? tagsRef.current[idx - 1] ?? null;
    return () => {
      if (neighbor) chipRefs.current.get(neighbor)?.focus({ preventScroll: true });
      else inputRef.current?.focus({ preventScroll: true });
    };
  };

  const removeTagNow = (tag: string, excludeFromFlip: boolean) => {
    const idx = tagsRef.current.indexOf(tag);
    if (idx === -1) return;
    snapshotRects(excludeFromFlip ? tag : undefined);
    const next = tagsRef.current.filter((t) => t !== tag);
    setTags(next);
    undoStackRef.current.push({ tag, index: idx });
    if (undoStackRef.current.length > 20) undoStackRef.current.shift();
    setAnnounce(
      `removed ${tag}, ${next.length} tag${next.length === 1 ? "" : "s"} remain${next.length === 1 ? "s" : ""}`,
    );
  };

  const fastFadeRemove = (tag: string) => {
    if (fadingIds.has(tag)) return;
    const focusNeighbor = focusNeighborOf(tag);
    setFadingIds((prev) => new Set(prev).add(tag));
    track(reducedRef.current ? 0 : FADE_MS, () => {
      setFadingIds((prev) => {
        const n = new Set(prev);
        n.delete(tag);
        return n;
      });
      removeTagNow(tag, false);
      requestAnimationFrame(focusNeighbor);
    });
  };

  const clearDrag = () => {
    dragIdRef.current = null;
    setDragId(null);
    dragProgressRef.current = 0;
    setDragProgressState(0);
    prevBrokenRef.current = new Array(DASH_COUNT).fill(false);
  };

  const commitDrop = (tag: string) => {
    const el = chipRefs.current.get(tag);
    const rect = el?.getBoundingClientRect() ?? null;
    clearDrag();
    if (reducedRef.current || !rect) {
      fastFadeRemove(tag);
      return;
    }
    const focusNeighbor = focusNeighborOf(tag);
    setGhost({ tag, left: rect.left, top: rect.top, width: rect.width });
    removeTagNow(tag, true);
    track(FALL_MS, () => setGhost(null));
    requestAnimationFrame(focusNeighbor);
  };

  const springBack = () => {
    if (reducedRef.current) {
      clearDrag();
      return;
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    let vel = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.032, Math.max(0, (now - last) / 1000));
      last = now;
      const c = 2 * SPRING_ZETA * Math.sqrt(SPRING_K);
      vel += (-SPRING_K * dragProgressRef.current - c * vel) * dt;
      dragProgressRef.current += vel * dt;
      if (Math.abs(dragProgressRef.current) < 0.004 && Math.abs(vel) < 0.02) {
        rafRef.current = 0;
        clearDrag();
        return;
      }
      applyProgress(clamp(dragProgressRef.current, 0, 1));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  function applyProgress(p: number) {
    dragProgressRef.current = p;
    setDragProgressState(p);
    for (let i = 0; i < DASH_COUNT; i++) {
      const broken = p >= (i + 1) / DASH_COUNT;
      if (broken !== prevBrokenRef.current[i]) {
        prevBrokenRef.current[i] = broken;
        if (!reducedRef.current) {
          setJitterIndex(i);
          if (jitterTimerRef.current) clearTimeout(jitterTimerRef.current);
          jitterTimerRef.current = setTimeout(() => setJitterIndex(null), JITTER_MS);
        }
      }
    }
  }

  const onChipPointerDown = (tag: string) => (e: React.PointerEvent<HTMLLIElement>) => {
    if (e.button !== 0) return;
    const el = e.currentTarget;
    el.focus({ preventScroll: true });
    setFocusedTag(tag);
    el.setPointerCapture(e.pointerId);
    dragIdRef.current = tag;
    setDragId(tag);
    dragStartYRef.current = e.clientY;
    prevBrokenRef.current = new Array(DASH_COUNT).fill(false);
    applyProgress(0);
    e.preventDefault();
  };

  // Drag tracking lives on window, not the chip: a chip-scoped pointermove
  // only fires while the pointer stays over the chip's own box (or, for a
  // real mouse, while setPointerCapture is honored — which it isn't for the
  // synthetic pointer events the registry's autoplay preview dispatches).
  // Once the cursor crosses the chip's bottom edge mid-tear, a chip-scoped
  // listener stops receiving events and progress sticks at its last value.
  // Listening on window guarantees delivery regardless of where the pointer
  // physically is, for both real and synthetic pointers. The handlers are
  // kept fresh via refs (updated every render, no dependency array) and
  // wired to window exactly once on mount, so the listener identity never
  // changes and no event is ever dropped between remove/re-add.
  useEffect(() => {
    onWindowPointerMoveRef.current = (e: PointerEvent) => {
      if (!dragIdRef.current) return;
      const dy = Math.max(0, e.clientY - dragStartYRef.current);
      applyProgress(clamp(dy / TEAR_DISTANCE, 0, 1));
    };
    onWindowPointerUpRef.current = () => {
      const tag = dragIdRef.current;
      if (!tag) return;
      if (dragProgressRef.current >= RELEASE_AT) commitDrop(tag);
      else springBack();
    };
    onWindowPointerCancelRef.current = () => {
      if (dragIdRef.current) springBack();
    };
  });

  useEffect(() => {
    const move = (e: PointerEvent) => onWindowPointerMoveRef.current(e);
    const up = (e: PointerEvent) => onWindowPointerUpRef.current(e);
    const cancel = (e: PointerEvent) => onWindowPointerCancelRef.current(e);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
  }, []);

  const undo = () => {
    const entry = undoStackRef.current.pop();
    if (!entry || tagsRef.current.includes(entry.tag)) return;
    snapshotRects();
    const next = [...tagsRef.current];
    next.splice(Math.min(entry.index, next.length), 0, entry.tag);
    setTags(next);
    setAnnounce(`restored ${entry.tag}`);
  };

  const commitDraft = () => {
    const tag = draft.trim();
    setDraft("");
    if (!tag || tagsRef.current.includes(tag)) return;
    snapshotRects();
    const next = [...tagsRef.current, tag];
    setTags(next);
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitDraft();
    }
  };

  const chipIndex = (tag: string) => tagsRef.current.indexOf(tag);

  const onChipKeyDown = (tag: string) => (e: React.KeyboardEvent<HTMLLIElement>) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      fastFadeRemove(tag);
      return;
    }
    const i = chipIndex(tag);
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const dir = e.key === "ArrowLeft" ? -1 : 1;
      const ni = clamp(i + dir, 0, tagsRef.current.length - 1);
      if (dir > 0 && i === tagsRef.current.length - 1) {
        inputRef.current?.focus();
        return;
      }
      const nextTag = tagsRef.current[ni];
      setFocusedTag(nextTag);
      chipRefs.current.get(nextTag)?.focus({ preventScroll: true });
    } else if (e.key === "Home") {
      e.preventDefault();
      const first = tagsRef.current[0];
      if (first) {
        setFocusedTag(first);
        chipRefs.current.get(first)?.focus({ preventScroll: true });
      }
    } else if (e.key === "End") {
      e.preventDefault();
      const last = tagsRef.current[tagsRef.current.length - 1];
      if (last) {
        setFocusedTag(last);
        chipRefs.current.get(last)?.focus({ preventScroll: true });
      }
    }
  };

  const onRootKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.key === "z" || e.key === "Z") && (e.ctrlKey || e.metaKey) && !e.altKey) {
      if (undoStackRef.current.length > 0) {
        e.preventDefault();
        undo();
      }
    }
  };

  return (
    <div className={`w-full ${className}`} onKeyDown={onRootKeyDown}>
      <style>{`
        @keyframes tag-input-tear-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes tag-input-tear-jitter {
          0% { transform: translate(0, 0); }
          30% { transform: translate(0, -1px); }
          60% { transform: translate(0, 1px); }
          100% { transform: translate(0, 0); }
        }
        @keyframes tag-input-tear-fall {
          from { transform: translateY(0) rotate(0deg); opacity: 1; }
          to { transform: translateY(48px) rotate(4deg); opacity: 0; }
        }
        .tag-input-tear-chip { animation: tag-input-tear-in 180ms ease-out backwards; }
        .tag-input-tear-jitter { animation: tag-input-tear-jitter ${JITTER_MS}ms ease-out; }
        .tag-input-tear-fading { transition: opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms ease; opacity: 0; transform: scale(0.94); }
        .tag-input-tear-ghost { animation: tag-input-tear-fall ${FALL_MS}ms cubic-bezier(0.55, 0, 1, 0.45) forwards; }
        @media (prefers-reduced-motion: reduce) {
          .tag-input-tear-chip, .tag-input-tear-jitter, .tag-input-tear-ghost { animation: none; }
          .tag-input-tear-fading { transition: none; opacity: 0; }
        }
      `}</style>

      <div
        onClick={(e) => {
          if (!(e.target as HTMLElement).closest('[role="option"]')) inputRef.current?.focus();
        }}
        className="w-full cursor-text rounded-md border border-border bg-surface px-3 py-2.5 transition-colors duration-150 focus-within:border-muted"
      >
        <ul
          role="listbox"
          aria-label={label}
          className={`flex flex-wrap items-center gap-x-1.5 gap-y-2 ${tags.length > 0 ? "mb-2" : ""}`}
        >
          {tags.map((tag) => {
            const dragging = dragId === tag;
            const progress = dragging ? dragProgress : 0;
            const armed = dragging && progress >= RELEASE_AT;
            const isFading = fadingIds.has(tag);
            const isFocused = focusedTag === tag || (focusedTag === null && chipIndex(tag) === 0);
            return (
              <li
                key={tag}
                ref={(el) => {
                  if (el) chipRefs.current.set(tag, el);
                  else chipRefs.current.delete(tag);
                }}
                role="option"
                tabIndex={isFocused ? 0 : -1}
                onFocus={() => setFocusedTag(tag)}
                onPointerDown={onChipPointerDown(tag)}
                onKeyDown={onChipKeyDown(tag)}
                data-tear-first={chipIndex(tag) === 0 || undefined}
                className={[
                  "tag-input-tear-chip inline-flex h-7 shrink-0 cursor-grab touch-none select-none items-stretch",
                  "overflow-visible rounded-md border border-l-0 border-border bg-background",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  isFading ? "tag-input-tear-fading" : "",
                ].join(" ")}
                style={{
                  transform: dragging
                    ? `translateY(${progress * 14}px) rotate(${progress * 2}deg)`
                    : undefined,
                  transition: dragging ? "none" : undefined,
                }}
              >
                <Perforation progress={progress} jitterIndex={dragging ? jitterIndex : null} armed={armed} />
                <span
                  aria-hidden
                  style={{ width: 4 + progress * 8 }}
                  className="shrink-0"
                />
                <span className="flex min-w-0 max-w-[16ch] items-center truncate pr-2.5 text-xs text-foreground">
                  {tag}
                </span>
              </li>
            );
          })}
        </ul>
        <input
          ref={inputRef}
          type="text"
          aria-label={placeholder}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onInputKeyDown}
          className="w-full min-w-[8ch] bg-transparent py-0.5 text-sm text-foreground outline-none placeholder:text-muted"
        />
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>

      {ghost ? (
        <div
          aria-hidden
          className="tag-input-tear-ghost pointer-events-none fixed z-50 flex h-7 items-center overflow-hidden rounded-md border border-border bg-background"
          style={{ left: ghost.left, top: ghost.top, width: ghost.width }}
        >
          <Perforation progress={1} jitterIndex={null} armed />
          <span className="truncate px-2.5 text-xs text-foreground">{ghost.tag}</span>
        </div>
      ) : null}
    </div>
  );
}
