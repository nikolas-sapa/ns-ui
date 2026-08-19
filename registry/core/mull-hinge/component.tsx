"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// MullHinge — a margin comment thread glued to its anchored phrase by a
// translucent SVG tissue strip (a bookbinder's hinge), whose geometry is a
// strain gauge on anchor health rather than decoration. The thread is a
// controlled component: the consumer's collab/document layer supplies
// `driftPx` (currentAnchorTop − anchorTopAtCreation, in px) and `orphaned`
// (true once the anchored text itself was deleted upstream) — this
// component owns only the physics and the rendering, never the measurement.
//
// PHYSICS: driftPx changes spring-animate (k=210 s^-2, zeta=0.9) rather than
// snapping, so a large upstream paste reads as the hinge being yanked, not
// as a teleport. From the *displayed* (spring) drift we derive shear angle
// = atan(drift / hingeLength), capped at ±38deg — past that angle the strip
// would visually slip off the card's edge and read as broken when the
// anchor is actually still perfectly attached, so both the quoted-text
// marker and the hinge's own geometry are driven off the SAME capped value.
// That's what keeps the hard constraint true: the hinge is glued at both
// endpoints at all times, it just refuses to *look* torn before it is.
// Tissue opacity falls 0.5 -> 0.25 with the same capped ratio (stretched
// tissue reads thinner). Past 120px of raw drift a Mend affordance fades
// in, letting the consumer accept the current position as the new baseline.
//
// ORPHAN: when `orphaned` flips true, the single tissue quad — always
// rendered as two SVG pieces sharing one precomputed jagged clip-path
// boundary, invisible at rest because the pieces sit flush — separates
// along that boundary over 300ms ease-out (a real CSS transform
// transition, not a re-layout), then the card-side piece gets one damped
// ~4deg sway (a second spring, k=70 zeta=0.32) around the point still
// glued to the card. The text-side remainder becomes a frayed, inert stub.
// Nothing is deleted from the DOM or reflows into a different shape —
// dangling is a genuine end state, not a leader line re-routing.
//
// Differs from margin-cite on purpose: that is static citation furniture
// that never claims to track anything. Here the connector is stateful and
// its whole job is to make broken attachment visible before you read a
// word — every other shipped margin-comment competitor asserts attachment
// and silently orphans instead.
//
// A11y: real <section> with a heading; the hinge SVG is aria-hidden and its
// meaning is duplicated as plain text via aria-describedby ('anchored to
// "…", drifted N paragraphs down' / 'original text deleted'); a real
// <textarea> and reply buttons carry the thread; Jump-to-anchor moves focus
// to the quoted-text marker and scrolls it into view; orphaned threads keep
// the last-known quote inline, never hide it. Reduced motion swaps every
// spring for an instant snap and drops the sway entirely.
//
// Pure DOM + inline SVG + CSS. Colors: --background, --foreground,
// --ns-muted, --border, --ns-accent only — --ns-accent appears solely on
// focus rings and the reply/mend affordances.
// ---------------------------------------------------------------------------

