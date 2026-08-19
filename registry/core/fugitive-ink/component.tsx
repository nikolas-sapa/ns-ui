"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

// ---------------------------------------------------------------------------
// FugitiveInk — a one-time secret panel (new API key, recovery code) that
// prints the value fully legible, then lets it decay like security ink
// instead of hiding it behind a modal you can close and lose. The
// never-again clause is enacted, not footnoted.
//
// MECHANISM: a single governing scalar `t` (0 -> 1 across `decayMs`, default
// 60s) is written once per tick as the CSS custom property `--fi-t` on the
// panel root and inherits to every character span — there is no per-char
// timer or choreography. Each middle character carries only a static
// `--fi-o` offset derived from a hash of its index (0..0.4 of the window),
// and a shared CSS formula turns (t, o) into that character's own local
// phase: `--fi-local = clamp01((t - o) * 1.667)`, scaled so the
// latest-offset character still reaches 1 exactly when t reaches 1. That
// local phase crosses three thresholds, same formula for every character,
// just at different absolute moments: font-weight 600 -> 300 (phase
// 0 -> 0.35), color --foreground -> --ns-muted via color-mix (phase
// 0.3 -> 0.65), then a clip-path eating the glyph from its waterline
// (bottom) up, leaving a top hairline (phase 0.55 -> 1, up to 88% eaten).
// The prefix and last four characters never enter this system at all — they
// render as plain, permanently full-weight text — so the string decays into
// a stub that is exactly what a returning user needs to recognize the key
// by, not gibberish.
//
// Arming: the clock is idle (t pinned at 0, secret fully legible) until the
// user's own Copy click *or* focus leaving the panel entirely (a real
// `blur`/`focusout` past the panel boundary), whichever happens first — a
// one-way latch, not a toggle. A thin rule under the secret drains on the
// same `--fi-t` scalar (`scaleX(1 - t)`) and is labelled with the real
// integer seconds remaining, recomputed from wall-clock elapsed time so it
// can't drift from what's announced. Clipboard and pixels expire together:
// the Copy button copies the full value for as long as t < 1, and once t
// reaches 1 it copies only the identifying stub (`prefix…suffix`) forever
// after — never the full value again, but never a dead button either. A
// permanent record line under the field (`sk-live-…4f2q, copied 14:32, will
// not be shown again`) survives decay unchanged; nothing here is a modal
// that closes and takes the record with it.
//
// A11Y: the secret sits in a real `role="textbox" aria-readonly` element,
// keyboard-focusable and text-selectable, never conveying the live value
// through color or clip alone — the character text itself never changes.
// The Copy button's accessible name is explicit ("Copy secret key, shown
// only once", swapping to name the stub once expired). Arming announces
// assertively (a visually-hidden `role="alert"`); crossing half and zero
// announce politely (`aria-live="polite"`) and never claim a state the
// pixels haven't reached yet, since both read off the same `t`.
// `prefers-reduced-motion` doesn't disable the decay, it quantizes the same
// `--fi-t` scalar to the same three moments (0, half, expired) instead of a
// continuous ramp, so the CSS thresholds above collapse to three discrete
// text states rather than a smooth animation.
// ---------------------------------------------------------------------------

const DEFAULT_DECAY_MS = 60_000;
const TICK_MS = 100;
const OFFSET_MAX = 0.4; // fraction of the window a character's local clock can lag by
const LOCAL_SCALE = 1 / (1 - OFFSET_MAX); // reciprocal: max-offset char still reaches local=1 at t=1
const WEIGHT_RECIP = 1 / 0.35; // local phase 0 -> 0.35 covers the font-weight step
const COLOR_START = 0.3;
const COLOR_RECIP = 1 / 0.35; // local phase 0.3 -> 0.65 covers the color step
const CLIP_START = 0.55;
const CLIP_RECIP = 1 / 0.45; // local phase 0.55 -> 1 covers the clip-path step
const CLIP_MAX_PCT = 88; // never fully to 100 — a hairline survives, it doesn't vanish

