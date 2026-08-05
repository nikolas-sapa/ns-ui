"use client";

import { useCallback, useEffect, useId, useRef, type ReactNode, type RefObject } from "react";

// A modal on the native <dialog> element: focus trap, background inertness to
// pointer and focus, Escape-to-close, top-layer stacking and ::backdrop all
// come from the platform, so none of that is reimplemented here. showModal()
// does NOT stop the page behind it from scrolling, though, so that one piece
// of inertness is hand-rolled: body scroll is locked for the duration the
// dialog is open and the scrollbar's width is compensated with padding so the
// page doesn't jump when the scrollbar disappears. The twist is the entrance —
// the panel emerges from the control that opened it. The trigger's bounding
// rect is measured at open time (not at mount; it moves on scroll and resize),
// inverted into one transform, and played out to identity (FLIP: no layout
// thrash, one composited property). Closing runs the same transform backwards
// so the panel returns into the trigger and the user never loses the thread of
// what they clicked. No trigger — opened programmatically — falls back to a
// centered scale-in. The close is timer-driven rather than transitionend-driven
// so a backgrounded tab can't strand an un-closed dialog. Reduced motion skips
// the morph entirely and opens instantly, still fully functional.

const OPEN_MS = 340;
const CLOSE_MS = 220;
const OPEN_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const CLOSE_EASE = "cubic-bezier(0.4, 0, 0.9, 0.4)";
const PANEL_RADIUS = 12; // --radius-md, kept visually constant through the scale
const FALLBACK_SCALE = 0.92; // centered scale-in when there is no trigger

export interface EmergeDialogProps {
  /** Controlled open state. The dialog is opened with `showModal()`. */
  open: boolean;
  /** Called for every close the platform can originate: Escape, backdrop, close controls. */
  onOpenChange: (open: boolean) => void;
  /** The control the panel emerges from and returns into. Omit for a centered scale-in. */
  triggerRef?: RefObject<HTMLElement | null>;
  title?: ReactNode;
  description?: ReactNode;
  /** Body and actions. Rendered inside the panel, below the title block. */
  children?: ReactNode;
  /** Clicking the dimmed backdrop closes. Default true. */
  dismissOnBackdrop?: boolean;
  className?: string;
}

