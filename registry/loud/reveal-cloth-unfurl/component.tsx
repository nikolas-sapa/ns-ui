"use client";

import { useEffect, useMemo, useRef } from "react";

// ---------------------------------------------------------------------------
// BoltUnfurl — a media reveal that unrolls an image like a bolt of cloth.
// The image is sliced into N vertical DOM strips (background-image +
// background-position/-size, the classic CSS sprite-slice technique — no
// canvas). Each strip hinges from its own left edge (transform-origin: left
// center) so a steep negative rotateY tucks it edge-on into a "still rolled"
// cylinder, while a rotateY of 0 lays it flat as part of the fully revealed
// image. One requestAnimationFrame loop tweens a single progress value
// 0 -> 1 and, every frame, writes each strip's transform/filter directly via
// refs (never React state) from that one shared progress: strips left of the
// roll cursor are flat, strips at the cursor fan out through the curl band,
// strips right of it stay pinned at max curl (visually collapsing into the
// thin rolled cylinder waiting its turn). A soft shadow band travels with the
// cursor, cast onto the already-flat part. After progress reaches 1, one
// staggered rotateX ripple crosses the strips (the settle wave) plus, being
// `loud`, a single diagonal sheen sweep.
//
// A real <img> with the caller's alt text sits underneath, full size, for
// accessibility and progressive enhancement; the strips (aria-hidden) are an
// opaque overlay that IS what's visually seen, matching the underlying image
// pixel-for-pixel once fully unrolled.
//
// The trigger is a counter, not a boolean: bump `trigger` (via an
// IntersectionObserver on first view, or a Replay button) and the component
// re-plays rolled -> unrolled from scratch every time the value changes,
// including re-triggering while already mid-animation.
// ---------------------------------------------------------------------------

