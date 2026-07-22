"use client";

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from "react";

// ---------------------------------------------------------------------------
// CrimpCopy — a copy-to-clipboard field where the confirmation happens inside
// the type itself, not in a toast bolted onto the corner of the screen.
//
// MECHANISM: the value renders as one span per character, each carrying a
// `--cc-delay` custom property. Activating copy computes an origin character
// index — the one nearest the pointer for a click, or index 0 for a keyboard
// activation (native <button> click events fire with `detail === 0` when
// triggered by Enter/Space, which is how the two are told apart without a
// separate keydown handler) — and every character's delay becomes its
// distance from that origin times ~18ms. A CSS keyframe animation
// (`letter-spacing: 0 -> -0.06em -> 0`, with a hair of positive overshoot on
// the way back out) then plays per character at its own delay, so the string
// visibly crimps shut in a wave from the touched point and springs back
// open — a wire getting a ferrule, not a flash of color. Characters remount
// (keyed by an incrementing run id) on every activation so the animation
// always plays from its start, repeat clicks included.
//
// Once the wave finishes sweeping outward, a small inline check (stroked in
// --foreground) scales into the icon slot with an ease-out-expo curve, holds
// for 1.2s, and fades back out to the idle copy glyph (--muted) — no toast,
// no green flash, no layout shift, because the icon slot is reserved space
// that never changes size.
//
// A11Y: the field is a real <button> whose accessible name is an explicit
// `aria-label` (default derived from `label`, never from `value`) — the
// character spans and both icons are aria-hidden, so a masked or unmasked
// value never leaks into the accessible name either way. A visually-hidden
// `aria-live="polite"` region announces "Copied" (cleared and reset each
// activation so repeat copies re-announce). `prefers-reduced-motion` drops
// the letter-spacing wave and icon transitions to near-instant but keeps the
// check appearing and holding — the confirmation still reads, it just isn't
// animated.
// ---------------------------------------------------------------------------

const DELAY_PER_CHAR_MS = 18;
const CRIMP_DURATION_MS = 420;
const HOLD_MS = 1200;
const MASK_CHAR = "•";

export interface CrimpCopyProps {
  /** The real value copied to the clipboard. */
  value: string;
  /** Optional caption above the field, e.g. "API key". Also seeds the default accessible name. */
  label?: string;
  /** Render the value as bullets instead of its characters. The real value still copies. */
  masked?: boolean;
  /** Overrides the copy button's accessible name entirely. Never derived from `value`. */
  ariaLabel?: string;
  onCopy?: (value: string) => void;
  className?: string;
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the execCommand fallback
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.opacity = "0";
    ta.style.pointerEvents = "none";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

type Phase = "idle" | "success";

export function CrimpCopy({ value, label, masked = false, ariaLabel, onCopy, className = "" }: CrimpCopyProps) {
  const charsRef = useRef<HTMLSpanElement>(null);
  const timersRef = useRef<number[]>([]);
  const announceId = useId();

  const [phase, setPhase] = useState<Phase>("idle");
  const [crimpRun, setCrimpRun] = useState(0);
  const [delays, setDelays] = useState<number[]>(() => value.split("").map(() => 0));
  const [announcement, setAnnouncement] = useState("");

  const chars = value.split("");

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const announce = useCallback((text: string) => {
    setAnnouncement("");
    window.requestAnimationFrame(() => setAnnouncement(text));
  }, []);

  const nearestIndex = useCallback(
    (clientX: number) => {
      const el = charsRef.current;
      if (!el || chars.length <= 1) return 0;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0) return 0;
      const ratio = clamp01((clientX - rect.left) / rect.width);
      return Math.round(ratio * (chars.length - 1));
    },
    [chars.length]
  );

