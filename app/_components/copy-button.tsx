"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Copy-to-clipboard control. Two shapes:
 *  - variant="icon"  small square button, used on each card
 *  - variant="inline" flush button inside the header install bar
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
  variant?: "icon" | "inline";
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
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
      try {
        await navigator.clipboard.writeText(value);
      } catch {
        return;
      }
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    },
    [value],
  );

  const base =
    "inline-flex shrink-0 items-center justify-center rounded-sm text-ns-muted " +
    "outline-none transition-colors motion-reduce:transition-none " +
    "hover:bg-border/60 hover:text-foreground  transition-colors" +
    "focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 " +
    "focus-visible:ring-offset-background";

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied" : label}
      title={copied ? "Copied" : label}
      className={`${base} ${
        variant === "icon" ? "size-7" : "size-8"
      } ${className}`}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
}

function CopyIcon() {
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

function CheckIcon() {
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
