"use client";

import {
  cloneElement,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";
import { createPortal } from "react-dom";

// A tooltip that resolves FROM the trigger's own edge instead of fading in
// from nowhere: on open, the panel's 1px border traces itself outward from
// the edge facing the trigger — that edge draws first from its own centre,
// the two edges meeting it shoot out from that seam, the far edge closes the
// loop last — and the label settles in ~80ms behind the border, so the panel
// reads as something the trigger extruded rather than a layer that appeared
// on top of the page.
//
// Delay-group: PenumbraTipGroup gives siblings a shared "warm" window. The
// first tooltip to open in a cold group waits the full openDelay; while one
// is open, or within `closeGrace` of the last one closing, the next sibling
// opens instantly with the trace/settle skipped entirely — a menu-bar
// handoff, not a fresh reveal. Leaving the group for longer than closeGrace
// re-arms the delay. Group state lives in refs, not React state, so handoff
// is a synchronous decision made the instant a trigger is entered — no frame
// where two tooltips or a stale delay could race.
//
// Semantics: role="tooltip" on the panel + aria-describedby on the trigger,
// applied only while open (Radix's convention, not the APG's "always-mounted,
// visually hidden" alternative). The always-mounted approach keeps the
// association stable for AT that only reads aria-describedby once on focus,
// but it means shipping content in the DOM (with real layout cost, since it
// can't be display:none) for something that never becomes visible in the
// common case. Given this panel is genuinely mount/unmount (it needs a fresh
// measure-and-place pass every open regardless, for collision awareness),
// tying its DOM lifetime to aria-describedby's is the smaller compromise:
// every AT this was tested against reads the description because the
// attribute lands before the synchronous focus/hover handler returns, well
// before any AT polling interval fires.
//
// Placement is collision-aware (flips to the opposite side when the
// preferred one doesn't fit, clamped to the viewport on the cross axis) and
// portals to document.body so an ancestor's overflow:hidden can never clip
// it — a known failure mode in this repo.
//
// Keyboard: focus opens it — instantly, never delayed, because a keyboard
// user is not "hovering past" and switching a delay on for them is a real
// accessibility bug — and Escape closes it. Hover honors the delay/group
// logic. Touch has no hover, so a touch tap opens it as an isolated peek:
// a second tap on the trigger, a tap anywhere else, a scroll, Escape, or a
// 4s safety timeout all close it — nothing a touch user does can leave it
// stuck open.
//
// prefers-reduced-motion: the trace and the content settle are skipped, the
// panel simply appears — same placement logic, same delay/group timing,
// fully legible, just not animated.

type Side = "top" | "bottom" | "left" | "right";

const OPPOSITE: Record<Side, Side> = { top: "bottom", bottom: "top", left: "right", right: "left" };
const SIDES: Side[] = ["top", "bottom", "left", "right"];

function mergeRefs<T>(...refs: Array<Ref<T> | null | undefined>) {
  return (node: T | null) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === "function") ref(node);
      else (ref as MutableRefObject<T | null>).current = node;
    }
  };
}

// ---------------------------------------------------------------------------
// Delay group
// ---------------------------------------------------------------------------

interface GroupApi {
  openDelay: number;
  isWarm: () => boolean;
  markOpen: (id: string) => void;
  markClosed: (id: string) => void;
}

const GroupContext = createContext<GroupApi | null>(null);

// Props interface intentionally declared further down, after PenumbraTipProps
// (see the comment there) — TS type declarations aren't order-sensitive, so
// this doesn't change how PenumbraTipGroup below can use it.

/** Wrap a row of PenumbraTip triggers so they share open-delay/handoff state,
 * the way a real menu bar's submenus do. */
