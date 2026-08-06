"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// SashWeight — a side drawer hung on a counterweight, sash-window style. The
// drawer's leading edge carries a thin vertical track; a 24px weight pill
// rides it, traveling opposite the drawer at a -0.6x ratio while the drawer
// is dragged, plus a tick marking the balance point. Release before the tick
// (weight still above it) and a spring pulls the drawer shut; release past it
// (weight bottoms out) and the drawer holds itself open — the weight's
// resting position (down = open, up = closed) is the state indicator, true
// even when nobody is mid-drag. Built on the native <dialog> element for
// showModal()'s free focus trap, Escape-as-cancel, top-layer stacking and
// background inertness; only the entrance/exit motion and the counterweight
// are hand-rolled. All motion (drawer translateX, weight translateY, scrim
// opacity) is driven by a direct-DOM rAF loop writing CSS custom properties —
// zero React state on the hot path. Two spring profiles (opening: k=260
// zeta≈0.74 / closing: k=260 zeta≈0.93, mass 1) resolve the drawer+weight
// together toward whichever side the release lands on, seeded with the
// actual release velocity so the catch reads as one continuous motion, not a
// snap-then-glide. Reduced motion drops both springs for a 150ms opacity fade
// and disables weight travel — it appears already parked at the resting spot.
// ---------------------------------------------------------------------------

const WEIGHT_SIZE = 24; // px — the pill
const TRACK_LEN = 200; // px — visual track length
const TRAVEL = TRACK_LEN - WEIGHT_SIZE; // px of usable weight travel
const BALANCE_FRAC = 0.5; // the tick's position along the travel
const BALANCE_Y = BALANCE_FRAC * TRAVEL;
const RATIO = 0.6; // weight moves at -0.6x the drawer's drag delta

