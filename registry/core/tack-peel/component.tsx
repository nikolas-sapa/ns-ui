"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

// ---------------------------------------------------------------------------
// TackPeelCard — a dismissible notification card held down like something
// taped at one corner. Two stacked layers share the same rounded rect: a
// paler "underside" (a --muted/--background color-mix) sits behind, and the
// card face sits in front with a clip-path polygon cut across its lifted
// corner. Dragging (from anywhere but the dismiss button) reads pointer
// distance through a sqrt resistance curve — raw finger travel is clamped
// to [0,1] against a width-derived max, then peel progress p = sqrt(raw), so
// the first few pixels buy a lot of visible peel and the rest buys less,
// like real adhesive giving way unevenly. p drives three things at once: the
// clip-path notch (bigger notch = more underside showing), a rotation of the
// face around the anchored corner (up to 8deg, zero 3D), and a box-shadow
// that grows under the lifted corner. Past p=0.55 resistance inverts —
// further input is ignored and the peel is frozen fully open.
//
// The state change itself (React swapping in the "dismissed" ghost row with
// its Undo button) happens synchronously the instant dismissal is decided —
// never gated behind an animation's promise. What plays out afterward is a
// purely decorative, aria-hidden overlay sitting on top of that already-live
// ghost row: a frozen snapshot of the peeled face thrown off with a Web
// Animations ease-in (drag path), or fading out plainly (button/Enter path,
// which always uses the plain fade regardless of any drag in progress). The
// overlay is pointer-events-none and self-removes on finish, so the real
// control underneath is clickable throughout, not just after the animation
// settles. Released below the 0.55 line, an rAF spring (stiffness 420, zeta
// 0.9 — heavily damped, no bounce) pulls peel back to 0: a fast, clean
// re-tack. Either dismissal path lands in the same ghost state, announced
// once through a polite live region reading exactly "Notification
// dismissed, Undo available"; Undo restores the card, or after undoMs with
// no undo it's removed for good and onRemove fires. prefers-reduced-motion
// disables the drag gesture entirely — no pointer handlers attach — so the
// button is the only path, and its fade collapses to effectively instant
// while remaining a real, announced transition.
// ---------------------------------------------------------------------------

const PEEL_COMMIT = 0.55; // fraction of peel progress where resistance inverts and it flings
const ROTATE_MAX_DEG = 8;
const CUT_MAX_PCT = 82; // how far the clip-path notch reaches across the card at full peel
const SETTLE_K = 420; // rAF spring stiffness for the re-tack settle
const SETTLE_ZETA = 0.9; // heavily damped — a settle, not a bounce
const FLING_MS = 380;
const FADE_MS = 220;

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function peelStyle(p: number): { clipPath: string; transform: string; boxShadow: string } {
  const cx = 100 - p * CUT_MAX_PCT;
  const cy = p * CUT_MAX_PCT;
  return {
    clipPath: `polygon(0% 0%, ${cx}% 0%, 100% ${cy}%, 100% 100%, 0% 100%)`,
    transform: `rotate(${(-p * ROTATE_MAX_DEG).toFixed(2)}deg)`,
    boxShadow:
      p > 0.015
        ? `${(8 * p).toFixed(1)}px ${(10 * p).toFixed(1)}px ${(22 * p).toFixed(1)}px -6px color-mix(in oklab, var(--foreground) 32%, transparent)`
        : "none",
  };
}

function applyPeel(front: HTMLElement, p: number) {
  const s = peelStyle(p);
  front.style.clipPath = s.clipPath;
  front.style.transform = s.transform;
  front.style.boxShadow = s.boxShadow;
}

function XIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

type Phase = "resting" | "dismissed" | "gone";
type ExitKind = "none" | "fling" | "fade";

export interface TackPeelCardProps {
  /** Notification title — also used in the accessible names of its controls. */
  title: string;
  description?: string;
  /** ms the "dismissed" ghost holds an Undo before it's gone for good. Default 5000. */
  undoMs?: number;
  /** Fires the instant dismissal is decided (drag flung past threshold, or the button pressed). */
  onDismiss?: () => void;
  /** Fires when Undo is pressed inside the window. */
  onUndo?: () => void;
  /** Fires once the undo window elapses with no undo — the card is gone for good. */
  onRemove?: () => void;
  className?: string;
}

