"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";

// ---------------------------------------------------------------------------
// FringeShift — visual diff by optical interference. Two versions of a
// screenshot are stacked with mix-blend-mode: difference; identical pixels
// go optically silent (near-black) and only differences survive the blend.
// A filter chain (grayscale -> brightness -> contrast -> a posterizing
// feComponentTransfer) amplifies those residuals into discrete monochrome
// contour bands, so even a 1px shift rings loudly. A native range input
// nudges the top layer by fractions of a pixel to compensate sub-pixel
// drift. This is coincidence detection, not a spatial split comparator —
// sameness costs zero attention, unlike a before/after slider or a 50%
// onion-skin, both of which make the reader search the whole frame.
//
// The blended field is decorative (aria-hidden): its job is to bloom at
// whatever differs, not to be read by a screen reader pixel-by-pixel. The
// accessible diff is a plain-text change list rendered alongside it, and
// clicking the field opens a "pixel loupe" dialog showing both sources at
// that point, each a real <img> with its own full alt text. No canvas —
// the whole effect is CSS blend + filter + one small SVG <filter> def.
// ---------------------------------------------------------------------------

export interface FringeShiftImage {
  /** image URL (or data URI) for this side of the comparison */
  src: string;
  /** full, standalone alt text — shown in the pixel loupe, never on the blended field */
  alt: string;
  /** short label, e.g. "Build A" / "Build B". Defaults to "Before" / "After" */
  label?: string;
}

export interface FringeShiftProps {
  before: FringeShiftImage;
  after: FringeShiftImage;
  /** width/height ratio of the compared frame. Default 1.6 (~16:10) */
  aspectRatio?: number;
  /** plain-text change list — the accessible diff. e.g. "Header moved 2px down" */
  changes?: string[];
  /** overall share of pixels that differ, e.g. 3.1 for "3.1% of pixels changed" */
  changedPercent?: number;
  /** posterize steps the residual resolves into. 2..12, default 5 */
  levels?: number;
  /** 0..1, how aggressively small residuals get amplified. Default 0.6 */
  sensitivity?: number;
  className?: string;
}

const ZOOM = 2.6; // loupe magnification

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

