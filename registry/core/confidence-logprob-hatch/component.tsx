"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

// ---------------------------------------------------------------------------
// PencilHedge — token-level model uncertainty rendered as pencil hesitation.
// A span the model was unsure about gets a 4px hand-hatched underline built
// from ONE shared SVG <pattern> per doubt bucket (sparse / medium /
// cross-hatch — a draftsman going over a line once, twice, or crossed), fed
// by a single generation's logprobs: no resampling, cheap enough for every
// message. The words themselves NEVER change weight, blur or opacity — that
// is the failure mode this design exists to avoid, unlike an ink-reveal
// treatment. Density is a shape channel (line count/angle), not a hue, so it
// reads under every theme and every color-vision deficiency.
//
// Hover or focus on a hatched span opens a small popover (12px / rounded-md)
// listing the runner-up tokens the model almost said as mono rows — "said
// 0.44", "almost 0.31" — each alternative a real button that rewrites the
// span in place with a short settle transition and clears its marks (a
// resolved token reads exactly like a confident one). The popover is a
// plain DOM child of the hatched span itself, not a portal: mouseenter/
// mouseleave don't fire crossing into a descendant, so moving the pointer
// from text down into the popover never flickers it shut, and Tab reaches
// its buttons in natural document order with no focus-stealing hacks.
//
// A11y: the hatched span is role="note" tabIndex=0 with an aria-label
// carrying the doubt — "low confidence: <text>" by default, expanded to
// name the alternatives with percentages when the caller opts a message
// into verbose mode, so default reading flow stays quiet. The popover is
// role="dialog" with an aria-label naming the token it's alternatives-for.
// Escape closes from anywhere (span or popover) and returns focus to the
// span, never trapping. Confident text is never wrapped at all — plain
// text, no role, no tabIndex, nothing to land on.
//
// Colors are the five registry tokens only (--background --foreground
// --muted --border --accent), read as CSS custom properties directly in
// SVG attributes — no canvas here, so no getComputedStyle dance is needed.
// prefers-reduced-motion drops the settle transition; the rewrite still
// happens instantly and is fully legible.
// ---------------------------------------------------------------------------

export type DoubtBucket = "sparse" | "medium" | "cross-hatch";

export type DoubtCandidate = {
  /** the alternative token's text */
  text: string;
  /** probability mass, 0..1 */
  prob: number;
};

export type DoubtToken = {
  /** stable id — used for React keys and internal open/resolved state */
  id: string;
  /** the token text as originally emitted */
  text: string;
  /** hatch density bucket. Omit entirely (use a plain string segment instead) for confident text. */
  bucket: DoubtBucket;
  /** probability of the token actually emitted, 0..1 */
  said: number;
  /** runner-up candidates, ideally sorted by descending prob */
  alternatives: DoubtCandidate[];
};

export type PencilHedgeSegment = string | DoubtToken;

export interface PencilHedgeProps {
  /** Prose as an ordered mix of plain strings (confident text, rendered verbatim) and DoubtToken objects (hatched spans). */
  segments: PencilHedgeSegment[];
  /** Appends a decorative, aria-hidden superscript dagger to the highest-doubt bucket. Default false. */
  daggerOnHighestDoubt?: boolean;
  /** Opts this passage into verbose screen-reader descriptions (names alternatives + percentages). Default false — the terse form. */
  verbose?: boolean;
  className?: string;
}

const SETTLE_MS = 220;
const CLOSE_GRACE_MS = 90;

function pct(prob: number): string {
  return `${Math.round(prob * 100)}%`;
}

function noteLabel(token: DoubtToken, verbose: boolean): string {
  if (!verbose || token.alternatives.length === 0) {
    return `Low confidence: ${token.text}`;
  }
  const alts = token.alternatives.map((a) => `${a.text} ${pct(a.prob)}`).join(", ");
  return `Low confidence: ${token.text}, alternatives ${alts}`;
}