export function PenumbraTipGroup({ children, openDelay = 500, closeGrace = 300 }: PenumbraTipGroupProps) {
  // refs, not state: a hover handoff has to be decided synchronously inside
  // the pointerenter that starts it, not on the next render.
  const openIdRef = useRef<string | null>(null);
  const warmUntilRef = useRef(0);

  const api = useMemo<GroupApi>(
    () => ({
      openDelay,
      isWarm: () => openIdRef.current !== null || Date.now() < warmUntilRef.current,
      markOpen: (id) => {
        openIdRef.current = id;
      },
      markClosed: (id) => {
        if (openIdRef.current === id) openIdRef.current = null;
        warmUntilRef.current = Date.now() + closeGrace;
      },
    }),
    [openDelay, closeGrace]
  );

  return <GroupContext.Provider value={api}>{children}</GroupContext.Provider>;
}

// ---------------------------------------------------------------------------
// Collision-aware placement
// ---------------------------------------------------------------------------

const VIEWPORT_PAD = 8;

function computePlacement(
  trigger: DOMRect,
  panel: { width: number; height: number },
  preferred: Side,
  offset: number
): { side: Side; top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const space: Record<Side, number> = {
    top: trigger.top - VIEWPORT_PAD,
    bottom: vh - trigger.bottom - VIEWPORT_PAD,
    left: trigger.left - VIEWPORT_PAD,
    right: vw - trigger.right - VIEWPORT_PAD,
  };
  const need = (side: Side) => (side === "top" || side === "bottom" ? panel.height : panel.width) + offset;

  let side = preferred;
  if (space[side] < need(side)) {
    const opp = OPPOSITE[side];
    // flip when the opposite side actually has room; otherwise there is
    // nowhere that fits, so keep whichever of the two loses least
    side = space[opp] >= need(opp) ? opp : space[side] >= space[opp] ? side : opp;
  }

  let top: number;
  let left: number;
  if (side === "top" || side === "bottom") {
    top = side === "top" ? trigger.top - offset - panel.height : trigger.bottom + offset;
    left = trigger.left + trigger.width / 2 - panel.width / 2;
    left = Math.min(Math.max(left, VIEWPORT_PAD), Math.max(VIEWPORT_PAD, vw - panel.width - VIEWPORT_PAD));
  } else {
    left = side === "left" ? trigger.left - offset - panel.width : trigger.right + offset;
    top = trigger.top + trigger.height / 2 - panel.height / 2;
    top = Math.min(Math.max(top, VIEWPORT_PAD), Math.max(VIEWPORT_PAD, vh - panel.height - VIEWPORT_PAD));
  }
  return { side, top, left };
}

// ---------------------------------------------------------------------------
// Entrance: the border trace + content settle
// ---------------------------------------------------------------------------

const TRACE_EASE = "cubic-bezier(0.16, 1, 0.3, 1)"; // ease-out-expo
const TRACE_LEG_MS = 70;
const CONTENT_DELAY_MS = 80;
const CONTENT_MS = 130;

function axisTransform(side: Side, scale: number): string {
  return side === "top" || side === "bottom" ? `scaleX(${scale})` : `scaleY(${scale})`;
}

// The facing edge (the one nearest the trigger) and its opposite both grow
// symmetrically from their own centre. The two edges connecting them are
// anchored at the corner where they meet the facing edge, so they read as
// shooting out FROM it rather than growing independently.
function edgeTransformOrigin(edge: Side, facing: Side): string {
  if (edge === facing || edge === OPPOSITE[facing]) return "center";
  switch (facing) {
    case "top":
      return "center top";
    case "bottom":
      return "center bottom";
    case "left":
      return "left center";
    default:
      return "right center";
  }
}

function contentStartTransform(facing: Side): string {
  switch (facing) {
    case "top":
      return "translateY(-3px)";
    case "bottom":
      return "translateY(3px)";
    case "left":
      return "translateX(-3px)";
    default:
      return "translateX(3px)";
  }
}

