"use client";

import { useCallback, useEffect, useId, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";

// ---------------------------------------------------------------------------
// LeadingLight — an onboarding tour rendered as a lighthouse. The current
// target gets a light ring (1px --foreground ring + soft halo); everything
// else drops to penumbra via a single full-viewport SVG mask: one rect
// (the dim scrim) minus a feathered rounded-rect hole over the target — not
// per-element opacity, so nothing in the underlying page needs to know the
// tour exists. Advancing morphs the hole (SVG x/y/width/height, which are
// CSS-transitionable geometry properties) to the new target's rect while a
// separate feathered wedge div sweeps along the straight line between the
// old and new target centers, drawn via a scaleX(0->1) transform-origin
// animation so it reads as a beam traveling the path, then fades. All of
// this is one-shot direct-DOM ref writes per step change (CSS handles the
// interpolation) — there's no continuous per-frame loop, so nothing here
// touches React state on a hot path.
// ---------------------------------------------------------------------------

export interface LeadingLightStep {
  /** CSS selector for the element this step highlights. */
  target: string;
  title: string;
  body: string;
}

export interface LeadingLightProps {
  steps: LeadingLightStep[];
  /** current step index, 0-based */
  active: number;
  onNext: () => void;
  onBack: () => void;
  /** Esc or Skip — caller unmounts / restores whatever it wants */
  onExit: () => void;
  className?: string;
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const RING_PAD = 5;
const HOLE_PAD = 9;
const HOLE_RADIUS = 10;
const MORPH_MS = 480;
const BEAM_SWEEP_MS = 340;
const BEAM_FADE_MS = 180;
const BEAM_THICKNESS = 34;
const CARD_MARGIN = 14;
const CARD_GAP = 14;

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

function measure(selector: string): Rect | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

function center(r: Rect) {
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function moveRing(el: HTMLDivElement | null, r: Rect, reduced: boolean) {
  if (!el) return;
  el.style.transition = reduced
    ? "none"
    : `left ${MORPH_MS}ms ${EASE}, top ${MORPH_MS}ms ${EASE}, width ${MORPH_MS}ms ${EASE}, height ${MORPH_MS}ms ${EASE}`;
  el.style.left = `${r.left - RING_PAD}px`;
  el.style.top = `${r.top - RING_PAD}px`;
  el.style.width = `${r.width + RING_PAD * 2}px`;
  el.style.height = `${r.height + RING_PAD * 2}px`;
}

function morphHole(el: SVGRectElement | null, r: Rect, reduced: boolean) {
  if (!el) return;
  const x = r.left - HOLE_PAD;
  const y = r.top - HOLE_PAD;
  const w = r.width + HOLE_PAD * 2;
  const h = r.height + HOLE_PAD * 2;
  el.style.transition = reduced
    ? "none"
    : `x ${MORPH_MS}ms ${EASE}, y ${MORPH_MS}ms ${EASE}, width ${MORPH_MS}ms ${EASE}, height ${MORPH_MS}ms ${EASE}`;
  // x/y/width/height are CSS-animatable geometry properties for SVG shapes,
  // but aren't part of TS's CSSStyleDeclaration typing — set the attributes
  // directly instead; a transitioned CSS property still picks up attribute
  // changes since presentation attributes participate in the cascade.
  el.setAttribute("x", String(x));
  el.setAttribute("y", String(y));
  el.setAttribute("width", String(w));
  el.setAttribute("height", String(h));
}

function sweepBeam(
  el: HTMLDivElement | null,
  from: Rect,
  to: Rect,
  reduced: boolean,
  flicker: boolean
) {
  if (!el) return;
  if (reduced) {
    el.style.opacity = "0";
    return;
  }
  const a = center(from);
  const b = center(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.max(1, Math.hypot(dx, dy));
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

  el.style.transition = "none";
  el.style.left = `${a.x}px`;
  el.style.top = `${a.y}px`;
  el.style.width = `${len}px`;
  el.style.opacity = flicker ? "0.55" : "1";
  el.style.transform = `translateY(-50%) rotate(${angle}deg) scaleX(0)`;
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  el.offsetHeight; // force reflow so the collapsed start state commits
  el.style.transition = `transform ${BEAM_SWEEP_MS}ms ${EASE}`;
  el.style.transform = `translateY(-50%) rotate(${angle}deg) scaleX(1)`;
  window.setTimeout(() => {
    el.style.transition = `opacity ${BEAM_FADE_MS}ms linear`;
    el.style.opacity = "0";
  }, BEAM_SWEEP_MS);
}

function clampCardPosition(target: Rect, cardW: number, cardH: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top = target.top + target.height + CARD_GAP;
  if (top + cardH > vh - CARD_MARGIN) {
    const above = target.top - CARD_GAP - cardH;
    top = above > CARD_MARGIN ? above : Math.max(CARD_MARGIN, vh - cardH - CARD_MARGIN);
  }

  let left = target.left + target.width / 2 - cardW / 2;
  left = Math.min(Math.max(left, CARD_MARGIN), Math.max(CARD_MARGIN, vw - cardW - CARD_MARGIN));

  return { left, top: Math.max(CARD_MARGIN, top) };
}

export function LeadingLight({ steps, active, onNext, onBack, onExit, className = "" }: LeadingLightProps) {
  const autoId = useId();
  const titleId = `ll-title-${autoId.replace(/:/g, "")}`;
  const bodyId = `ll-body-${autoId.replace(/:/g, "")}`;

  const holeRef = useRef<SVGRectElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);
  const beamRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const nextBtnRef = useRef<HTMLButtonElement | null>(null);

  const reducedRef = useRef(false);
  const prevActiveRef = useRef<number>(active);
  const prevRectRef = useRef<Rect | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const flickerRef = useRef(false);

  const step = steps[active];

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    const onChange = () => {
      reducedRef.current = mq.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // remember what had focus before the tour started, restore it on exit
  useEffect(() => {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    return () => {
      returnFocusRef.current?.focus?.();
    };
  }, []);

  const reposition = useCallback(() => {
    if (!step) return;
    const rect = measure(step.target);
    if (!rect) return;
    moveRing(ringRef.current, rect, reducedRef.current);
    morphHole(holeRef.current, rect, reducedRef.current);
    const card = cardRef.current;
    if (card) {
      const { left, top } = clampCardPosition(rect, card.offsetWidth || 280, card.offsetHeight || 140);
      card.style.left = `${left}px`;
      card.style.top = `${top}px`;
    }
    prevRectRef.current = rect;
  }, [step]);

  // step change: sweep the beam from the old rect to the new one, morph the
  // hole/ring, and reposition the card — then focus the card for keyboard use
  useEffect(() => {
    if (!step) return;
    const rect = measure(step.target);
    if (!rect) return;

    const prevRect = prevRectRef.current;
    const isAdvance = prevActiveRef.current !== active;
    prevActiveRef.current = active;

    if (isAdvance && prevRect) {
      sweepBeam(beamRef.current, prevRect, rect, reducedRef.current, flickerRef.current);
      flickerRef.current = false;
    }

    moveRing(ringRef.current, rect, reducedRef.current);
    morphHole(holeRef.current, rect, reducedRef.current);

    const card = cardRef.current;
    if (card) {
      const { left, top } = clampCardPosition(rect, card.offsetWidth || 280, card.offsetHeight || 140);
      card.style.left = `${left}px`;
      card.style.top = `${top}px`;
    }
    prevRectRef.current = rect;

    const focusTarget = nextBtnRef.current ?? cardRef.current;
    focusTarget?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, step?.target]);

  useEffect(() => {
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [reposition]);

  const onCardKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onExit();
      return;
    }
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      onNext();
      return;
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      if (active > 0) onBack();
      return;
    }
    if (e.key === "Tab") {
      const card = cardRef.current;
      if (!card) return;
      const focusables = Array.from(
        card.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute("disabled"));
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  if (!step) return null;

  return (
    <div className={`fixed inset-0 z-[900] ${className}`}>
      <svg className="pointer-events-none fixed inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <filter id={`${autoId}-feather`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
          <mask id={`${autoId}-mask`} maskContentUnits="userSpaceOnUse">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect
              ref={holeRef}
              rx={HOLE_RADIUS}
              fill="black"
              filter={`url(#${autoId}-feather)`}
            />
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.62)" mask={`url(#${autoId}-mask)`} />
      </svg>

      <div
        ref={ringRef}
        className="pointer-events-none fixed rounded-[10px]"
        style={{
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: "var(--foreground)",
          boxShadow: "0 0 0 1px var(--foreground), 0 0 22px 3px color-mix(in srgb, var(--foreground) 35%, transparent)",
        }}
        aria-hidden="true"
      />

      <div
        ref={beamRef}
        className="pointer-events-none fixed h-0 origin-left"
        style={{
          height: BEAM_THICKNESS,
          opacity: 0,
          background:
            "linear-gradient(90deg, transparent, color-mix(in srgb, var(--foreground) 55%, transparent) 45%, color-mix(in srgb, var(--foreground) 55%, transparent) 60%, transparent)",
          clipPath: "polygon(0% 42%, 0% 58%, 100% 8%, 100% 92%)",
          filter: "blur(3px)",
        }}
        aria-hidden="true"
      />

      <div
        ref={cardRef}
        role="region"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onCardKeyDown}
        className="fixed z-[910] flex w-72 flex-col gap-3 rounded-[12px] border border-border bg-background p-4 text-foreground shadow-lg outline-none"
      >
        <span role="status" aria-live="polite" className="sr-only">
          Step {active + 1} of {steps.length}: {step.title}
        </span>
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-wide text-ns-muted">
            {active + 1} of {steps.length}
          </span>
          <button
            type="button"
            onClick={onExit}
            className="rounded-[6px] px-1.5 py-0.5 font-mono text-[11px] text-ns-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            Skip
          </button>
        </div>
        <h3 id={titleId} className="text-sm font-medium text-foreground">
          {step.title}
        </h3>
        <p id={bodyId} className="text-xs leading-relaxed text-ns-muted">
          {step.body}
        </p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onBack}
            disabled={active === 0}
            aria-disabled={active === 0}
            className="rounded-[6px] border border-border px-2.5 py-1 text-xs text-foreground transition-colors hover:border-foreground disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            Back
          </button>
          <button
            ref={nextBtnRef}
            type="button"
            onClick={onNext}
            onMouseEnter={() => {
              flickerRef.current = true;
            }}
            className="rounded-[6px] border border-foreground bg-foreground px-2.5 py-1 text-xs font-medium text-background transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            {active === steps.length - 1 ? "Done" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