function DoubtSpan({
  token,
  patternPrefix,
  daggerOnHighestDoubt,
  verbose,
  isOpen,
  onOpen,
  onClose,
  registerRef,
}: {
  token: DoubtToken;
  patternPrefix: string;
  daggerOnHighestDoubt: boolean;
  verbose: boolean;
  isOpen: boolean;
  onOpen: (id: string) => void;
  onClose: (id: string) => void;
  registerRef: (id: string, el: HTMLSpanElement | null) => void;
}) {
  const [displayText, setDisplayText] = useState(token.text);
  const [displayBucket, setDisplayBucket] = useState<DoubtBucket | null>(token.bucket);
  const [settling, setSettling] = useState(false);
  const [flipAbove, setFlipAbove] = useState(false);

  const spanRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLSpanElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uid = useId();
  const dialogId = `${uid}-ph-dialog`;

  useEffect(() => {
    registerRef(token.id, spanRef.current);
    return () => registerRef(token.id, null);
  }, [registerRef, token.id]);

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  // Measure once per open — flip above when there isn't ~130px of room
  // below the span, so the popover doesn't run off the bottom of a short
  // chat viewport.
  useLayoutEffect(() => {
    if (!isOpen || !spanRef.current) return;
    const rect = spanRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    setFlipAbove(spaceBelow < 150 && rect.top > 150);
  }, [isOpen]);

  const openNow = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    if (displayBucket === null) return; // resolved — no more popover
    onOpen(token.id);
  };
  const closeSoon = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => onClose(token.id), CLOSE_GRACE_MS);
  };

  const selectAlternative = (alt: DoubtCandidate) => {
    setDisplayText(alt.text);
    setDisplayBucket(null);
    setSettling(true);
    onClose(token.id);
    setTimeout(() => setSettling(false), SETTLE_MS);
    // Focus follows the rewrite so the reader never loses their place, but
    // the target is now a plain, non-tabbable node (tabIndex -1) — it's not
    // added back to the Tab sequence, matching "confident text carries no
    // marks" for keyboard users too.
    requestAnimationFrame(() => spanRef.current?.focus({ preventScroll: true }));
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLSpanElement>) => {
    if (e.key === "Escape" && isOpen) {
      e.preventDefault();
      onClose(token.id);
      spanRef.current?.focus({ preventScroll: true });
    }
  };

  const onBlur = (e: ReactFocusEvent<HTMLSpanElement>) => {
    const next = e.relatedTarget as Node | null;
    if (next && e.currentTarget.contains(next)) return;
    onClose(token.id);
  };

  if (displayBucket === null) {
    // Resolved (or was always confident, but confident tokens never reach
    // this component at all — see PencilHedge below). Plain text, no marks.
    return (
      <span ref={spanRef} tabIndex={-1} className={settling ? "ns-ph-settle" : undefined}>
        {displayText}
      </span>
    );
  }

  return (
    <span
      ref={spanRef}
      role="note"
      tabIndex={0}
      aria-label={noteLabel({ ...token, text: displayText }, verbose)}
      data-bucket={displayBucket}
      onMouseEnter={openNow}
      onMouseLeave={closeSoon}
      onFocus={openNow}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      onClick={openNow}
      className="ns-ph-span relative inline-block cursor-default rounded-sm text-[inherit] text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {displayText}
      {daggerOnHighestDoubt && displayBucket === "cross-hatch" && (
        <sup aria-hidden className="ml-0.5 select-none text-[0.7em] text-muted">
          †
        </sup>
      )}
      <svg
        aria-hidden
        focusable="false"
        className="pointer-events-none absolute inset-x-0 bottom-[-3px] h-1 w-full"
        viewBox="0 0 100 4"
        preserveAspectRatio="none"
      >
        <rect width="100" height="4" fill={`url(#${patternPrefix}-${displayBucket})`} />
      </svg>

      {isOpen && (
        <span
          ref={popoverRef}
          id={dialogId}
          role="dialog"
          aria-label={`Alternatives for "${token.text}"`}
          onMouseEnter={openNow}
          onMouseLeave={closeSoon}
          style={{ [flipAbove ? "bottom" : "top"]: "100%" }}
          className={[
            "ns-ph-pop absolute left-0 z-10 flex w-max min-w-[9.5rem] max-w-[15rem] flex-col gap-0.5 rounded-md border border-border bg-background p-1.5 font-mono text-xs shadow-lg",
            flipAbove ? "mb-1.5" : "mt-1.5",
          ].join(" ")}
        >
          <span className="flex items-baseline gap-2 px-1 py-0.5">
            <span className="w-12 shrink-0 text-[10px] uppercase tracking-wide text-muted">said</span>
            <span className="truncate text-foreground">{displayText}</span>
            <span className="ml-auto shrink-0 tabular-nums text-muted">{token.said.toFixed(2)}</span>
          </span>
          {token.alternatives.map((alt, i) => (
            <button
              key={`${alt.text}-${i}`}
              type="button"
              onClick={() => selectAlternative(alt)}
              className="flex w-full items-baseline gap-2 rounded-sm px-1 py-0.5 text-left transition-colors duration-150 ease-out hover:bg-foreground/[0.06] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
            >
              <span className="w-12 shrink-0 text-[10px] uppercase tracking-wide text-muted">
                {i === 0 ? "almost" : ""}
              </span>
              <span className="truncate text-foreground">{alt.text}</span>
              <span className="ml-auto shrink-0 tabular-nums text-muted">{alt.prob.toFixed(2)}</span>
            </button>
          ))}
        </span>
      )}
      <style>{`
.ns-ph-settle{animation:ns-ph-settle-kf ${SETTLE_MS}ms cubic-bezier(0.16,1,0.3,1)}
@keyframes ns-ph-settle-kf{0%{opacity:.45;transform:translateY(-1px) scale(.97)}100%{opacity:1;transform:none}}
.ns-ph-pop{animation:ns-ph-pop-kf 130ms cubic-bezier(0.16,1,0.3,1) both}
@keyframes ns-ph-pop-kf{from{opacity:0;transform:translateY(-2px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion: reduce){.ns-ph-settle,.ns-ph-pop{animation:none}}
`}</style>
    </span>
  );
}

