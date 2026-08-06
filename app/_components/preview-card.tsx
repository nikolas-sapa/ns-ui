"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { CopyButton } from "./copy-button";
import { LivePreviewFrame } from "./live-preview-frame";
import { SaveButton } from "./save-button";

export type RegistryEntry = {
  name: string;
  title: string;
  description: string;
  collection: string;
  /** Plain-language "what is this" label — see lib/kind.ts. */
  kind: string | null;
  /** True for the NEW_COUNT most recently added components — see app/page.tsx. */
  isNew: boolean;
};

/**
 * Demos are authored against a real viewport (`min-h-screen`, `vw` units,
 * `position: fixed`, media queries). Emulating one with a scaled div does not
 * work: viewport units inside the demo resolve against the *browser* viewport,
 * not the div, so the card drifted from the direct link at every window shape
 * that was not exactly 16:10 (a 9vw headline overshot by 48% at 2560x1080).
 *
 * So each preview gets a real viewport instead — an iframe onto
 * `/preview/<name>`, the very page we are trying to match, sized to
 * {@link FRAME_W}x{@link FRAME_H} and CSS-scaled down into the card. An iframe
 * *is* a viewport, so `vw`/`vh`/`w-screen`/`fixed`/media queries resolve
 * exactly as they do on the direct link, at every window shape. `scale()` is a
 * paint-time effect on the parent and never reaches the frame's own layout.
 */
export function PreviewCard({
  entry,
  active,
  onScreen,
  registerRef,
  installCommand,
  saved,
  authenticated,
  savePending,
  onToggleSave,
}: {
  entry: RegistryEntry;
  active: boolean;
  /** True viewport visibility — see `LivePreviewFrame`'s `onScreen`. */
  onScreen: boolean;
  registerRef: (name: string, el: HTMLElement | null) => void;
  installCommand: string;
  saved: boolean;
  authenticated: boolean | null;
  savePending: boolean;
  onToggleSave: (name: string) => void;
}) {
  const setCardRef = useCallback(
    (el: HTMLElement | null) => {
      registerRef(entry.name, el);
    },
    [registerRef, entry.name],
  );

  const [previewState, setPreviewState] = useState({ mounted: false, loaded: false });

  return (
    <article
      ref={setCardRef}
      id={entry.name}
      data-name={entry.name}
      data-mounted={previewState.mounted ? "true" : "false"}
      data-loaded={previewState.loaded ? "true" : "false"}
      // Clears the sticky filter bar (catalog-controls.tsx) by its measured
      // height rather than a magic number — the bar's chip row wraps at
      // narrower widths and grows taller than any static value would assume.
      // The 6rem fallback matches today's static offset for the brief window
      // before the bar has measured itself (or if JS never runs).
      //
      // `group/focus` is separate from the plain `group` hover already in use
      // below — it's what lets the box div react to the title link's own
      // :focus-visible (see that div's `group-has-[a:focus-visible]/focus:`
      // classes). The whole card is one hit target (the title's
      // `after:inset-0` stretches over it), so a mouse hover already
      // highlights the full box; before this, Tab landed a focus ring on just
      // the title text — a small rectangle in the corner, not "this card is
      // focused" — which was the one control on the page where keyboard and
      // mouse affordances didn't match.
      className="group group/focus relative flex scroll-mt-[calc(var(--filter-bar-h,6rem)+0.75rem)] flex-col"
    >
      {/* Aspect-locked from first paint, so the frame arriving shifts nothing. */}
      <LivePreviewFrame
        name={entry.name}
        title={entry.title}
        active={active}
        onScreen={onScreen}
        onStateChange={setPreviewState}
        className="aspect-[16/10] w-full transition-colors duration-200 group-hover:border-ns-muted/60 group-has-[a:focus-visible]/focus:ring-2 group-has-[a:focus-visible]/focus:ring-ns-accent group-has-[a:focus-visible]/focus:ring-offset-2 group-has-[a:focus-visible]/focus:ring-offset-background motion-reduce:transition-none"
      >
        {/* A flat, non-gradient wash — the border brightening alone is easy
            to miss on a near-black full-bleed canvas/WebGL demo, which is
            most of this grid. No scale transform: the box holds a live
            iframe, and scaling it on hover would jitter whatever's running
            inside. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10 rounded-md bg-foreground/0 transition-colors duration-200 group-hover:bg-foreground/[0.04] motion-reduce:transition-none"
        />
        <div className="absolute right-3 top-3 z-20">
          <SaveButton
            name={entry.name}
            saved={saved}
            authenticated={authenticated}
            pending={savePending}
            onToggle={onToggleSave}
          />
        </div>
      </LivePreviewFrame>

      <div className="mt-3 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            {/* The title is the link; `after:inset-0` stretches its hit area
                over the whole card. The description below lifts itself back
                above that overlay so the copy stays selectable. Semibold and
                a notch larger than the kind caption beside it — at the old
                text-sm/font-medium both sat at the same visual weight, so
                the name (what the grid is meant to be scanned by) didn't
                read as the primary word on the card. */}
            <h3 className="truncate text-[15px] font-semibold tracking-tight">
              <Link
                href={`/components/${entry.name}`}
                // 222 cards, one link each. Next prefetches every link near the
                // viewport, so the default fired ~147 RSC requests on a single
                // homepage load (measured) for pages the visitor will open at
                // most one of. Still off now the target is the canonical
                // component page, which reads searchParams and so isn't served
                // straight from the prerender manifest.
                prefetch={false}
                // No focus ring here — it lives on the preview box above,
                // via `group-has-[a:focus-visible]/focus:`, so the ring
                // matches the card's actual hit area instead of just this
                // text. `outline-none` still suppresses the browser default.
                className="rounded-sm outline-none after:absolute after:inset-0 after:rounded-md"
              >
                {entry.title}
              </Link>
            </h3>
            {/* The names are metaphors on purpose; this is what stops a card
                from being a riddle. Muted and after the title, so it reads as
                a caption rather than competing with the name. */}
            {entry.kind ? (
              <span className="shrink-0 text-xs text-ns-muted">{entry.kind}</span>
            ) : null}
            {entry.isNew ? (
              <span className="shrink-0 rounded-sm border border-border px-1.5 py-px font-mono text-[10px] uppercase tracking-wider text-foreground">
                new
              </span>
            ) : null}
            {entry.collection === "loud" ? (
              <span className="shrink-0 rounded-sm border border-border px-1.5 py-px font-mono text-[10px] uppercase tracking-wider text-ns-muted">
                loud
              </span>
            ) : null}
          </div>
          <p className="relative z-10 mt-1 line-clamp-2 text-xs leading-relaxed text-ns-muted">
            {entry.description}
          </p>
        </div>
        <CopyButton
          value={installCommand}
          label={`Copy install command for ${entry.name}`}
          className="relative z-20 -mt-1"
        />
      </div>
    </article>
  );
}