function playEntrance(
  edges: Record<Side, HTMLDivElement | null>,
  content: HTMLDivElement | null,
  facing: Side,
  instant: boolean,
  reduced: boolean
) {
  const setEdge = (side: Side, scale: number, delay: number, dur: number) => {
    const el = edges[side];
    if (!el) return;
    el.style.transition = dur > 0 ? `transform ${dur}ms ${TRACE_EASE} ${delay}ms` : "none";
    el.style.transform = axisTransform(side, scale);
  };

  if (instant || reduced) {
    for (const s of SIDES) setEdge(s, 1, 0, 0);
    if (content) {
      content.style.transition = "none";
      content.style.opacity = "1";
      content.style.transform = "none";
    }
    return;
  }

  const adjacent: Record<Side, [Side, Side]> = {
    top: ["left", "right"],
    bottom: ["left", "right"],
    left: ["top", "bottom"],
    right: ["top", "bottom"],
  };
  const far = OPPOSITE[facing];
  const [a1, a2] = adjacent[facing];

  // start fully collapsed
  for (const s of SIDES) setEdge(s, 0, 0, 0);
  if (content) {
    content.style.transition = "none";
    content.style.opacity = "0";
    content.style.transform = contentStartTransform(facing);
  }

  requestAnimationFrame(() => {
    setEdge(facing, 1, 0, TRACE_LEG_MS);
    setEdge(a1, 1, Math.round(TRACE_LEG_MS * 0.6), TRACE_LEG_MS);
    setEdge(a2, 1, Math.round(TRACE_LEG_MS * 0.6), TRACE_LEG_MS);
    setEdge(far, 1, Math.round(TRACE_LEG_MS * 1.3), Math.round(TRACE_LEG_MS * 0.9));
    if (content) {
      content.style.transition = `opacity ${CONTENT_MS}ms ease-out ${CONTENT_DELAY_MS}ms, transform ${CONTENT_MS}ms ${TRACE_EASE} ${CONTENT_DELAY_MS}ms`;
      content.style.opacity = "1";
      content.style.transform = "none";
    }
  });
}

function edgeBaseClass(side: Side): string {
  const base = "absolute bg-border";
  switch (side) {
    case "top":
      return `${base} left-0 right-0 top-0 h-px`;
    case "bottom":
      return `${base} left-0 right-0 bottom-0 h-px`;
    case "left":
      return `${base} top-0 bottom-0 left-0 w-px`;
    default:
      return `${base} top-0 bottom-0 right-0 w-px`;
  }
}

// ---------------------------------------------------------------------------
// PenumbraTip
// ---------------------------------------------------------------------------

export interface PenumbraTipProps {
  /** Tooltip body. Keep it short — non-interactive text/inline content only;
   * a tooltip is never itself focusable or clickable. */
  content: ReactNode;
  /** A single trigger element. Gets a merged ref, pointer/focus/keyboard
   * handlers, and aria-describedby (while open) cloned onto it. */
  children: ReactElement;
  /** Preferred side. Flips to the opposite side when there isn't room. */
  side?: Side;
  /** Gap between trigger and panel, px. Default 8. */
  sideOffset?: number;
  /** Delay before an isolated open (standalone, or a cold group), ms.
   * Defaults to the enclosing PenumbraTipGroup's openDelay, else 500. */
  openDelay?: number;
  disabled?: boolean;
  /** Extra classes on the tooltip panel. */
  className?: string;
}

// Declared here (after PenumbraTipProps, not up by PenumbraTipGroup) purely
// so that this file's PROP-SHAPE SCANNER (scripts/build-llms.ts) — which
// greps for the first `export interface *Props` in the file, not the one
// matching a particular component name — resolves to the primary
// component's props instead of the group wrapper's. No runtime meaning to
// the position; see the note by GroupContext above.
export interface PenumbraTipGroupProps {
  children: ReactNode;
  /** Delay before the first tooltip in a cold group opens, ms. Default 500. */
  openDelay?: number;
  /** How long the group stays "warm" after its last tooltip closes — a
   * sibling entered within this window hands off instantly. Default 300. */
  closeGrace?: number;
}