const OPEN_K = 260;
const OPEN_C = 24;
const CLOSE_K = 260;
const CLOSE_C = 30;
const FLING_V = 500; // px/s — release speed past this overrides tick position
const V_WINDOW = 80; // ms of pointer samples averaged into release velocity
const SETTLE_MS = 1000; // forced-settle deadline
const POS_EPS = 0.4;
const VEL_EPS = 6;
const FADE_MS = 150; // reduced-motion opacity fade

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export interface SashWeightProps {
  /** controlled open state; omit for uncontrolled */
  open?: boolean;
  /** uncontrolled initial open state. Default false. */
  defaultOpen?: boolean;
  /** called with the new open state after the trigger or a dismissal */
  onOpenChange?: (open: boolean) => void;
  /** label rendered on the trigger button */
  trigger?: ReactNode;
  /** drawer heading */
  title: string;
  /** supporting copy under the title */
  description?: ReactNode;
  /** drawer body content */
  children?: ReactNode;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function SashWeight({
  open,
  defaultOpen = false,
  onOpenChange,
  trigger = "Open panel",
  title,
  description,
  children,
  className = "",
}: SashWeightProps) {
  const isControlled = open !== undefined;
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const openState = isControlled ? (open as boolean) : internalOpen;

  const dialogRef = useRef<HTMLDialogElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const weightRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const liveRef = useRef<HTMLParagraphElement>(null);
  const engineRef = useRef<{ request: (target: boolean, v?: number) => void } | null>(null);

  const titleId = useId();
  const descId = useId();
  const dialogId = useId();

  const notify = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };
  // the setup effect below mounts once; its pointer/keyboard handlers must
  // still call whatever `onOpenChange` the *latest* render passed in, not
  // the one captured when the effect first ran — mirrored every render.
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  useEffect(() => {
    const dlg = dialogRef.current;
    const rail = railRef.current;
    const weight = weightRef.current;
    const live = liveRef.current;
    if (!dlg || !rail || !weight || !live) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = mq.matches;
    const onMq = () => {
      reduced = mq.matches;
    };
    mq.addEventListener("change", onMq);

    // -- hot-path state: locals only, never React state ----------------------
    let W = 0; // measured drawer width, px
    let sized = false;
    let everOpened = false; // has the dialog been shown at least once yet?
    let tx = 0; // drawer offset from open, 0 = open, W = closed (off-screen)
    let wY = 0; // weight offset within its travel, 0 = top/closed, TRAVEL = bottom/open
    let vTx = 0;
    let vWy = 0;
    let mode: 0 | 1 | 2 = 0; // idle | dragging | spring-resolving
    let targetOpen = openState;
    let pendingTarget: boolean | null = null;
    let deadline = 0;
    let raf = 0;
    let last = 0;
    let fadeTimer = 0;

    // drag bookkeeping
    let pointerId = -1;
    let startPointerX = 0;
    let pointerX = 0;
    let startTx = 0;
    let startWy = 0;
    let samples: { t: number; x: number }[] = [];

    const render = () => {
      dlg.style.setProperty("--sash-tx", `${tx.toFixed(2)}px`);
      weight.style.setProperty("--sash-wy", `${wY.toFixed(2)}px`);
      const progress = W > 0 ? clamp(1 - tx / W, 0, 1) : 0;
      dlg.style.setProperty("--sash-scrim-op", (progress * 0.55).toFixed(3));
    };

    const announce = (isOpen: boolean) => {
      live.textContent = isOpen ? `${title} opened` : `${title} closed`;
    };

    const resize = () => {
      const rect = dlg.getBoundingClientRect();
      if (rect.width < 40) {
        sized = false;
        return;
      }
      const prevW = W;
      W = rect.width;
      sized = true;
      // re-anchor to whichever end is currently settled when the viewport
      // itself resizes — but never on the very first measurement (that one
      // is the bootstrap for a fresh spring-open, and everOpened being false
      // there keeps this from snapping tx to its target before the spring in
      // request() ever gets a displacement to resolve).
      if (mode === 0 && everOpened && W !== prevW) {
        tx = targetOpen ? 0 : W;
        render();
      }
      if (pendingTarget !== null) {
        const t = pendingTarget;
        pendingTarget = null;
        request(t, 0);
      }
    };

    const fadeTo = (target: boolean) => {
      window.clearTimeout(fadeTimer);
      if (target) {
        dlg.style.transition = "none";
        dlg.style.opacity = "0";
        requestAnimationFrame(() => {
          dlg.style.transition = `opacity ${FADE_MS}ms ease-out`;
          dlg.style.opacity = "1";
        });
      } else {
        dlg.style.transition = `opacity ${FADE_MS}ms ease-out`;
        dlg.style.opacity = "0";
        fadeTimer = window.setTimeout(() => {
          if (dlg.open) dlg.close();
          dlg.style.opacity = "";
          dlg.style.transition = "";
        }, FADE_MS + 20);
      }
    };

    const wake = () => {
      if (!raf && sized && mode !== 0 && !document.hidden) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    const finishSettle = () => {
      mode = 0;
      if (!targetOpen && dlg.open) dlg.close();
      announce(targetOpen);
    };

    const loop = (now: number) => {
      raf = 0;
      if (document.hidden || mode === 0) {
        last = 0;
        return;
      }
      const dt = last ? Math.min(0.032, (now - last) / 1000) : 1 / 60;
      last = now;

      if (mode === 1) {
        const dx = pointerX - startPointerX;
        tx = clamp(startTx + dx, 0, W);
        wY = clamp(startWy - RATIO * dx, 0, TRAVEL);
      } else {
        const k = targetOpen ? OPEN_K : CLOSE_K;
        const c = targetOpen ? OPEN_C : CLOSE_C;
        const tTx = targetOpen ? 0 : W;
        const tWy = targetOpen ? TRAVEL : 0;
        vTx += (-k * (tx - tTx) - c * vTx) * dt;
        tx += vTx * dt;
        vWy += (-k * (wY - tWy) - c * vWy) * dt;
        wY += vWy * dt;

        const settled =
          Math.abs(tx - tTx) < POS_EPS &&
          Math.abs(vTx) < VEL_EPS &&
          Math.abs(wY - tWy) < POS_EPS &&
          Math.abs(vWy) < VEL_EPS;
        if (settled || now >= deadline) {
          tx = tTx;
          wY = tWy;
          vTx = vWy = 0;
          render();
          finishSettle();
          return;
        }
      }
      render();
      raf = requestAnimationFrame(loop);
    };

    // engine.request — single authoritative entry point for every open/close
    // intent (trigger, close button, backdrop, Escape, drag release). Two
    // calls targeting the same in-flight destination collapse into one: only
    // the first supplies a velocity, the second just refreshes the deadline —
    // so a React-effect echo of a decision already dispatched imperatively
    // from a pointerup handler can never stomp its velocity back to zero.
    const request = (target: boolean, v = 0) => {
      if (mode === 2 && targetOpen === target) {
        deadline = performance.now() + SETTLE_MS;
        return;
      }
      if (target) {
        if (!dlg.open) dlg.showModal();
        if (!sized) resize();
        if (!sized) {
          pendingTarget = target;
          return;
        }
        if (!everOpened) {
          // first-ever open: seed the closed origin explicitly so the spring
          // below actually has a displacement to resolve, instead of
          // discovering tx already equal to its own target.
          tx = W;
          wY = 0;
          everOpened = true;
        }
      } else if (!dlg.open) {
        mode = 0;
        return; // already fully closed, nothing to animate
      }

      if (reduced) {
        tx = target ? 0 : W;
        wY = target ? TRAVEL : 0;
        vTx = vWy = 0;
        mode = 0;
        render();
        fadeTo(target);
        announce(target);
        return;
      }

      targetOpen = target;
      vTx = v;
      vWy = -RATIO * v;
      mode = 2;
      deadline = performance.now() + SETTLE_MS;
      wake();
    };

    engineRef.current = { request };

    const onRailDown = (e: PointerEvent) => {
      if (reduced || !dlg.open || mode === 1 || e.button !== 0) return;
      pointerId = e.pointerId;
      startPointerX = e.clientX;
      pointerX = e.clientX;
      startTx = tx;
      startWy = wY;
      samples = [{ t: e.timeStamp, x: e.clientX }];
      mode = 1;
      rail.style.cursor = "grabbing";
      try {
        rail.setPointerCapture(e.pointerId);
      } catch {
        /* pointer already gone */
      }
      wake();
    };

    const onRailMove = (e: PointerEvent) => {
      if (mode !== 1 || e.pointerId !== pointerId) return;
      pointerX = e.clientX;
      samples.push({ t: e.timeStamp, x: e.clientX });
      while (samples.length > 1 && e.timeStamp - (samples[0]?.t ?? 0) > V_WINDOW) {
        samples.shift();
      }
    };

    const releaseDrag = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      pointerId = -1;
      rail.style.cursor = "";
      if (mode !== 1) return;
      const cutoff = e.timeStamp - V_WINDOW;
      let i0 = 0;
      while (i0 < samples.length - 1 && (samples[i0]?.t ?? 0) < cutoff) i0++;
      const a = samples[i0];
      const b = samples[samples.length - 1];
      let vRelease = 0;
      if (a && b && b.t - a.t > 8) vRelease = ((b.x - a.x) / (b.t - a.t)) * 1000;
      const decision =
        Math.abs(vRelease) > FLING_V ? vRelease < 0 : wY > BALANCE_Y;
      request(decision, vRelease);
      notify(decision);
    };

    const onBackdropDown = (e: PointerEvent) => {
      // backdrop clicks target the dialog itself (::backdrop isn't a real
      // element); a click landing inside the panel targets a descendant.
      if (e.target === dlg) {
        request(false, 0);
        notify(false);
      }
    };
    const onCancel = (e: Event) => {
      e.preventDefault();
      request(false, 0);
      notify(false);
    };
    const onNativeClose = () => {
      // covers any close path that bypassed request() (shouldn't happen, but
      // keeps state honest if something calls dlg.close() directly)
      if (mode !== 0) mode = 0;
    };
    dlg.addEventListener("pointerdown", onBackdropDown);
    dlg.addEventListener("cancel", onCancel);
    dlg.addEventListener("close", onNativeClose);
    rail.addEventListener("pointerdown", onRailDown);
    rail.addEventListener("pointermove", onRailMove);
    rail.addEventListener("pointerup", releaseDrag);
    rail.addEventListener("pointercancel", releaseDrag);

    const ro = new ResizeObserver(resize);
    ro.observe(dlg);
    // Deliberately no IntersectionObserver here: this dialog is
    // position:fixed (viewport-relative, unaffected by page scroll), and the
    // *only* thing that ever changes its on-/off-screen intersection is its
    // own open/close transform — so gating the rAF loop on "currently
    // intersecting" would gate the animation on its own output. A close
    // settles with the panel translated fully off-screen (non-intersecting)
    // in the same frame the spring reaches its target; an IO callback firing
    // on that same closed frame would latch a `visible=false` that nothing
    // could ever clear (the panel can only become intersecting again by
    // running the very animation the flag blocks), silently swallowing or
    // cutting off the next open/close request — which reads as the panel
    // popping partway open/closed and resetting, over and over. Tab
    // backgrounding is still covered, correctly, by `document.hidden` below.
    const onVis = () => {
      if (!document.hidden) wake();
    };
    document.addEventListener("visibilitychange", onVis);

    // no direct kickoff here — the `[openState]` effect below fires on mount
    // too (openState starts defined), and engineRef.current is already wired
    // by the time it runs in the same commit. One call site, no echo to guard.

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(fadeTimer);
      mq.removeEventListener("change", onMq);
      dlg.removeEventListener("pointerdown", onBackdropDown);
      dlg.removeEventListener("cancel", onCancel);
      dlg.removeEventListener("close", onNativeClose);
      rail.removeEventListener("pointerdown", onRailDown);
      rail.removeEventListener("pointermove", onRailMove);
      rail.removeEventListener("pointerup", releaseDrag);
      rail.removeEventListener("pointercancel", releaseDrag);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      engineRef.current = null;
    };
    // title feeds the aria-live announcement text but shouldn't retrigger the
    // whole engine setup — read fresh via the closure is fine since it only
    // changes if the caller renames the panel, an edge case not worth a
    // teardown/rebuild of the pointer + observer wiring.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // reacts to externally-controlled `open` prop changes (or the initial
  // uncontrolled value). Internal handlers already drive the engine
  // imperatively and in the same tick, so this mostly matters for a parent
  // flipping `open` without going through this component's own controls —
  // request()'s same-target guard makes a redundant echo harmless.
  useEffect(() => {
    engineRef.current?.request(openState, 0);
  }, [openState]);

  const handleTriggerClick = () => {
    engineRef.current?.request(true, 0);
    notify(true);
  };
  const handleClose = () => {
    engineRef.current?.request(false, 0);
    notify(false);
  };

  return (
    <>
      <dialog
        ref={dialogRef}
        id={dialogId}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className={`ns-sash h-dvh max-h-none w-[min(24rem,88vw)] max-w-none overflow-hidden border-l border-border bg-surface p-0 text-foreground shadow-2xl will-change-transform ${className}`}
      >
        <div className="flex h-full">
          {/* leading-edge sash rail: decorative counterweight track, and the
              optional drag handle. aria-hidden — the trigger button already
              exposes open/closed via aria-expanded, and a visible weight
              position conveys nothing to assistive tech. */}
          <div
            ref={railRef}
            aria-hidden
            className="relative flex w-8 shrink-0 cursor-grab touch-none items-center justify-center border-r border-border select-none"
          >
            <div
              className="relative bg-border"
              style={{ height: TRACK_LEN, width: 1 }}
            >
              <span
                className="absolute left-1/2 h-px w-3 -translate-x-1/2 bg-border"
                style={{ top: BALANCE_Y }}
              />
              <span
                ref={weightRef}
                className="absolute left-1/2 top-0 h-6 w-6 -translate-x-1/2 rounded-full border border-border bg-foreground shadow-sm will-change-transform"
                style={{ transform: "translateY(var(--sash-wy, 0px))" }}
              />
            </div>
          </div>

          {/* showModal() focuses the first focusable descendant unless something
              claims it — here that's the close button, which paints a focus
              ring at rest (this demo rests open). Same pattern as
              dialog-emerge: take the focus on the panel itself, so screen
              readers announce the title and Tab starts at the top without
              preselecting a control. */}
          <div autoFocus tabIndex={-1} className="flex min-w-0 flex-1 flex-col outline-none">
            <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div className="min-w-0">
                <h2 id={titleId} className="text-sm font-semibold text-foreground">
                  {title}
                </h2>
                {description && (
                  <p id={descId} className="mt-1 text-xs leading-relaxed text-ns-muted">
                    {description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close"
                className="shrink-0 rounded-sm border border-border p-1.5 text-ns-muted transition-colors duration-150 hover:border-foreground/25 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
              >
                <svg aria-hidden viewBox="0 0 16 16" width="14" height="14" fill="none">
                  <path
                    d="M4 4l8 8M12 4l-8 8"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          </div>
        </div>

        <p ref={liveRef} role="status" aria-live="polite" className="sr-only" />

        <style>{`
          .ns-sash {
            position: fixed;
            inset: 0 0 0 auto;
            transform: translateX(var(--sash-tx, 100%));
          }
          .ns-sash::backdrop {
            background: color-mix(in srgb, var(--foreground) 22%, transparent);
            opacity: var(--sash-scrim-op, 0);
          }
          :where(.dark) .ns-sash::backdrop {
            background: color-mix(in srgb, var(--background) 66%, transparent);
          }
          @media (prefers-reduced-motion: reduce) {
            .ns-sash { transition: none; }
          }
        `}</style>
      </dialog>

      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={openState}
        aria-controls={dialogId}
        onClick={handleTriggerClick}
        className="inline-flex items-center gap-2 rounded-sm border border-border bg-surface px-3.5 py-2 text-sm font-medium text-foreground transition-colors duration-150 hover:border-foreground/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
      >
        {trigger}
      </button>
    </>
  );
}
