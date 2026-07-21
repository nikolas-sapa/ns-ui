"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { CopyButton } from "./copy-button";

export type RegistryEntry = {
  name: string;
  title: string;
  description: string;
  collection: string;
};

/**
 * The preview's viewport, in CSS pixels. 16:10 so it drops into the card's
 * aspect box with no letterboxing.
 */
const FRAME_W = 1440;
const FRAME_H = 900;

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
  registerRef,
  installCommand,
}: {
  entry: RegistryEntry;
  active: boolean;
  registerRef: (name: string, el: HTMLElement | null) => void;
  installCommand: string;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  const measure = useCallback(() => {
    const box = boxRef.current;
    if (!box) return;
    const w = box.clientWidth;
    if (!w) return;
    setScale(w / FRAME_W);
  }, []);

  useLayoutEffect(() => {
    measure();
    const box = boxRef.current;
    if (!box) return;
    // The frame is a fixed pixel size, so only the card's own width matters.
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, [measure]);

  // Unmounting removes the iframe, which tears its page down. Clearing
  // `loaded` means a card scrolled back into view shows the placeholder again
  // until its fresh frame has actually painted, rather than flashing blank.
  useEffect(() => {
    if (!active) setLoaded(false);
  }, [active]);

  const setCardRef = useCallback(
    (el: HTMLElement | null) => {
      registerRef(entry.name, el);
    },
    [registerRef, entry.name],
  );

  const mounted = active && scale !== null;

  return (
    <article
      ref={setCardRef}
      data-name={entry.name}
      data-mounted={mounted ? "true" : "false"}
      data-loaded={loaded ? "true" : "false"}
      className="group relative flex scroll-mt-24 flex-col"
    >
      {/* Aspect-locked from first paint, so the frame arriving shifts nothing. */}
      <div
        ref={boxRef}
        className="relative aspect-[16/10] w-full overflow-hidden rounded-md border border-border bg-surface transition-colors duration-200 group-hover:border-muted/40 motion-reduce:transition-none"
      >
        <Placeholder visible={!loaded} />
        {mounted ? (
          <iframe
            // `?embed=1` only makes the demo inert inside the frame — see the
            // preview route. The page it renders is otherwise identical.
            // `&autoplay=1` additionally runs the shared autoplay driver, so
            // components that only wake on input (hover, press, drag, scroll)
            // demonstrate themselves in the card instead of showing a still
            // frame. Components without an `autoplay` descriptor in their
            // meta.json are unaffected.
            src={`/preview/${entry.name}?embed=1&autoplay=1`}
            title={`${entry.title} preview`}
            loading="lazy"
            tabIndex={-1}
            // `inert` keeps the demo's own buttons/inputs out of the tab order —
            // pointer-events:none only blocks the mouse. Interaction belongs on
            // the full preview page.
            inert
            aria-hidden
            onLoad={() => setLoaded(true)}
            className="pointer-events-none absolute left-0 top-0 origin-top-left border-0 bg-transparent"
            style={{
              width: FRAME_W,
              height: FRAME_H,
              transform: `scale(${scale ?? 0})`,
              opacity: loaded ? 1 : 0,
            }}
          />
        ) : null}
      </div>

      <div className="mt-3 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            {/* The title is the link; `after:inset-0` stretches its hit area
                over the whole card. The description below lifts itself back
                above that overlay so the copy stays selectable. */}
            <h3 className="truncate text-sm font-medium tracking-tight">
              <Link
                href={`/preview/${entry.name}`}
                className="rounded-sm outline-none after:absolute after:inset-0 after:rounded-md focus-visible:ring-2 focus-visible:ring-accent"
              >
                {entry.title}
              </Link>
            </h3>
            {entry.collection === "loud" ? (
              <span className="shrink-0 rounded-sm border border-border px-1.5 py-px font-mono text-[10px] uppercase tracking-wider text-muted">
                loud
              </span>
            ) : null}
          </div>
          <p className="relative z-10 mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
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

/** Quiet empty stage: dot grid on surface. No text, no shimmer bar. */
function Placeholder({ visible }: { visible: boolean }) {
  return (
    <div
      aria-hidden
      className="absolute inset-0 [background-image:radial-gradient(circle,var(--color-border)_1px,transparent_1px)] [background-size:16px_16px] motion-safe:animate-pulse"
      style={{ opacity: visible ? 1 : 0 }}
    />
  );
}
