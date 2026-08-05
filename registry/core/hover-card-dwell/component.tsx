"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

// IntentCoil — a hover-card trigger that has to be wound before it opens,
// instead of firing the instant the pointer happens to cross it. A hairline
// arc (an SVG circle, r=5, stroke --ns-muted) coils clockwise around a 5px dot
// appended after the trigger's label, its stroke-dashoffset driven straight
// off dwell time on a rAF loop rather than a CSS transition, because the
// wind has to be *interruptible mid-frame*: drift off before it completes
// and the same loop reverses the same dashoffset back to empty at 2x speed,
// so the coil un-winds visibly instead of just vanishing — no card ever
// mounts, no flicker. Reach full wind (~350ms of continuous dwell) and the
// card mounts with a spring scale-in from 0.95 while the arc lets go in a
// fast release: a ~117ms ease-out-expo unwind back to empty, the visual
// discharge of the intent that just got confirmed. That gate — a charging
// visualization of the hover delay itself — is the whole point of this
// component, and what separates it from a tooltip like PenumbraTip: that one
// always fires (its only job is arriving from the right edge without a
// layout flash); this one is allowed to refuse to fire, and shows you why.
//
// Keyboard has no dwell to visualize, so it doesn't try: focusing the
// trigger arms a plain 300ms timer that opens the card with no arc at all
// (a keyboard user already stated intent by tabbing here, gating them behind
// the same charge a mouse gets would be a bug, not a nicety), and Enter
// (or a decisive click, treated the same way) skips even that timer and
// opens immediately. The trigger is a real link — clicking it opens the
// preview rather than navigating, matching aria-haspopup="dialog"'s own
// semantics that the primary action invokes a popup, not a page. Card
// content is plain, un-portaled DOM sitting right after the trigger, so it
// simply falls into the tab order in document position while open rather
// than needing to be spliced into it. Escape closes from anywhere (focus
// may already be inside the card) and returns focus to the trigger. The
// card itself is deliberately unstyled beyond the essentials — a
// --background surface, 12px radius, 1px --border — because the mechanism
// is the interesting part, not the chrome.
//
// prefers-reduced-motion drops the coil and the release outright: the arc
// stays hidden, hover opens the card after the same dwell window via a
// plain opacity fade, nothing measured in motion. Zero dependencies; every
// color is a token (--background --foreground --ns-muted --border --ns-accent).

const WIND_MS = 350; // continuous hover needed to fully wind the coil
const UNWIND_MULT = 2; // leaving mid-wind reverses at this multiple of the wind rate
const RELEASE_MS = Math.round(WIND_MS / 3); // fast unwind once the card opens
const RELEASE_EASE = "cubic-bezier(0.16, 1, 0.3, 1)"; // ease-out-expo
const FOCUS_DWELL_MS = 300;
const CLOSE_GRACE_MS = 160; // lets the pointer travel from trigger to card without a flicker-close

type Phase = "idle" | "winding" | "unwinding" | "releasing";

export interface IntentCoilProps {
  /** Destination for the trigger link. */
  href: string;
  /** Trigger label — the text (or element) the coil winds around. */
  children: ReactNode;
  /** Card body: link preview, profile summary, definition — whatever the hover-card should show. */
  preview: ReactNode;
  /** Accessible name for the popover. Defaults to a name derived from `children` when it's plain text. */
  previewLabel?: string;
  className?: string;
}

function deriveLabel(children: ReactNode, explicit?: string): string {
  if (explicit) return explicit;
  if (typeof children === "string") return `${children} — preview`;
  return "Preview";
}

