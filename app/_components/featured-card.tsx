"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
 * inside an iframe, exactly like a catalog card — autoplaying and inert, a
 * live thumbnail rather than something to drive in place. Genuine
 * interaction lives one click away, at the dedicated playground page
 * (`/preview/<name>/play`): the whole card is a real link there (same
 * stretched-hit-area pattern as `preview-card.tsx`), so middle-click,
 * cmd-click and copy-link all work.
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

  const src = `/preview/${entry.name}?embed=1&autoplay=1`;

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
            tabIndex={-1}
            inert
            aria-hidden
            onLoad={() => setLoaded(true)}
            className="pointer-events-none absolute left-0 top-0 origin-top-left border-0 bg-transparent transition-opacity duration-300 ease-out motion-reduce:transition-none"
            style={{
              width: FRAME_W,
              height: FRAME_H,
              transform: `scale(${scale})`,
              opacity: loaded ? 1 : 0,
            }}
          />
        ) : null}
      </div>

      <div className="mt-3 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h3 className="truncate text-sm font-medium tracking-tight">
              {/* `after:inset-0` stretches the hit area over the whole card —
                  same pattern as preview-card.tsx — so the entire featured
                  card is a real link to the playground, not just the title. */}
              <Link
                href={`/preview/${entry.name}/play`}
                className="rounded-sm outline-none after:absolute after:inset-0 after:rounded-md focus-visible:ring-2 focus-visible:ring-accent"
              >
                {entry.title}
              </Link>
            </h3>
            {entry.isNew ? (
              <span className="shrink-0 rounded-sm border border-border px-1.5 py-px font-mono text-[10px] uppercase tracking-wider text-foreground">
                new
              </span>
            ) : null}
            {entry.collection === "loud" ? (
              <span className="shrink-0 rounded-sm border border-border px-1.5 py-px font-mono text-[10px] uppercase tracking-wider text-muted">
                loud
              </span>
            ) : null}
          </div>
          {/* Lifted above the title link's after:inset-0 overlay, same as
              preview-card.tsx, so this copy stays selectable. */}
          <p className="relative z-10 mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
            {entry.description}
          </p>
        </div>
        <CopyButton
          value={installCommand}
          label={`Copy install command for ${entry.name}`}
          className="relative z-20"
        />
      </div>
    </article>
  );
}
