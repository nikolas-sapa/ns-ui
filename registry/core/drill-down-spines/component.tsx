"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";

// ---------------------------------------------------------------------------
// SpineStack — drill-down navigation where a pushed level never vanishes
// behind a back button: it compresses against the left edge into a slim
// clickable book spine, so the whole navigation stack stands on a shelf
// beside the current page, labeled and directly tappable at any depth.
//
// Each level's width is an explicit, always-computed pixel value (never
// flex:auto), tracked against the container's measured width via
// ResizeObserver. That is what lets a level's width transition smoothly in
// EITHER direction on a single CSS `transition: width` — full page shrinking
// to a 14px spine on push, or a 14/22px spine growing back to full width on
// pop — both are just px-to-px interpolation, no measure-then-override FLIP
// hack required. The transition runs on a spring-approximating overshoot
// cubic-bezier (not a hand-rolled rAF integrator): honest about the
// mechanism, still reads as a little bounce settling into place.
//
// A spine's content crossfades between a vertical Geist Mono title (the
// resting 14px look) and a horizontal truncated one, widened to 22px, either
// once the shelf is wide enough (a container breakpoint) or transiently on
// hover/focus of that one spine — rotated text is genuinely harder to read,
// so wide-enough shelves and any focused/hovered spine get the easier
// horizontal form. A 1px inset "lit" edge (color-mix over --foreground, a
// decoration, never --ns-accent) reads as the spine's physical edge catching
// light, so the row reads as stacked thickness even at rest.
//
// Clicking any spine pops every level above it in one motion: the levels
// above cascade off in reverse-push order (the most recently pushed leaves
// first, each subsequent one staggered ~90ms behind) while the clicked
// spine's width transitions back up to full — "re-inflating" in parallel
// with, not after, the cascade above it. `prefers-reduced-motion` drops the
// stagger and the transition entirely: pops commit their new stack
// synchronously, entrances render at final width immediately.
//
// A11y: every spine is a real <button> whose accessible name is the level's
// full title (`aria-label`; the rotated/truncated visual text is
// `aria-hidden`, decorative only) — full horizontal names regardless of how
// little of the title is legible on screen. All spines sit inside a `<nav>`
// landmark labeled "Navigation history, N levels". Focus moves to the new
// active page's heading (a `tabIndex={-1}` <h2>) on every push and on every
// pop's commit, so the SPA-style navigation announces itself to assistive
// tech the same way a full route change would. Zero dependencies, DOM+CSS
// only — no canvas.
// ---------------------------------------------------------------------------

export interface SpineStackLevel {
  /** stable id — also used as the React key and as the pop target */
  id: string;
  /** shown as the vertical/horizontal spine label and the active page heading */
  title: string;
  content: ReactNode;
}

export interface SpineStackHandle {
  /** push a new level onto the stack; ignored if `id` already exists in the stack or a pop is mid-animation */
  push: (level: SpineStackLevel) => void;
  /** pop every level above `id`; no-op if `id` isn't in the stack or is already the active (top) level */
  popTo: (id: string) => void;
  /** pop exactly one level (convenience for a "back" affordance); no-op at the root */
  pop: () => void;
  /** replace the whole stack with a single level, instantly, no animation */
  reset: (level: SpineStackLevel) => void;
}