export interface BoltUnfurlProps {
  /** the media source url */
  src: string;
  /** alt text for the media */
  alt: string;
  /** Bump to (re)play the unroll animation from rolled to unrolled. */
  trigger: number;
  /** Number of vertical strips. Default 24. */
  strips?: number;
  /** CSS aspect-ratio of the media box. Default "16/9". */
  aspectRatio?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

const DURATION_MS = 1300;
const CURL_BAND_FRAC = 0.16; // fraction of width over which strips fan out
const MAX_CURL_DEG = 86;
const SETTLE_MS = 260;
const SETTLE_STAGGER_MS = 14;

function easeOutExpo(t: number) {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export function BoltUnfurl({ src, alt, trigger, strips: stripsProp = 24, aspectRatio = "16 / 9", className = "" }: BoltUnfurlProps) {
  const strips = Math.max(2, stripsProp);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const stripRefs = useRef<(HTMLDivElement | null)[]>([]);
  const shadowRef = useRef<HTMLDivElement | null>(null);
  const stripsWrapRef = useRef<HTMLDivElement | null>(null);

  const reducedRef = useRef(false);
  const startRef = useRef<number | undefined>(undefined);
  const rafRef = useRef<number | undefined>(undefined);
  const lastTriggerRef = useRef<number>(-1);

  const indices = useMemo(() => Array.from({ length: strips }, (_, i) => i), [strips]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    const onChange = () => {
      reducedRef.current = mq.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const paint = (progress: number) => {
    const root = rootRef.current;
    if (!root) return;
    const width = root.clientWidth;
    const band = Math.max(24, width * CURL_BAND_FRAC);
    // Sweep past the right edge by one band so the last strip's curl band
    // fully clears by progress===1 — stopping exactly at `width` would leave
    // strips inside the final band permanently curled.
    const rollX = progress * (width + band);
    const stripWidth = width / strips;

    for (let i = 0; i < strips; i++) {
      const el = stripRefs.current[i];
      if (!el) continue;
      const cx = (i + 0.5) * stripWidth;
      const d = cx - rollX;
      let curl: number; // 0 = flat, 1 = fully curled into the roll
      if (d <= -band) curl = 0;
      else if (d >= band) curl = 1;
      else curl = (d + band) / (2 * band);
      const angle = -curl * MAX_CURL_DEG;
      const shade = 1 - curl * 0.45;
      // Curled strips also translate toward the roll cursor, converging
      // their centers there — without this they'd only rotate in place and
      // read as thin slivers spread across the whole width instead of a
      // bundled cylinder sitting at the roll's leading edge.
      const tx = (rollX - cx) * curl;
      el.style.transform = `translateX(${tx}px) rotateY(${angle}deg)`;
      el.style.filter = `brightness(${shade})`;
    }

    if (shadowRef.current) {
      shadowRef.current.style.transform = `translateX(${rollX - 26}px)`;
      shadowRef.current.style.opacity = progress > 0 && progress < 1 ? "1" : "0";
    }
  };

  const settle = () => {
    const wrap = stripsWrapRef.current;
    if (!wrap) return;
    wrap.classList.remove("ns-bolt-settling");
    wrap.classList.remove("ns-bolt-sheen");
    // force reflow so re-adding the class restarts the animation on replay
    void wrap.offsetWidth;
    for (let i = 0; i < strips; i++) {
      const el = stripRefs.current[i];
      if (!el) continue;
      el.style.animationDelay = `${i * SETTLE_STAGGER_MS}ms`;
    }
    wrap.classList.add("ns-bolt-settling");
    wrap.classList.add("ns-bolt-sheen");
  };

  useEffect(() => {
    if (trigger === lastTriggerRef.current) return;
    lastTriggerRef.current = trigger;
    if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);

    if (trigger <= 0) {
      paint(0);
      return;
    }

    if (reducedRef.current) {
      paint(1);
      const wrap = stripsWrapRef.current;
      if (wrap) {
        wrap.classList.remove("ns-bolt-fade");
        void wrap.offsetWidth;
        wrap.classList.add("ns-bolt-fade");
      }
      return;
    }

    startRef.current = undefined;
    const tick = (t: number) => {
      if (startRef.current === undefined) startRef.current = t;
      const elapsed = t - startRef.current;
      const raw = Math.min(1, elapsed / DURATION_MS);
      paint(easeOutExpo(raw));
      if (raw < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = undefined;
        settle();
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger, strips]);

  useEffect(() => {
    paint(trigger > 0 ? (reducedRef.current ? 1 : 0) : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={rootRef}
      className={`relative w-full overflow-hidden rounded-[12px] border border-border bg-background ${className}`}
      style={{ aspectRatio }}
    >
      <style>{CSS}</style>
      {/* opacity:0 (not display:none/visibility:hidden) keeps alt text in the
          accessibility tree while the opaque strips overlay does the only
          visible painting — without this the flat image shows straight
          through the gaps between curled-away strips before it's "unrolled". */}
      <img
        src={src}
        alt={alt}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ opacity: 0 }}
        draggable={false}
      />

      <div ref={stripsWrapRef} className="ns-bolt-strips absolute inset-0" aria-hidden="true" style={{ perspective: 900 }}>
        {indices.map((i) => (
          <div
            key={i}
            ref={(el) => {
              stripRefs.current[i] = el;
            }}
            className="ns-bolt-strip absolute inset-y-0"
            style={{
              left: `${(i / strips) * 100}%`,
              width: `${100 / strips}%`,
              backgroundImage: `url(${src})`,
              backgroundSize: `${strips * 100}% 100%`,
              backgroundPosition: `${(i / (strips - 1)) * 100}% 0%`,
              transformOrigin: "left center",
              transformStyle: "preserve-3d",
            }}
          />
        ))}
        <div ref={shadowRef} className="ns-bolt-shadow pointer-events-none absolute inset-y-0 left-0 w-6" style={{ opacity: 0 }} />
      </div>
    </div>
  );
}

const CSS = `
.ns-bolt-strip{will-change:transform,filter;backface-visibility:hidden;}
.ns-bolt-shadow{background:linear-gradient(to right, transparent, rgba(0,0,0,0.35));will-change:transform,opacity;transition:opacity 200ms ease-out;}
.ns-bolt-settling .ns-bolt-strip{animation:ns-bolt-settle-wave ${SETTLE_MS}ms ease-out backwards;}
@keyframes ns-bolt-settle-wave{0%{transform:rotateY(0deg) rotateX(-6deg);}100%{transform:rotateY(0deg) rotateX(0deg);}}
/* no position:relative here — the wrapper is already absolute (Tailwind), and
   an equal-specificity relative would win by source order and collapse the
   inset-0 wrapper to height 0, blanking every strip after the first settle. */
.ns-bolt-sheen::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(115deg, transparent 40%, rgba(255,255,255,0.16) 50%, transparent 60%);background-size:260% 100%;background-position:120% 0;animation:ns-bolt-sheen-sweep 700ms ease-out;}
@keyframes ns-bolt-sheen-sweep{from{background-position:120% 0;}to{background-position:-20% 0;}}
.ns-bolt-fade{animation:ns-bolt-fade-in 260ms ease-out;}
@keyframes ns-bolt-fade-in{from{opacity:0;}to{opacity:1;}}
@media (prefers-reduced-motion: reduce){
  .ns-bolt-strip{transition:none !important;animation:none !important;}
  .ns-bolt-sheen::after{animation:none;display:none;}
}
`;
