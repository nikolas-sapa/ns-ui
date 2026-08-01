"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// CarbonLift — a copy-to-clipboard button that shows WHAT it copied, not just
// that something happened. On click, a duplicate of the source text peels up
// off the source line and travels most of the real distance to the button's
// clipboard glyph over 720ms — the actual measured gap between source and
// icon, not a token nudge — fading and tightening its letter-spacing as it
// goes, arriving right as the glyph gives one small settle bounce, as if it
// just "caught" the duplicate. The label ticks Copy -> Copied in Geist Mono
// at the same moment. This is a duplicate rising UP and traveling with the
// real content as the moving element — distinct from a stamp pressing an
// impression DOWN.
//
// MECHANISM: on click, the visible source node and the button's icon are
// measured with getBoundingClientRect(); a clone span is absolutely
// positioned at the source's exact box (same font, --foreground) inside a
// shared relative container, then animated via a CSS custom property
// translate + opacity + letter-spacing over 720ms ease-out-expo: it holds
// near-full opacity through the first half of the flight so the two-line
// duplication actually registers, then fades over the second half as it
// nears the glyph. If the source is scrolled off-screen the measurement is
// skipped and the component falls back to a plain label swap — the same
// thing reduced motion always does.
//
// A11Y: a real <button> with an aria-label naming exactly what it copies.
// Success is announced through a visually-hidden aria-live=polite region
// ("Copied to clipboard"); the flying duplicate is aria-hidden and purely
// decorative — nothing here is conveyed only by animation. Enter/Space
// behave identically to a click (native button semantics, no custom key
// handling needed). The label + icon revert to the resting state after 2s.
//
// Tokens only: --foreground for ink and the ghost, --muted for secondary
// text, --border for the frame, --accent for the keyboard focus ring only.
// Pure DOM/SVG/CSS — no canvas.
// ---------------------------------------------------------------------------

const GHOST_MS = 720;
const BOUNCE_MS = 260;
// The glyph's settle bounce should land as the duplicate arrives, not
// partway through its flight — so its delay is derived from the flight
// duration rather than hardcoded against a different number.
const BOUNCE_DELAY_MS = Math.max(0, GHOST_MS - BOUNCE_MS - 40);
const REVERT_MS = 2000;
// Floor on how far the duplicate travels even if source and icon happen to
// sit right on top of each other; in practice the measured delta (usually
// 150-300px in the demo) dominates this.
const DRIFT_FLOOR_PX = 12;
const TRAVEL_FRACTION = 0.82;
const PEEL_PX = 8;
const GHOST_CHARS = 24;

export interface CarbonLiftProps {
  /** The full string that gets copied to the clipboard. Also what is displayed. */
  value: string;
  /**
   * Short description of what this copies, e.g. "API key" or "Invite link".
   * Used to build the button's accessible name: "Copy {description}".
   * Falls back to a truncated preview of `value` if omitted.
   */
  description?: string;
  /** Label shown at rest. @default "Copy" */
  copyLabel?: string;
  /** Label shown for 2s after a successful copy. @default "Copied" */
  copiedLabel?: string;
  className?: string;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

async function writeToClipboard(text: string) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    throw new Error("clipboard api unavailable");
  } catch {
    // Fallback for insecure/sandboxed contexts (e.g. embedded previews):
    // a temporary offscreen textarea + the legacy execCommand path.
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.top = "-1000px";
      ta.style.left = "-1000px";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    } catch {
      // Best-effort only — the UI still reflects the user's intent even if
      // every copy mechanism is unavailable in this environment.
    }
  }
}

type Ghost = {
  id: number;
  left: number;
  top: number;
  width: number;
  height: number;
  fontSize: string;
  fontFamily: string;
  tx: number;
  ty: number;
  text: string;
};

type Vars = React.CSSProperties & Record<`--${string}`, string | number>;

