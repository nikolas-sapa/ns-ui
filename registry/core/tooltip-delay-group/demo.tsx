"use client";

import { PenumbraTip, PenumbraTipGroup } from "./component";

// A formatting toolbar — the realistic home for a delay-group: five triggers
// share PenumbraTipGroup, so sweeping across them opens the first on the full
// delay and every sibling after it instantly, no re-animation. The help
// button on the right sits outside the group (its own standalone delay) and
// is pinned flush to the card's right edge with side="right" so, at ordinary
// preview widths, there's no room to its right and it flips to the left —
// the collision case, forced by real geometry rather than staged.

function LinkIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M6.4 9.6 9.6 6.4" strokeLinecap="round" />
      <path d="M7 4.6 8.2 3.4a2.2 2.2 0 0 1 3.1 3.1L10.1 7.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 11.4 7.8 12.6a2.2 2.2 0 0 1-3.1-3.1L5.9 8.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AlignLeftIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2.5 4h11" strokeLinecap="round" />
      <path d="M2.5 8h7" strokeLinecap="round" />
      <path d="M2.5 12h9.5" strokeLinecap="round" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 7.4v4" strokeLinecap="round" />
      <circle cx="8" cy="5.1" r="0.7" fill="currentColor" stroke="none" />
    </svg>
  );
}

const iconButtonClass =
  "flex size-8 items-center justify-center rounded-sm border border-transparent text-ns-muted transition-colors duration-150 hover:border-border hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent";

export default function PenumbraTipDemo() {
  return (
    <div className="mx-auto flex min-h-[420px] w-full max-w-2xl flex-col justify-center gap-6 p-8">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / tooltip-delay-group — traces out from the trigger, siblings hand off instantly
      </p>

      <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-surface p-3">
        {/* openDelay tuned down from the component's 500ms default so the
            landing-page autoplay sweep — which only dwells briefly over each
            button — reliably trips the first open and then shows the warm
            handoff across the rest of the row. */}
        <PenumbraTipGroup openDelay={220}>
          <div className="flex items-center gap-1">
            <PenumbraTip content="Bold — ⌘B">
              <button data-ptip-first type="button" aria-label="Bold" className={iconButtonClass}>
                <span className="text-sm font-semibold">B</span>
              </button>
            </PenumbraTip>
            <PenumbraTip content="Italic — ⌘I">
              <button type="button" aria-label="Italic" className={iconButtonClass}>
                <span className="text-sm italic">I</span>
              </button>
            </PenumbraTip>
            <PenumbraTip content="Underline — ⌘U">
              <button type="button" aria-label="Underline" className={iconButtonClass}>
                <span className="text-sm underline">U</span>
              </button>
            </PenumbraTip>
            <span aria-hidden className="mx-1 h-5 w-px bg-border" />
            <PenumbraTip content="Insert link — ⌘K">
              <button type="button" aria-label="Insert link" className={iconButtonClass}>
                <LinkIcon />
              </button>
            </PenumbraTip>
            <PenumbraTip content="Align left" side="bottom">
              <button type="button" aria-label="Align left" className={iconButtonClass}>
                <AlignLeftIcon />
              </button>
            </PenumbraTip>
          </div>
        </PenumbraTipGroup>

        <PenumbraTip content="Formatting applies to the selected paragraph only." side="right">
          <button type="button" aria-label="Formatting help" className={iconButtonClass}>
            <InfoIcon />
          </button>
        </PenumbraTip>
      </div>

      <div className="rounded-md border border-border bg-background p-4 text-sm leading-relaxed text-ns-muted">
        <p className="mb-2 text-foreground">Q3 launch notes</p>
        <p>
          Hover or tab through the toolbar above — the first tooltip waits out the open delay, but once
          it&apos;s open, every other trigger in the row answers instantly with no re-animation. The help
          button on the right is outside the group, so it always waits its own delay and always resolves
          on the left, where the room is.
        </p>
      </div>
    </div>
  );
}