export function TackPeelCard({
  title,
  description,
  undoMs = 5000,
  onDismiss,
  onUndo,
  onRemove,
  className = "",
}: TackPeelCardProps) {
  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  const cardRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const exitOverlayRef = useRef<HTMLDivElement>(null);

  const [phase, setPhase] = useState<Phase>("resting");
  const phaseRef = useRef<Phase>("resting");
  const [exitKind, setExitKind] = useState<ExitKind>("none");
  const [isDragging, setIsDragging] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const peelRef = useRef(0);
  const frozenPeelRef = useRef(0); // snapshot of peel at the instant dismissal was decided
  const dragRef = useRef<{ startX: number; startY: number; maxDrag: number } | null>(null);
  const settleRafRef = useRef(0);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setPhaseBoth = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  const cancelSettleLoop = useCallback(() => {
    if (settleRafRef.current) {
      cancelAnimationFrame(settleRafRef.current);
      settleRafRef.current = 0;
    }
  }, []);

  const settleBack = useCallback(() => {
    cancelSettleLoop();
    let v = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = clamp((now - last) / 1000, 0, 0.032);
      last = now;
      const c = 2 * SETTLE_ZETA * Math.sqrt(SETTLE_K);
      const x = peelRef.current;
      const a = SETTLE_K * (0 - x) - c * v;
      v += a * dt;
      let nx = x + v * dt;
      let done = false;
      if (Math.abs(nx) < 0.001 && Math.abs(v) < 0.01) {
        nx = 0;
        done = true;
      }
      peelRef.current = nx;
      const front = frontRef.current;
      if (front) applyPeel(front, nx);
      if (!done) {
        settleRafRef.current = requestAnimationFrame(step);
      } else {
        settleRafRef.current = 0;
      }
    };
    settleRafRef.current = requestAnimationFrame(step);
  }, [cancelSettleLoop]);

  const startUndoTimer = useCallback(() => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => {
      if (phaseRef.current !== "dismissed") return;
      setPhaseBoth("gone");
      onRemove?.();
    }, undoMs);
  }, [onRemove, setPhaseBoth, undoMs]);

  // The state transition is synchronous — the ghost row and its Undo button
  // exist in the DOM the instant this runs. `kind` only decides what the
  // decorative exit overlay (mounted separately, see below) plays out with.
  const beginDismiss = useCallback(
    (kind: Exclude<ExitKind, "none">) => {
      if (phaseRef.current !== "resting") return;
      frozenPeelRef.current = peelRef.current;
      setPhaseBoth("dismissed");
      setExitKind(kind);
      onDismiss?.();
      setAnnouncement("Notification dismissed, Undo available");
      startUndoTimer();
    },
    [onDismiss, setPhaseBoth, startUndoTimer]
  );

  const commitFling = useCallback(() => {
    if (phaseRef.current !== "resting") return;
    dragRef.current = null;
    setIsDragging(false);
    cancelSettleLoop();
    peelRef.current = 1;
    beginDismiss("fling");
  }, [beginDismiss, cancelSettleLoop]);

  const handlePointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (phaseRef.current !== "resting" || reducedRef.current) return;
    const targetEl = e.target as HTMLElement;
    if (targetEl.closest("button")) return; // dismiss button owns its own click, not a drag
    const root = cardRef.current;
    if (!root) return;
    cancelSettleLoop();
    const rect = root.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      maxDrag: Math.max(220, rect.width * 1.1),
    };
    setIsDragging(true);
    try {
      targetEl.setPointerCapture(e.pointerId);
    } catch {
      // ignore — pointer capture is a nicety, not load-bearing for the math below
    }
  }, [cancelSettleLoop]);

  const handlePointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || phaseRef.current !== "resting") return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    const raw = clamp((dx - dy) / d.maxDrag, 0, 1);
    const p = Math.sqrt(raw);
    peelRef.current = p;
    const front = frontRef.current;
    if (front) applyPeel(front, p);
    if (p >= PEEL_COMMIT) {
      commitFling();
    }
  }, [commitFling]);

  const handlePointerUp = useCallback(() => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    setIsDragging(false);
    if (phaseRef.current !== "resting") return; // already flung — nothing to settle
    settleBack();
  }, [settleBack]);

  const handleDismissClick = useCallback(() => {
    if (phaseRef.current !== "resting") return;
    dragRef.current = null;
    cancelSettleLoop();
    setIsDragging(false);
    beginDismiss("fade");
  }, [beginDismiss, cancelSettleLoop]);

  const handleUndoClick = useCallback(() => {
    if (phaseRef.current !== "dismissed") return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setExitKind("none");
    peelRef.current = 0;
    setPhaseBoth("resting");
    onUndo?.();
    setAnnouncement(`${title} restored.`);
  }, [onUndo, setPhaseBoth, title]);

  // Plays the decorative exit overlay whenever a dismissal kicks one off, and
  // tears it down (cancel + unmount) the moment it finishes or Undo cuts in.
  useEffect(() => {
    if (exitKind === "none") return;
    const el = exitOverlayRef.current;
    if (!el || typeof el.animate !== "function") {
      setExitKind("none");
      return;
    }
    const baseDeg = -frozenPeelRef.current * ROTATE_MAX_DEG;
    const anim =
      exitKind === "fling"
        ? el.animate(
            [
              { transform: `rotate(${baseDeg.toFixed(2)}deg) translate(0px, 0px)`, opacity: 1 },
              {
                transform: `rotate(${(baseDeg + 16).toFixed(2)}deg) translate(140px, -46px)`,
                opacity: 0,
              },
            ],
            { duration: FLING_MS, easing: "cubic-bezier(0.55, 0, 1, 1)", fill: "forwards" }
          )
        : el.animate(
            [{ opacity: 1 }, { opacity: 0 }],
            { duration: reducedRef.current ? 1 : FADE_MS, easing: "ease-out", fill: "forwards" }
          );
    let cancelled = false;
    anim.finished
      .then(() => {
        if (!cancelled) setExitKind("none");
      })
      .catch(() => {
        if (!cancelled) setExitKind("none");
      });
    return () => {
      cancelled = true;
      anim.cancel();
    };
  }, [exitKind]);

  useEffect(() => {
    return () => {
      cancelSettleLoop();
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, [cancelSettleLoop]);

  if (phase === "gone") return null;

  const frozenStyle = peelStyle(frozenPeelRef.current);

  return (
    <div
      ref={cardRef}
      data-tackpeel-root
      data-tackpeel-state={phase}
      className={`relative overflow-visible rounded-[12px] ${className}`}
    >
      {phase === "dismissed" ? (
        <div className="relative">
          <div className="flex items-center gap-2 rounded-[12px] border border-dashed border-border bg-surface px-4 py-3">
            <span className="min-w-0 flex-1 truncate text-sm text-foreground/40">
              {title} — dismissed
            </span>
            <button
              type="button"
              data-tackpeel-undo
              onClick={handleUndoClick}
              aria-label={`Undo dismiss: ${title}`}
              className="shrink-0 rounded-[6px] px-2 py-1 text-xs font-medium text-accent transition-opacity duration-150 hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Undo
            </button>
          </div>
          {exitKind !== "none" ? (
            <div
              ref={exitOverlayRef}
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-[12px] border border-border bg-surface px-4 py-3.5 pr-10"
              style={{
                clipPath: frozenStyle.clipPath,
                transform: frozenStyle.transform,
                boxShadow: frozenStyle.boxShadow,
                transformOrigin: "0% 100%",
              }}
            >
              <p className="truncate text-sm font-medium text-foreground">{title}</p>
              {description ? (
                <p className="mt-0.5 truncate text-xs text-muted">{description}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <div
          className={`relative rounded-[12px] ${!reduced ? (isDragging ? "cursor-grabbing" : "cursor-grab") : ""}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {/* underside — a paler layer revealed through the front's clip-path notch */}
          <div
            aria-hidden
            className="absolute inset-0 rounded-[12px] border border-border"
            style={{ background: "color-mix(in oklab, var(--muted) 35%, var(--background))" }}
          />
          <div
            ref={frontRef}
            className="relative rounded-[12px] border border-border bg-surface px-4 py-3.5 pr-10"
            style={{
              clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
              transformOrigin: "0% 100%",
              willChange: "clip-path, transform",
            }}
          >
            <p className="truncate text-sm font-medium text-foreground">{title}</p>
            {description ? (
              <p className="mt-0.5 truncate text-xs text-muted">{description}</p>
            ) : null}
            <button
              type="button"
              data-tackpeel-dismiss
              onClick={handleDismissClick}
              aria-label={`Dismiss ${title}`}
              className="absolute right-2 top-2 rounded-[6px] p-1 text-muted transition-colors hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <XIcon />
            </button>
          </div>
        </div>
      )}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
