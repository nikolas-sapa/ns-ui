"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Dismissed for good. Separate from the view counter below, same split as
 * McpPopup: one records a decision, the other records exposure.
 */
const STORAGE_KEY = "ns-ui-star-prompt-dismissed";
const VIEWS_KEY = "ns-ui-star-prompt-views";
/** After this many appearances it retires itself, clicked or not. */
const MAX_VIEWS = 3;
/** Long enough to read two lines and reach the link, not long enough to nag. */
const AUTO_DISMISS_MS = 9000;
const EXIT_MS = 220;

const REPO_URL = "https://github.com/nikolas-sapa/ns-ui";

/** CopyButton fires this on a successful write. */
export const COPIED_EVENT = "ns-ui:copied";

/**
 * Asks for a star at the one moment the visitor has just taken something.
 *
 * The problem it exists for: traffic was converting to stars at well under a
 * percent, because the only ask is a button in the hero that a visitor scrolls
 * past before they know whether the library is any good. A copy is the first
 * point at which they demonstrably do — they have the install command on their
 * clipboard.
 *
 * Deliberately not a modal and deliberately not blocking: it cannot interrupt
 * the paste it is reacting to, or it costs more than a star is worth. It is a
 * corner card that auto-dismisses, retires after MAX_VIEWS, and never returns
 * once dismissed.
 *
 * Mounted once in the shell rather than per button, and driven by a window
 * event, so CopyButton stays unaware of it — every copy surface on the site
 * (cards, code blocks, prose blocks) gets this for free and none of them had
 * to take a prop.
 */
export function StarPrompt() {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const retired = useRef(false);
  const exitTimer = useRef<number | null>(null);
  const dismissTimer = useRef<number | null>(null);
  const hovered = useRef(false);

  // Read once on mount. A visitor who already said no, or has seen it
  // MAX_VIEWS times, never arms the listener at all.
  useEffect(() => {
    try {
      const closedBefore = localStorage.getItem(STORAGE_KEY) === "1";
      const views = Number(localStorage.getItem(VIEWS_KEY) ?? "0");
      retired.current = closedBefore || views >= MAX_VIEWS;
    } catch {
      // Storage blocked (private mode): show it for this session rather than
      // silently never showing it. One ask is the failure mode we want here.
      retired.current = false;
    }
  }, []);

  const close = useCallback((permanent: boolean) => {
    setClosing(true);
    if (permanent) {
      try {
        localStorage.setItem(STORAGE_KEY, "1");
      } catch {
        /* nothing to persist to — it just reappears next visit */
      }
    }
    exitTimer.current = window.setTimeout(() => {
      setVisible(false);
      setClosing(false);
    }, EXIT_MS);
  }, []);

  useEffect(() => {
    const onCopied = () => {
      if (retired.current) return;
      // One ask per page life, however many things get copied.
      retired.current = true;
      try {
        const views = Number(localStorage.getItem(VIEWS_KEY) ?? "0");
        localStorage.setItem(VIEWS_KEY, String(views + 1));
      } catch {
        /* exposure just goes uncounted */
      }
      setVisible(true);
    };
    window.addEventListener(COPIED_EVENT, onCopied);
    return () => window.removeEventListener(COPIED_EVENT, onCopied);
  }, []);

  // Auto-dismiss, paused while the pointer is on it — the one case where the
  // visitor is plainly still reading.
  useEffect(() => {
    if (!visible || closing) return;
    const tick = () => {
      if (hovered.current) {
        dismissTimer.current = window.setTimeout(tick, 1000);
        return;
      }
      close(false);
    };
    dismissTimer.current = window.setTimeout(tick, AUTO_DISMISS_MS);
    return () => {
      if (dismissTimer.current !== null) clearTimeout(dismissTimer.current);
    };
  }, [visible, closing, close]);

  useEffect(
    () => () => {
      if (exitTimer.current !== null) clearTimeout(exitTimer.current);
      if (dismissTimer.current !== null) clearTimeout(dismissTimer.current);
    },
    [],
  );

  if (!visible) return null;

  return (
    <div
      role="status"
      onPointerEnter={() => {
        hovered.current = true;
      }}
      onPointerLeave={() => {
        hovered.current = false;
      }}
      // Bottom-left: the back-to-top button and McpPopup own the bottom-right
      // corner, and this must not stack on either.
      className={`ns-star-prompt fixed bottom-4 left-4 z-50 max-w-[22rem] rounded-md border border-border bg-surface p-3 shadow-lg transition-[opacity,transform] duration-200 motion-reduce:transition-none ${
        closing ? "translate-y-1 opacity-0" : "translate-y-0 opacity-100"
      }`}
    >
      <div className="flex items-start gap-3">
        <p className="text-[13px] leading-snug text-foreground">
          Copied. If this saved you time, a star helps other people find it.
        </p>
        <button
          type="button"
          onClick={() => close(true)}
          aria-label="Dismiss"
          className="-m-1 shrink-0 rounded-sm p-1 text-ns-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent motion-reduce:transition-none"
        >
          <svg
            viewBox="0 0 16 16"
            className="size-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>
      <a
        href={REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => close(true)}
        className="mt-2.5 inline-flex items-center gap-1.5 rounded-sm border border-border px-2.5 py-1.5 text-xs font-medium text-foreground outline-none transition-colors hover:border-ns-muted hover:bg-border/40 focus-visible:ring-2 focus-visible:ring-ns-accent motion-reduce:transition-none"
      >
        <svg
          viewBox="0 0 16 16"
          className="size-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z" />
        </svg>
        Star on GitHub
      </a>
    </div>
  );
}
