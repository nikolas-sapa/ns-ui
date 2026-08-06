"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import cardFrames from "@/lib/card-frame.generated.json";
import { fitTo, parseCardFrame, type Fit } from "@/lib/card-frame";

/**
 * The preview's viewport, in CSS pixels. 16:10 so it drops into a card's
 * aspect box with no letterboxing.
 */
const FRAME_W = 1440;
const FRAME_H = 900;

/**
 * The live-preview iframe box, factored out of `preview-card.tsx` so the
 * homepage catalog and the saved library (`saved-library.tsx`) share one
 * implementation of "run the real demo in a real viewport and scale it into
 * a card" instead of drifting into two. See `preview-card.tsx`'s original
 * docblock for why this has to be a real iframe (`/preview/<name>/embed`)
 * rather than a scaled div: viewport units inside the demo only resolve
 * correctly against an actual viewport.
 *
 * Deliberately does not own the card's title row, save button or hover
 * chrome — those differ between call sites. This is just the box: aspect
 * ratio and rounding come from `className`, mount/eviction comes from
 * `active`.
 */
export function LivePreviewFrame({
  name,
  title,
  active,
  onScreen = true,
  className = "",
  children,
  onStateChange,
}: {
  name: string;
  title: string;
  active: boolean;
  /**
   * True when this card is inside the *true* viewport, as opposed to just
   * `active` (mounted — which includes the mount manager's preload margin
   * and its off-screen-nearest-first eviction backfill). A mounted card can
   * sit fully off-screen; this is what tells its iframe to actually pause
   * rather than keep animating unseen. See `use-mount-manager.ts`'s
   * `isOnScreen`. Defaults to `true` so callers that don't pass it (there
   * are none left, but it keeps this prop additive) never pause anything.
   */
  onScreen?: boolean;
  className?: string;
  children?: React.ReactNode;
  /** Reports mount/paint state up, for callers that surface it (e.g. the
   *  homepage grid's `data-mounted`/`data-loaded`, read by nothing today but
   *  cheap to keep honest). */
  onStateChange?: (state: { mounted: boolean; loaded: boolean }) => void;
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
    () => parseCardFrame((cardFrames as Record<string, unknown>)[name]),
    [name],
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

  const mounted = active && scale !== null;

  useEffect(() => {
    onStateChange?.({ mounted, loaded });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, loaded]);

  /**
   * Tells the embed document whether it is actually visible, so its
   * animation gate (`app/preview/[name]/embed/page.tsx`) can pause rAF work
   * a mounted-but-scrolled-past card would otherwise keep spending unseen.
   * Re-sent on `loaded` too — a fresh iframe document starts its own gate
   * assuming visible, and a preload-margin card can finish loading while
   * already off-screen.
   */
  useEffect(() => {
    if (!mounted || !loaded) return;
    const win = frameRef.current?.contentWindow;
    if (!win) return;
    try {
      win.postMessage({ source: "ns-ui-preview", visible: onScreen }, window.location.origin);
    } catch {
      /* frame gone */
    }
  }, [mounted, loaded, onScreen]);

  return (
    <div
      ref={boxRef}
      className={`relative overflow-hidden rounded-md border border-border bg-surface transition-colors duration-200 motion-reduce:transition-none ${className}`}
    >
      <Placeholder visible={!loaded} />
      {mounted ? (
        <iframe
          ref={frameRef}
          // `/embed` is `/preview/<name>?embed=1&autoplay=1` with both flags
          // baked into the path — see preview-card.tsx's docblock for why.
          src={`/preview/${name}/embed`}
          title={`${title} preview`}
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
          className="pointer-events-none absolute left-0 top-0 origin-top-left border-0 bg-transparent transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none"
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
      {children}
    </div>
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
      className="absolute inset-0 [background-image:radial-gradient(circle,var(--border)_1px,transparent_1px)] [background-size:16px_16px] motion-safe:animate-pulse"
      style={{ opacity: visible ? 1 : 0 }}
    />
  );
}
