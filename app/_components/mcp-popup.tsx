"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "ns-ui-mcp-notice-dismissed";
const DELAY_MS = 4000;

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
 * `isolate` on the positioning shell: without it, once the entrance
 * animation finishes (`transform` reverts to `none`), this element has no
 * stacking context of its own, and the featured cards' `<iframe>` previews
 * — each its own compositing layer — can paint over it despite the z-40 and
 * despite `elementFromPoint` correctly reporting this card as the topmost
 * hit target at that point. That mismatch (hit-test says on top, paint
 * says under) is what a solid `bg-surface` panel doing literally nothing
 * wrong looks like when the bug is compositing, not transparency — checked
 * via computed styles over CDP before reaching for `isolate` rather than
 * guessing from a screenshot.
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

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const dismiss = () => {
    setVisible(false);
    setDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* private mode / storage disabled — it'll just reappear next visit */
    }
  };

  if (!mounted || dismissed || !visible) return null;

  return (
    <div
      aria-hidden={!visible}
      className="pointer-events-none fixed inset-x-0 bottom-6 z-40 isolate hidden justify-end px-6 sm:flex"
    >
      <div
        role="status"
        className="pointer-events-auto flex max-w-sm items-center gap-3 rounded-md border border-border bg-surface py-2.5 pl-3.5 pr-2.5 shadow-lg motion-safe:animate-[mcp-popup-in_260ms_cubic-bezier(0.22,1,0.36,1)]"
      >
        <p className="text-xs leading-relaxed text-foreground">
          This registry also runs as an{" "}
          <Link
            href="/connect"
            className="rounded-sm text-accent outline-none underline underline-offset-2 hover:text-accent-hover focus-visible:ring-2 focus-visible:ring-accent"
          >
            MCP server
          </Link>
          , for agents that want it directly.
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none"
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
