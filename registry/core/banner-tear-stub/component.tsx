"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// TearStub — a dismissible notice with a perforated edge, 32px in from the
// leading edge. Dismissing tears the panel off along that perforation with a
// quick ~1deg rip (translate + rotate + fade, ease-out-expo) while a slim
// stub stays seated flush at the edge — a permanent, always-legible record
// that a notice exists, exactly like the stub a receipt book keeps after the
// check tears out. Clicking the stub reopens the banner, reversing the rip
// and springing the row's height back open. The stub itself is always
// present as decoration while attached (just the icon, non-interactive) and
// is promoted into the Reopen button only once the panel is actually gone —
// so there is never a pointless enabled control sitting idle at rest.
//
// Differs from selvage-fold on purpose: that folds content away in place and
// keeps the same object at a smaller size. Here the remainder is a distinct,
// much smaller object (a torn stub, not a folded panel) and the physical
// contract is that the record is never destroyed, only shrunk — dismissal
// is always recoverable.
//
// This component doesn't force a width — it's an inline flex row sized to
// its content. Pass className="w-full" for a page-width banner; either way,
// once the panel is torn off, only the stub column remains in the row, so
// the whole thing naturally shrinks down to a small tab rather than leaving
// a wide empty strip.
//
// DOM + CSS only, no canvas. Colors come from --background/--surface/
// --foreground/--muted/--border/--accent only. prefers-reduced-motion swaps
// the rip for a plain crossfade (handled by the stylesheet below) and the
// height change for a short linear resize instead of a spring (handled in
// JS, since a spring is inherently a physical motion).
// ---------------------------------------------------------------------------

const TEAR_MS = 300;
const TEAR_MS_REDUCED = 160;
const TEAR_EASE = "cubic-bezier(0.22, 1, 0.36, 1)"; // ease-out-expo-ish
const SPRING_STIFFNESS = 230; // s^-2
const SPRING_DAMPING = 26; // ~critically damped, one barely-visible settle
const STUB_HIT_OVERHANG = 6; // each side of the 32px (w-8) column — 44px touch target

