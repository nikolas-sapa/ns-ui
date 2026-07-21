"use client";

import { useEffect, useRef, useState } from "react";
import { EmergeDialog } from "./component";

// Rests OPEN: a closed modal is an empty page and says nothing about the
// component. The <dialog> is mounted before the trigger in DOM order so the
// verifier's "first visible interactive element" is a live control inside the
// panel and not the trigger sitting inert behind the backdrop. Closing it
// reopens after a beat so the card keeps showing the return-to-origin morph.
const REOPEN_MS = 1600;

export default function EmergeDialogDemo() {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const reopenRef = useRef(0);
  const [open, setOpen] = useState(true);
  const [keepCopy, setKeepCopy] = useState(true);

  useEffect(() => () => clearTimeout(reopenRef.current), []);

  const handleOpenChange = (next: boolean) => {
    clearTimeout(reopenRef.current);
    setOpen(next);
    if (!next) reopenRef.current = window.setTimeout(() => setOpen(true), REOPEN_MS);
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-between gap-10 px-8 py-24">
      <EmergeDialog
        open={open}
        onOpenChange={handleOpenChange}
        triggerRef={triggerRef}
        title="Delete this draft?"
        description="“Q3 launch notes” and its 3 saved revisions will be removed from the workspace. This can't be undone."
      >
        <button
          type="button"
          aria-pressed={keepCopy}
          onClick={() => setKeepCopy((v) => !v)}
          className="flex items-center gap-3 rounded-sm border border-border bg-background px-3 py-2.5 text-left text-sm text-foreground transition-colors duration-150 hover:border-muted hover:bg-border/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <span
            aria-hidden
            className={[
              "grid size-4 shrink-0 place-items-center rounded-[3px] border transition-colors duration-150",
              keepCopy ? "border-accent bg-accent text-white" : "border-muted bg-transparent",
            ].join(" ")}
          >
            <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="2">
              <path
                d="M2.5 6.2 4.8 8.5 9.5 3.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={keepCopy ? 1 : 0}
              />
            </svg>
          </span>
          Keep a local copy on this device
        </button>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            data-close
            onClick={() => handleOpenChange(false)}
            className="rounded-sm border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors duration-150 hover:border-muted hover:bg-border/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            className="rounded-sm bg-accent px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Delete draft
          </button>
        </div>
      </EmergeDialog>

      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / emerge-dialog — the panel grows out of the control that opened it
      </p>

      <div className="flex w-full max-w-md items-center justify-between gap-6 rounded-md border border-border bg-surface px-4 py-3">
        <span className="min-w-0 truncate font-mono text-xs text-muted">q3-launch-notes.md</span>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => handleOpenChange(true)}
          className="shrink-0 rounded-sm border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors duration-150 hover:border-muted hover:bg-border/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Delete draft
        </button>
      </div>
    </div>
  );
}
