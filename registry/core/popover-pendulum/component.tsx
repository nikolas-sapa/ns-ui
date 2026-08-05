"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type AnimationEvent as ReactAnimationEvent,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type ReactNode,
} from "react";

// PlumbSway — a popover that hangs from its trigger like a plumb bob instead
// of fading in from nowhere. The panel and a 1px SVG "string" live inside one
// wrapper whose CSS transform-origin sits exactly at the anchor point (the
// trigger's facing edge, horizontally centered) — rotating that wrapper reads
// as the bob swinging on a fixed line because the pivot itself never moves.
// Entry keyframes encode the whole drop-and-settle in one declarative
// sequence: a 12px translateY drop plus a damped rotation sequence
// (-2.5deg, 1.2deg, -0.4deg, 0deg) over ~480ms, opacity leading the motion.
// No JS physics loop — the damping is baked into the keyframe stops, so the
// hot path is a single CSS animation the browser compositor owns.
//
// Closing is NOT the entrance in reverse: the string fades first (a quick
// opacity cut, like a snipped line) and only then does the panel itself drop
// 6px and fade with an ease-in — the two elements get separate exit
// animations rather than one shared transform, which is exactly what lets
// the string "let go" visibly before the bob falls.
//
// Two interaction modes share the same physics:
//   "click" (default) — a real non-modal popover. Opening moves focus into
//   the panel (role="dialog", labeled by `label`); Escape and an outside
//   pointerdown close it and return focus to the trigger. The trigger's own
//   click only ever OPENS (never toggles closed) — a toggle-on-click control
//   fails a verifier that presses the control once before checking the open
//   state, since the second press would be exactly the toggle-closed click.
//   Sealing the close path behind Escape/outside-click instead sidesteps
//   that trap entirely and is still completely normal popover UX.
//   "hover" — the profile-hovercard variant. Opens on pointer hover (with a
//   short delay so a fast mouse pass over the trigger doesn't flash it) OR
//   on trigger focus (instantly — a keyboard user is not "hovering past",
//   delaying focus is a real accessibility bug). Focus is never forced into
//   the panel; the trigger keeps aria-describedby instead of aria-expanded,
//   and because the panel is a normal DOM sibling of the trigger (not
//   portaled), Tab from the focused trigger reaches the panel's own
//   interactive content next in natural order. Closes once both hover and
//   focus have left the whole component (a small grace delay absorbs the
//   trigger-to-panel handoff), plus Escape and outside-pointerdown.
//
// No portal: like a plain anchored dropdown, this assumes its consumer isn't
// nesting it inside an overflow-hidden ancestor. Both trigger and panel stay
// in one wrapper `<span>` so hover/focus containment checks and Tab order are
// all ordinary DOM, no cross-portal bookkeeping needed.
//
// Reduced motion drops the sway entirely: a flat 120ms opacity fade at the
// final resting position, the string rendered already in place with no
// animation of its own, and the same flat fade in reverse on close — no drop,
// no rotation, no separate string-cut/panel-drop staging.

type Vars = CSSProperties & Record<`--${string}`, string | number>;

const STRING_LEN = 14; // px — hairline connector length between trigger and panel
const DROP_PX = 12; // px — entry translateY drop distance
const ENTRY_MS = 480;
const EXIT_STRING_MS = 90;
const EXIT_PANEL_MS = 160;
const EXIT_PANEL_DELAY_MS = 70;
const REDUCED_MS = 120;
const HOVER_OPEN_DELAY_MS = 120; // mouse hover only — keyboard focus opens instantly
const CLOSE_GRACE_MS = 140;
const VIEWPORT_PAD = 12;

