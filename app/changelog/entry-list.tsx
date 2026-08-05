"use client";

import { useCallback, useRef } from "react";
import type { ChangelogEntry } from "./entries";

/**
 * Each release as its own card, with a way to move to the entry above or
 * below it without hunting for it in the page. Newest first, same order the
 * page always rendered — this only adds rhythm and a second way to move
 * through it.
 */
export function ChangelogEntryList({ entries }: { entries: ChangelogEntry[] }) {
  const refs = useRef<(HTMLLIElement | null)[]>([]);

  const goTo = useCallback((index: number) => {
    const target = refs.current[index];
    if (!target) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    target.focus({ preventScroll: true });
  }, []);

  return (
    <ol className="mt-16 space-y-6">
      {entries.map((entry, i) => {
        const prev = i > 0 ? entries[i - 1] : null; // newer
        const next = i < entries.length - 1 ? entries[i + 1] : null; // older
        return (
          <li
            key={entry.version}
            id={entry.version}
            ref={(el) => {
              refs.current[i] = el;
            }}
            tabIndex={-1}
            onKeyDown={(e) => {
              if (e.key === "ArrowUp" && prev) {
                e.preventDefault();
                goTo(i - 1);
              } else if (e.key === "ArrowDown" && next) {
                e.preventDefault();
                goTo(i + 1);
              }
            }}
            className="scroll-mt-24 rounded-md border border-border bg-surface p-5 outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ns-accent sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="text-base font-medium tracking-tight">{entry.title}</h2>
                  <span className="font-mono text-xs text-ns-muted">{entry.version}</span>
                </div>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-ns-muted">
                  <time dateTime={entry.iso}>{entry.iso}</time>
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <NavArrow
                  disabled={!prev}
                  label={prev ? `Previous release: ${prev.version}` : "No newer release"}
                  onClick={() => prev && goTo(i - 1)}
                  direction="up"
                />
                <NavArrow
                  disabled={!next}
                  label={next ? `Next release: ${next.version}` : "No older release"}
                  onClick={() => next && goTo(i + 1)}
                  direction="down"
                />
              </div>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ns-muted">{entry.body}</p>
          </li>
        );
      })}
    </ol>
  );
}

function NavArrow({
  disabled,
  label,
  onClick,
  direction,
}: {
  disabled: boolean;
  label: string;
  onClick: () => void;
  direction: "up" | "down";
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-sm text-ns-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent motion-reduce:transition-none disabled:pointer-events-none disabled:opacity-30"
    >
      {/* Same hand-drawn chevron the Sort select and the sidebar's <details>
          use, rotated rather than redrawn — one icon language across the site. */}
      <svg
        viewBox="0 0 16 16"
        aria-hidden
        className={`size-3 ${direction === "up" ? "rotate-180" : ""}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 6l4 4 4-4" />
      </svg>
    </button>
  );
}