export function IntentCoil({ href, children, preview, previewLabel, className = "" }: IntentCoilProps) {
  const uid = useId();
  const panelId = `ns-hover-card-dwell-${uid.replace(/:/g, "")}`;

  const triggerRef = useRef<HTMLAnchorElement>(null);
  // span, not div: this trigger sits inline inside prose (a link preview
  // mid-paragraph), and a block-level div here forces the browser to
  // auto-close an ancestor <p> and re-parent everything after it — invalid
  // nesting that silently restructures the DOM. The panel is already
  // position:absolute, so the used display becomes block regardless of tag;
  // span costs nothing visually and keeps this legal inside running text.
  const panelRef = useRef<HTMLSpanElement>(null);
  const arcRef = useRef<SVGCircleElement>(null);

  const [open, setOpen] = useState(false);
  const [reduced, setReduced] = useState(false);

  // Interaction state lives in a ref, not React state — the rAF wind/unwind
  // loop and the pointer handlers that drive it run every frame and can't
  // wait on a render round-trip.
  const st = useRef({
    phase: "idle" as Phase,
    progress: 0, // 0..1 wound
    raf: 0,
    last: 0,
    hoverTrigger: false,
    hoverCard: false,
    focused: false,
    reducedTimer: undefined as number | undefined,
    focusDwellTimer: undefined as number | undefined,
    closeTimer: undefined as number | undefined,
    releaseTimer: undefined as number | undefined,
  }).current;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const writeArc = useCallback((p: number) => {
    const el = arcRef.current;
    if (el) el.style.strokeDashoffset = String(1 - p);
  }, []);

  const clearSoftTimers = useCallback(() => {
    if (st.reducedTimer !== undefined) {
      window.clearTimeout(st.reducedTimer);
      st.reducedTimer = undefined;
    }
    if (st.focusDwellTimer !== undefined) {
      window.clearTimeout(st.focusDwellTimer);
      st.focusDwellTimer = undefined;
    }
    if (st.closeTimer !== undefined) {
      window.clearTimeout(st.closeTimer);
      st.closeTimer = undefined;
    }
  }, [st]);

  const stopRaf = useCallback(() => {
    if (st.raf) {
      cancelAnimationFrame(st.raf);
      st.raf = 0;
    }
  }, [st]);

  // Opens the card directly, no wind/release — the path shared by click,
  // Enter, focus-dwell and reduced-motion, none of which get a coil at all.
  const openInstant = useCallback(() => {
    clearSoftTimers();
    stopRaf();
    if (st.releaseTimer !== undefined) {
      window.clearTimeout(st.releaseTimer);
      st.releaseTimer = undefined;
    }
    st.phase = "idle";
    st.progress = 0;
    const el = arcRef.current;
    if (el) el.style.transition = "none";
    writeArc(0);
    setOpen(true);
  }, [clearSoftTimers, stopRaf, st, writeArc]);

  const scheduleMaybeClose = useCallback(() => {
    if (st.closeTimer !== undefined) window.clearTimeout(st.closeTimer);
    st.closeTimer = window.setTimeout(() => {
      st.closeTimer = undefined;
      if (!st.hoverTrigger && !st.hoverCard && !st.focused) setOpen(false);
    }, CLOSE_GRACE_MS);
  }, [st]);

  const closeNow = useCallback(
    (returnFocus: boolean) => {
      clearSoftTimers();
      setOpen(false);
      if (returnFocus) triggerRef.current?.focus();
    },
    [clearSoftTimers]
  );

  // The fast release: the coil is fully wound (dashoffset 0) the instant the
  // card opens, then snaps back to empty over RELEASE_MS on an eased CSS
  // transition — the wind discharging rather than just disappearing.
  const release = useCallback(() => {
    const el = arcRef.current;
    st.phase = "releasing";
    if (el) {
      el.style.transition = `stroke-dashoffset ${RELEASE_MS}ms ${RELEASE_EASE}`;
      requestAnimationFrame(() => {
        if (arcRef.current) arcRef.current.style.strokeDashoffset = "1";
      });
    }
    if (st.releaseTimer !== undefined) window.clearTimeout(st.releaseTimer);
    // timer-driven, not transitionend-driven: a backgrounded tab can never
    // strand the arc mid-release with its transition still armed.
    st.releaseTimer = window.setTimeout(() => {
      st.releaseTimer = undefined;
      st.phase = "idle";
      st.progress = 0;
      if (arcRef.current) arcRef.current.style.transition = "none";
    }, RELEASE_MS + 40);
  }, [st]);

  const tick = useCallback(
    (now: number) => {
      const dt = st.last ? now - st.last : 0;
      st.last = now;
      if (st.phase === "winding") {
        st.progress = Math.min(1, st.progress + dt / WIND_MS);
        writeArc(st.progress);
        if (st.progress >= 1) {
          st.raf = 0;
          setOpen(true);
          release();
          return;
        }
      } else if (st.phase === "unwinding") {
        st.progress = Math.max(0, st.progress - (dt / WIND_MS) * UNWIND_MULT);
        writeArc(st.progress);
        if (st.progress <= 0) {
          st.phase = "idle";
          st.raf = 0;
          return;
        }
      } else {
        st.raf = 0;
        return;
      }
      st.raf = requestAnimationFrame(tick);
    },
    [st, writeArc, release]
  );

  const startRaf = useCallback(() => {
    if (st.raf) return;
    st.last = 0;
    st.raf = requestAnimationFrame(tick);
  }, [st, tick]);

  const startWind = useCallback(() => {
    if (open) return;
    if (reduced) {
      if (st.reducedTimer === undefined) {
        st.reducedTimer = window.setTimeout(() => {
          st.reducedTimer = undefined;
          setOpen(true);
        }, WIND_MS);
      }
      return;
    }
    const el = arcRef.current;
    if (el) el.style.transition = "none"; // cut off any pending release transition cleanly
    st.phase = "winding";
    startRaf();
  }, [open, reduced, st, startRaf]);

  const abandonWind = useCallback(() => {
    if (st.reducedTimer !== undefined) {
      window.clearTimeout(st.reducedTimer);
      st.reducedTimer = undefined;
    }
    if (st.phase === "winding") {
      st.phase = "unwinding";
      startRaf();
    }
  }, [st, startRaf]);

  useEffect(() => {
    return () => {
      stopRaf();
      clearSoftTimers();
      if (st.releaseTimer !== undefined) window.clearTimeout(st.releaseTimer);
    };
  }, [stopRaf, clearSoftTimers, st]);

  // Escape closes from anywhere — focus may already be inside the card —
  // and returns focus to the trigger.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      closeNow(true);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, closeNow]);

  const label = useMemo(() => deriveLabel(children, previewLabel), [children, previewLabel]);

  return (
    <span className={`ns-hover-card-dwell relative inline-flex items-center ${className}`}>
      <a
        ref={triggerRef}
        href={href}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className={[
          "rounded-sm underline decoration-border underline-offset-4 transition-colors duration-150 ease-out",
          "hover:decoration-foreground",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent",
        ].join(" ")}
        onPointerEnter={(e: ReactPointerEvent<HTMLAnchorElement>) => {
          if (e.pointerType === "touch") return;
          st.hoverTrigger = true;
          if (st.closeTimer !== undefined) {
            window.clearTimeout(st.closeTimer);
            st.closeTimer = undefined;
          }
          startWind();
        }}
        onPointerLeave={(e: ReactPointerEvent<HTMLAnchorElement>) => {
          if (e.pointerType === "touch") return;
          st.hoverTrigger = false;
          abandonWind();
          if (open) scheduleMaybeClose();
        }}
        onFocus={(_e: ReactFocusEvent<HTMLAnchorElement>) => {
          st.focused = true;
          if (st.closeTimer !== undefined) {
            window.clearTimeout(st.closeTimer);
            st.closeTimer = undefined;
          }
          if (!open && st.focusDwellTimer === undefined) {
            st.focusDwellTimer = window.setTimeout(() => {
              st.focusDwellTimer = undefined;
              openInstant();
            }, FOCUS_DWELL_MS);
          }
        }}
        onBlur={(e: ReactFocusEvent<HTMLAnchorElement>) => {
          st.focused = false;
          if (st.focusDwellTimer !== undefined) {
            window.clearTimeout(st.focusDwellTimer);
            st.focusDwellTimer = undefined;
          }
          const next = e.relatedTarget as Node | null;
          if (next && panelRef.current?.contains(next)) return; // tabbing forward into the card
          if (open) scheduleMaybeClose();
        }}
        onKeyDown={(e: ReactKeyboardEvent<HTMLAnchorElement>) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (st.focusDwellTimer !== undefined) {
              window.clearTimeout(st.focusDwellTimer);
              st.focusDwellTimer = undefined;
            }
            openInstant();
          }
        }}
        onClick={(e) => {
          // aria-haspopup="dialog" means this link's job is to invoke the
          // popover, not navigate — a decisive click states the same intent
          // Enter does, so it opens immediately too (idempotent: clicking an
          // already-open trigger just keeps it open).
          e.preventDefault();
          if (!open) openInstant();
        }}
      >
        {children}
      </a>
      <svg aria-hidden width={14} height={14} viewBox="0 0 14 14" className="ns-hover-card-dwell-dial ml-1 shrink-0 text-ns-muted">
        <circle cx={7} cy={7} r={2} fill="currentColor" />
        <circle
          ref={arcRef}
          cx={7}
          cy={7}
          r={5}
          fill="none"
          stroke="currentColor"
          strokeWidth={1}
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1}
          style={{ transformOrigin: "50% 50%", transform: "rotate(-90deg)" }}
        />
      </svg>
      {open && (
        <span
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label={label}
          onPointerEnter={() => {
            st.hoverCard = true;
            if (st.closeTimer !== undefined) {
              window.clearTimeout(st.closeTimer);
              st.closeTimer = undefined;
            }
          }}
          onPointerLeave={() => {
            st.hoverCard = false;
            scheduleMaybeClose();
          }}
          onBlur={(e: ReactFocusEvent<HTMLSpanElement>) => {
            const next = e.relatedTarget as Node | null;
            if (next && (panelRef.current?.contains(next) || triggerRef.current?.contains(next))) return;
            scheduleMaybeClose();
          }}
          className="ns-hover-card-dwell-card absolute left-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-md border border-border bg-background p-3 text-sm text-foreground shadow-sm"
        >
          {preview}
        </span>
      )}
      <style>{`
.ns-hover-card-dwell-card{animation:ns-coil-in 220ms cubic-bezier(0.34,1.56,0.64,1) both}
@keyframes ns-coil-in{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:none}}
@keyframes ns-coil-fade{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion: reduce){
  .ns-hover-card-dwell-dial{display:none}
  .ns-hover-card-dwell-card{animation:ns-coil-fade 130ms ease-out both}
}
`}</style>
    </span>
  );
}
