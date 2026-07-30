"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CopyButton } from "./copy-button";
import cardFrames from "@/lib/card-frame.generated.json";
import { fitTo, parseCardFrame, type Fit } from "@/lib/card-frame";

export type RegistryEntry = {
  name: string;
  title: string;
  description: string;
  collection: string;
  /** True for the NEW_COUNT most recently added components — see app/page.tsx. */
  isNew: boolean;
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
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [scale, setScale] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [fit, setFit] = useState<Fit | null>(null);

  // Optional per-component framing hint (see lib/card-frame.ts). Absent for
  // all but a handful of components, and absent means "frame the whole
  // viewport", exactly as before.
  const frame = useMemo(
    () => parseCardFrame((cardFrames as Record<string, unknown>)[entry.name]),
    [entry.name],
  );

  const measure = useCallback(() => {
    const box = boxRef.current;
    if (!box) return;
    const w = box.clientWidth;
    if (!w) return;
    setScale(w / FRAME_W);
  }, []);

  /**
   * Re-derive the crop from the live preview document.
   *
   * The subject's box can only be read from inside the frame — it depends on
   * the demo's own layout, fonts and (for canvas components) first paint — so
   * this is measured, not declared. Same origin, so `contentDocument` is
   * readable; the try/catch is belt-and-braces for a frame torn down mid-read.
   * Anything that fails to resolve leaves `fit` null, which is the untouched
   * full-viewport framing. Framing is deliberately independent of autoplay and
   * of reduced motion: cropping is layout, not animation.
   */
  const refit = useCallback(() => {
    if (!frame) return;
    const box = boxRef.current;
    const el = frameRef.current;
    if (!box || !el) return;
    const cardW = box.clientWidth;
    const cardH = box.clientHeight;
    if (!cardW || !cardH) return;
    let next: Fit | null = null;
    try {
      const subject = el.contentDocument?.querySelector(frame.focus);
      if (subject) {
        next = fitTo(subject.getBoundingClientRect(), frame, cardW, cardH, FRAME_W, FRAME_H);
      }
    } catch {
      next = null;
    }
    setFit((prev) => (same(prev, next) ? prev : next));
  }, [frame]);

  useLayoutEffect(() => {
    measure();
    const box = boxRef.current;
    if (!box) return;
    // The frame is a fixed pixel size, so only the card's own width matters.
    const ro = new ResizeObserver(() => {
      measure();
      refit();
    });
    ro.observe(box);
    return () => ro.disconnect();
  }, [measure, refit]);

  // Unmounting removes the iframe, which tears its page down. Clearing
  // `loaded` means a card scrolled back into view shows the placeholder again
  // until its fresh frame has actually painted, rather than flashing blank.
  useEffect(() => {
    if (!active) {
      setLoaded(false);
      setFit(null);
    }
  }, [active]);

  // `onLoad` is a race: React attaches the handler after the element is in the
  // DOM, so an iframe whose document is already complete by then (warm cache,
  // instant dev response) fires `load` into nothing and the card stays at
  // opacity 0 — a blank stage. Poll the frame's own readyState for the first
  // few seconds as a floor. Same origin, so this is readable; the try/catch
  // covers a frame torn down mid-poll.
  useEffect(() => {
    if (!active || loaded) return;
    const id = window.setInterval(() => {
      try {
        if (frameRef.current?.contentDocument?.readyState === "complete") {
          // Fit in the same batch as the fade-in, so the frame's first visible
          // paint is already cropped rather than zooming in afterwards.
          refit();
          setLoaded(true);
        }
      } catch {
        /* frame gone */
      }
    }, 120);
    return () => window.clearInterval(id);
  }, [active, loaded, refit]);

  // `load` fires before webfonts settle and before a canvas/WebGL demo has
  // laid anything out, so the first measurement of the subject can be wrong or
  // absent. Re-measure a few times over the first couple of seconds; `same()`
  // makes the repeats free once the layout has stopped moving.
  useEffect(() => {
    if (!loaded || !frame) return;
    const timers = [0, 250, 800, 2000].map((ms) => window.setTimeout(refit, ms));
    return () => timers.forEach(window.clearTimeout);
  }, [loaded, frame, refit]);

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
      id={entry.name}
      data-name={entry.name}
      data-mounted={mounted ? "true" : "false"}
      data-loaded={loaded ? "true" : "false"}
      // Clears the sticky filter bar (catalog-controls.tsx) by its measured
      // height rather than a magic number — the bar's chip row wraps at
      // narrower widths and grows taller than any static value would assume.
      // The 6rem fallback matches today's static offset for the brief window
      // before the bar has measured itself (or if JS never runs).
      className="group relative flex scroll-mt-[calc(var(--filter-bar-h,6rem)+0.75rem)] flex-col"
    >
      {/* Aspect-locked from first paint, so the frame arriving shifts nothing. */}
      <div
        ref={boxRef}
        className="relative aspect-[16/10] w-full overflow-hidden rounded-md border border-border bg-surface transition-colors duration-200 group-hover:border-muted/40 motion-reduce:transition-none"
      >
        <Placeholder visible={!loaded} />
        {mounted ? (
          <iframe
            ref={frameRef}
            // `/embed` is `/preview/<name>?embed=1&autoplay=1` with both flags
            // baked into the path: the demo is inert, and the shared autoplay
            // driver runs so components that only wake on input (hover, press,
            // drag, scroll) demonstrate themselves instead of showing a still
            // frame. Components without an `autoplay` descriptor in their
            // meta.json are unaffected. The path form exists because reading
            // `searchParams` made the query form uncacheable — every card frame
            // was a function invocation. See the embed route for the detail.
            src={`/preview/${entry.name}/embed`}
            title={`${entry.title} preview`}
            loading="lazy"
            tabIndex={-1}
            // `inert` keeps the demo's own buttons/inputs out of the tab order —
            // pointer-events:none only blocks the mouse. Interaction belongs on
            // the full preview page.
            inert
            aria-hidden
            onLoad={() => {
              refit();
              setLoaded(true);
            }}
            className="pointer-events-none absolute left-0 top-0 origin-top-left border-0 bg-transparent transition-transform duration-200 ease-out motion-reduce:transition-none"
            style={{
              width: FRAME_W,
              height: FRAME_H,
              transform: fit
                ? `translate(${fit.tx}px, ${fit.ty}px) scale(${fit.scale})`
                : `scale(${scale ?? 0})`,
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

/** Sub-pixel-stable equality, so repeat measurements don't re-render. */
function same(a: Fit | null, b: Fit | null) {
  if (!a || !b) return a === b;
  return (
    Math.abs(a.scale - b.scale) < 0.0005 &&
    Math.abs(a.tx - b.tx) < 0.5 &&
    Math.abs(a.ty - b.ty) < 0.5
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