function hashOffset(index: number): number {
  const h = Math.imul(index + 1, 2654435761) >>> 0;
  return ((h % 1000) / 1000) * OFFSET_MAX;
}

function formatClock(d: Date): string {
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

function secondsLeft(msLeft: number): number {
  return Math.max(0, Math.ceil(msLeft / 1000));
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

type Phase = "idle" | "armed" | "expired";

export interface FugitiveInkProps {
  /** The real secret — full API key, recovery code, etc. Shown once, in full. */
  value: string;
  /** Caption above the field, e.g. "New API key". Also seeds accessible names. */
  label?: string;
  /** Characters at the start that never decay (the identifying prefix, e.g. "sk-live-"). */
  prefixLen?: number;
  /** Characters at the end that never decay. */
  suffixLen?: number;
  /** Full decay window in ms, idle -> fully faded. Default 60000 (60s). */
  decayMs?: number;
  /** Overrides the record line's timestamp text instead of the real clock at arm time. */
  copiedAtOverride?: string;
  /** Called on every successful copy with what was actually copied and which kind. */
  onCopy?: (copied: string, kind: "full" | "stub") => void;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function FugitiveInk({
  value,
  label = "New API key",
  prefixLen = 8,
  suffixLen = 4,
  decayMs = DEFAULT_DECAY_MS,
  copiedAtOverride,
  onCopy,
  className = "",
}: FugitiveInkProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const armedAtRef = useRef<number | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const reducedRef = useRef(false);
  const halfFiredRef = useRef(false);

  const [phase, setPhase] = useState<Phase>("idle");
  const [remainingSec, setRemainingSec] = useState(() => Math.round(decayMs / 1000));
  const [recordVerb, setRecordVerb] = useState<"copied" | "shown">("copied");
  const [recordAt, setRecordAt] = useState<string | null>(null);
  const [politeMsg, setPoliteMsg] = useState("");
  const [assertiveMsg, setAssertiveMsg] = useState("");

  const totalSec = Math.round(decayMs / 1000);

  const safePrefixLen = Math.min(prefixLen, Math.max(0, value.length - suffixLen));
  const safeSuffixLen = Math.min(suffixLen, Math.max(0, value.length - safePrefixLen));
  const prefix = value.slice(0, safePrefixLen);
  const suffix = safeSuffixLen > 0 ? value.slice(value.length - safeSuffixLen) : "";
  const middle = value.slice(safePrefixLen, value.length - safeSuffixLen);
  const stub = `${prefix}…${suffix}`;

  const offsets = useMemo(() => middle.split("").map((_, i) => hashOffset(i)), [middle]);

  const announcePolite = useCallback((text: string) => {
    setPoliteMsg("");
    window.requestAnimationFrame(() => setPoliteMsg(text));
  }, []);
  const announceAssertive = useCallback((text: string) => {
    setAssertiveMsg("");
    window.requestAnimationFrame(() => setAssertiveMsg(text));
  }, []);

  const stopClock = useCallback(() => {
    if (timerRef.current !== undefined) {
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);

  const writeT = useCallback((t: number) => {
    const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
    const snapped = reducedRef.current ? (clamped >= 1 ? 1 : clamped >= 0.5 ? 0.5 : 0) : clamped;
    panelRef.current?.style.setProperty("--fi-t", snapped.toFixed(4));
  }, []);

  const tick = useCallback(() => {
    const armedAt = armedAtRef.current;
    if (armedAt == null) return;
    const elapsed = performance.now() - armedAt;
    const t = Math.min(1, elapsed / decayMs);
    writeT(t);

    setRemainingSec((prev) => {
      const next = secondsLeft(decayMs - elapsed);
      return prev === next ? prev : next;
    });

    if (!halfFiredRef.current && t >= 0.5) {
      halfFiredRef.current = true;
      announcePolite(`Half faded — ${Math.round(totalSec / 2)} seconds left.`);
    }

    if (t >= 1) {
      setPhase("expired");
      announcePolite("Key no longer readable.");
      stopClock();
      return;
    }

    timerRef.current = window.setTimeout(tick, TICK_MS);
  }, [decayMs, writeT, announcePolite, stopClock, totalSec]);

  const arm = useCallback(
    (copied: boolean) => {
      if (armedAtRef.current != null) return; // one-way latch: copy-then-blur can't re-arm
      armedAtRef.current = performance.now();
      halfFiredRef.current = false;
      setPhase("armed");
      setRemainingSec(totalSec);
      setRecordVerb(copied ? "copied" : "shown");
      setRecordAt(copiedAtOverride ?? formatClock(new Date()));
      announceAssertive(
        copied
          ? `Copied. Key becomes unreadable in ${totalSec} seconds.`
          : `Key becomes unreadable in ${totalSec} seconds.`
      );
      writeT(0);
      stopClock();
      timerRef.current = window.setTimeout(tick, TICK_MS);
    },
    [announceAssertive, copiedAtOverride, stopClock, tick, totalSec, writeT]
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    const onChange = () => {
      reducedRef.current = mq.matches;
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => stopClock, [stopClock]);

  const handleCopyClick = useCallback(() => {
    void (async () => {
      if (phase === "expired") {
        const ok = await copyToClipboard(stub);
        if (ok) {
          onCopy?.(stub, "stub");
          announcePolite("Copied identifier.");
        } else {
          announcePolite("Copy failed.");
        }
        return;
      }

      const wasArmed = armedAtRef.current != null;
      const ok = await copyToClipboard(value);
      if (!ok) {
        announcePolite("Copy failed.");
        return;
      }
      onCopy?.(value, "full");
      if (wasArmed) {
        announcePolite("Copied.");
      } else {
        arm(true);
      }
    })();
  }, [announcePolite, arm, onCopy, phase, stub, value]);

  const handlePanelBlur = useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      const next = e.relatedTarget as Node | null;
      if (next && panelRef.current?.contains(next)) return;
      arm(false);
    },
    [arm]
  );

  const copyLabel =
    phase === "expired" ? `Copy key identifier ${stub}, secret no longer available` : "Copy secret key, shown only once";

  const clockLabel =
    phase === "idle"
      ? `Copy, or click away, to start the ${totalSec}s clock`
      : phase === "expired"
        ? "Faded — no longer shown"
        : `${remainingSec}s remaining`;

  const recordLine =
    phase === "idle" ? `${stub} — not yet ${recordVerb === "copied" ? "copied" : "shown"}` : `${stub}, ${recordVerb} ${recordAt}, will not be shown again`;

  return (
    <div
      ref={panelRef}
      className={`ns-fi ${className}`}
      data-phase={phase}
      onBlur={handlePanelBlur}
      style={{ "--fi-t": 0 } as CSSProperties}
    >
      <p className="ns-fi-label">{label}</p>

      <div className="ns-fi-secret" role="textbox" aria-readonly="true" aria-label={`${label} value`} tabIndex={0}>
        <span className="ns-fi-exempt">{prefix}</span>
        <span className="ns-fi-chars">
          {middle.split("").map((ch, i) => (
            <span
              key={i}
              className="ns-fi-char"
              style={{ "--fi-o": offsets[i]?.toFixed(4) ?? "0" } as CSSProperties}
            >
              {ch === " " ? " " : ch}
            </span>
          ))}
        </span>
        <span className="ns-fi-exempt">{suffix}</span>
      </div>

      <div className="ns-fi-rulewrap">
        <div className="ns-fi-rule" aria-hidden="true" />
        <span className="ns-fi-countdown" data-ns-fi-countdown={phase !== "idle" ? "" : undefined}>
          {clockLabel}
        </span>
      </div>

      <button type="button" className="ns-fi-copy-btn" aria-label={copyLabel} onClick={handleCopyClick}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <rect x="4.5" y="4.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M2.5 9.5V2.5a1 1 0 0 1 1-1H9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        {phase === "expired" ? "Copy identifier" : "Copy secret key"}
      </button>

      <p className="ns-fi-record">{recordLine}</p>

      <span className="ns-fi-sr" role="status" aria-live="polite">
        {politeMsg}
      </span>
      <span className="ns-fi-sr" role="alert" aria-live="assertive">
        {assertiveMsg}
      </span>

      <style>{`
        .ns-fi {
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-width: 26rem;
          padding: 16px;
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--background);
        }
        .ns-fi-label {
          margin: 0;
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--ns-muted);
        }
        .ns-fi-sr {
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

        .ns-fi-secret {
          display: block;
          padding: 10px 12px;
          border: 1px solid var(--border);
          border-radius: 6px;
          font-family: var(--font-mono, ui-monospace, monospace);
          font-size: 13px;
          line-height: 1.5;
          color: var(--foreground);
          word-break: break-all;
          user-select: text;
          cursor: text;
        }
        .ns-fi-secret:focus-visible {
          outline: 2px solid var(--ns-accent);
          outline-offset: 2px;
        }
        .ns-fi-exempt {
          font-weight: 600;
          color: var(--foreground);
          white-space: pre;
        }
        .ns-fi-chars {
          white-space: pre-wrap;
        }
        .ns-fi-char {
          display: inline-block;
          white-space: pre;
          --fi-local: max(0, min(1, calc((var(--fi-t, 0) - var(--fi-o, 0)) * ${LOCAL_SCALE.toFixed(4)})));
          --fi-w01: min(1, calc(var(--fi-local, 0) * ${WEIGHT_RECIP.toFixed(4)}));
          --fi-mix: calc(100 * max(0, min(1, calc((var(--fi-local, 0) - ${COLOR_START}) * ${COLOR_RECIP.toFixed(4)}))));
          --fi-eat: calc(${CLIP_MAX_PCT} * max(0, min(1, calc((var(--fi-local, 0) - ${CLIP_START}) * ${CLIP_RECIP.toFixed(4)}))));
          font-weight: calc(600 - 300 * var(--fi-w01, 0));
          color: color-mix(in oklab, var(--foreground), var(--ns-muted) calc(var(--fi-mix, 0) * 1%));
          clip-path: inset(0 0 calc(var(--fi-eat, 0) * 1%) 0);
        }
        @media (prefers-reduced-motion: no-preference) {
          .ns-fi-char {
            transition: color 160ms linear, clip-path 160ms linear;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .ns-fi-char {
            transition: none;
          }
        }

        .ns-fi-rulewrap {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .ns-fi-rule {
          position: relative;
          flex: 1;
          height: 2px;
          border-radius: 999px;
          background: var(--border);
          overflow: hidden;
        }
        .ns-fi-rule::after {
          content: "";
          position: absolute;
          inset: 0;
          transform-origin: left center;
          transform: scaleX(calc(1 - var(--fi-t, 0)));
          background: var(--foreground);
        }
        @media (prefers-reduced-motion: no-preference) {
          .ns-fi-rule::after {
            transition: transform 160ms linear;
          }
        }
        .ns-fi-countdown {
          flex-shrink: 0;
          font-family: var(--font-mono, ui-monospace, monospace);
          font-size: 11px;
          color: var(--ns-muted);
          white-space: nowrap;
        }

        .ns-fi-copy-btn {
          display: inline-flex;
          align-items: center;
          align-self: flex-start;
          gap: 8px;
          padding: 8px 14px;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: var(--background);
          color: var(--foreground);
          font-size: 13px;
          cursor: pointer;
          transition: border-color 140ms ease-out, background-color 140ms ease-out;
        }
        .ns-fi-copy-btn:hover {
          border-color: color-mix(in oklab, var(--foreground) 24%, var(--border));
          background: color-mix(in oklab, var(--foreground) 3%, var(--background));
        }
        .ns-fi-copy-btn:active {
          background: color-mix(in oklab, var(--foreground) 6%, var(--background));
        }
        .ns-fi-copy-btn:focus-visible {
          outline: 2px solid var(--ns-accent);
          outline-offset: 2px;
        }

        .ns-fi-record {
          margin: 0;
          font-family: var(--font-mono, ui-monospace, monospace);
          font-size: 11px;
          color: var(--ns-muted);
          word-break: break-all;
        }
      `}</style>
    </div>
  );
}
