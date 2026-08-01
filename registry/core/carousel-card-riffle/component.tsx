"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// RiffleEdge — a card-stack navigator whose pagination indicator IS the scrub
// control. The stack shows its actual card edges as a stripe of thin lines
// (one 1px --border line per card, the current one recolored --foreground),
// running down the side of the top card like the exposed page-edge of a
// book. Dragging that stripe riffles cards past: each step change kicks the
// top card with a 220ms rotateY(5deg) + translateX(11px) flip-past (deter-
// ministic per-index vertical jitter, so no two steps land identically),
// settling on a smooth ease-out with no overshoot — release settles the
// arrival with the same kick. The two decorative depth layers behind the
// top card (its permanently-visible stacked-thickness read) kick too, on
// the same commit, at a subtler amplitude (9px/3deg then 5px/2deg, reduced
// with depth): an opposite-leaning translate+rotate that eases back to
// their resting offset a beat after the top card, each layer lagging the
// one in front of it — so a step reads as the whole deck visibly
// reshuffling and restacking, cleanly, not a subtle 3px nudge and not a
// glitchy overshoot. Scrub
// velocity governs which: slow drags step discretely (a kick per card), fast
// drags blur the top card through a CSS filter transition instead of
// chattering through kicks — the exposed edge itself carries both roles at
// once, never a separate dot-row or progress bar.
//
// Direct DOM writes (transform/filter) on committed index changes only — no
// per-frame rAF loop. Motion is entirely CSS-transition-driven: a one-off
// double-write (snap to a kicked pose, then rAF back to identity/rest so the
// transition eases the return) for the flip and the two back-layer nudges,
// and a filter transition ramped by the caller for blur. The back layers'
// resting offset is expressed in rem (matching their Tailwind translate
// utility at rest) with the kick's extra nudge layered on top via calc(), so
// the shuffle scales with root font size the same way the static pose
// already did. `prefers-reduced-motion` drops all of it: no rotateY, no
// perspective, no back-layer nudge, no blur ever — steps crossfade via
// opacity instead.
//
// The stripe's *drawn* thickness is deliberately compressed (down to a
// 1.5px-per-card pitch) so a small deck visibly reads thinner than a large
// one — but the drag range is NOT tied to that compressed thickness: it's
// a `travel` distance matched to the card's own measured height, a
// full-height rail beside the card rather than a sliver a couple of
// cards wide. Wheel/trackpad scroll over the stripe steps one card per
// tick too (accumulated deltaY, cooldown-gated so a single fling can't
// blow through several kicks at once) — dragging, wheeling and the
// keyboard all land on the same commit+kick path.
//
// A11y: root is role="group" (aria-label + a nested aria-live="polite" span
// announcing "Card N of total" on every committed change); the stripe itself
// is role="slider" (vertical, aria-valuemax = count-1) and owns the keyboard
// — ArrowLeft/Right and PageUp/PageDown step one card, Home/End jump to the
// ends. Differs from gallery-coverflow-caustic (lateral drag-through of large cover
// art, momentum + chromatic aberration, browsing) and from drill-down-spines
// (levels compress into read-at-rest spines you click to pop back to):
// carousel-card-riffle has exactly one visible card, and the "how many / where am I"
// readout is the scrubbable thickness of the stack itself, not a row of
// static dots or a shelf of resting spines. DOM/CSS only, no canvas.
// ---------------------------------------------------------------------------

