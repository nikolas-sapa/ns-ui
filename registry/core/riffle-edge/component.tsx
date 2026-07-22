"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// RiffleEdge — a card-stack navigator whose pagination indicator IS the scrub
// control. The stack shows its actual card edges as a stripe of thin lines
// (one 1px --border line per card, the current one recolored --foreground),
// running down the side of the top card like the exposed page-edge of a
// book. Dragging that stripe riffles cards past: each step change kicks the
// top card with a 90ms rotateY(4deg) + translateX flip-past (deterministic
// per-index vertical jitter, so no two steps land identically), release
// settles the arrival with the same kick. Scrub velocity governs which:
// slow drags step discretely (a kick per card), fast drags blur the top card
// through a CSS filter transition instead of chattering through kicks —
// the exposed edge itself carries both roles at once, never a separate
// dot-row or progress bar.
//
// Direct DOM writes (transform/filter) on committed index changes only — no
// per-frame rAF loop. Motion is entirely CSS-transition-driven: a one-off
// double-write (snap to a kicked pose, then rAF back to identity so the
// transition eases the return) for the flip, and a filter transition ramped
// by the caller for blur. `prefers-reduced-motion` drops both: no rotateY,
// no perspective, no blur ever — steps crossfade via opacity instead.
//
// A11y: root is role="group" (aria-label + a nested aria-live="polite" span
// announcing "Card N of total" on every committed change); the stripe itself
// is role="slider" (vertical, aria-valuemax = count-1) and owns the keyboard
// — ArrowLeft/Right and PageUp/PageDown step one card, Home/End jump to the
// ends. Differs from caustic-coverflow (lateral drag-through of large cover
// art, momentum + chromatic aberration, browsing) and from spine-stack
// (levels compress into read-at-rest spines you click to pop back to):
// riffle-edge has exactly one visible card, and the "how many / where am I"
// readout is the scrubbable thickness of the stack itself, not a row of
// static dots or a shelf of resting spines. DOM/CSS only, no canvas.
// ---------------------------------------------------------------------------

const NATURAL_PITCH = 3; // px: 1px line + 2px gap, the "natural" edge rhythm
const MIN_PITCH = 1.5;
const STRIPE_PAD = 16; // px hit-area padding above/below the drawn lines
const KICK_MS = 90;
const CROSSFADE_MS = 120;
const BLUR_TRANSITION_MS = 140;
const MAX_BLUR = 5;
const FAST_VELOCITY = 14; // idx/s — at or above this, blur-through instead of a kick
const VELOCITY_FOR_MAX_BLUR = 46; // idx/s mapped to MAX_BLUR
const KICK_ROTATE_DEG = 4;
const KICK_TRANSLATE_X = 6;
const PERSPECTIVE_PX = 720;

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

// deterministic per-index jitter (px), so each card's flip-past reads as a
// distinct sheet of paper rather than a repeating mechanical tick
function jitterFor(i: number) {
  const s = Math.sin(i * 12.9898) * 43758.5453;
  const frac = s - Math.floor(s);
  return (frac - 0.5) * 4; // -2..2px
}

export interface RiffleEdgeItem {
  /** stable id, also the React key */
  id: string;
  /** small mono eyebrow above the title (category, step kind, sender…) */
  eyebrow?: string;
  title: string;
  description?: string;
}

export interface RiffleEdgeProps {
  items: RiffleEdgeItem[];
  /** controlled current index; omit for uncontrolled */
  index?: number;
  defaultIndex?: number;
  onIndexChange?: (index: number) => void;
  className?: string;
  /** accessible name for the enclosing group */
  "aria-label"?: string;
}