export function EmergeDialog({
  open,
  onOpenChange,
  triggerRef,
  title,
  description,
  children,
  dismissOnBackdrop = true,
  className = "",
}: EmergeDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const timerRef = useRef(0);
  const titleId = useId();
  const descId = useId();
  // Captured inline body styles from just before the lock was applied, so
  // close/unmount restores whatever a host page had set rather than clobbering
  // it. Null means "not currently locked".
  const scrollLockRef = useRef<{ overflow: string; paddingRight: string } | null>(null);

  // read in listeners that are bound once, so their deps stay empty
  const openRef = useRef(open);
  openRef.current = open;
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;
  const dismissRef = useRef(dismissOnBackdrop);
  dismissRef.current = dismissOnBackdrop;

  const reset = useCallback(() => {
    const dlg = dialogRef.current;
    const panel = panelRef.current;
    if (dlg) {
      dlg.removeAttribute("data-closing");
      dlg.style.transition = "";
      dlg.style.transform = "";
      dlg.style.borderRadius = "";
    }
    if (panel) {
      panel.style.transition = "";
      panel.style.opacity = "";
      panel.style.transform = "";
    }
  }, []);

  // The inverted transform that maps the dialog's final rect onto the trigger's.
  const invert = useCallback(() => {
    const dlg = dialogRef.current;
    if (!dlg) return null;
    const d = dlg.getBoundingClientRect();
    if (!d.width || !d.height) return null;
    const t = triggerRef?.current?.getBoundingClientRect();
    if (!t || !t.width || !t.height) {
      return { sx: FALLBACK_SCALE, sy: FALLBACK_SCALE, dx: 0, dy: 0 };
    }
    return {
      sx: Math.max(0.05, t.width / d.width),
      sy: Math.max(0.05, t.height / d.height),
      dx: t.left + t.width / 2 - (d.left + d.width / 2),
      dy: t.top + t.height / 2 - (d.top + d.height / 2),
    };
  }, [triggerRef]);

  // Counter the scale so the corner radius reads the same size all the way
  // through the morph instead of ballooning as the panel shrinks.
  const morph = (dlg: HTMLDialogElement, m: { sx: number; sy: number; dx: number; dy: number }) => {
    dlg.style.transform = `translate(${m.dx.toFixed(1)}px, ${m.dy.toFixed(1)}px) scale(${m.sx.toFixed(4)}, ${m.sy.toFixed(4)})`;
    dlg.style.borderRadius = `${(PANEL_RADIUS / ((m.sx + m.sy) / 2)).toFixed(1)}px`;
  };

  const reduced = () =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // showModal() and CSS inertness stop pointer and focus from reaching the
  // background, but the page itself keeps scrolling under it. Lock it here;
  // the scrollbar's width is added back as body padding so the page doesn't
  // reflow/jump when the scrollbar disappears. Idempotent: a re-open landing
  // mid-close finds it already locked and no-ops.
  const lockScroll = useCallback(() => {
    if (scrollLockRef.current) return;
    const body = document.body;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    scrollLockRef.current = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      const currentPadding = parseFloat(window.getComputedStyle(body).paddingRight) || 0;
      body.style.paddingRight = `${currentPadding + scrollbarWidth}px`;
    }
  }, []);

  const unlockScroll = useCallback(() => {
    const saved = scrollLockRef.current;
    if (!saved) return;
    const body = document.body;
    body.style.overflow = saved.overflow;
    body.style.paddingRight = saved.paddingRight;
    scrollLockRef.current = null;
  }, []);

  const openNow = useCallback(() => {
    const dlg = dialogRef.current;
    const panel = panelRef.current;
    if (!dlg) return;
    if (dlg.open && !dlg.hasAttribute("data-closing")) return;
    // a re-open landing mid-close must not inherit the close's transform, and
    // must kill the pending timer that would otherwise close it a frame later
    clearTimeout(timerRef.current);
    cancelAnimationFrame(rafRef.current);
    reset();
    lockScroll();
    if (!dlg.open) dlg.showModal();
    if (reduced()) return;

    const m = invert();
    if (!m) return;
    dlg.style.transition = "none";
    morph(dlg, m);
    if (panel) {
      panel.style.transition = "none";
      panel.style.opacity = "0";
      panel.style.transform = "translateY(6px)";
    }
    // rect measurement above already flushed layout, so one frame is enough
    rafRef.current = requestAnimationFrame(() => {
      dlg.style.transition = `transform ${OPEN_MS}ms ${OPEN_EASE}, border-radius ${OPEN_MS}ms ${OPEN_EASE}`;
      dlg.style.transform = "translate(0px, 0px) scale(1, 1)";
      dlg.style.borderRadius = "";
      if (panel) {
        // content arrives after the box has most of its size — the squash of
        // real text through a 0.2 scale is what makes a morph look cheap
        panel.style.transition = `opacity 200ms ease-out 110ms, transform 240ms ${OPEN_EASE} 90ms`;
        panel.style.opacity = "1";
        panel.style.transform = "translateY(0px)";
      }
    });
  }, [invert, reset, lockScroll]);

  const closeNow = useCallback(() => {
    const dlg = dialogRef.current;
    const panel = panelRef.current;
    if (!dlg || !dlg.open || dlg.hasAttribute("data-closing")) return;
    cancelAnimationFrame(rafRef.current);
    if (reduced()) {
      reset();
      dlg.close();
      return;
    }
    const m = invert();
    if (!m) {
      dlg.close();
      return;
    }
    dlg.setAttribute("data-closing", "");
    dlg.style.transition = `transform ${CLOSE_MS}ms ${CLOSE_EASE}, border-radius ${CLOSE_MS}ms ${CLOSE_EASE}`;
    morph(dlg, m);
    if (panel) {
      panel.style.transition = "opacity 130ms ease-in";
      panel.style.opacity = "0";
    }
    timerRef.current = window.setTimeout(() => {
      reset();
      dlg.close();
    }, CLOSE_MS + 40);
  }, [invert, reset]);

  useEffect(() => {
    if (open) openNow();
    else closeNow();
  }, [open, openNow, closeNow]);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    // Escape fires `cancel`; take it over so the return-to-trigger still plays.
    const onCancel = (e: Event) => {
      e.preventDefault();
      onOpenChangeRef.current(false);
    };
    // anything that closed the dialog without going through the prop. The
    // native `close` event fires for every path the dialog can close through
    // (our own dlg.close() calls included), so it's the single place the
    // scroll lock is released rather than duplicating that call at every
    // dlg.close() site.
    const onClose = () => {
      unlockScroll();
      if (openRef.current) onOpenChangeRef.current(false);
    };
    // a click on the backdrop targets the dialog itself; the panel covers the rest
    const onClick = (e: MouseEvent) => {
      if (dismissRef.current && e.target === dlg) onOpenChangeRef.current(false);
    };
    dlg.addEventListener("cancel", onCancel);
    dlg.addEventListener("close", onClose);
    dlg.addEventListener("click", onClick);
    return () => {
      dlg.removeEventListener("cancel", onCancel);
      dlg.removeEventListener("close", onClose);
      dlg.removeEventListener("click", onClick);
    };
  }, [unlockScroll]);

  useEffect(
    () => () => {
      clearTimeout(timerRef.current);
      cancelAnimationFrame(rafRef.current);
      // Unmounting mid-animation (before the close timer fires dlg.close())
      // must not strand the page scroll-locked forever.
      unlockScroll();
    },
    [unlockScroll]
  );

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={description ? descId : undefined}
      className={[
        "ns-emerge m-auto w-[min(30rem,calc(100vw-2rem))] overflow-hidden p-0",
        "rounded-md border border-border bg-surface text-foreground shadow-2xl",
        "will-change-transform",
        className,
      ].join(" ")}
    >
      {/* showModal() focuses the first focusable descendant unless something
          claims it. Left alone that is whatever control happens to come first —
          on a destructive dialog it pre-selects an option the user never chose,
          and paints a focus ring on it at rest. Take it here: focus lands
          inside the dialog (screen readers announce the title, Tab starts at
          the top) without preselecting anything. */}
      <div
        ref={panelRef}
        autoFocus
        tabIndex={-1}
        className="flex flex-col gap-5 p-6 outline-none"
      >
        {(title || description) && (
          <div className="flex flex-col gap-2">
            {title && (
              <h2 id={titleId} className="text-base font-semibold tracking-tight">
                {title}
              </h2>
            )}
            {description && (
              <p id={descId} className="text-sm leading-relaxed text-ns-muted">
                {description}
              </p>
            )}
          </div>
        )}
        {children}
      </div>

      {/* ::backdrop inherits custom properties from its originating element, so
          the scrim stays token-derived: ink-over-paper in light, paper's own
          near-black in dark. Dim only — a blur costs a compositor layer and
          reads as generic. */}
      <style>{`
        .ns-emerge { --ns-scrim: color-mix(in srgb, var(--foreground) 22%, transparent); }
        :where(.dark) .ns-emerge { --ns-scrim: color-mix(in srgb, var(--background) 66%, transparent); }
        .ns-emerge::backdrop { background: var(--ns-scrim); animation: ns-emerge-scrim-in ${OPEN_MS}ms ease-out forwards; }
        .ns-emerge[data-closing]::backdrop { animation: ns-emerge-scrim-out ${CLOSE_MS}ms ease-in forwards; }
        @keyframes ns-emerge-scrim-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes ns-emerge-scrim-out { from { opacity: 1 } to { opacity: 0 } }
        @media (prefers-reduced-motion: reduce) {
          .ns-emerge::backdrop, .ns-emerge[data-closing]::backdrop { animation: none; opacity: 1 }
        }
      `}</style>
    </dialog>
  );
}
