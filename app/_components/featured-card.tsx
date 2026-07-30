"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
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
 * A featured card is the honest reference page (`/preview/<name>`) run inside
 * an iframe — autoplaying and inert, a live thumbnail rather than something to
 * drive in place. Genuine interaction lives one click away at the playground
 * (`/preview/<name>/play`): the whole card is a real link there (same
 * stretched-hit-area pattern as `preview-card.tsx`), so middle-click,
 * cmd-click and copy-link all work.
 *
 * It now starts as a still and goes live when you point at it, because the
 * live-at-rest version was the entire cost of the homepage. Measured, same
 * build and machine, back to back: with the featured iframes rendered the main
 * thread blocks ~5-6s per 10s indefinitely on an idle page; with them not
 * rendered it measures 0ms — while each of these components measures 0ms on
 * its own at a full viewport. It is not the components. A continuously
 * repainting 1440x900 document being CSS-scaled to ~26% is expensive to
 * composite no matter what is inside it, and each frame also re-downloads the
 * Next runtime, React, the stylesheet and the fonts into its own document.
 *
 * `hot` is one-way on purpose: once a card has gone live it stays live, so
 * moving the pointer away does not yank the animation out from under you. The
 * still is the screenshot the quality gate already generates, so there is no
 * second source of truth to keep in sync.
 */
export function FeaturedCard({
  entry,
  installCommand,
  priority = false,
}: {
  entry: RegistryEntry;
  installCommand: string;
  /** True for the first row, whose posters are the page's LCP candidates. */
  priority?: boolean;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [inView, setInView] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [scale, setScale] = useState<number | null>(null);
  // Set once, never cleared — see the note above about not yanking a running
  // demo back to a still when the pointer leaves.
  const [hot, setHot] = useState(false);

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

  // The CDN-cacheable path form of `?embed=1&autoplay=1` — see the embed route.
  const src = `/preview/${entry.name}/embed`;

  return (
    <article
      // Pointer OR keyboard focus wakes the demo, so a keyboard visitor
      // reaching the card by tab gets what a mouse visitor gets.
      //
      // These live on the <article>, not on the preview box, because the title
      // link stretches an `after:inset-0` overlay across the whole card (so the
      // entire card is clickable). That overlay is a sibling of the box, not a
      // descendant, so it sits between the pointer and the box and `pointerenter`
      // — which does not bubble — never reached it. Measured: hovering produced
      // no iframe at all until the handler moved up here.
      onPointerEnter={() => setHot(true)}
      onFocusCapture={() => setHot(true)}
      className="group relative flex flex-col"
    >
      <div
        ref={boxRef}
        className="relative aspect-[16/10] w-full overflow-hidden rounded-md border border-border bg-surface transition-colors duration-200 group-hover:border-muted/40 motion-reduce:transition-none"
      >
        <div
          aria-hidden
          className="absolute inset-0 [background-image:radial-gradient(circle,var(--color-border)_1px,transparent_1px)] [background-size:16px_16px] motion-safe:animate-pulse"
          style={{ opacity: loaded ? 0 : 1 }}
        />
        {/* The still. Two files rather than one theme-aware source because the
            screenshots are per-theme already; `.dark` is on <html>, set by the
            pre-hydration script, so the right one is correct at first paint
            with no JS. Sized to the card, not the 1440px source — next/image
            re-encodes to AVIF/WebP at that width, which is what makes the
            ~120KB PNG on disk cost a fraction of that on the wire.
            `priority` on the first row only: these are the LCP candidates. */}
        {!hot ? (
          <>
            <Image
              src={`/posters/${entry.name}-light.png`}
              alt=""
              aria-hidden
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover dark:hidden"
              priority={priority}
            />
            <Image
              src={`/posters/${entry.name}-dark.png`}
              alt=""
              aria-hidden
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="hidden object-cover dark:block"
              priority={priority}
            />
          </>
        ) : null}
        {hot && inView && scale !== null ? (
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
                // Same reasoning as preview-card.tsx: the playground is
                // prerendered and CDN-cached, so prefetching every card's is
                // spend without a payoff.
                prefetch={false}
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