export function RiffleEdge({
  items,
  index,
  defaultIndex = 0,
  onIndexChange,
  className = "",
  "aria-label": ariaLabel = "Card stack",
}: RiffleEdgeProps) {
  const count = Math.max(1, items.length);
  const clampIndex = (v: number) => clamp(Math.round(v), 0, count - 1);

  const isControlled = index !== undefined;
  const [internal, setInternal] = useState(() => clampIndex(defaultIndex));
  const current = isControlled ? clampIndex(index as number) : internal;

  // mirrors `current` for synchronous reads inside pointer/keyboard handlers,
  // where React state hasn't re-rendered yet between rapid successive events
  const posRef = useRef(current);
  useEffect(() => {
    posRef.current = current;
  }, [current]);

  const [cardHeight, setCardHeight] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  const stripeRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<HTMLSpanElement>(null);

  const dragRef = useRef<{
    pointerId: number;
    lastRaw: number;
    lastT: number;
    vel: number;
    lastDir: number;
  } | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // the natural pitch shrinks only if the deck's own thickness would
  // otherwise outgrow the top card's rendered height — measured on the
  // card, not the stripe (the stripe's size is DERIVED from the pitch, so
  // measuring itself would be circular)
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    setCardHeight(el.getBoundingClientRect().height);
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height;
      if (h) setCardHeight(h);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // aria-live announce on every committed change (not on raw drag position)
  useEffect(() => {
    if (liveRef.current) liveRef.current.textContent = `Card ${current + 1} of ${count}`;
  }, [current, count]);

  const commit = (v: number) => {
    if (!isControlled) setInternal(v);
    posRef.current = v;
    onIndexChange?.(v);
  };

  const kick = (dir: number, targetIndex: number) => {
    const card = cardRef.current;
    if (!card) return;
    if (reducedMotion) {
      card.style.transition = "none";
      card.style.opacity = "0.4";
      requestAnimationFrame(() => {
        card.style.transition = `opacity ${CROSSFADE_MS}ms ease-out`;
        card.style.opacity = "1";
      });
      return;
    }
    const j = jitterFor(targetIndex);
    card.style.transition = "none";
    card.style.transform = `perspective(${PERSPECTIVE_PX}px) rotateY(${dir * KICK_ROTATE_DEG}deg) translateX(${(-dir * KICK_TRANSLATE_X).toFixed(2)}px) translateY(${j.toFixed(2)}px)`;
    requestAnimationFrame(() => {
      card.style.transition = `transform ${KICK_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
      card.style.transform = `perspective(${PERSPECTIVE_PX}px) rotateY(0deg) translateX(0px) translateY(0px)`;
    });
  };

  const setBlur = (velAbs: number) => {
    const card = cardRef.current;
    if (!card || reducedMotion) return;
    const t = clamp((velAbs - FAST_VELOCITY) / (VELOCITY_FOR_MAX_BLUR - FAST_VELOCITY), 0, 1);
    const px = t * MAX_BLUR;
    card.style.transition = `filter ${BLUR_TRANSITION_MS}ms ease-out`;
    card.style.filter = px > 0.05 ? `blur(${px.toFixed(2)}px)` : "none";
  };

  // applies a raw (fractional) scrub position: rounds to the nearest card,
  // commits it if changed, and picks kick (slow) vs blur-through (fast)
  const applyRaw = (raw: number, velAbs: number) => {
    const rounded = clampIndex(raw);
    if (rounded !== posRef.current) {
      const dir = Math.sign(rounded - posRef.current) || 1;
      commit(rounded);
      if (reducedMotion || velAbs < FAST_VELOCITY) kick(dir, rounded);
    }
    setBlur(velAbs);
  };

  const pitch =
    cardHeight > 0 ? clamp(cardHeight / count, MIN_PITCH, NATURAL_PITCH) : NATURAL_PITCH;
  const runHeight = count > 1 ? (count - 1) * pitch + 2 : 2;

  // maps to the drawn line run itself (inset by STRIPE_PAD on each side),
  // not the padded hit box — so the scrub position always coincides with
  // where the highlighted line visually sits, whatever the pad is for
  const rawFromClientY = (clientY: number) => {
    const stripe = stripeRef.current;
    if (!stripe) return posRef.current;
    const rect = stripe.getBoundingClientRect();
    const frac = clamp((clientY - rect.top - STRIPE_PAD) / Math.max(1, runHeight), 0, 1);
    return frac * (count - 1);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const stripe = stripeRef.current;
    if (!stripe) return;
    e.preventDefault();
    try {
      stripe.setPointerCapture(e.pointerId);
    } catch {
      /* capture unsupported */
    }
    stripe.focus({ preventScroll: true });
    const raw = rawFromClientY(e.clientY);
    dragRef.current = {
      pointerId: e.pointerId,
      lastRaw: raw,
      lastT: performance.now(),
      vel: 0,
      lastDir: 1,
    };
    applyRaw(raw, 0);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const raw = rawFromClientY(e.clientY);
    const now = performance.now();
    const dt = Math.max(4, now - drag.lastT) / 1000;
    const instVel = (raw - drag.lastRaw) / dt;
    drag.vel = drag.vel * 0.5 + instVel * 0.5;
    if (instVel !== 0) drag.lastDir = Math.sign(instVel);
    drag.lastRaw = raw;
    drag.lastT = now;
    applyRaw(raw, Math.abs(drag.vel));
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    try {
      stripeRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    const wasFast = Math.abs(drag.vel) >= FAST_VELOCITY;
    const finalRounded = clampIndex(drag.lastRaw);
    const lastDir = drag.lastDir || 1;
    dragRef.current = null;
    setBlur(0); // release settles: blur eases to zero either way
    if (finalRounded !== posRef.current) {
      commit(finalRounded);
      kick(lastDir, finalRounded);
    } else if (wasFast && !reducedMotion) {
      // arrived on this card via a fast blur-through pass that never itself
      // kicked — mark the arrival so a release always reads as a settle
      kick(lastDir, finalRounded);
    }
  };

  const onPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setBlur(0);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const cur = posRef.current;
    let next: number | null = null;
    switch (e.key) {
      case "ArrowRight":
      case "PageDown":
        next = cur + 1;
        break;
      case "ArrowLeft":
      case "PageUp":
        next = cur - 1;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = count - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    const clamped = clampIndex(next);
    if (clamped !== cur) {
      const dir = Math.sign(clamped - cur) || 1;
      commit(clamped);
      kick(dir, clamped);
    }
  };

  const item = items[current] ?? items[0];

  return (
    <div className={`w-full ${className}`} role="group" aria-label={ariaLabel}>
      <div className="flex items-center gap-3">
        <div className="relative min-h-[200px] flex-1" style={{ perspective: `${PERSPECTIVE_PX}px` }}>
          {/* decorative stack depth — the physical thickness read, behind the top card */}
          <div
            aria-hidden
            className="absolute inset-0 translate-x-1.5 translate-y-1.5 rounded-md border border-border bg-surface opacity-60"
          />
          <div
            aria-hidden
            className="absolute inset-0 translate-x-3 translate-y-3 rounded-md border border-border bg-surface opacity-35"
          />
          {item ? (
            <div
              ref={cardRef}
              className="relative flex h-full flex-col gap-2 rounded-md border border-border bg-surface p-5 transition-colors duration-200 hover:border-foreground/35"
              style={{ willChange: "transform, filter" }}
            >
              {item.eyebrow && (
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                  {item.eyebrow}
                </p>
              )}
              <h3 className="text-base font-semibold tracking-tight text-foreground">
                {item.title}
              </h3>
              {item.description && (
                <p className="text-sm leading-relaxed text-muted">{item.description}</p>
              )}
              <p aria-hidden className="mt-auto font-mono text-[10px] tracking-wide text-muted">
                {String(current + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
              </p>
            </div>
          ) : (
            <div className="relative flex h-full items-center justify-center rounded-md border border-border bg-surface p-5 text-sm text-muted">
              No cards
            </div>
          )}
        </div>

        <div
          ref={stripeRef}
          role="slider"
          tabIndex={0}
          aria-label="Scrub cards"
          aria-orientation="vertical"
          aria-valuemin={0}
          aria-valuemax={count - 1}
          aria-valuenow={current}
          aria-valuetext={`Card ${current + 1} of ${count}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={onPointerCancel}
          onKeyDown={onKeyDown}
          style={{ height: runHeight + STRIPE_PAD * 2 }}
          className="group relative flex w-6 shrink-0 cursor-row-resize touch-none select-none flex-col items-center justify-center rounded-sm outline-none transition-colors duration-200 hover:bg-border/10 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <div className="relative" style={{ height: runHeight, width: 14 }}>
            {items.map((it, i) => {
              const active = i === current;
              return (
                <div
                  key={it.id}
                  aria-hidden
                  data-active={active ? "true" : "false"}
                  className={
                    active
                      ? "absolute left-0 w-full rounded-full bg-foreground transition-colors duration-200"
                      : "absolute left-0 w-full rounded-full bg-border transition-colors duration-200 group-hover:bg-muted"
                  }
                  style={{ top: i * pitch, height: active ? 2 : 1 }}
                />
              );
            })}
          </div>
        </div>
      </div>
      <span ref={liveRef} aria-live="polite" className="sr-only" />
    </div>
  );
}
