"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { CopyButton } from "./copy-button";
import type { RegistryEntry } from "./preview-card";

// Same fixed-viewport-then-scale approach as preview-card.tsx, and the same
// reason: demos are authored against a real viewport (vw/vh, `fixed`, media
// queries), so a real iframe viewport sized to FRAME_W×FRAME_H and then
// CSS-scaled down is the only way the card matches the direct link exactly.
const FRAME_W = 1440;
const FRAME_H = 900;

/** Mount this far before the card reaches the viewport. Featured is a short
 * rail (≤20 cards), so — unlike the catalog grid — nothing here is evicted
 * once mounted; there's no budget pressure worth the bookkeeping. */
const PRELOAD_MARGIN = 400;

/**
 * A featured card is the honest reference page (`/preview/<name>`) run
 * inside an iframe, exactly like a catalog card — but it starts in the same
 * autoplaying, inert state a catalog card would, and a deliberate click
 * promotes it to genuinely interactive.
 *
 * The click-to-activate gesture (rather than interactive-from-load) is what
 * keeps a mount-time `focus()` inside some future component from stealing
 * scroll from the host page: `inert` only lifts after the visitor has
 * already brought the frame on screen and asked for it, so there is nothing
 * for the browser to scroll into view. See `app/preview/[name]/page.tsx`.
 */
export function FeaturedCard({
  entry,
  installCommand,
}: {
  entry: RegistryEntry;
  installCommand: string;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [inView, setInView] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [live, setLive] = useState(false);
  const [scale, setScale] = useState<number | null>(null);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setInView(true);
      },
      { rootMargin: `${PRELOAD_MARGIN}px 0px ${PRELOAD_MARGIN}px 0px` },
    );
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => {
      const w = box.clientWidth;
      if (w) setScale(w / FRAME_W);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  const activate = useCallback(() => {
    setLive(true);
    // Reload with `interactive=1` rather than mutating the running document —
    // autoplay state (rAF loops, synthetic pointer state) doesn't stop
    // cleanly mid-flight, so a fresh non-inert mount is simpler than trying
    // to unwind it in place.
    setLoaded(false);
  }, []);

  const src = `/preview/${entry.name}?embed=1${
    live ? "&interactive=1" : "&autoplay=1"
  }`;

  return (
    <article className="group relative flex flex-col">
      <div
        ref={boxRef}
        className="relative aspect-[16/10] w-full overflow-hidden rounded-md border border-border bg-surface transition-colors duration-200 group-hover:border-muted/40 motion-reduce:transition-none"
      >
        <div
          aria-hidden
          className="absolute inset-0 [background-image:radial-gradient(circle,var(--color-border)_1px,transparent_1px)] [background-size:16px_16px] motion-safe:animate-pulse"
          style={{ opacity: loaded ? 0 : 1 }}
        />
        {inView && scale !== null ? (
          <iframe
            ref={frameRef}
            src={src}
            title={`${entry.title} preview`}
            loading="lazy"
            tabIndex={live ? 0 : -1}
            inert={!live}
            aria-hidden={!live}
            onLoad={() => setLoaded(true)}
            className={`absolute left-0 top-0 origin-top-left border-0 bg-transparent transition-opacity duration-300 ease-out motion-reduce:transition-none ${
              live ? "" : "pointer-events-none"
            }`}
            style={{
              width: FRAME_W,
              height: FRAME_H,
              transform: `scale(${scale})`,
              opacity: loaded ? 1 : 0,
            }}
          />
        ) : null}

        {!live ? (
          <button
            type="button"
            onClick={activate}
            className="absolute inset-0 flex items-end justify-start p-4 outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
            aria-label={`Interact with ${entry.title}`}
          >
            <span className="rounded-full border border-border bg-background/90 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-foreground opacity-0 backdrop-blur transition-opacity duration-200 motion-reduce:transition-none group-hover:opacity-100 group-focus-visible:opacity-100">
              Click to interact
            </span>
          </button>
        ) : null}

        {live ? (
          <span className="pointer-events-none absolute right-3 top-3 rounded-full border border-border bg-background/90 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted backdrop-blur">
            Live
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h3 className="truncate text-sm font-medium tracking-tight">
              <Link
                href={`/preview/${entry.name}`}
                className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
            {entry.description}
          </p>
        </div>
        <CopyButton
          value={installCommand}
          label={`Copy install command for ${entry.name}`}
        />
      </div>
    </article>
  );
}
