"use client";

import { useEffect, useRef, useState } from "react";
import { QuickKey, type QuickKeySection } from "./component";

// Rests OPEN: a closed cheat sheet is an empty page. The overlay is mounted
// before the trigger in DOM order so the verifier's "first visible interactive
// element" is a live shortcut row inside the panel, not the trigger sitting
// inert behind the backdrop. Escape or Close reopens after a beat so the card
// keeps demonstrating itself.
//
// The mock search field behind the panel is the point of the twist: while the
// overlay is up, pressing ⌘K flashes the keycap and the field below never
// focuses, because the component swallows the event in the capture phase.
const REOPEN_MS = 1400;

const SECTIONS: QuickKeySection[] = [
  {
    title: "General",
    items: [
      { keys: ["Mod", "K"], label: "Search" },
      { keys: ["Mod", "/"], label: "Toggle sidebar" },
      { keys: ["?"], label: "Shortcuts" },
    ],
  },
  {
    title: "Editing",
    items: [
      { keys: ["Mod", "B"], label: "Bold" },
      { keys: ["Mod", "Z"], label: "Undo" },
      { keys: ["Mod", "Shift", "Z"], label: "Redo" },
    ],
  },
  {
    title: "Navigation",
    items: [
      { keys: ["G", "then", "P"], label: "Go to project" },
      { keys: ["↑"], label: "Move selection up" },
      { keys: ["↓"], label: "Move selection down" },
      { keys: ["Enter"], label: "Open selection" },
      { keys: ["Esc"], label: "Dismiss" },
    ],
  },
];

export default function QuickKeyDemo() {
  const reopenRef = useRef(0);
  const [open, setOpen] = useState(true);

  useEffect(() => () => clearTimeout(reopenRef.current), []);

  const handleOpenChange = (next: boolean) => {
    clearTimeout(reopenRef.current);
    setOpen(next);
    if (!next) reopenRef.current = window.setTimeout(() => setOpen(true), REOPEN_MS);
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-between gap-10 px-8 py-24">
      <QuickKey sections={SECTIONS} open={open} onOpenChange={handleOpenChange} columns={2} />

      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / shortcuts-cheat-sheet — the sheet presses its own keys
      </p>

      <div className="flex w-full max-w-md flex-col gap-3">
        <label htmlFor="shortcuts-cheat-sheet-demo-search" className="text-xs text-ns-muted">
          This field is what ⌘K would normally focus
        </label>
        <input
          id="shortcuts-cheat-sheet-demo-search"
          type="text"
          placeholder="Search the workspace…"
          className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-ns-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
        />
      </div>
    </div>
  );
}