const TOUCH_AUTOCLOSE_MS = 4000;

export function PenumbraTip({
  content,
  children,
  side = "top",
  sideOffset = 8,
  openDelay,
  disabled = false,
  className = "",
}: PenumbraTipProps) {
  const group = useContext(GroupContext);
  const reactId = useId();
  const tipId = `ns-ptip-${reactId.replace(/:/g, "")}`;
  const groupIdRef = useRef(tipId);

  const triggerElRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const contentElRef = useRef<HTMLDivElement | null>(null);
  const edgeRefs = useRef<Record<Side, HTMLDivElement | null>>({
    top: null,
    bottom: null,
    left: null,
    right: null,
  });

  const [open, setOpen] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const instantRef = useRef(false);
  const openViaTouchRef = useRef(false);

  const hoverRef = useRef(false);
  const focusRef = useRef(false);
  const openTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => setPortalReady(true), []);

  const effectiveDelay = openDelay ?? group?.openDelay ?? 500;

  const clearOpenTimer = () => {
    if (openTimerRef.current !== undefined) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = undefined;
    }
  };

  const doOpen = useCallback(
    (instant: boolean, viaTouch: boolean) => {
      clearOpenTimer();
      instantRef.current = instant;
      openViaTouchRef.current = viaTouch;
      group?.markOpen(groupIdRef.current);
      setOpen(true);
    },
    [group]
  );

  const doClose = useCallback(() => {
    clearOpenTimer();
    group?.markClosed(groupIdRef.current);
    setOpen(false);
  }, [group]);

  useEffect(() => {
    if (disabled) doClose();
  }, [disabled, doClose]);

  // hover/focus are independent inputs; the tooltip stays open as long as
  // either is true, and only closes once both let go — so tabbing to a
  // trigger you're also resting the mouse on doesn't flicker on mouseleave.
  const evaluate = useCallback(() => {
    const shouldOpen = hoverRef.current || focusRef.current;
    if (shouldOpen && !open) {
      if (focusRef.current) {
        // keyboard focus: always instant, full trace — a delay here is a
        // real a11y bug, not a nicety
        doOpen(false, false);
        return;
      }
      if (group?.isWarm() ?? false) {
        doOpen(true, false);
        return;
      }
      clearOpenTimer();
      openTimerRef.current = window.setTimeout(() => doOpen(false, false), effectiveDelay);
    } else if (!shouldOpen) {
      clearOpenTimer();
      if (open) doClose();
    }
  }, [open, doOpen, doClose, group, effectiveDelay]);

  // Escape (always), plus outside-tap/scroll/safety-timeout for a
  // touch-opened peek — a touch tap has no hover to release on, so it needs
  // its own guaranteed way back to closed.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") doClose();
    };
    const onScroll = () => doClose();
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);

    let onOutside: ((e: PointerEvent) => void) | undefined;
    let safety: number | undefined;
    if (openViaTouchRef.current) {
      onOutside = (e) => {
        const t = e.target as Node;
        if (panelRef.current?.contains(t) || triggerElRef.current?.contains(t)) return;
        doClose();
      };
      document.addEventListener("pointerdown", onOutside, true);
      safety = window.setTimeout(doClose, TOUCH_AUTOCLOSE_MS);
    }

    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      if (onOutside) document.removeEventListener("pointerdown", onOutside, true);
      if (safety !== undefined) window.clearTimeout(safety);
    };
  }, [open, doClose]);

  // Measure, place (collision-aware) and animate. Runs once per open — the
  // panel is a fresh mount every time, so a stale rect can't leak between
  // opens at a different trigger position.
  useLayoutEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const trigger = triggerElRef.current;
    if (!panel || !trigger) return;

    const triggerRect = trigger.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const placement = computePlacement(
      triggerRect,
      { width: panelRect.width, height: panelRect.height },
      side,
      sideOffset
    );
    const facing = OPPOSITE[placement.side];

    panel.style.top = `${placement.top}px`;
    panel.style.left = `${placement.left}px`;
    panel.style.visibility = "visible";

    for (const s of SIDES) {
      const el = edgeRefs.current[s];
      if (el) el.style.transformOrigin = edgeTransformOrigin(s, facing);
    }

    const reduced =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    playEntrance(edgeRefs.current, contentElRef.current, facing, instantRef.current, reduced);
  }, [open, side, sideOffset]);

  useEffect(() => () => clearOpenTimer(), []);

  if (typeof children === "object" && children !== null && !("props" in (children as object))) {
    // not a valid element — nothing sane to clone onto
    return children as unknown as ReactElement;
  }

  const child = children as ReactElement<Record<string, unknown>>;
  const originalProps = (child.props ?? {}) as Record<string, unknown>;
  // React 19 moved `ref` into props and made the old `element.ref` accessor
  // emit a console.error on every read (which the verify gate hard-fails
  // on) — read it off props instead.
  const originalRef = originalProps.ref as Ref<HTMLElement> | undefined;

  const clonedChild = cloneElement(child, {
    ref: mergeRefs<HTMLElement>(originalRef, (node) => {
      triggerElRef.current = node;
    }),
    onPointerEnter: (e: ReactPointerEvent) => {
      (originalProps.onPointerEnter as ((e: ReactPointerEvent) => void) | undefined)?.(e);
      if (disabled || e.pointerType === "touch") return;
      hoverRef.current = true;
      evaluate();
    },
    onPointerLeave: (e: ReactPointerEvent) => {
      (originalProps.onPointerLeave as ((e: ReactPointerEvent) => void) | undefined)?.(e);
      if (e.pointerType === "touch") return;
      hoverRef.current = false;
      evaluate();
    },
    onFocus: (e: ReactFocusEvent) => {
      (originalProps.onFocus as ((e: ReactFocusEvent) => void) | undefined)?.(e);
      if (disabled) return;
      focusRef.current = true;
      evaluate();
    },
    onBlur: (e: ReactFocusEvent) => {
      (originalProps.onBlur as ((e: ReactFocusEvent) => void) | undefined)?.(e);
      focusRef.current = false;
      evaluate();
    },
    onKeyDown: (e: ReactKeyboardEvent) => {
      (originalProps.onKeyDown as ((e: ReactKeyboardEvent) => void) | undefined)?.(e);
      if (e.key === "Escape" && open) {
        e.stopPropagation();
        doClose();
      }
    },
    onPointerDown: (e: ReactPointerEvent) => {
      (originalProps.onPointerDown as ((e: ReactPointerEvent) => void) | undefined)?.(e);
      if (disabled || e.pointerType !== "touch") return;
      if (open) {
        doClose();
        return;
      }
      doOpen(true, true);
    },
    "aria-describedby":
      open ? tipId : (originalProps["aria-describedby"] as string | undefined),
  });

  return (
    <>
      {clonedChild}
      {open &&
        portalReady &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            id={tipId}
            role="tooltip"
            style={{ position: "fixed", top: 0, left: 0, visibility: "hidden" }}
            className={[
              "ns-ptip pointer-events-auto z-50 max-w-64 overflow-hidden rounded-sm bg-surface px-3 py-2",
              "font-sans text-xs leading-snug text-foreground shadow-sm",
              className,
            ]
              .join(" ")
              .trim()}
          >
            {SIDES.map((s) => (
              <div
                key={s}
                ref={(el) => {
                  edgeRefs.current[s] = el;
                }}
                aria-hidden
                className={edgeBaseClass(s)}
              />
            ))}
            <div ref={contentElRef}>{content}</div>
          </div>,
          document.body
        )}
    </>
  );
}
