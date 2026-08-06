"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "ns-ui-mcp-notice-dismissed";
const DELAY_MS = 4000;
// The card's own copy is two short clauses ("This registry also runs as an
// MCP server, for agents that want it directly.") — about 3-4s at a
// comfortable reading pace. 8s doubles that so a slow read or a moment's
// hesitation before clicking the link isn't cut off, without letting a
// one-sentence nudge sit on screen indefinitely. Paused entirely (see the
// hover/focus effect below) rather than shortened, so a visitor who is
// actively reading or has tabbed onto the link never loses it mid-read.
const AUTO_DISMISS_MS = 8000;
// Matches the entrance's duration/easing (mcp-popup-in, globals.css) so the
// exit reads as the same motion in reverse rather than a different gesture.
const EXIT_MS = 260;

/**
 * A one-sentence, one-time nudge toward /connect. Rendered from SiteShell
 * itself rather than routed to per-page: SiteShell already returns bare
 * children (no chrome at all) on `/preview/<name>` and `/preview/<name>/embed`
 * — the screenshot gate's routes and every catalog/featured card's iframe —
 * so mounting this here means those exclusions come for free instead of a
 * second regex to keep in sync with `isBarePreview`. `/connect` itself still
 * needs its own check below; nothing about that route goes through the bare
 * path.
 *
 * No backdrop, no focus trap, no layout shift — it's an aside, not a modal.
 * `pointer-events-none` on the positioning shell and `pointer-events-auto`
 * on the card itself keeps the rest of the page fully interactive under it.
 *
 * The card once looked see-through over a featured card's live preview —
 * readable label and canvas dot-pattern bleeding through the surface. The
 * actual cause: the entrance keyframe (`mcp-popup-in`, globals.css)
 * animated `opacity: 0 → 1` over its 260ms duration. Over live content that
 * is not a rendering bug, it's what a fade-in *is* — the card is genuinely,
 * correctly partially transparent for the first ~150-160ms of every single
 * appearance, and a screenshot landing in that window (as the original
 * report's did — the popup fires 4s after mount, easy to catch mid-fade)
 * reads as a persistent transparency defect when it's actually a transient
 * animation frame. Proved by pausing the card's Web Animation and scrubbing
 * `currentTime` deterministically, sampling a pixel over card content (not
 * the popup's own surface color, which can't discriminate the two states):
 *
 *   ms    computed opacity   sampled pixel        surface token is (23,23,23)
 *   0     0                  (6,6,6)   — pure content, no card there yet
 *   40    0.564              (16,16,16)
 *   80    0.841              (20,20,20)
 *   120   0.948              (22,22,22)
 *   160+  ~1                 (23,23,23) — settled, matches surface exactly
 *
 * (10 + 0.564×(23−10) ≈ 17.3 — reconciles with the crop that reported the
 * bug, which showed flat 16-17 regions.) The keyframe no longer animates
 * opacity (globals.css) — the card slides in already-opaque instead of
 * fading in translucent. Re-running the same scrub after that change reads
 * the surface token at every one of the 0-260ms steps.
 *
 * An iframe-compositing-layer theory was raised and tested first (real
 * hover driven via CDP `Input.dispatchMouseEvent`, not synthetic DOM
 * events, to actually mount a featured card's iframe and screenshot it
 * live under the popup) — it did not reproduce. `isolate` stays on the
 * positioning shell anyway, not as this bug's fix but as cheap, correct
 * defensive hygiene: a fixed overlay sitting above iframe-bearing content
 * is exactly the kind of element that should own its stacking context
 * rather than depend on z-index alone, even though it wasn't what broke
 * here.
 *
 * Hidden below `sm`: at 390px there's no fixed-position slot big enough for
 * this card that isn't also a slot some scrollable content passes under —
 * bottom sits on the category chips, top sits under the header controls.
 * Reserving permanent space for it would fix that but reintroduces the
 * layout shift this was built to avoid (the card only appears at 4s, so
 * reserving its height from first paint moves everything below it on load).
 * A non-essential nudge toward `/connect` isn't worth either tradeoff on the
 * narrowest breakpoint, so it simply doesn't render there.
 */