export function FringeShift({
  before,
  after,
  aspectRatio = 1.6,
  changes = [],
  changedPercent,
  levels = 5,
  sensitivity = 0.6,
  className = "",
}: FringeShiftProps) {
  const uid = useId();
  const filterId = `${uid}-posterize`;
  const titleId = `${uid}-loupe-title`;

  const [phase, setPhase] = useState(0);
  // loupe is opened, never toggled off, by its own trigger — only Escape,
  // the close button or an outside click ever set it back to false. That
  // keeps a repeated click on the trigger (autoplay's press pass, then a
  // verifier's own gate click) idempotent: however many times it fires,
  // the dialog ends up open, not flickered shut on an even hit count.
  const [loupeOpen, setLoupeOpen] = useState(false);
  const [point, setPoint] = useState({ x: 0.5, y: 0.5 });
  const [live, setLive] = useState("");

  const fieldRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const stepCount = Math.max(2, Math.min(12, Math.round(levels)));
  const tableValues = Array.from({ length: stepCount }, (_, i) =>
    (i / (stepCount - 1)).toFixed(3)
  ).join(" ");
  const clampedSensitivity = Math.min(1, Math.max(0, sensitivity));
  const brightness = 2 + clampedSensitivity * 5; // 2..7
  const contrastPct = 200 + clampedSensitivity * 500; // 200%..700%

  const openLoupe = (e: ReactMouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    // a keyboard-issued click carries e.detail === 0 and no useful client
    // coordinates — fall back to the frame's center rather than the loupe
    // opening pinned to the top-left corner.
    const fromPointer = e.detail !== 0 && rect.width > 0 && rect.height > 0;
    const x = fromPointer
      ? Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
      : 0.5;
    const y = fromPointer
      ? Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
      : 0.5;
    setPoint({ x, y });
    setLoupeOpen(true);
    setLive(
      `Pixel loupe opened at ${Math.round(x * 100)} percent across, ${Math.round(
        y * 100
      )} percent down.`
    );
  };

  const closeLoupe = () => {
    setLoupeOpen(false);
    setLive("Pixel loupe closed.");
    fieldRef.current?.focus();
  };

  // Escape closes from anywhere, and a minimal Tab trap keeps focus cycling
  // inside the dialog while it's open (its only two focusables today are
  // the close button and — once loupe content grows — the source links).
  useEffect(() => {
    if (!loupeOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeLoupe();
        return;
      }
      if (e.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;
      const focusables = root.querySelectorAll<HTMLElement>(
        'button, [href], input, [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loupeOpen]);

  // focus lands on the close button as soon as the dialog mounts, so Tab
  // immediately cycles inside it rather than continuing through the page.
  useEffect(() => {
    if (!loupeOpen) return;
    const id = requestAnimationFrame(() =>
      closeRef.current?.focus({ preventScroll: true })
    );
    return () => cancelAnimationFrame(id);
  }, [loupeOpen]);

  const loupeImgStyle: CSSProperties = {
    left: `${50 - point.x * 100 * ZOOM}%`,
    top: `${50 - point.y * 100 * ZOOM}%`,
    width: `${100 * ZOOM}%`,
    height: `${100 * ZOOM}%`,
  };

  return (
    <div
      className={`relative w-full rounded-[16px] border border-border bg-background p-5 ${className}`}
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ns-muted">
            Fringe diff
          </p>
          <h3 className="text-sm font-medium text-foreground">
            Optical interference comparator
          </h3>
        </div>
        <div className="flex items-center gap-2 text-xs text-ns-muted">
          <span className="font-mono uppercase tracking-[0.15em]">Phase</span>
          <input
            type="range"
            min={-2}
            max={2}
            step={0.02}
            value={phase}
            onChange={(e) => setPhase(Number(e.target.value))}
            aria-label="Sub-pixel phase offset of the after layer, in pixels"
            style={{ accentColor: "var(--ns-accent)" }}
            className="h-1 w-28 cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ns-accent"
          />
          <span className="w-14 text-right font-mono tabular-nums text-foreground">
            {phase.toFixed(2)}px
          </span>
        </div>
      </div>

      <button
        ref={fieldRef}
        type="button"
        aria-haspopup="dialog"
        aria-label="Open pixel loupe on the difference field"
        onClick={openLoupe}
        style={{ aspectRatio }}
        className="relative block w-full overflow-hidden rounded-[12px] border border-border bg-background transition-colors duration-150 hover:border-foreground/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
      >
        {/* decorative: the blended/posterized field is the visualization,
            not the accessible diff — see the change list + alt text below */}
        <div
          aria-hidden
          className="absolute inset-0 isolate"
          style={{
            filter: `grayscale(1) brightness(${brightness}) contrast(${contrastPct}%) url(#${filterId})`,
          }}
        >
          <img
            src={before.src}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <img
            src={after.src}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              mixBlendMode: "difference",
              transform: `translateX(${phase}px)`,
            }}
          />
        </div>
        <span className="pointer-events-none absolute bottom-2 right-2 rounded-full border border-border bg-background px-2 py-0.5 font-mono text-[10px] text-ns-muted">
          click to inspect
        </span>
      </button>

      {/* posterizing filter def — no visible geometry, just the discrete
          component transfer that turns the amplified residual into bands */}
      <svg width="0" height="0" className="absolute" aria-hidden focusable="false">
        <filter id={filterId} colorInterpolationFilters="sRGB">
          <feComponentTransfer>
            <feFuncR type="discrete" tableValues={tableValues} />
            <feFuncG type="discrete" tableValues={tableValues} />
            <feFuncB type="discrete" tableValues={tableValues} />
          </feComponentTransfer>
        </filter>
      </svg>

      <div className="mt-4 rounded-[12px] border border-border bg-background p-3">
        <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-ns-muted">
          Change list
        </p>
        {changes.length > 0 ? (
          <ul className="space-y-1 text-sm text-foreground">
            {changes.map((c, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden className="text-ns-muted">
                  —
                </span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ns-muted">No differences reported.</p>
        )}
        {typeof changedPercent === "number" && (
          <p className="mt-2 font-mono text-xs text-ns-muted">
            {changedPercent.toFixed(1)}% of pixels changed
          </p>
        )}
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {live}
      </p>

      {loupeOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4"
            onPointerDown={(e) => {
              if (e.target === e.currentTarget) closeLoupe();
            }}
          >
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="ns-fringe-shift-loupe-in w-full max-w-md rounded-[16px] border border-border bg-background p-4"
              style={{
                boxShadow:
                  "0 8px 30px color-mix(in srgb, var(--foreground) 15%, transparent)",
              }}
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 id={titleId} className="text-sm font-medium text-foreground">
                  Pixel loupe
                </h2>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={closeLoupe}
                  aria-label="Close pixel loupe"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-ns-muted transition-colors duration-150 hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
                >
                  <CloseIcon />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <figure className="m-0">
                  <div className="relative aspect-square overflow-hidden rounded-[6px] border border-border bg-background">
                    <img
                      src={before.src}
                      alt={before.alt}
                      className="absolute max-w-none object-cover"
                      style={loupeImgStyle}
                    />
                  </div>
                  <figcaption className="mt-1.5 text-center font-mono text-[10px] uppercase tracking-[0.15em] text-ns-muted">
                    {before.label ?? "Before"}
                  </figcaption>
                </figure>
                <figure className="m-0">
                  <div className="relative aspect-square overflow-hidden rounded-[6px] border border-border bg-background">
                    <img
                      src={after.src}
                      alt={after.alt}
                      className="absolute max-w-none object-cover"
                      style={loupeImgStyle}
                    />
                  </div>
                  <figcaption className="mt-1.5 text-center font-mono text-[10px] uppercase tracking-[0.15em] text-ns-muted">
                    {after.label ?? "After"}
                  </figcaption>
                </figure>
              </div>
            </div>
          </div>,
          document.body
        )}

      <style>{`
@keyframes ns-fringe-shift-loupe-in{from{opacity:0;transform:scale(0.97)}to{opacity:1;transform:scale(1)}}
.ns-fringe-shift-loupe-in{animation:ns-fringe-shift-loupe-in 150ms ease-out both}
@media (prefers-reduced-motion: reduce){
  .ns-fringe-shift-loupe-in{animation:none}
}
      `}</style>
    </div>
  );
}
