"use client";

import { useEffect, useRef } from "react";

// ponytail: lerp, not a real spring. Swap in a damped spring if the ease reads too linear.
const EASE = 0.18; // higher = tighter follow
const TURN = 0.22; // rotation smoothing
const MIN_SPEED = 0.35; // below this, keep the last angle instead of jittering

const CLICKABLE =
  'a, button, [role="button"], [role="link"], input, textarea, select, summary, label';

/**
 * Ported from the portfolio's `SmoothCursor` (same lerp/turn constants, same
 * markup, same CSS hooks), with ns-ui-specific additions: bails out entirely
 * inside iframes, since every `/preview/<slug>` shape and every catalog card
 * thumbnail render this same root layout framed — a hidden native cursor
 * with no replacement inside that frame would make embedded components
 * unusable. `[role="link"]` and a `cursor-pointer` class fallback were added
 * to the hand-state hit test on top of the portfolio's plain tag/role list,
 * so any non-semantic clickable (a div/span with an onClick, styled
 * cursor-pointer instead of using a real button/link) still gets the hand.
 */
export function SmoothCursor() {
  const ref = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    // See the module comment — this component only owns the cursor on the
    // top-level document, never inside an embedded component's iframe.
    if (window.self !== window.top) return;

    const el = ref.current;
    const arrow = arrowRef.current;
    if (!el || !arrow) return;

    // Coarse pointers have no cursor to replace; reduced-motion users opted out of this.
    const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || calm) return;

    document.body.classList.add("smooth-cursor-active");

    let x = 0;
    let y = 0;
    let tx = 0;
    let ty = 0;
    let angle = 0;
    let seen = false;
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      if (!seen) {
        x = tx;
        y = ty;
        seen = true;
      }
      // Always mark visible on a real move, not just the first one. onOver's
      // IFRAME branch below sets visible="false" when the pointer crosses onto
      // an embedded component's iframe (that document owns the pointer from
      // then on, so the arrow would otherwise hang mid-page). Gating this
      // behind `!seen` — which is true exactly once, ever — meant the pointer
      // coming back off that iframe onto real content never un-hid the arrow:
      // pointerenter doesn't fire (the pointer never left the window) and
      // pointermove had already run its one-time branch. The arrow, and with
      // it the entire cursor, stayed invisible for the rest of the page's
      // life. Confirmed live: hover a component page's interactive demo
      // iframe, then move back onto a plain link — data-visible stuck
      // "false" until this line ran unconditionally.
      el.dataset.visible = "true";
    };
    const onLeave = () => {
      el.dataset.visible = "false";
    };
    const onEnter = () => {
      if (seen) el.dataset.visible = "true";
    };
    // Over anything clickable the arrow becomes a pointing hand, same as a
    // native cursor would. pointerover bubbles, so one listener covers the page.
    const onOver = (e: PointerEvent) => {
      const target = e.target as Element | null;
      // Crossing onto an embedded component's iframe: the parent document
      // stops receiving pointermove from here on, so the arrow would freeze
      // mid-page instead of tracking. Hide it rather than let it hang there —
      // the catalog grid and every component preview are full of these.
      if (target?.tagName === "IFRAME") {
        el.dataset.visible = "false";
        return;
      }
      // Semantic clickables first (cheap `closest`, covers everything real in
      // this codebase today — grepped, the only non-semantic `cursor-pointer`
      // uses are already `<summary>`, already in CLICKABLE). Anything left
      // over — a future div/span with an onClick and no button/link role,
      // styled `cursor-pointer` instead — still presents as interactive
      // visually, so fall back to a class check. NOT `getComputedStyle`: the
      // global `body.smooth-cursor-active *` rule (globals.css) sets
      // `cursor: none` on every element while this effect is running, which
      // outranks a `cursor-pointer` utility class on specificity — computed
      // style would read "none" here regardless, silently never matching.
      const semantic = target?.closest?.(CLICKABLE);
      const styled = !semantic && target?.closest?.('[class*="cursor-pointer"]');
      el.dataset.hand = semantic || styled ? "true" : "false";
    };
    const onDown = () => {
      el.dataset.down = "true";
    };
    const onUp = () => {
      el.dataset.down = "false";
    };

    addEventListener("pointermove", onMove, { passive: true });
    addEventListener("pointerover", onOver, { passive: true });
    addEventListener("pointerdown", onDown, { passive: true });
    addEventListener("pointerup", onUp, { passive: true });
    addEventListener("pointerleave", onLeave);
    addEventListener("pointerenter", onEnter);

    const frame = () => {
      const dx = tx - x;
      const dy = ty - y;
      x += dx * EASE;
      y += dy * EASE;

      const speed = Math.hypot(dx, dy);
      if (speed > MIN_SPEED) {
        // +90deg because the arrow is drawn pointing up, and atan2 measures from +x.
        const target = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
        const delta = ((target - angle + 540) % 360) - 180; // shortest way round
        angle += delta * TURN;
      }

      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      // Only the arrow steers — a rotating hand reads as broken.
      arrow.style.transform = `rotate(${angle}deg)`;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("pointermove", onMove);
      removeEventListener("pointerover", onOver);
      removeEventListener("pointerdown", onDown);
      removeEventListener("pointerup", onUp);
      removeEventListener("pointerleave", onLeave);
      removeEventListener("pointerenter", onEnter);
      document.body.classList.remove("smooth-cursor-active");
    };
  }, []);

  return (
    <div ref={ref} className="smooth-cursor" aria-hidden="true">
      {/* Own geometry: arrow with a notched base, pointing "up" at 0deg.
          Corners are curves, not joins — stroke-linejoin only rounds the
          outline, leaving the filled tip sharp. */}
      <span ref={arrowRef} className="smooth-cursor-arrow">
        <svg width="25" height="27" viewBox="0 0 50 54" fill="none">
          <path
            d="M25 11 C27.4 11 29.2 12.8 30.1 15.4 L40.8 39.2 C42.4 42.8 39.6 46.4 36.2 44.8 L27 40.4 C25.7 39.8 24.3 39.8 23 40.4 L13.8 44.8 C10.4 46.4 7.6 42.8 9.2 39.2 L19.9 15.4 C20.8 12.8 22.6 11 25 11 Z"
            fill="var(--cursor-fill)"
            stroke="var(--cursor-stroke)"
            strokeWidth="4.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      </span>
      {/* Pointing hand: index up, two curled fingers, thumb across the palm.
          Drawn once into <defs>, then painted twice — a fat stroke pass for the
          silhouette outline, a fill pass on top. Stroking each shape directly
          would draw seams where the fingers meet the palm. */}
      <span className="smooth-cursor-hand">
        <svg width="26" height="30" viewBox="0 0 48 56">
          <defs>
            <g id="cursor-hand">
              <rect x="18.5" y="5" width="8.5" height="28" rx="4.25" />
              <rect x="26.5" y="19" width="7.5" height="18" rx="3.75" />
              <rect x="33" y="22" width="7.5" height="15" rx="3.75" />
              <path d="M15 27 h25 a4.5 4.5 0 0 1 4.5 4.5 V38 c0 7.5-5 12.5-13 12.5 h-4 c-4.8 0-7.9-2-10.4-5.8 L5 33.5 a4.4 4.4 0 0 1 7.4-4.7 z" />
            </g>
          </defs>
          <use
            href="#cursor-hand"
            fill="var(--cursor-stroke)"
            stroke="var(--cursor-stroke)"
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
          <use href="#cursor-hand" fill="var(--cursor-fill)" />
          {/* Knuckle creases — without them the curled fingers read as one blob. */}
          <g
            fill="none"
            stroke="var(--cursor-stroke)"
            strokeWidth="1.3"
            strokeLinecap="round"
          >
            <path d="M27 21.5 v10" />
            <path d="M33.6 24.5 v8.5" />
            <path d="M14.6 30.5 l4.6 6.6" />
          </g>
        </svg>
      </span>
    </div>
  );
}