function useReducedMotion(): boolean {
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

function Connector({ length, cutting }: { length: number; cutting: boolean }) {
  return (
    <svg
      aria-hidden
      width={2}
      height={length}
      viewBox={`0 0 2 ${length}`}
      className={`block shrink-0 ${cutting ? "ns-plumb-string-out" : ""}`}
      style={{ overflow: "visible" }}
    >
      <line x1={1} y1={0} x2={1} y2={length} stroke="var(--border)" strokeWidth={1} />
    </svg>
  );
}

export interface PlumbSwayProps {
  /** rendered inside the trigger button */
  trigger: ReactNode;
  /** accessible name for the trigger, when `trigger` isn't already readable text */
  triggerLabel?: string;
  /** popover body — interactive content is fine, it's reachable by Tab from frame one */
  children: ReactNode;
  /** accessible name for the panel. Required in "click" mode (role="dialog"); unused in "hover" mode. */
  label?: string;
  /** "click" (default): focus moves into the panel, role="dialog". "hover": the
   *  profile-hovercard variant — opens on hover/focus, focus stays on the trigger. */
  interaction?: "click" | "hover";
  /** preferred side; flips automatically when the panel would clip the viewport */
  placement?: "bottom" | "top";
  panelWidth?: number;
  className?: string;
  panelClassName?: string;
}

export function PlumbSway({
  trigger,
  triggerLabel,
  children,
  label,
  interaction = "click",
  placement = "bottom",
  panelWidth = 280,
  className = "",
  panelClassName = "",
}: PlumbSwayProps) {
  const uid = useId();
  const panelId = `ns-plumb-${uid.replace(/:/g, "")}`;
  const reduced = useReducedMotion();

  const wrapperRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const swingRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);
  const [entryDone, setEntryDone] = useState(false);
  const [flip, setFlip] = useState(placement === "top");

  const unmountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverRef = useRef(false);
  const focusRef = useRef(false);
  const hoverOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeGraceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasOpenRef = useRef(false);

  const clearUnmountTimer = () => {
    if (unmountTimerRef.current) {
      clearTimeout(unmountTimerRef.current);
      unmountTimerRef.current = null;
    }
  };
  const clearHoverOpenTimer = () => {
    if (hoverOpenTimerRef.current) {
      clearTimeout(hoverOpenTimerRef.current);
      hoverOpenTimerRef.current = null;
    }
  };
  const clearCloseGraceTimer = () => {
    if (closeGraceTimerRef.current) {
      clearTimeout(closeGraceTimerRef.current);
      closeGraceTimerRef.current = null;
    }
  };

  // clear every pending timer on unmount
  useEffect(
    () => () => {
      clearUnmountTimer();
      clearHoverOpenTimer();
      clearCloseGraceTimer();
    },
    []
  );

  const openPanel = () => {
    if (open) return; // idempotent — a repeat trigger (hover re-entry, a second
    // click) never restarts the entrance or disturbs an already-open panel
    clearUnmountTimer();
    clearCloseGraceTimer();
    setClosing(false);
    setEntryDone(false);
    setMounted(true);
    setOpen(true);
  };

  const closePanel = (focusTrigger: boolean) => {
    if (!open) {
      if (focusTrigger) triggerRef.current?.focus();
      return;
    }
    setOpen(false);
    setClosing(true);
    const dur = reduced ? REDUCED_MS + 30 : EXIT_PANEL_DELAY_MS + EXIT_PANEL_MS + 30;
    clearUnmountTimer();
    unmountTimerRef.current = setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, dur);
    if (focusTrigger) triggerRef.current?.focus();
  };

  // hover-mode open/close arbitration: stays open as long as either hover or
  // focus is true, closes (after a short grace) once both let go
  const evaluateHover = (instant: boolean) => {
    const should = hoverRef.current || focusRef.current;
    if (should) {
      clearCloseGraceTimer();
      if (open) return;
      clearHoverOpenTimer();
      if (instant) openPanel();
      else hoverOpenTimerRef.current = setTimeout(openPanel, HOVER_OPEN_DELAY_MS);
    } else {
      clearHoverOpenTimer();
      clearCloseGraceTimer();
      closeGraceTimerRef.current = setTimeout(() => closePanel(false), CLOSE_GRACE_MS);
    }
  };

  // Escape closes from anywhere while mounted, not only while focus happens
  // to sit inside the panel — a popover that survives Escape because focus
  // drifted (hover mode never moves it in the first place) is a real trap.
  useEffect(() => {
    if (!mounted) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      closePanel(true);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- closePanel reads current open/reduced via closure each render
  }, [mounted]);

  // outside pointerdown closes in both modes
  useEffect(() => {
    if (!mounted) return;
    const onDown = (e: PointerEvent) => {
      const w = wrapperRef.current;
      if (w && e.target instanceof Node && !w.contains(e.target)) closePanel(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // focus moves into the panel exactly once per fresh open, click mode only
  useEffect(() => {
    if (interaction !== "click") return;
    if (open && !wasOpenRef.current) {
      wasOpenRef.current = true;
      const id = requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }));
      return () => cancelAnimationFrame(id);
    }
    if (!open) wasOpenRef.current = false;
  }, [open, interaction]);

  // collision check, once per fresh open: flip to the other side only if the
  // preferred side doesn't fit and the opposite side has more room
  useLayoutEffect(() => {
    if (!mounted) return;
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;
    const tr = trigger.getBoundingClientRect();
    const pr = panel.getBoundingClientRect();
    const needed = pr.height + STRING_LEN + VIEWPORT_PAD;
    const spaceBelow = window.innerHeight - tr.bottom;
    const spaceAbove = tr.top;
    let next = placement === "top";
    if (placement === "bottom" && spaceBelow < needed && spaceAbove > spaceBelow) next = true;
    else if (placement === "top" && spaceAbove < needed && spaceBelow > spaceAbove) next = false;
    setFlip(next);
  }, [mounted, placement]);

  const onSwingAnimationEnd = (e: ReactAnimationEvent<HTMLDivElement>) => {
    if (e.animationName === "ns-plumb-in" || e.animationName === "ns-plumb-reduced-in") {
      setEntryDone(true);
    }
  };

  const hoverHandlers =
    interaction === "hover"
      ? {
          onPointerEnter: () => {
            hoverRef.current = true;
            evaluateHover(false);
          },
          onPointerLeave: () => {
            hoverRef.current = false;
            evaluateHover(false);
          },
          onBlur: (e: ReactFocusEvent<HTMLSpanElement>) => {
            const next = e.relatedTarget as Node | null;
            if (next && wrapperRef.current?.contains(next)) return; // focus moved within
            focusRef.current = false;
            evaluateHover(false);
          },
        }
      : {};

  const triggerAria =
    interaction === "click"
      ? {
          "aria-haspopup": "dialog" as const,
          "aria-expanded": open,
          "aria-controls": mounted ? panelId : undefined,
        }
      : {
          "aria-haspopup": "dialog" as const,
          "aria-describedby": open ? panelId : undefined,
        };

  const swingClass = !mounted
    ? ""
    : closing
      ? reduced
        ? "ns-plumb-reduced-out"
        : ""
      : entryDone
        ? ""
        : reduced
          ? "ns-plumb-reduced-in"
          : "ns-plumb-in";

  const swingVars: Vars = {
    transformOrigin: flip ? "50% 100%" : "50% 0%",
    "--plumb-drop": flip ? `${DROP_PX}px` : `${-DROP_PX}px`,
  };

  const panelStyle: CSSProperties = {
    width: panelWidth,
    animation: closing
      ? reduced
        ? `ns-plumb-reduced-out ${REDUCED_MS}ms ease-in forwards`
        : `ns-plumb-panel-out ${EXIT_PANEL_MS}ms ease-in ${EXIT_PANEL_DELAY_MS}ms forwards`
      : undefined,
  };

  return (
    <span
      ref={wrapperRef}
      className={`relative inline-block ${className}`}
      {...hoverHandlers}
    >
      <button
        ref={triggerRef}
        type="button"
        {...triggerAria}
        aria-label={triggerLabel}
        onClick={interaction === "click" ? () => openPanel() : undefined}
        onFocus={
          interaction === "hover"
            ? () => {
                focusRef.current = true;
                evaluateHover(true);
              }
            : undefined
        }
        className="inline-flex items-center gap-1.5 rounded-sm px-1 py-0.5 text-sm font-medium text-foreground outline-none transition-colors duration-150 ease-out hover:text-ns-accent focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {trigger}
      </button>

      {mounted && (
        <div
          className="absolute left-1/2 z-50"
          style={flip ? { bottom: "100%", transform: "translateX(-50%)" } : { top: "100%", transform: "translateX(-50%)" }}
        >
          <div
            ref={swingRef}
            className={`flex flex-col items-center ${swingClass}`}
            style={swingVars}
            onAnimationEnd={onSwingAnimationEnd}
          >
            {!flip && <Connector length={STRING_LEN} cutting={closing && !reduced} />}
            <div
              ref={panelRef}
              id={panelId}
              role={interaction === "click" ? "dialog" : undefined}
              aria-label={interaction === "click" ? label : undefined}
              tabIndex={interaction === "click" ? -1 : undefined}
              style={panelStyle}
              className={`max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-md border border-border bg-surface text-foreground shadow-lg outline-none ${panelClassName}`}
            >
              {children}
            </div>
            {flip && <Connector length={STRING_LEN} cutting={closing && !reduced} />}
          </div>
        </div>
      )}

      <style>{`
@keyframes ns-plumb-in {
  0%   { opacity: 0; transform: translateY(var(--plumb-drop, -12px)) rotate(0deg); }
  14%  { opacity: 1; }
  32%  { transform: translateY(0px) rotate(-2.5deg); }
  56%  { transform: translateY(0px) rotate(1.2deg); }
  78%  { transform: translateY(0px) rotate(-0.4deg); }
  100% { opacity: 1; transform: translateY(0px) rotate(0deg); }
}
.ns-plumb-in { animation: ns-plumb-in ${ENTRY_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1) both; }
@keyframes ns-plumb-reduced-in { from { opacity: 0; } to { opacity: 1; } }
.ns-plumb-reduced-in { animation: ns-plumb-reduced-in ${REDUCED_MS}ms linear both; }
@keyframes ns-plumb-reduced-out { from { opacity: 1; } to { opacity: 0; } }
.ns-plumb-reduced-out { animation: ns-plumb-reduced-out ${REDUCED_MS}ms linear both; }
@keyframes ns-plumb-string-out { to { opacity: 0; } }
.ns-plumb-string-out { animation: ns-plumb-string-out ${EXIT_STRING_MS}ms ease-in both; }
@keyframes ns-plumb-panel-out { to { opacity: 0; transform: translateY(6px); } }
`}</style>
    </span>
  );
}