export interface SpineStackProps {
  /** seed level for the stack; only read on mount — the stack is uncontrolled thereafter, drive it via the ref */
  initial: SpineStackLevel;
  /** fires after the top (active) level settles — on mount, on push, and once a pop's cascade commits */
  onNavigate?: (id: string) => void;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

const SPINE_NARROW = 14;
const SPINE_WIDE = 22;
const WIDE_BREAKPOINT = 640;
const TRANSITION_MS = 420;
const STAGGER_MS = 90;
const ENTER_MS = 380;
const SPRING_EASE = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const MIN_ACTIVE_WIDTH = 200;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export const SpineStack = forwardRef<SpineStackHandle, SpineStackProps>(function SpineStack(
  { initial, onNavigate, className = "" },
  ref
) {
  const [stack, setStack] = useState<SpineStackLevel[]>(() => [initial]);
  const [collapsingIds, setCollapsingIds] = useState<string[]>([]); // newest-first
  const [poppingTarget, setPoppingTarget] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [enteringId, setEnteringId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const isAnimatingRef = useRef(false);
  const commitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enterTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRenderRef = useRef(true);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setContainerWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(
    () => () => {
      if (commitTimeoutRef.current) clearTimeout(commitTimeoutRef.current);
      if (enterTimeoutRef.current) clearTimeout(enterTimeoutRef.current);
    },
    []
  );

  const activeId = poppingTarget ?? stack[stack.length - 1].id;

  useEffect(() => {
    if (hoveredId === activeId || (hoveredId && !stack.some((level) => level.id === hoveredId))) {
      setHoveredId(null);
    }
  }, [activeId, hoveredId, stack]);

  // focus + onNavigate fire once the *committed* top settles (immediately on
  // push, or once a pop's cascade actually truncates the stack) — never
  // mid-cascade, and never on first mount.
  const committedActiveId = stack[stack.length - 1].id;
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    if (poppingTarget) return; // still mid-cascade; effect re-fires once it clears
    headingRef.current?.focus({ preventScroll: true });
    onNavigate?.(committedActiveId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onNavigate intentionally excluded, fires on id change only
  }, [committedActiveId, poppingTarget]);

  const push = useCallback(
    (level: SpineStackLevel) => {
      if (isAnimatingRef.current) return;
      setStack((prev) => {
        if (prev.some((l) => l.id === level.id)) return prev;
        return [...prev, level];
      });
      if (enterTimeoutRef.current) clearTimeout(enterTimeoutRef.current);
      if (!reducedMotion) {
        setEnteringId(level.id);
        enterTimeoutRef.current = setTimeout(() => setEnteringId(null), ENTER_MS);
      }
    },
    [reducedMotion]
  );

  const popTo = useCallback(
    (id: string) => {
      if (isAnimatingRef.current) return;
      const idx = stack.findIndex((l) => l.id === id);
      if (idx === -1 || idx === stack.length - 1) return;
      const above = stack
        .slice(idx + 1)
        .map((l) => l.id)
        .reverse(); // newest (most recently pushed) first

      if (reducedMotion) {
        setStack((prev) => prev.slice(0, idx + 1));
        return;
      }

      isAnimatingRef.current = true;
      setPoppingTarget(id);
      setCollapsingIds(above);
      const total = (above.length - 1) * STAGGER_MS + TRANSITION_MS + 40;
      commitTimeoutRef.current = setTimeout(() => {
        setStack((prev) => prev.slice(0, idx + 1));
        setCollapsingIds([]);
        setPoppingTarget(null);
        isAnimatingRef.current = false;
      }, total);
    },
    [stack, reducedMotion]
  );

  const pop = useCallback(() => {
    if (stack.length < 2) return;
    popTo(stack[stack.length - 2].id);
  }, [stack, popTo]);

  const reset = useCallback((level: SpineStackLevel) => {
    if (commitTimeoutRef.current) clearTimeout(commitTimeoutRef.current);
    if (enterTimeoutRef.current) clearTimeout(enterTimeoutRef.current);
    isAnimatingRef.current = false;
    setCollapsingIds([]);
    setPoppingTarget(null);
    setEnteringId(null);
    setStack([level]);
  }, []);

  useImperativeHandle(ref, () => ({ push, popTo, pop, reset }), [push, popTo, pop, reset]);

  const wide = containerWidth >= WIDE_BREAKPOINT;
  const spineWidthFor = (id: string) => {
    if (collapsingIds.includes(id)) return 0;
    return wide || hoveredId === id || focusedId === id ? SPINE_WIDE : SPINE_NARROW;
  };
  const spinesTotal = stack.reduce((sum, l) => sum + (l.id === activeId ? 0 : spineWidthFor(l.id)), 0);
  const GAP = 3;
  const gapCount = Math.max(0, stack.length - 1);
  const activeWidth = containerWidth
    ? clamp(containerWidth - spinesTotal - gapCount * GAP, MIN_ACTIVE_WIDTH, containerWidth)
    : undefined;

  const navLabel = `Navigation history, ${stack.length} level${stack.length === 1 ? "" : "s"}`;

  return (
    <div
      ref={containerRef}
      className={["ns-drill-down-spines relative flex h-full w-full overflow-hidden", className]
        .filter(Boolean)
        .join(" ")}
    >
      <style>{`
.ns-drill-down-spines .ns-level{transition:width ${TRANSITION_MS}ms ${SPRING_EASE},opacity ${TRANSITION_MS}ms ease-out;}
.ns-drill-down-spines .ns-spine-face,
.ns-drill-down-spines .ns-active-face{transition:opacity ${TRANSITION_MS}ms ease-out;}
.ns-drill-down-spines .ns-spine-label{transition:opacity 200ms ease-out;}
.ns-drill-down-spines .ns-spine-enter{animation:ns-spine-enter ${ENTER_MS}ms ${SPRING_EASE};}
@keyframes ns-spine-enter{
  from{opacity:0.35;transform:translateX(18px);}
  to{opacity:1;transform:translateX(0);}
}
@media (prefers-reduced-motion: reduce){
  .ns-drill-down-spines .ns-level,
  .ns-drill-down-spines .ns-spine-face,
  .ns-drill-down-spines .ns-active-face,
  .ns-drill-down-spines .ns-spine-label{transition:none !important;}
  .ns-drill-down-spines .ns-spine-enter{animation:none !important;}
}
`}</style>

      <nav aria-label={navLabel} className="flex h-full w-full" style={{ gap: GAP }}>
        {stack.map((level) => {
          const isActive = level.id === activeId;
          const collapsing = !isActive && collapsingIds.includes(level.id);
          const collapseIndex = collapsingIds.indexOf(level.id);
          const width = isActive ? activeWidth : spineWidthFor(level.id);
          const isWideSpine = !isActive && width === SPINE_WIDE;
          return (
            <div
              key={level.id}
              style={{
                width,
                minWidth: isActive ? MIN_ACTIVE_WIDTH : width,
                opacity: collapsing ? 0 : 1,
                transitionDelay: collapsing ? `${collapseIndex * STAGGER_MS}ms` : "0ms",
              }}
              className={[
                "ns-level relative h-full shrink-0 overflow-hidden rounded-md border border-border bg-surface",
                enteringId === level.id ? "ns-spine-enter" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {/* spine face — the level's resting/collapsed representation. Stays mounted
                  even while the active face is showing, so the width transition (on the
                  shared wrapper above) and this opacity crossfade run on ONE persistent
                  element, not a remount between two different DOM nodes. */}
              <button
                type="button"
                data-slot="spine"
                aria-label={level.title}
                title={level.title}
                inert={isActive || undefined}
                onClick={() => popTo(level.id)}
                onMouseEnter={() => setHoveredId(level.id)}
                onMouseLeave={() => setHoveredId((h) => (h === level.id ? null : h))}
                onFocus={() => setFocusedId(level.id)}
                onBlur={() => setFocusedId((f) => (f === level.id ? null : f))}
                style={{
                  opacity: isActive ? 0 : 1,
                  visibility: isActive ? "hidden" : "visible",
                  pointerEvents: isActive ? "none" : undefined,
                  boxShadow: "inset -1px 0 0 0 color-mix(in srgb, var(--foreground) 22%, transparent)",
                }}
                className="ns-spine-face absolute inset-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
              >
                <span
                  aria-hidden
                  className="ns-spine-label pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden whitespace-nowrap px-1 font-mono text-[10px] tracking-wide text-ns-muted"
                  style={{
                    writingMode: "vertical-rl",
                    textOverflow: "ellipsis",
                    opacity: isWideSpine ? 0 : 1,
                  }}
                >
                  {level.title}
                </span>
                <span
                  aria-hidden
                  className="ns-spine-label pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-nowrap px-1.5 font-mono text-[10px] tracking-wide text-ellipsis text-ns-muted"
                  style={{ opacity: isWideSpine ? 1 : 0 }}
                >
                  {level.title}
                </span>
              </button>

              {/* active face — the level's full page. Mounted for every level, always,
                  so a spine popping back to active re-inflates in place instead of
                  swapping to a freshly-mounted pane. */}
              <div
                inert={isActive ? undefined : true}
                style={{
                  opacity: isActive ? 1 : 0,
                  visibility: isActive ? "visible" : "hidden",
                  pointerEvents: isActive ? undefined : "none",
                }}
                className="ns-active-face absolute inset-0 overflow-auto bg-background"
              >
                <div className="flex h-full flex-col p-4">
                  <h2
                    ref={isActive ? headingRef : undefined}
                    tabIndex={-1}
                    className="mb-3 text-base font-semibold tracking-tight text-foreground outline-none"
                  >
                    {level.title}
                  </h2>
                  <div className="min-h-0 flex-1">{level.content}</div>
                </div>
              </div>
            </div>
          );
        })}
      </nav>
    </div>
  );
});