  const activate = useCallback(
    async (originIndex: number) => {
      const ok = await copyToClipboard(value);
      clearTimers();

      if (!ok) {
        announce("Copy failed");
        return;
      }

      onCopy?.(value);
      announce("Copied");

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const nextDelays = chars.map((_, i) => (reduced ? 0 : Math.abs(i - originIndex) * DELAY_PER_CHAR_MS));
      setDelays(nextDelays);
      setCrimpRun((r) => r + 1);
      // reset immediately: a re-activation mid-hold hides the old check
      // before the new wave plays, rather than leaving it stuck on screen.
      setPhase("idle");

      const maxDelay = reduced ? 0 : Math.max(0, ...nextDelays);
      const waveEnd = reduced ? 0 : maxDelay + CRIMP_DURATION_MS;

      // the check only scales in once the wave has finished relaxing back —
      // sequential, not simultaneous, per the crimp-then-check timeline.
      const showAt = window.setTimeout(() => setPhase("success"), waveEnd);
      const hideAt = window.setTimeout(() => setPhase("idle"), waveEnd + HOLD_MS);
      timersRef.current.push(showAt, hideAt);
    },
    [announce, chars, clearTimers, onCopy, value]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const originIndex = e.detail === 0 ? 0 : nearestIndex(e.clientX);
      activate(originIndex).catch(() => {});
    },
    [activate, nearestIndex]
  );

  useEffect(() => clearTimers, [clearTimers]);

  const resolvedAriaLabel = ariaLabel ?? (label ? `Copy ${label}` : "Copy value");

  return (
    <div className={`ns-cc-wrap ${className}`}>
      {label && <span className="ns-cc-label">{label}</span>}
      <button type="button" className="ns-cc" aria-label={resolvedAriaLabel} onClick={handleClick}>
        <span className="ns-cc-chars" ref={charsRef} aria-hidden="true" key={crimpRun}>
          {chars.map((ch, i) => (
            <span
              key={i}
              className="ns-cc-char"
              data-crimp={crimpRun > 0 ? "" : undefined}
              style={{ "--cc-delay": `${delays[i] ?? 0}ms` } as CSSProperties}
            >
              {masked ? MASK_CHAR : ch === " " ? " " : ch}
            </span>
          ))}
        </span>

        <span className="ns-cc-icon" aria-hidden="true">
          <svg
            className="ns-cc-icon-copy"
            data-hidden={phase === "success" ? "" : undefined}
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
          >
            <rect x="4.5" y="4.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M2.5 9.5V2.5a1 1 0 0 1 1-1H9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <svg
            className="ns-cc-icon-check"
            data-visible={phase === "success" ? "" : undefined}
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
          >
            <path
              d="M2.5 7.3L5.4 10.5L11.5 3.8"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      <span id={announceId} className="ns-cc-sr" role="status" aria-live="polite">
        {announcement}
      </span>

      <style>{`
        .ns-cc-wrap {
          display: flex;
          flex-direction: column;
          gap: 6px;
          max-width: 26rem;
        }
        .ns-cc-label {
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .ns-cc-sr {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        .ns-cc {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          width: 100%;
          padding: 9px 12px;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: var(--surface);
          cursor: pointer;
          text-align: left;
          transition: border-color 140ms ease-out, background-color 140ms ease-out;
        }
        .ns-cc:hover {
          border-color: color-mix(in oklab, var(--foreground) 24%, var(--border));
          background: color-mix(in oklab, var(--foreground) 3%, var(--surface));
        }
        .ns-cc:active {
          background: color-mix(in oklab, var(--foreground) 6%, var(--surface));
        }
        .ns-cc:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }

        .ns-cc-chars {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          font-family: var(--font-mono, ui-monospace, monospace);
          font-size: 13px;
          color: var(--foreground);
        }
        .ns-cc-char {
          display: inline-block;
          letter-spacing: 0em;
          white-space: pre;
        }
        .ns-cc-char[data-crimp] {
          animation: ns-cc-crimp ${CRIMP_DURATION_MS}ms cubic-bezier(0.22, 0.9, 0.34, 1) both;
          animation-delay: var(--cc-delay, 0ms);
        }
        @keyframes ns-cc-crimp {
          0% { letter-spacing: 0em; }
          32% { letter-spacing: -0.06em; }
          60% { letter-spacing: -0.06em; }
          82% { letter-spacing: 0.01em; }
          100% { letter-spacing: 0em; }
        }

        .ns-cc-icon {
          position: relative;
          flex-shrink: 0;
          width: 14px;
          height: 14px;
        }
        .ns-cc-icon-copy,
        .ns-cc-icon-check {
          position: absolute;
          inset: 0;
        }
        .ns-cc-icon-copy {
          color: var(--muted);
          opacity: 1;
          transform: scale(1);
          transition: opacity 200ms ease-out, transform 200ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .ns-cc-icon-copy[data-hidden] {
          opacity: 0;
          transform: scale(0.55);
        }
        .ns-cc-icon-check {
          color: var(--foreground);
          opacity: 0;
          transform: scale(0.4);
          transition: opacity 260ms cubic-bezier(0.16, 1, 0.3, 1), transform 260ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .ns-cc-icon-check[data-visible] {
          opacity: 1;
          transform: scale(1);
        }

        @media (prefers-reduced-motion: reduce) {
          .ns-cc-char[data-crimp] {
            animation: none;
          }
          .ns-cc-icon-copy,
          .ns-cc-icon-check {
            transition-duration: 1ms;
          }
        }
      `}</style>
    </div>
  );
}
