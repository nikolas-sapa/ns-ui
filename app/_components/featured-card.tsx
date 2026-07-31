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
 * It no longer runs that iframe at rest, because doing so was the entire cost
 * of the homepage. Measured, same build and machine, back to back: with the
 * featured iframes rendered the main thread blocked ~3.6s per 10s indefinitely
 * on an idle page; with them not rendered, 0ms — while each of these components
 * measures 0ms on its own at a full viewport. It was never the components. A
 * continuously repainting 1440x900 document being CSS-scaled to ~26% is
 * expensive to composite whatever is inside it, and each frame also
 * re-downloaded the Next runtime, React, the stylesheet and the fonts into its
 * own document.
 *
 * A still alone fixed the cost and broke the page: a rail of frozen thumbnails
 * reads as broken, and needing to move the cursor before anything happens is
 * worse than the problem it solved. So the resting state is a silent looping
 * recording (scripts/build-previews.ts). Video decode is GPU work that never
 * touches the main thread, so the card moves at rest and still measures 0ms.
 *
 * Three layers, cheapest first, each replacing the one under it:
 *   1. the still — the screenshot the quality gate already generates, so there
 *      is no second source of truth. Paints immediately and is the LCP element.
 *   2. the loop — fetched only once the card is near the viewport, faded in
 *      when it actually has frames, so there is no flash of empty video.
 *   3. the real component — mounted on pointer-enter or focus, for anyone who
 *      wants to confirm the card is not a marketing video. One-way on purpose:
 *      once a card is live it stays live, so moving the pointer away does not
 *      yank a running demo back to a recording.
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
  // demo back to a recording when the pointer leaves.
  const [hot, setHot] = useState(false);
  // Flipped on the video's own `playing` event rather than on mount, so the
  // still stays up until there is a real frame to show instead of cross-fading
  // to a black box on a slow connection.
  const [rolling, setRolling] = useState(false);
  // Which recording to fetch. Null until the client has read the theme: the
  // server cannot know it (the no-flash script sets `.dark` from localStorage
  // and the media query), and rendering both variants so CSS could hide one
  // would download two videos to show one. The still covers this gap — it is
  // theme-correct at first paint via a plain `dark:` class, with no JS.
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  // Reduced motion has to gate the *element*, not just its visibility. Hiding
  // the video in CSS still downloads it — measured: 4 files fetched for a
  // visitor who never sees a frame. Null until read on the client, same reason
  // as `theme`.
  const [calm, setCalm] = useState<boolean | null>(null);

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

  // Track `.dark` on <html> rather than the media query: the theme toggle sets
  // that class directly, so a visitor flipping themes gets the matching
  // recording without a reload. `rolling` resets so the still covers the swap
  // instead of showing one frame of the wrong palette.
  useEffect(() => {
    const read = () =>
      setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    read();
    const mo = new MutationObserver(() => {
      setRolling(false);
      read();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onCalm = () => setCalm(mq.matches);
    onCalm();
    mq.addEventListener("change", onCalm);

    return () => {
      mo.disconnect();
      mq.removeEventListener("change", onCalm);
    };
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
      // `group/focus` — same reasoning as preview-card.tsx: the title link's
      // own :focus-visible drives a ring on the box below, so a keyboard
      // visitor gets a ring around the whole card instead of just the text.
      className="group group/focus relative flex flex-col"
    >
      <div
        ref={boxRef}
        className="relative aspect-[16/10] w-full overflow-hidden rounded-md border border-border bg-surface transition-colors duration-200 group-hover:border-muted/60 group-has-[a:focus-visible]/focus:ring-2 group-has-[a:focus-visible]/focus:ring-accent group-has-[a:focus-visible]/focus:ring-offset-2 group-has-[a:focus-visible]/focus:ring-offset-background motion-reduce:transition-none"
      >
        {/* Flat, non-gradient hover wash — same as preview-card.tsx. Sits
            above the poster/video/iframe layers (explicit z-index), so it
            reads on all three regardless of which is currently showing. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10 rounded-md bg-foreground/0 transition-colors duration-200 group-hover:bg-foreground/[0.04] motion-reduce:transition-none"
        />
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
            {/* `inView` gates the fetch so a rail of 36 does not pull 36 files
                on load. `calm === false` keeps it out of the tree entirely for
                anyone who asked for less motion — the loop is decoration and
                the still says the same thing, so there is no reason to spend
                their bandwidth on it. `muted` + `playsInline` are what make
                autoplay legal on iOS and under Chrome's policy; without both it
                silently never starts. */}
            {inView && theme && calm === false ? (
              <video
                // Keyed so a theme flip swaps the source instead of leaving the
                // element holding a stale first frame.
                key={theme}
                src={`/previews/${entry.name}-${theme}.mp4`}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                tabIndex={-1}
                aria-hidden
                onPlaying={() => setRolling(true)}
                className="absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ease-out"
                style={{ opacity: rolling ? 1 : 0 }}
              />
            ) : null}
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
            {/* Same weight bump as preview-card.tsx, for the same reason —
                title and kind caption were reading at identical weight. */}
            <h3 className="truncate text-[15px] font-semibold tracking-tight">
              {/* `after:inset-0` stretches the hit area over the whole card —
                  same pattern as preview-card.tsx — so the entire featured
                  card is a real link to the playground, not just the title. */}
              <Link
                href={`/preview/${entry.name}/play`}
                // Same reasoning as preview-card.tsx: the playground is
                // prerendered and CDN-cached, so prefetching every card's is
                // spend without a payoff.
                prefetch={false}
                // Ring lives on the preview box above (see its
                // group-has-[a:focus-visible]/focus: classes), not here —
                // same reasoning as preview-card.tsx.
                className="rounded-sm outline-none after:absolute after:inset-0 after:rounded-md"
              >
                {entry.title}
              </Link>
            </h3>
            {/* Same caption as the grid cards — the name is a metaphor, this
                says what it is. See lib/kind.ts. */}
            {entry.kind ? (
              <span className="shrink-0 text-xs text-muted">{entry.kind}</span>
            ) : null}
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