const NATURAL_PITCH = 3; // px: 1px line + 2px gap, the "natural" edge rhythm
const MIN_PITCH = 1.5;
const STRIPE_PAD = 16; // px hit-area padding above/below the drawn lines
const KICK_MS = 220;
// phase 1 of every kick: the card visibly travels OUT to the kicked pose
// before settling back — without this the pose was snapped on instantly and
// the viewer only ever saw the settle half, so no shuffle read at all
const KICK_OUT_MS = 130;
const KICK_OUT_EASE = "cubic-bezier(0.25, 0.46, 0.45, 0.94)"; // plain ease-out, no overshoot
const CROSSFADE_MS = 120;
const BLUR_TRANSITION_MS = 140;
const MAX_BLUR = 5;
const FAST_VELOCITY = 14; // idx/s — at or above this, blur-through instead of a kick
const VELOCITY_FOR_MAX_BLUR = 46; // idx/s mapped to MAX_BLUR
const KICK_ROTATE_DEG = 7;
const KICK_TRANSLATE_X = 15;
// clean settle: smooth ease-out with no bounce/overshoot past identity/rest,
// so the return half of every kick reads as a deliberate riffle rather than
// a springy glitch — applied to the top card's flip-past and both back
// layers' restack alike
const SETTLE_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const PERSPECTIVE_PX = 720;
// decorative back-layer rest offsets, in rem — matches the original
// translate-x-1.5/translate-y-1.5 and translate-x-3/translate-y-3 Tailwind
// utilities exactly (1 spacing unit = 0.25rem), so switching them to
// JS-driven inline transforms doesn't change their resting appearance.
const BACK1_REST_REM = 0.375;
const BACK2_REST_REM = 0.75;
// shuffle nudge applied on top of the rest offset during a kick — smaller
// than the top card's own kick, and smaller again for the second layer, so
// depth reads as reduced amplitude the further back a layer sits. Scaled
// down proportionally with the top card's own kick so the whole deck still
// visibly cascades on every step, without reading as a broken animation.
const BACK1_SHIFT_PX = 9;
const BACK2_SHIFT_PX = 5;
const BACK1_ROTATE_DEG = 3;
const BACK2_ROTATE_DEG = 2;
const BACK_STAGGER_MS = 90; // each back layer settles this much later than the one in front
const WHEEL_STEP_PX = 36; // deltaY accumulated before a wheel/trackpad tick steps a card
const WHEEL_COOLDOWN_MS = 360; // >= KICK_OUT_MS + KICK_MS, so each step's out-and-back reads before the next fires

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
  const back1Ref = useRef<HTMLDivElement>(null);
  const back2Ref = useRef<HTMLDivElement>(null);
  const liveRef = useRef<HTMLSpanElement>(null);

  const dragRef = useRef<{
    pointerId: number;
    lastRaw: number;
    lastT: number;
    vel: number;
    lastDir: number;
  } | null>(null);
  const wheelRef = useRef({ accum: 0, lastT: 0 });
  const settleTimerRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
    },
    []
  );

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
    const j1 = jitterFor(targetIndex + 1) * 0.5;
    const j2 = jitterFor(targetIndex + 2) * 0.3;
    const back1 = back1Ref.current;
    const back2 = back2Ref.current;
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);

    // phase 1: animate OUT to the kicked pose — the visible half of the
    // shuffle. The deck's decorative depth layers travel with the top card,
    // a smaller opposite-leaning nudge per layer (reduced amplitude with
    // depth), so a step reads as the whole stack restacking rather than
    // only the top card swapping.
    card.style.transition = `transform ${KICK_OUT_MS}ms ${KICK_OUT_EASE}`;
    card.style.transform = `perspective(${PERSPECTIVE_PX}px) rotateY(${dir * KICK_ROTATE_DEG}deg) translateX(${(-dir * KICK_TRANSLATE_X).toFixed(2)}px) translateY(${j.toFixed(2)}px)`;
    if (back1) {
      back1.style.transition = `transform ${KICK_OUT_MS}ms ${KICK_OUT_EASE}`;
      back1.style.transform = `translate(calc(${BACK1_REST_REM}rem + ${(dir * BACK1_SHIFT_PX).toFixed(2)}px), calc(${BACK1_REST_REM}rem + ${j1.toFixed(2)}px)) rotate(${(dir * BACK1_ROTATE_DEG).toFixed(2)}deg)`;
    }
    if (back2) {
      back2.style.transition = `transform ${KICK_OUT_MS}ms ${KICK_OUT_EASE}`;
      back2.style.transform = `translate(calc(${BACK2_REST_REM}rem + ${(dir * BACK2_SHIFT_PX).toFixed(2)}px), calc(${BACK2_REST_REM}rem + ${j2.toFixed(2)}px)) rotate(${(dir * BACK2_ROTATE_DEG).toFixed(2)}deg)`;
    }

    // phase 2: once the out-travel lands, settle everything back to rest —
    // each back layer a beat after the layer in front of it, no overshoot
    settleTimerRef.current = window.setTimeout(() => {
      settleTimerRef.current = null;
      card.style.transition = `transform ${KICK_MS}ms ${SETTLE_EASE}`;
      card.style.transform = `perspective(${PERSPECTIVE_PX}px) rotateY(0deg) translateX(0px) translateY(0px)`;
      if (back1) {
        back1.style.transition = `transform ${KICK_MS + BACK_STAGGER_MS}ms ${SETTLE_EASE}`;
        back1.style.transform = `translate(${BACK1_REST_REM}rem, ${BACK1_REST_REM}rem) rotate(0deg)`;
      }
      if (back2) {
        back2.style.transition = `transform ${KICK_MS + BACK_STAGGER_MS * 2}ms ${SETTLE_EASE}`;
        back2.style.transform = `translate(${BACK2_REST_REM}rem, ${BACK2_REST_REM}rem) rotate(0deg)`;
      }
    }, KICK_OUT_MS);
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

  // `runHeight` is deliberately compressed (down to a 1.5px pitch) so the
  // drawn line-stack reads as the deck's actual physical thickness. Mapping
  // pointer position over THAT span, though, made the drag range as small as
  // ~20px for a handful of cards — a couple of stray pixels would skip
  // several cards, and the stripe itself rendered as a sliver next to a much
  // taller card. `travel` is the interactive range: it matches the card's
  // own measured height (a full-height rail beside it, like a scrollbar),
  // independent of how compact the visual pitch is. The thin lines still
  // draw at `runHeight`/`pitch` (centered inside the taller stripe via the
  // stripe's own `items-center`) — only the hit box and the drag mapping grow.
  const travel = cardHeight > 0 ? Math.max(runHeight, cardHeight - STRIPE_PAD * 2) : runHeight;

  // maps clientY across `travel` (inset by STRIPE_PAD on each side, which is
  // now genuinely just headroom past the ends, not the whole usable range)
  const rawFromClientY = (clientY: number) => {
    const stripe = stripeRef.current;
    if (!stripe) return posRef.current;
    const rect = stripe.getBoundingClientRect();
    const frac = clamp((clientY - rect.top - STRIPE_PAD) / Math.max(1, travel), 0, 1);
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

  // wheel/trackpad: accumulate deltaY and step one card per WHEEL_STEP worth
  // of scroll, gated by a cooldown so a fast trackpad fling doesn't blow
  // through several cards' kicks in one continuous gesture — mirrors the
  // discrete feel of a slow drag or a keyboard step, never a blur-through.
  // Attached natively (not React's onWheel) with { passive: false }: a
  // passive listener would make preventDefault() a silent no-op (the page
  // scrolls out from under the stripe) and can warn in the console, which
  // the verify gate treats as a failure.
  useEffect(() => {
    const stripe = stripeRef.current;
    if (!stripe) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const w = wheelRef.current;
      w.accum += e.deltaY;
      const now = performance.now();
      if (now - w.lastT < WHEEL_COOLDOWN_MS) return;
      if (Math.abs(w.accum) < WHEEL_STEP_PX) return;
      const dir = Math.sign(w.accum);
      w.accum = 0;
      w.lastT = now;
      const cur = posRef.current;
      const clamped = clampIndex(cur + dir);
      if (clamped !== cur) {
        commit(clamped);
        kick(dir, clamped);
      }
    };
    stripe.addEventListener("wheel", handler, { passive: false });
    return () => stripe.removeEventListener("wheel", handler);
    // re-bound every render (cheap: one addEventListener/removeEventListener
    // pair) rather than a narrow deps array — `handler` closes over `commit`/
    // `kick`, which themselves close over props like `onIndexChange`, so a
    // stale closure here would silently call an old callback after a parent
    // re-render, exactly the class of bug a trimmed deps array would hide.
  });

  const item = items[current] ?? items[0];

  return (
    <div className={`w-full ${className}`} role="group" aria-label={ariaLabel}>
      <div className="flex items-center gap-3">
        <div className="relative min-h-[200px] flex-1" style={{ perspective: `${PERSPECTIVE_PX}px` }}>
          {/* decorative stack depth — the physical thickness read, behind the
              top card. Rest transform set inline (rem, matching the original
              translate-x-1.5/translate-y-1.5 and translate-x-3/translate-y-3
              utilities) rather than via Tailwind classes, so `kick` can nudge
              and ease it back with the same imperative double-write it uses
              on the top card. */}
          <div
            ref={back1Ref}
            aria-hidden
            className="absolute inset-0 rounded-md border border-border bg-surface opacity-60"
            style={{ transform: `translate(${BACK1_REST_REM}rem, ${BACK1_REST_REM}rem)`, willChange: "transform" }}
          />
          <div
            ref={back2Ref}
            aria-hidden
            className="absolute inset-0 rounded-md border border-border bg-surface opacity-35"
            style={{ transform: `translate(${BACK2_REST_REM}rem, ${BACK2_REST_REM}rem)`, willChange: "transform" }}
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
          style={{ height: travel + STRIPE_PAD * 2 }}
          className="group relative flex w-8 shrink-0 cursor-row-resize touch-none select-none flex-col items-center justify-center rounded-sm outline-none transition-colors duration-200 hover:bg-border/10 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