export function CarbonLift({
  value,
  description,
  copyLabel = "Copy",
  copiedLabel = "Copied",
  className = "",
}: CarbonLiftProps) {
  const reducedMotion = useReducedMotion();
  const [copied, setCopied] = useState(false);
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const [bounce, setBounce] = useState(0);
  const [live, setLive] = useState("");

  const containerRef = useRef<HTMLDivElement | null>(null);
  const sourceRef = useRef<HTMLElement | null>(null);
  const iconRef = useRef<HTMLSpanElement | null>(null);
  const ghostSeq = useRef(0);
  const revertTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  const ghostTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );

  useEffect(() => {
    return () => {
      window.clearTimeout(revertTimer.current);
      window.clearTimeout(ghostTimer.current);
    };
  }, []);

  const spawnGhost = useCallback(() => {
    const container = containerRef.current;
    const source = sourceRef.current;
    const icon = iconRef.current;
    if (!container || !source || !icon) return;

    const sourceRect = source.getBoundingClientRect();
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const onScreen =
      sourceRect.width > 0 &&
      sourceRect.height > 0 &&
      sourceRect.bottom > 0 &&
      sourceRect.top < vh &&
      sourceRect.right > 0 &&
      sourceRect.left < vw;
    if (!onScreen) return; // fallback: plain label swap only

    const containerRect = container.getBoundingClientRect();
    const iconRect = icon.getBoundingClientRect();

    const sourceCx = sourceRect.left + sourceRect.width / 2;
    const sourceCy = sourceRect.top + sourceRect.height / 2;
    const iconCx = iconRect.left + iconRect.width / 2;
    const iconCy = iconRect.top + iconRect.height / 2;

    const dx = iconCx - sourceCx;
    const dy = iconCy - sourceCy;
    const dist = Math.hypot(dx, dy) || 1;
    // Travel most of the real gap to the glyph, not a fixed token nudge —
    // otherwise a duplicate spawned 250px from its destination only ever
    // covers 12px of that distance and never visibly leaves the source.
    const travel = Math.max(dist * TRAVEL_FRACTION, DRIFT_FLOOR_PX);
    const tx = (dx / dist) * travel;
    // Peel "up" in addition to drifting toward the icon.
    const ty = (dy / dist) * travel - PEEL_PX;

    const style = window.getComputedStyle(source);
    const text =
      value.length > GHOST_CHARS ? `${value.slice(0, GHOST_CHARS)}…` : value;

    ghostSeq.current += 1;
    setGhost({
      id: ghostSeq.current,
      left: sourceRect.left - containerRect.left,
      top: sourceRect.top - containerRect.top,
      width: sourceRect.width,
      height: sourceRect.height,
      fontSize: style.fontSize,
      fontFamily: style.fontFamily,
      tx,
      ty,
      text,
    });

    window.clearTimeout(ghostTimer.current);
    ghostTimer.current = setTimeout(() => setGhost(null), GHOST_MS + 60);
  }, [value]);

  const handleCopy = useCallback(async () => {
    await writeToClipboard(value);

    setCopied(true);
    setBounce((b) => b + 1);
    setLive((prev) => (prev === "Copied to clipboard" ? "Copied to clipboard​" : "Copied to clipboard"));

    if (!reducedMotion) spawnGhost();

    window.clearTimeout(revertTimer.current);
    revertTimer.current = setTimeout(() => setCopied(false), REVERT_MS);
  }, [value, reducedMotion, spawnGhost]);

  const accessibleName = description
    ? `Copy ${description}`
    : `Copy ${value.length > GHOST_CHARS ? `${value.slice(0, GHOST_CHARS)}…` : value}`;

  return (
    <div ref={containerRef} className={`ns-cl-row ${className}`}>
      <code ref={sourceRef as React.RefObject<HTMLElement>} className="ns-cl-source">
        {value}
      </code>

      <button
        type="button"
        onClick={handleCopy}
        aria-label={accessibleName}
        data-state={copied ? "copied" : "idle"}
        className="ns-cl-button"
      >
        <span
          key={reducedMotion ? "static" : `icon-${bounce}`}
          ref={iconRef}
          className="ns-cl-icon"
          data-bounce={!reducedMotion && bounce > 0 ? true : undefined}
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 16 16"
            width="14"
            height="14"
            className="ns-cl-icon-glyph"
            data-visible={!copied || undefined}
          >
            <rect x="4.5" y="1.5" width="7" height="2.5" rx="0.6" fill="none" stroke="currentColor" strokeWidth="1.1" />
            <rect x="2.5" y="2.75" width="11" height="12" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.1" />
          </svg>
          <svg
            viewBox="0 0 16 16"
            width="14"
            height="14"
            className="ns-cl-icon-glyph ns-cl-icon-check"
            data-visible={copied || undefined}
          >
            <path
              d="M3.5 8.5 L6.5 11.5 L12.5 4.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>

        <span key={copied ? "copied" : "copy"} className="ns-cl-label">
          {copied ? copiedLabel : copyLabel}
        </span>
      </button>

      <span role="status" aria-live="polite" className="sr-only">
        {live}
      </span>

      {ghost && (
        <span
          key={ghost.id}
          aria-hidden="true"
          className="ns-cl-ghost"
          style={
            {
              left: `${ghost.left}px`,
              top: `${ghost.top}px`,
              width: `${ghost.width}px`,
              height: `${ghost.height}px`,
              fontSize: ghost.fontSize,
              fontFamily: ghost.fontFamily,
              "--cl-tx": `${ghost.tx}px`,
              "--cl-ty": `${ghost.ty}px`,
            } as Vars
          }
        >
          {ghost.text}
        </span>
      )}

      <style>{`
        .ns-cl-row {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          max-width: 100%;
        }
        .ns-cl-source {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 260px;
          font-family: var(--font-geist-mono, ui-monospace, monospace);
          font-size: 13px;
          color: var(--foreground);
          opacity: 0.85;
        }
        .ns-cl-button {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
          height: 30px;
          padding: 0 10px;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: transparent;
          color: var(--foreground);
          font-family: var(--font-geist-mono, ui-monospace, monospace);
          font-size: 12px;
          cursor: pointer;
          outline: none;
          transition: border-color 150ms ease, background 150ms ease;
        }
        .ns-cl-button:hover {
          border-color: color-mix(in oklab, var(--foreground) 30%, var(--border));
          background: color-mix(in oklab, var(--foreground) 4%, transparent);
        }
        .ns-cl-button:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }
        .ns-cl-button[data-state="copied"] {
          border-color: color-mix(in oklab, var(--foreground) 35%, var(--border));
        }

        .ns-cl-icon {
          position: relative;
          display: inline-grid;
          place-items: center;
          width: 14px;
          height: 14px;
        }
        .ns-cl-icon-glyph {
          grid-area: 1 / 1;
          opacity: 0;
          transition: opacity 150ms ease;
        }
        .ns-cl-icon-glyph[data-visible] {
          opacity: 1;
        }
        .ns-cl-icon-check {
          color: var(--foreground);
        }
        .ns-cl-icon[data-bounce] {
          animation: ns-cl-bounce ${BOUNCE_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
          animation-delay: ${BOUNCE_DELAY_MS}ms;
        }

        .ns-cl-label {
          display: inline-block;
          min-width: 3.6em;
          text-align: left;
          animation: ns-cl-tick 150ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .ns-cl-ghost {
          position: absolute;
          display: flex;
          align-items: center;
          overflow: hidden;
          white-space: nowrap;
          pointer-events: none;
          color: var(--foreground);
          opacity: 0.85;
          letter-spacing: 0;
          transform: translate(0, 0);
          animation: ns-cl-lift ${GHOST_MS}ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        /* Holds near-full opacity through the first half of the flight —
           the duplicate needs to visibly separate from the source before it
           starts fading, or the two overlapping copies read as one string
           that never moved. Fade and letter-spacing crimp happen entirely
           in the second half, timed to finish as it reaches the glyph. */
        @keyframes ns-cl-lift {
          0% {
            transform: translate(0, 0);
            opacity: 0.85;
            letter-spacing: 0em;
          }
          45% {
            opacity: 0.85;
          }
          100% {
            transform: translate(var(--cl-tx), var(--cl-ty));
            opacity: 0;
            letter-spacing: -0.03em;
          }
        }
        @keyframes ns-cl-bounce {
          0% { transform: scale(1); }
          55% { transform: scale(1.06); }
          100% { transform: scale(1); }
        }
        @keyframes ns-cl-tick {
          from { opacity: 0; transform: translateY(3px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .ns-cl-ghost { display: none; animation: none; }
          .ns-cl-icon[data-bounce] { animation: none; }
          .ns-cl-label { animation: none; }
          .ns-cl-button { transition: none; }
        }
      `}</style>
    </div>
  );
}