type Spring = { x: number; v: number; t: number };
function stepSpring(s: Spring, k: number, zeta: number, dt: number) {
  const c = 2 * zeta * Math.sqrt(k);
  s.v += (k * (s.t - s.x) - c * s.v) * dt;
  s.x += s.v * dt;
}
function settled(s: Spring, epsX = 0.05, epsV = 0.05) {
  return Math.abs(s.x - s.t) < epsX && Math.abs(s.v) < epsV;
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const DRIFT_K = 210; // s^-2
const DRIFT_ZETA = 0.9;
const SWAY_K = 70; // s^-2
const SWAY_ZETA = 0.32;
const ANGLE_CAP = (38 * Math.PI) / 180;
const MEND_THRESHOLD = 120; // px, raw (uncapped) drift
const TEAR_MS = 300;
const OPACITY_MAX = 0.5;
const OPACITY_MIN = 0.25;

// Hinge logical geometry, in SVG viewBox units (== px at hingeLength width).
const H = 40; // strip height
const CY = H / 2;
const HALF = 7; // glued-edge half-thickness
const STUB_LEN = 15; // px into the strip where the tear boundary sits

// Precomputed jagged tear boundary: (yFraction 0..1, x offset from STUB_LEN).
// Fixed once — this is the polyline the tear always splits along, never
// recomputed per drift or per orphan, matching a real physical tear.
const JAGGED: [number, number][] = [
  [0, 0],
  [0.22, -2.6],
  [0.45, 1.8],
  [0.68, -1.9],
  [0.86, 2.3],
  [1, 0],
];

function buildClipPaths(w: number) {
  const cutX = (dx: number) => STUB_LEN + dx;
  const down = JAGGED.map(([yFrac, dx]) => `${cutX(dx)},${yFrac * H}`);
  const up = [...JAGGED].reverse().map(([yFrac, dx]) => `${cutX(dx)},${yFrac * H}`);
  const left = `0,0 0,${H} ${down.join(" ")}`;
  const right = `${up.join(" ")} ${w},${H} ${w},0`;
  return { left, right };
}

export interface MullHingeComment {
  id: string;
  author: string;
  body: string;
  timestamp?: string;
}

export interface MullHingeProps {
  /** the exact phrase this thread is anchored to; shown as the margin marker and, if orphaned, the permanent last-known snapshot */
  anchorQuote: string;
  /** currentAnchorTop − anchorTopAtCreation, in px. Positive = the anchor moved down. Drives the hinge's shear/opacity via a spring. */
  driftPx: number;
  /** true once the anchored text has been deleted upstream — tears the hinge and leaves the card dangling from a frayed stub */
  orphaned?: boolean;
  /** thread heading, e.g. "3 comments" */
  title: string;
  comments: MullHingeComment[];
  /** fires with the trimmed reply body; the composer clears itself on submit */
  onReply?: (body: string) => void;
  /** re-anchor: accept the current drifted position as the new baseline. Shown once |driftPx| exceeds 120px. */
  onMend?: () => void;
  /** fires when Jump-to-anchor is activated, in addition to the built-in focus+scroll */
  onJumpToAnchor?: () => void;
  /** horizontal span the tissue strip covers, in px. @default 56 */
  hingeLength?: number;
  replyPlaceholder?: string;
  replyLabel?: string;
  jumpLabel?: string;
  mendLabel?: string;
  className?: string;
}

export function MullHinge({
  anchorQuote,
  driftPx,
  orphaned = false,
  title,
  comments,
  onReply,
  onMend,
  onJumpToAnchor,
  hingeLength = 56,
  replyPlaceholder = "Reply…",
  replyLabel = "Post reply",
  jumpLabel = "Jump to anchor",
  mendLabel = "Mend",
  className = "",
}: MullHingeProps) {
  const rawId = useId().replace(/:/g, "");
  const headingId = `${rawId}-h`;
  const describeId = `${rawId}-d`;
  const markerId = `${rawId}-m`;
  const clipLeftId = `${rawId}-cl`;
  const clipRightId = `${rawId}-cr`;

  const [displayDrift, setDisplayDrift] = useState(driftPx);
  const [torn, setTorn] = useState(orphaned);
  const [swayDeg, setSwayDeg] = useState(0);
  const [reply, setReply] = useState("");

  const springRef = useRef<Spring>({ x: driftPx, v: 0, t: driftPx });
  const rafRef = useRef<number | undefined>(undefined);
  const lastRef = useRef<number | null>(null);
  const reducedRef = useRef(false);
  const markerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    const onChange = () => {
      reducedRef.current = mq.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // drive the drift spring toward driftPx
  useEffect(() => {
    springRef.current.t = driftPx;
    if (reducedRef.current) {
      springRef.current.x = driftPx;
      springRef.current.v = 0;
      setDisplayDrift(driftPx);
      return;
    }
    if (rafRef.current != null) return; // loop already running; picks up the new target next tick
    const loop = (now: number) => {
      if (lastRef.current == null) lastRef.current = now;
      const dt = Math.min((now - lastRef.current) / 1000, 0.032);
      lastRef.current = now;
      stepSpring(springRef.current, DRIFT_K, DRIFT_ZETA, dt);
      setDisplayDrift(springRef.current.x);
      if (settled(springRef.current)) {
        rafRef.current = undefined;
        lastRef.current = null;
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [driftPx]);

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    },
    []
  );

  // tear sequencing: orphaned true -> split plays (CSS, TEAR_MS) -> one damped sway spring
  useEffect(() => {
    if (!orphaned) {
      setTorn(false);
      setSwayDeg(0);
      return;
    }
    setTorn(true);
    if (reducedRef.current) {
      setSwayDeg(0);
      return;
    }
    let raf = 0;
    const timer = window.setTimeout(() => {
      const s: Spring = { x: 4, v: 0, t: 0 };
      let last: number | null = null;
      const step = (now: number) => {
        if (last == null) last = now;
        const dt = Math.min((now - last) / 1000, 0.032);
        last = now;
        stepSpring(s, SWAY_K, SWAY_ZETA, dt);
        setSwayDeg(s.x);
        if (settled(s)) return;
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, TEAR_MS);
    return () => {
      window.clearTimeout(timer);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [orphaned]);

  const rawAngle = Math.atan2(displayDrift, hingeLength);
  const clampedAngle = clamp(rawAngle, -ANGLE_CAP, ANGLE_CAP);
  const visualOffset = hingeLength * Math.tan(clampedAngle);
  const normalized = clamp(Math.abs(clampedAngle) / ANGLE_CAP, 0, 1);
  const tissueOpacity = OPACITY_MAX - (OPACITY_MAX - OPACITY_MIN) * normalized;
  const mendVisible = !orphaned && Math.abs(displayDrift) > MEND_THRESHOLD;

  const { left: clipLeftPoints, right: clipRightPoints } = useMemo(
    () => buildClipPaths(hingeLength),
    [hingeLength]
  );

  const leftEdgeCenter = CY + visualOffset; // anchor/text side — moves with drift
  const rightEdgeCenter = CY; // card side — fixed, always glued
  const quadPoints = `0,${leftEdgeCenter - HALF} ${hingeLength},${rightEdgeCenter - HALF} ${hingeLength},${rightEdgeCenter + HALF} 0,${leftEdgeCenter + HALF}`;

  const describeText = orphaned
    ? "original text deleted"
    : (() => {
        const abs = Math.abs(Math.round(driftPx));
        if (abs < 8) return `anchored to "${anchorQuote}", holding steady`;
        const paragraphs = Math.max(1, Math.round(abs / 72));
        return `anchored to "${anchorQuote}", drifted ${paragraphs} paragraph${paragraphs === 1 ? "" : "s"} ${driftPx > 0 ? "down" : "up"}`;
      })();

  function submitReply() {
    const body = reply.trim();
    if (!body) return;
    onReply?.(body);
    setReply("");
  }

  function jumpToAnchor() {
    const el = markerRef.current;
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ block: "center", behavior: reducedRef.current ? "auto" : "smooth" });
    onJumpToAnchor?.();
  }

  function replyTo(author: string) {
    setReply((r) => (r ? r : `@${author} `));
    textareaRef.current?.focus();
  }

  return (
    <section
      aria-labelledby={headingId}
      aria-describedby={describeId}
      className={`ns-mullhinge relative flex items-start gap-0 text-foreground ${className}`}
    >
      <span id={describeId} className="sr-only">
        {describeText}
      </span>

      {/* anchor-side marker — the quoted phrase, translated by the SAME
          capped offset that drives the hinge, so it never visually detaches
          from the strip it's supposedly glued to */}
      <div
        ref={markerRef}
        id={markerId}
        tabIndex={-1}
        style={{ transform: `translateY(${visualOffset}px)` }}
        className="ns-mullhinge-marker max-w-[10rem] shrink-0 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs leading-snug text-ns-muted outline-none focus-visible:ring-2 focus-visible:ring-ns-accent"
      >
        <span className="line-clamp-3">&ldquo;{anchorQuote}&rdquo;</span>
      </div>

      {/* the hinge itself */}
      <svg
        aria-hidden="true"
        width={hingeLength}
        height={H + 16}
        viewBox={`0 -8 ${hingeLength} ${H + 16}`}
        className="ns-mullhinge-svg shrink-0 self-center"
      >
        <defs>
          <clipPath id={clipLeftId}>
            <polygon points={clipLeftPoints} />
          </clipPath>
          <clipPath id={clipRightId}>
            <polygon points={clipRightPoints} />
          </clipPath>
        </defs>

        {/* text-side stub — recedes and droops once torn */}
        <g
          className="ns-mullhinge-stub"
          style={{
            transformBox: "fill-box",
            transformOrigin: "0% 50%",
            transform: torn ? "translate(-5px, 3px) rotate(-9deg)" : "translate(0px, 0px) rotate(0deg)",
          }}
        >
          <polygon
            points={quadPoints}
            clipPath={`url(#${clipLeftId})`}
            fill="var(--foreground)"
            fillOpacity={torn ? 0.22 : tissueOpacity}
            stroke="var(--border)"
            strokeWidth={0.5}
          />
        </g>

        {/* card-side piece — separates, then swings from the card's fixed edge */}
        <g
          className="ns-mullhinge-dangler"
          style={{
            transformBox: "fill-box",
            transformOrigin: "100% 50%",
            transform: torn ? "translate(5px, 0px)" : "translate(0px, 0px)",
          }}
        >
          <g
            style={{
              transformBox: "fill-box",
              transformOrigin: "100% 50%",
              transform: `rotate(${torn ? swayDeg : 0}deg)`,
            }}
          >
            <polygon
              points={quadPoints}
              clipPath={`url(#${clipRightId})`}
              fill="var(--foreground)"
              fillOpacity={tissueOpacity}
              stroke="var(--border)"
              strokeWidth={0.5}
            />
          </g>
        </g>
      </svg>

      {/* the thread card */}
      <div className="ns-mullhinge-card min-w-0 flex-1 rounded-md border border-border bg-background">
        <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <h3 id={headingId} className="min-w-0 truncate text-sm font-medium">
            {title}
          </h3>
          <div className="flex shrink-0 items-center gap-1.5">
            {orphaned && (
              <span
                data-mullhinge-orphaned-badge=""
                className="rounded-sm border border-border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-ns-muted"
              >
                Orphaned
              </span>
            )}
            {mendVisible && (
              <button
                type="button"
                onClick={() => onMend?.()}
                data-mullhinge-mend=""
                className="rounded-sm px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-ns-accent outline-none transition-colors hover:bg-ns-accent/10 focus-visible:ring-2 focus-visible:ring-ns-accent"
              >
                {mendLabel}
              </button>
            )}
            <button
              type="button"
              onClick={jumpToAnchor}
              data-mullhinge-jump=""
              className="rounded-sm px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-ns-muted outline-none transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent"
            >
              {jumpLabel}
            </button>
          </div>
        </header>

        <ul className="flex flex-col gap-2.5 px-3 py-2.5">
          {orphaned && (
            <li className="rounded-sm border border-border bg-foreground/[0.03] px-2.5 py-2 text-xs leading-relaxed text-ns-muted">
              Last known quote: &ldquo;{anchorQuote}&rdquo;
            </li>
          )}
          {comments.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium">
                  {c.author}
                  {c.timestamp && <span className="ml-1.5 font-normal text-ns-muted">{c.timestamp}</span>}
                </p>
                <p className="mt-0.5 text-sm leading-relaxed">{c.body}</p>
              </div>
              <button
                type="button"
                onClick={() => replyTo(c.author)}
                aria-label={`Reply to ${c.author}`}
                className="shrink-0 rounded-sm px-1.5 py-1 font-mono text-[10px] uppercase tracking-wide text-ns-muted outline-none transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent"
              >
                Reply
              </button>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-1.5 border-t border-border px-3 py-2.5">
          <label htmlFor={`${rawId}-ta`} className="sr-only">
            Reply to {title}
          </label>
          <textarea
            ref={textareaRef}
            id={`${rawId}-ta`}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder={replyPlaceholder}
            rows={2}
            className="w-full resize-none rounded-sm border border-border bg-background px-2 py-1.5 text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ns-accent"
          />
          <button
            type="button"
            onClick={submitReply}
            disabled={!reply.trim()}
            data-mullhinge-post=""
            className="self-end rounded-sm border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-foreground outline-none transition-colors hover:bg-foreground/[0.06] focus-visible:ring-2 focus-visible:ring-ns-accent disabled:pointer-events-none disabled:opacity-40"
          >
            {replyLabel}
          </button>
        </div>
      </div>

      <style>{`
        .ns-mullhinge-marker {
          transition: transform 80ms linear;
        }
        .ns-mullhinge-stub,
        .ns-mullhinge-dangler {
          transition: transform ${TEAR_MS}ms ease-out;
        }
        @media (prefers-reduced-motion: reduce) {
          .ns-mullhinge-marker,
          .ns-mullhinge-stub,
          .ns-mullhinge-dangler {
            transition: none;
          }
        }
      `}</style>
    </section>
  );
}
