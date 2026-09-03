"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Copy-to-clipboard control. Three shapes:
 *  - variant="icon"   small square button, used on each card
 *  - variant="inline" flush button inside a code-block row (code to its
 *    left, block padding to its right, in a `gap-2` flex row)
 *  - variant="prose"  standalone corner button for a plain-text/prose block
 *    (description, build spec) that has no code-block padding to sit flush
 *    against — see the sizing note on `overlay` below
 * Feedback is a glyph swap, not a colour change (accent stays interaction-only).
 */
export function CopyButton({
  value,
  label,
  variant = "icon",
  className = "",
}: {
  value: string;
  label: string;
  variant?: "icon" | "inline" | "prose";
  className?: string;
}) {
  // "failed" is the third state: the write can be refused (permission denied,
  // no transient activation, an insecure origin where navigator.clipboard is
  // undefined). It used to `return` silently, so the click looked identical to
  // no click at all and the visitor had no way to know the command was not on
  // their clipboard.
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const copy = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      let next: "copied" | "failed" = "copied";
      try {
        await navigator.clipboard.writeText(value);
      } catch {
        next = "failed";
      }
      setState(next);
      if (timer.current) clearTimeout(timer.current);
      // The failure message has to be read, not glimpsed, so it holds longer
      // than the check glyph does.
      timer.current = setTimeout(() => setState("idle"), next === "copied" ? 1600 : 4000);
    },
    [value],
  );

  const copied = state === "copied";
  const failed = state === "failed";

  // The space before `focus-visible:ring-2` is load-bearing: without it the
  // concatenation produced `transition-colorsfocus-visible:ring-2`, so the
  // ring *width* class never existed while `outline-none` did — every copy
  // button on the site had no visible keyboard focus at all.
  const base =
    "relative inline-flex shrink-0 items-center justify-center rounded-sm text-ns-muted " +
    "outline-none motion-reduce:transition-none " +
    // `transition-colors` sits in the SAME literal as the hover colours it
    // animates, not on the line above. The hover-transition invariant in
    // scripts/test-source-invariants.ts reads one class-list literal at a
    // time, so a transition parked on an adjacent line reads to it as a hover
    // that snaps. That is also why the pre-image carried a second, duplicated
    // `transition-colors` here: it satisfied this gate, and the missing space
    // in front of it is what silently ate `focus-visible:ring-2`. One copy,
    // on the right line, with its trailing space.
    "transition-colors hover:bg-border/60 hover:text-foreground " +
    "focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 " +
    "focus-visible:ring-offset-background";

  // "icon" is the card corner (preview-card.tsx / featured-card.tsx): its
  // nearest interactive neighbor is the title block, guaranteed at least
  // 12px away by the row's own flex gap, so the ::after is capped at half
  // that on the left and left generous on the right (open space to the grid
  // gutter) — 28x28 -> ~40x40.
  //
  // "inline" (install/theming/connect/component-detail/not-found code
  // blocks): every call site wraps it in the same `flex ... gap-2 ...
  // pr-1.5` code-block shape, the code text to its left, block padding to
  // its right — so 4px left (half the 8px gap) and generous right/vertical
  // is safe everywhere it's actually used. Confirmed with the site-wide
  // audit's theft check, not just by reading the one shared class string.
  // "prose" sits alone at the corner of a paragraph block (description,
  // build spec) — no code-block padding to stay clear of on its right and no
  // fixed flex gap to halve on its left, just whitespace in every direction.
  // Generous on all four sides rather than capped against a neighbor that
  // isn't there — 32x32 -> ~56x56.
  const overlay =
    variant === "icon"
      ? "after:absolute after:-inset-x-[6px] after:-inset-y-[6px] after:content-['']"
      : variant === "prose"
        ? "after:absolute after:-inset-[12px] after:content-['']"
        : "after:absolute after:-inset-x-[4px] after:-inset-y-[6px] after:content-['']";

  const status = copied
    ? "Copied"
    : failed
      ? "Copy failed. Select the text and copy it manually"
      : label;

  return (
    <>
      <button
        type="button"
        onClick={copy}
        aria-label={status}
        title={status}
        className={`${base} ${
          variant === "icon" ? "size-7" : "size-8"
        } ${overlay} ${className}`}
      >
        {copied ? <CheckIcon /> : failed ? <AlertIcon /> : <CopyIcon />}
      </button>
      {/* Announced rather than only drawn: the glyph swap is the sighted
          feedback, this is the same message for a screen reader. Empty at
          rest, so nothing is announced until a click actually happens. */}
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied" : failed ? "Copy failed. Select the text and copy it manually." : ""}
      </span>
    </>
  );
}

// Exported so ask-ai.tsx's clipboard-fallback buttons can reuse the exact
// same copy/copied glyphs as a corner badge — one "this copies something"
// visual language across the site, not a second one invented for one file.
export function CopyIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="5.75" y="5.75" width="8.5" height="8.5" rx="1.5" />
      <path d="M10.25 3.25v-.5a1 1 0 0 0-1-1H2.75a1 1 0 0 0-1 1v6.5a1 1 0 0 0 1 1h.5" />
    </svg>
  );
}

/** Shown when the clipboard write was refused — same stroke language as the
 *  copy/check glyphs, no colour of its own (accent stays interaction-only). */
function AlertIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="8" cy="8" r="6" />
      <path d="M8 5v3.5M8 11h.01" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 8.5 6.25 12 13 4.5" />
    </svg>
  );
}
