"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { NavBlueNoiseScrim } from "./component";

const COMMANDS = [
  "Go to Dashboard",
  "Go to Deployments",
  "Go to Analytics",
  "Search repository",
  "Create new project",
  "Invite teammate",
  "Toggle dark theme",
  "Open settings",
];

// A minimal command-palette overlay so the scrim has a real job: dim the
// page behind it while the dialog's own opaque panel carries the readable
// content. Escape closes, Tab is trapped on the single input (the palette's
// only interactive control), and the trigger button regains focus on close.
export default function NavBlueNoiseScrimDemo() {
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? COMMANDS.filter((c) => c.toLowerCase().includes(q)) : COMMANDS;
  }, [query]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      {/* app chrome underneath, so the scrim is dimming real page content */}
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <p className="font-mono text-xs tracking-[0.25em] text-ns-muted">
          ns-ui / nav-blue-noise-scrim
        </p>
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="rounded-sm border border-border bg-surface px-3 py-1.5 font-mono text-xs text-ns-muted transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
        >
          Search ⌘K
        </button>
      </header>

      <main className="mx-auto max-w-3xl flex-1 px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Blue Noise Scrim
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-ns-muted">
          The dimmed backdrop behind the palette is a temporal blue-noise
          dither: a void-and-cluster point mask, reshuffled every frame, that
          reads as fine aperiodic shimmer instead of the visible crosshatch
          of an ordered/Bayer dither. Open the palette to see it behind the
          panel — the panel itself stays fully opaque, so the grain never
          touches the text on top of it.
        </p>
      </main>

      {open ? (
        <div
          className="absolute inset-0 z-10"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              close();
            } else if (e.key === "Tab") {
              // focus trap: the input is the palette's single tab stop
              e.preventDefault();
              inputRef.current?.focus();
            }
          }}
        >
          <NavBlueNoiseScrim className="absolute inset-0" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            className="absolute left-1/2 top-24 w-full max-w-md -translate-x-1/2 overflow-hidden rounded-md border border-border bg-surface shadow-lg"
          >
            <input
              ref={inputRef}
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-autocomplete="list"
              aria-label="Search commands"
              autoComplete="off"
              spellCheck={false}
              value={query}
              placeholder="Type a command…"
              onChange={(e) => setQuery(e.target.value)}
              className="w-full border-b border-border bg-transparent px-4 py-3 text-sm text-foreground outline-none placeholder:text-ns-muted"
            />
            <ul id={listId} role="listbox" aria-label="Commands" className="max-h-72 overflow-y-auto py-1">
              {results.length ? (
                results.map((c) => (
                  <li
                    key={c}
                    role="option"
                    aria-selected="false"
                    className="cursor-pointer px-4 py-2 text-sm text-ns-muted transition-colors hover:bg-background hover:text-foreground"
                  >
                    {c}
                  </li>
                ))
              ) : (
                <li className="px-4 py-6 text-center text-sm text-ns-muted">
                  No matching commands
                </li>
              )}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