function NoticeIcon({ urgent, className }: { urgent: boolean; className?: string }) {
  if (urgent) {
    return (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" className={className} aria-hidden="true">
        <path d="M8 1.6 14.6 13a1 1 0 0 1-.87 1.5H2.27a1 1 0 0 1-.87-1.5L8 1.6Z" strokeLinejoin="round" />
        <path d="M8 6.2v3.1" strokeLinecap="round" />
        <circle cx="8" cy="11.4" r="0.75" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" className={className} aria-hidden="true">
      <circle cx="8" cy="8" r="6.3" />
      <path d="M8 7.3v3.9" strokeLinecap="round" />
      <circle cx="8" cy="4.9" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Physically integrates a height spring from `from` px to `to` px onto
 * `el.style.height`, then hands the element back to `auto` sizing once
 * settled. Returns a cancel fn — call it if another transition preempts
 * this one mid-flight. */
function springHeight(el: HTMLElement, from: number, to: number, onSettle?: () => void): () => void {
  let current = from;
  let velocity = 0;
  let last: number | null = null;
  let raf = 0;
  let cancelled = false;
  el.style.overflow = "hidden";
  el.style.height = `${from}px`;
  const step = (now: number) => {
    if (cancelled) return;
    if (last == null) last = now;
    const dt = Math.min((now - last) / 1000, 0.032);
    last = now;
    const disp = current - to;
    const accel = -SPRING_STIFFNESS * disp - SPRING_DAMPING * velocity;
    velocity += accel * dt;
    current += velocity * dt;
    if (Math.abs(disp) < 0.4 && Math.abs(velocity) < 0.4) {
      el.style.height = "";
      el.style.overflow = "";
      onSettle?.();
      return;
    }
    el.style.height = `${current}px`;
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => {
    cancelled = true;
    cancelAnimationFrame(raf);
  };
}

/** Reduced-motion counterpart: no bounce, one short linear resize. */
function snapHeight(el: HTMLElement, to: number, onSettle?: () => void): () => void {
  let cancelled = false;
  el.style.overflow = "hidden";
  el.style.height = `${el.getBoundingClientRect().height}px`;
  el.style.transition = "";
  const raf = requestAnimationFrame(() => {
    if (cancelled) return;
    el.style.transition = `height ${TEAR_MS_REDUCED}ms linear`;
    el.style.height = `${to}px`;
  });
  const done = (e: TransitionEvent) => {
    if (e.propertyName !== "height") return;
    finish();
  };
  const finish = () => {
    if (cancelled) return;
    cancelled = true;
    el.style.transition = "";
    el.style.height = "";
    el.style.overflow = "";
    el.removeEventListener("transitionend", done);
    onSettle?.();
  };
  el.addEventListener("transitionend", done);
  return () => {
    cancelled = true;
    cancelAnimationFrame(raf);
    el.removeEventListener("transitionend", done);
  };
}

export interface TearStubProps {
  /** The notice's title. Also becomes the stub's accessible name once torn
   * off ("Reopen: <title>"). */
  title: string;
  /** Supporting copy shown under the title. */
  description?: ReactNode;
  /** Swaps role=status for role=alert and the default icon for the more
   * severe glyph. @default "info" */
  variant?: "info" | "urgent";
  /** Custom icon replacing the built-in glyph. Always rendered aria-hidden —
   * the accessible name comes from `title` and `dismissLabel`, not the icon. */
  icon?: ReactNode;
  /** Controlled open state. Omit to let the component manage its own. */
  open?: boolean;
  /** Initial open state when uncontrolled. @default true */
  defaultOpen?: boolean;
  /** Fires after a dismiss or a reopen, from a click or the keyboard. */
  onOpenChange?: (open: boolean) => void;
  /** Accessible name (and visible label) for the dismiss control. @default "Dismiss" */
  dismissLabel?: string;
  className?: string;
}

export function TearStub({
  title,
  description,
  variant = "info",
  icon,
  open: openProp,
  defaultOpen = true,
  onOpenChange,
  dismissLabel = "Dismiss",
  className = "",
}: TearStubProps) {
  const isControlled = openProp !== undefined;
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = isControlled ? openProp : internalOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange]
  );

  // `panelMounted` lags `open` on the way to false, so the rip gets to play
  // out (panel still occupying its layout box, just transformed) before the
  // panel actually leaves flow. `torn` drives the CSS transform/opacity —
  // kept a beat ahead of `panelMounted` on the way back in, so a freshly
  // remounted panel starts already in its torn pose and animates *out* of
  // it, rather than popping in already settled.
  const [panelMounted, setPanelMounted] = useState(open);
  const [torn, setTorn] = useState(!open);

  const containerRef = useRef<HTMLDivElement>(null);
  const stubRef = useRef<HTMLButtonElement>(null);
  const dismissRef = useRef<HTMLButtonElement>(null);
  const prevOpenRef = useRef(open);
  const firstRenderRef = useRef(true);
  const cancelHeightRef = useRef<(() => void) | null>(null);
  const tearTimeoutRef = useRef<number | undefined>(undefined);

  const titleId = useId();
  const hintId = useId();

  useEffect(
    () => () => {
      cancelHeightRef.current?.();
      window.clearTimeout(tearTimeoutRef.current);
    },
    []
  );

  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      prevOpenRef.current = open;
      return; // no animation on mount, whichever state it mounts into
    }
    if (prevOpenRef.current === open) return;
    prevOpenRef.current = open;

    const container = containerRef.current;
    if (!container) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    cancelHeightRef.current?.();
    window.clearTimeout(tearTimeoutRef.current);

    if (!open) {
      // DISMISS — rip the panel in place first (it's still in flow, so the
      // row doesn't move yet), then drop it from the DOM and spring the row
      // down to the stub's own height. The pre-unmount height must be read
      // BEFORE setPanelMounted(false): the container has no explicit height,
      // so by the post-render rAF it has already collapsed and the spring
      // would be a from==to no-op.
      setTorn(true);
      const tearMs = reduced ? TEAR_MS_REDUCED : TEAR_MS;
      tearTimeoutRef.current = window.setTimeout(() => {
        const from = containerRef.current?.getBoundingClientRect().height ?? 0;
        setPanelMounted(false);
        requestAnimationFrame(() => {
          const el = containerRef.current;
          if (!el) return;
          const to = el.scrollHeight; // natural height now that the panel is gone
          cancelHeightRef.current = reduced
            ? snapHeight(el, to, () => stubRef.current?.focus())
            : springHeight(el, from, to, () => stubRef.current?.focus());
        });
      }, tearMs);
    } else {
      // REOPEN — remount the panel already torn (no visible jump), spring
      // the row back open, then flip `torn` off a frame later to play the
      // rip in reverse.
      setPanelMounted(true);
      requestAnimationFrame(() => {
        const el = containerRef.current;
        if (!el) return;
        const from = el.getBoundingClientRect().height;
        const to = el.scrollHeight; // natural height with the panel back
        cancelHeightRef.current = reduced
          ? snapHeight(el, to, () => dismissRef.current?.focus())
          : springHeight(el, from, to, () => dismissRef.current?.focus());
        requestAnimationFrame(() => setTorn(false));
      });
    }
  }, [open]);

  const urgent = variant === "urgent";
  const iconNode = icon ?? <NoticeIcon urgent={urgent} className={`h-4 w-4 shrink-0 ${urgent ? "text-foreground" : "text-muted"}`} />;

  return (
    <div
      ref={containerRef}
      // Static for the component's lifetime, not toggled per dismiss/reopen —
      // re-mounting the role every interaction is what would turn a one-time
      // "here's a notice" announcement into noise on every tear and heal.
      role={urgent ? "alert" : "status"}
      aria-live={urgent ? "assertive" : "polite"}
      aria-labelledby={panelMounted ? titleId : undefined}
      // When torn, cap the box at its content (the stub column) even if the
      // consumer passed w-full — the promise is a small tab, never a wide
      // empty strip. Cleared in the same commit that remounts the panel, so
      // the reopen measurement sees the full-width layout.
      style={panelMounted ? undefined : { maxWidth: "fit-content" }}
      className={`ns-tearstub relative inline-flex items-stretch rounded-md border border-border bg-background text-foreground ${className}`}
    >
      <div className="relative w-8 shrink-0 self-stretch">
        {panelMounted ? (
          <div aria-hidden="true" className="flex h-full w-full items-center justify-center">
            {iconNode}
          </div>
        ) : (
          <button
            ref={stubRef}
            type="button"
            onClick={() => setOpen(true)}
            aria-label={`Reopen: ${title}`}
            data-tearstub-reopen=""
            // In flow (not absolute): the stub is the only content left in
            // the row once the panel is gone, so it must contribute real
            // height — absolutely positioned it contributed none and the
            // whole notice collapsed to a flat border line. Negative x
            // margins keep the 44px touch target overhanging the 32px look.
            className="ns-tearstub-stub relative flex min-h-11 w-11 flex-col items-center justify-center gap-1.5 rounded-sm p-1 py-2 outline-none transition-colors hover:bg-foreground/[0.06] focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
            style={{ marginLeft: -STUB_HIT_OVERHANG, marginRight: -STUB_HIT_OVERHANG }}
          >
            {iconNode}
            <span aria-hidden="true" className="ns-tearstub-label select-none font-mono text-[9px] uppercase tracking-widest text-muted">
              {title}
            </span>
          </button>
        )}
        <span aria-hidden="true" className="ns-tearstub-perf pointer-events-none absolute inset-y-0 right-0 w-px" />
      </div>

      {panelMounted && (
        <div data-torn={torn ? "" : undefined} className="ns-tearstub-panel flex flex-1 items-start gap-3 px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <p id={titleId} className="text-sm font-medium leading-snug">
              {title}
            </p>
            {description && <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>}
          </div>
          <button
            ref={dismissRef}
            type="button"
            onClick={() => setOpen(false)}
            aria-describedby={hintId}
            data-tearstub-dismiss=""
            className="shrink-0 rounded-sm px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-wide text-muted outline-none transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
          >
            {dismissLabel}
          </button>
          <span id={hintId} className="sr-only">
            A small tab stays after dismissing so you can reopen this notice.
          </span>
        </div>
      )}

      <style>{`
        .ns-tearstub-perf {
          background: var(--border);
          -webkit-mask-image: repeating-linear-gradient(to bottom, black 0 5px, transparent 5px 8px);
          mask-image: repeating-linear-gradient(to bottom, black 0 5px, transparent 5px 8px);
        }
        .ns-tearstub-label {
          writing-mode: vertical-rl;
          transform: rotate(180deg);
          max-height: 60px;
          overflow: hidden;
          white-space: nowrap; /* one vertical column — wrapping crowds the 32px stub */
        }
        .ns-tearstub-panel {
          transition: transform ${TEAR_MS}ms ${TEAR_EASE}, opacity ${TEAR_MS}ms ${TEAR_EASE};
          transform: translateX(0) rotate(0deg);
          opacity: 1;
        }
        .ns-tearstub-panel[data-torn] {
          transform: translateX(24px) rotate(1deg);
          opacity: 0;
        }
        @media (prefers-reduced-motion: reduce) {
          .ns-tearstub-panel {
            transition: opacity ${TEAR_MS_REDUCED}ms linear;
          }
          .ns-tearstub-panel[data-torn] {
            transform: none;
          }
        }
      `}</style>
    </div>
  );
}