export function PencilHedge({
  segments,
  daggerOnHighestDoubt = false,
  verbose = false,
  className = "",
}: PencilHedgeProps) {
  const uid = useId().replace(/:/g, "");
  const patternPrefix = `ph-${uid}`;
  const [openId, setOpenId] = useState<string | null>(null);
  const refs = useRef(new Map<string, HTMLSpanElement | null>());

  const registerRef = useMemo(
    () => (id: string, el: HTMLSpanElement | null) => {
      refs.current.set(id, el);
    },
    []
  );

  // Escape closes from anywhere — span has focus, popover has focus, or
  // neither (a pure hover-opened popover) — and returns focus to the
  // triggering span so a keyboard user is never dropped onto document.body.
  useEffect(() => {
    if (!openId) return;
    const id = openId;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setOpenId(null);
      refs.current.get(id)?.focus({ preventScroll: true });
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [openId]);

  return (
    <span className={`ns-confidence-logprob-hatch ${className}`}>
      {/* One shared <defs> per instance: three diagonal-stroke patterns,
          density escalating sparse -> medium -> cross-hatch, like a
          draftsman going over a line once, then again, then crossed. Every
          stroke is --muted so the hatching survives theme and color-vision
          deficiency as a shape channel, never a hue. */}
      <svg width="0" height="0" aria-hidden focusable="false">
        <defs>
          <pattern id={`${patternPrefix}-sparse`} patternUnits="userSpaceOnUse" width="14" height="4">
            <line x1="0" y1="4" x2="7" y2="0" stroke="var(--muted)" strokeWidth="1" />
          </pattern>
          <pattern id={`${patternPrefix}-medium`} patternUnits="userSpaceOnUse" width="7" height="4">
            <line x1="0" y1="4" x2="7" y2="0" stroke="var(--muted)" strokeWidth="1" />
          </pattern>
          <pattern id={`${patternPrefix}-cross-hatch`} patternUnits="userSpaceOnUse" width="5" height="4">
            <line x1="0" y1="4" x2="5" y2="0" stroke="var(--muted)" strokeWidth="1" />
            <line x1="0" y1="0" x2="5" y2="4" stroke="var(--muted)" strokeWidth="1" />
          </pattern>
        </defs>
      </svg>

      {segments.map((seg, i) =>
        typeof seg === "string" ? (
          <span key={i}>{seg}</span>
        ) : (
          <DoubtSpan
            key={seg.id}
            token={seg}
            patternPrefix={patternPrefix}
            daggerOnHighestDoubt={daggerOnHighestDoubt}
            verbose={verbose}
            isOpen={openId === seg.id}
            onOpen={setOpenId}
            onClose={(id) => setOpenId((cur) => (cur === id ? null : cur))}
            registerRef={registerRef}
          />
        )
      )}
    </span>
  );
}