export function McpPopup() {
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [visible, setVisible] = useState(false);
  // Drives the exit animation only — `visible` stays true for the duration
  // of the exit so the card keeps rendering while it slides away.
  const [closing, setClosing] = useState(false);
  const [paused, setPaused] = useState(false);
  const hoveredRef = useRef(false);
  const focusedRef = useRef(false);
  const closingRef = useRef(false);
  // Wall-clock accounting for pause/resume: how much of the auto-dismiss
  // window is left, and when the current countdown segment started.
  const remainingRef = useRef(AUTO_DISMISS_MS);
  const startedAtRef = useRef<number | null>(null);

  // localStorage doesn't exist on the server — same mounted-gate pattern as
  // ThemeToggle and the sidebar's persisted open state.
  useEffect(() => {
    setMounted(true);
    try {
      setDismissed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  useEffect(() => {
    if (!mounted || dismissed) return;
    const id = window.setTimeout(() => setVisible(true), DELAY_MS);
    return () => window.clearTimeout(id);
  }, [mounted, dismissed]);

  // Auto-dismiss countdown. Paused (see the pointer/focus handlers on the
  // card below) rather than merely reset, so a visitor who leaves and
  // returns doesn't get a full fresh window they didn't ask for. Not
  // restarted on `closing` — once the exit is underway there is nothing
  // left to time out.
  useEffect(() => {
    if (!visible || closing || paused) return;
    startedAtRef.current = Date.now();
    const id = window.setTimeout(() => close(false), remainingRef.current);
    return () => {
      window.clearTimeout(id);
      if (startedAtRef.current !== null) {
        remainingRef.current = Math.max(
          0,
          remainingRef.current - (Date.now() - startedAtRef.current),
        );
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, closing, paused]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  /**
   * `persist` distinguishes a deliberate dismissal (the ✕ button, Escape)
   * from the auto-dismiss timeout: a click/Escape means "I'm done with
   * this," and is remembered via STORAGE_KEY like before; a timeout just
   * means nobody happened to interact with it, so it's free to reappear
   * next visit rather than being silently retired forever.
   */
  const close = (persist: boolean) => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finish = () => {
      setVisible(false);
      setClosing(false);
      closingRef.current = false;
      if (persist) {
        setDismissed(true);
        try {
          localStorage.setItem(STORAGE_KEY, "1");
        } catch {
          /* private mode / storage disabled — it'll just reappear next visit */
        }
      }
    };
    if (reduced) finish();
    else window.setTimeout(finish, EXIT_MS);
  };

  const updatePaused = () => setPaused(hoveredRef.current || focusedRef.current);

  if (!mounted || dismissed || !visible) return null;

  return (
    <div
      aria-hidden={!visible}
      // Raised well clear of the "back to top" button's box (fixed
      // bottom-8/right-8, 40px, sm+ — top edge sits 72px above the
      // viewport bottom) instead of sharing its bottom-6/right-6 corner:
      // the two are otherwise both clickable-when-visible fixed elements
      // sharing the same footprint, and the popup's own link previously
      // intercepted clicks meant for that button.
      className="pointer-events-none fixed inset-x-0 bottom-24 z-40 isolate hidden justify-end px-6 sm:flex"
    >
      <div
        role="status"
        onPointerEnter={() => {
          hoveredRef.current = true;
          updatePaused();
        }}
        onPointerLeave={() => {
          hoveredRef.current = false;
          updatePaused();
        }}
        onFocus={() => {
          focusedRef.current = true;
          updatePaused();
        }}
        onBlur={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
          focusedRef.current = false;
          updatePaused();
        }}
        // Two full, static class strings rather than an interpolated
        // arbitrary-value string — Tailwind's build-time scanner only
        // generates utilities it can see written out literally, so a
        // template-literal splice into `animate-[...]` would silently
        // produce no CSS at all.
        className={
          closing
            ? "pointer-events-auto flex max-w-sm items-center gap-3 rounded-md border border-border bg-surface py-2.5 pl-3.5 pr-2.5 shadow-lg motion-safe:animate-[mcp-popup-out_260ms_cubic-bezier(0.22,1,0.36,1)_forwards]"
            : "pointer-events-auto flex max-w-sm items-center gap-3 rounded-md border border-border bg-surface py-2.5 pl-3.5 pr-2.5 shadow-lg motion-safe:animate-[mcp-popup-in_260ms_cubic-bezier(0.22,1,0.36,1)]"
        }
      >
        <p className="text-xs leading-relaxed text-foreground">
          This registry also runs as an{" "}
          <Link
            href="/connect"
            className="rounded-sm text-ns-accent outline-none underline underline-offset-2 hover:text-ns-accent-hover focus-visible:ring-2 focus-visible:ring-ns-accent transition-colors"
          >
            MCP server
          </Link>
          , for agents that want it directly.
        </p>
        <button
          type="button"
          onClick={() => close(true)}
          aria-label="Dismiss"
          // The only other interactive element in this card is the inline
          // "MCP server" link in the paragraph beside it — kept modest on
          // the left in case text reflow ever lands that link's end near
          // this button, generous on the right/vertical where the card's
          // own pr-2.5/py-2.5 padding gives real clearance.
          className="relative inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-ns-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent motion-reduce:transition-none after:absolute after:-inset-x-[4px] after:-inset-y-[6px] after:content-['']"
        >
          <svg
            viewBox="0 0 16 16"
            aria-hidden
            className="size-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>
    </div>
  );
}
