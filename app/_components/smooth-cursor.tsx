"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  CURSOR_NATIVE_KEY,
  CURSOR_PREF_EVENT,
  applyNativeCursorClass,
  prefersNativeCursor,
} from "@/lib/cursor";

const TURN = 0.22; // rotation smoothing
// Below this, keep the last angle instead of jittering. Raised from the
// portfolio's 0.35 along with the lerp removal below: `dx/dy` used to be the
// decaying *gap* to the pointer (already low-passed by the ease, so sub-pixel
// values were meaningful), and is now the raw per-frame pointer delta. 0.75
// excludes a stationary pointer and trackpad sub-pixel noise while still
// admitting any real 1px move, whose direction is genuine.
const MIN_SPEED = 0.75;

const CLICKABLE =
  'a, button, [role="button"], [role="link"], input, textarea, select, summary, label';

/**
 * Ported from the portfolio's `SmoothCursor` (same turn constant, same
 * markup, same CSS hooks), with ns-ui-specific additions: bails out entirely
 * inside iframes, since every `/preview/<slug>` shape and every catalog card
 * thumbnail render this same root layout framed — a hidden native cursor
 * with no replacement inside that frame would make embedded components
 * unusable. `[role="link"]` and a `cursor-pointer` class fallback were added
 * to the hand-state hit test on top of the portfolio's plain tag/role list,
 * so any non-semantic clickable (a div/span with an onClick, styled
 * cursor-pointer instead of using a real button/link) still gets the hand.
 *
 * The portfolio's position lerp is gone (see `frame` below) and the visitor
 * can switch the whole thing off (lib/cursor.ts, CursorToggle) — both from the
 * same report, that the trailing read as cursor acceleration.
 */
export function SmoothCursor() {
  const ref = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<HTMLSpanElement>(null);
  const pathname = usePathname();
  // A /preview route is a component on a bare page, and it is what the
  // verification gate, the poster pipeline and every review screenshot load
  // DIRECTLY rather than in a frame. The iframe guard below therefore does not
  // fire there, and the replacement cursor was being baked into captured
  // images across the registry, including the weld-pool reference shots.
  const onPreview = pathname?.startsWith("/preview") ?? false;

  // The visitor's off switch. Starts `false` so the server and the first
  // client render agree (nothing in the markup below depends on it either
  // way); the class on <html>, set pre-paint by the no-flash script, is the
  // real first-frame answer, and globals.css already honours it on its own —
  // this state is only what tears the listeners and the rAF loop down.
  const [native, setNative] = useState(false);
  useEffect(() => {
    const read = () => setNative(prefersNativeCursor());
    read();
    // Same document: CursorToggle flips the class and fires this, since a
    // classList change is not otherwise observable.
    window.addEventListener(CURSOR_PREF_EVENT, read);
    // Every OTHER same-origin document: `storage` never fires in the one that
    // wrote, so this is the host page's only notice that a second tab (or a
    // framed copy of this shell, which cannot own a cursor itself) changed the
    // preference. Same pattern as theme-sync.tsx.
    const onStorage = (e: StorageEvent) => {
      // A key of `null` means the whole storage area was cleared.
      if (e.key !== CURSOR_NATIVE_KEY && e.key !== null) return;
      applyNativeCursorClass(e.newValue === "1");
      read();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CURSOR_PREF_EVENT, read);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    if (onPreview || native) return;
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
      // The hotspot is the pointer, full stop — no lerp. The portfolio's
      // `x += (tx - x) * 0.18` is what the owner was reading as "cursor
      // acceleration": at 60fps the arrow needed ~20 frames to close a gap, so
      // it visibly trailed on every move and overshot nothing on stopping.
      // Only the *rotation* is still smoothed, which is where the character
      // was, and it costs no positional lag. dx/dy stay the frame's real
      // movement, which is a better steering signal than the old decaying gap.
      const dx = tx - x;
      const dy = ty - y;
      x = tx;
      y = ty;

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
      // Back to the pre-first-move state. This effect can now run a second
      // time (the visitor switching the cursor back on), and the element is
      // the same one — left visible, it would paint one frame at
      // translate3d(0,0,0) before the next pointermove seeded a position,
      // flashing the arrow in the top-left corner.
      el.dataset.visible = "false";
    };
  }, [onPreview, native]);

  if (onPreview) return null;

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
