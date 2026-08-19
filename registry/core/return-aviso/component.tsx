"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// ReturnAviso — an @mention chip that behaves like registered post. On send,
// a thin stub tears off along a dashed perforation at the chip's trailing
// edge and drifts 12px clear, holding at 40% opacity — dispatched, then
// delivered, look identical, because neither is the news. Only when the
// mentioned person actually opens the thread does the stub travel back and
// dock as a filled corner notch, matching the chip's own corner radius, with
// a small Geist Mono timestamp riding along — a permanent per-mention read
// receipt, legible at rest, no hover required.
//
// Mechanism: `deliveryState` (0 sent, 1 delivered, 2 seen) is the ONLY
// animation input. Everything else — stub offset, stub width/fill, notch
// radius, timestamp reveal — is a pure function of `seen = deliveryState >=
// 2`. Sent and delivered render byte-identical on purpose: the person you
// mentioned hasn't looked yet either way, so the chip has nothing new to
// report until they do. The prop still carries three values rather than a
// boolean because the sync layer's own transport states (queued vs acked)
// are worth being honest about in the API, even where the UI collapses two
// of them into one look.
//
// Hard constraint: this component NEVER promotes itself to "seen" on its
// own — deliveryState is fully controlled, read straight from the sync
// layer's confirmation, never guessed optimistically on send. A receipt
// that fires before the fact is decoration wearing a receipt's clothes.
//
// Accessibility: the chip is a real <a> to the mentioned person; its
// accessible name is "@name" (plain text content), and aria-description
// spells out the state in words ("mentioned, seen 14:22" / "mentioned, not
// yet seen") so the two-state receipt is always available as text, not just
// as a shape change. The stub, perforation and inline timestamp are all
// aria-hidden — duplicating aria-description, never adding information a
// screen reader user wouldn't otherwise have. A visually-hidden aria-live
// region announces the sent/delivered -> seen transition, but only when
// `authoredByViewer` is true: a receipt is only news to the person who sent
// the mention, not to everyone re-rendering a thread that mentions them.
// prefers-reduced-motion drops the translate/width travel and crossfades
// opacity + fill only — still three readable states, no travel.
//
// Differs from badge-unread-tarnish: that ages the CURRENT user's own
// unread state on a badge over elapsed time. This tracks a round-trip
// acknowledgment on someone ELSE's attention, driven by discrete confirmed
// events from a sync layer, never by a clock.
//
// DOM/CSS only, no canvas. Colors: --background, --foreground, --ns-muted,
// --border. --ns-accent is reserved for the focus ring only.
// ---------------------------------------------------------------------------

const EASE_EXPO = "cubic-bezier(0.22, 1, 0.36, 1)";
const TRANSITION_MS = 220;

export type AvisoDeliveryState = 0 | 1 | 2;

export interface ReturnAvisoProps {
  /** The mentioned person's display name, rendered as "@name". Also forms
   * the chip's accessible name. */
  name: string;
  /** Link target for the mentioned person — this is a real link, not a
   * decorated span. */
  href: string;
  /** 0 = sent, 1 = delivered, 2 = seen — from the sync layer only. The
   * single governing scalar: stub position, notch fill and timestamp
   * visibility all derive from this and nothing else. Never set this to 2
   * optimistically on send. */
  deliveryState: AvisoDeliveryState;
  /** Pre-formatted "HH:MM" shown once deliveryState reaches 2. Formatting
   * (locale, timezone) is the caller's call, not this component's — passing
   * a raw Date here would make the same receipt read a different clock time
   * on the server that renders it than on the browser that hydrates it. */
  seenAt?: string;
  /** True only for mentions the current viewer authored. Gates the polite
   * live-region announcement on the not-seen -> seen transition — a receipt
   * is news to the sender, not to every viewer of a thread that mentions
   * them. @default false */
  authoredByViewer?: boolean;
  /** extra classes merged onto the rendered <a> */
  className?: string;
}

export function ReturnAviso({
  name,
  href,
  deliveryState,
  seenAt,
  authoredByViewer = false,
  className = "",
}: ReturnAvisoProps) {
  const seen = deliveryState >= 2;

  const description = seen
    ? `mentioned, seen ${seenAt ?? ""}`.trim()
    : "mentioned, not yet seen";

  // Announce only the not-seen -> seen crossing, only for mentions the
  // viewer authored, and never on mount (a chip can mount already seen —
  // e.g. a page reload after the fact — and that is not news either).
  const [announcement, setAnnouncement] = useState("");
  const prevSeenRef = useRef(seen);
  const firstRenderRef = useRef(true);
  const clearTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      prevSeenRef.current = seen;
      return;
    }
    const justSeen = !prevSeenRef.current && seen;
    prevSeenRef.current = seen;
    if (!justSeen || !authoredByViewer) return;

    setAnnouncement(`@${name} saw your mention${seenAt ? ` at ${seenAt}` : ""}`);
    window.clearTimeout(clearTimerRef.current);
    // Cleared a beat later so a second live region on the page re-reads a
    // repeat announcement as new rather than finding stale, identical text.
    clearTimerRef.current = window.setTimeout(() => setAnnouncement(""), 4000);
  }, [seen, authoredByViewer, name, seenAt]);

  useEffect(() => () => window.clearTimeout(clearTimerRef.current), []);

  return (
    <>
      <a
        href={href}
        aria-description={description}
        data-ns-aviso-seen={seen ? "" : undefined}
        className={`ns-aviso relative inline-flex items-stretch rounded-sm border border-border bg-transparent py-1 pl-2.5 pr-4 font-sans text-sm leading-none text-foreground no-underline transition-colors duration-150 hover:border-foreground/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent ${className}`}
      >
        <span className="self-center">@{name}</span>

        <span
          className="ns-aviso-time self-center overflow-hidden font-mono text-[10px] tracking-tight text-ns-muted"
          data-seen={seen ? "" : undefined}
          aria-hidden="true"
        >
          <span className="ns-aviso-time-inner block whitespace-nowrap">{seenAt ?? ""}</span>
        </span>

        <span aria-hidden="true" className="ns-aviso-perf pointer-events-none absolute inset-y-[3px] right-3 w-px" />
        <span
          aria-hidden="true"
          data-seen={seen ? "" : undefined}
          className="ns-aviso-stub pointer-events-none absolute inset-y-0 right-0"
        />

        <style>{`
        .ns-aviso-perf {
          background: var(--border);
          -webkit-mask-image: repeating-linear-gradient(to bottom, black 0 2px, transparent 2px 4px);
          mask-image: repeating-linear-gradient(to bottom, black 0 2px, transparent 2px 4px);
        }
        .ns-aviso-stub {
          width: 3px;
          background: transparent;
          border: 1px solid var(--border);
          border-radius: 0;
          opacity: 0.4;
          transform: translateX(12px);
          transition:
            transform ${TRANSITION_MS}ms ${EASE_EXPO},
            width ${TRANSITION_MS}ms ${EASE_EXPO},
            opacity ${TRANSITION_MS}ms ${EASE_EXPO},
            background-color ${TRANSITION_MS}ms ${EASE_EXPO},
            border-color ${TRANSITION_MS}ms ${EASE_EXPO},
            border-radius ${TRANSITION_MS}ms ${EASE_EXPO};
        }
        .ns-aviso-stub[data-seen] {
          width: 7px;
          background: var(--foreground);
          border-color: var(--foreground);
          border-radius: 0 6px 6px 0;
          opacity: 1;
          transform: translateX(0);
        }
        .ns-aviso-time {
          display: grid;
          grid-template-columns: 0fr;
          opacity: 0;
          transition:
            grid-template-columns ${TRANSITION_MS}ms ${EASE_EXPO},
            opacity ${TRANSITION_MS}ms ${EASE_EXPO};
        }
        .ns-aviso-time[data-seen] {
          grid-template-columns: 1fr;
          opacity: 1;
          margin-left: 6px;
        }
        .ns-aviso-time-inner {
          min-width: 0;
        }
        @media (prefers-reduced-motion: reduce) {
          /* No travel: the stub sits docked at all times and the three
             states crossfade through fill/opacity only, never position or
             width — a pure state indicator instead of a physical journey. */
          .ns-aviso-stub,
          .ns-aviso-stub[data-seen] {
            width: 5px;
            transform: none;
            border-radius: 0 6px 6px 0;
            transition:
              opacity ${TRANSITION_MS}ms linear,
              background-color ${TRANSITION_MS}ms linear,
              border-color ${TRANSITION_MS}ms linear;
          }
          .ns-aviso-time,
          .ns-aviso-time[data-seen] {
            grid-template-columns: 1fr;
            transition: opacity ${TRANSITION_MS}ms linear;
          }
        }
      `}</style>
      </a>

      {/* Separate from the link on purpose — nested inside the <a>, this
          text would splice into the link's own accessible name for as long
          as it holds a message ("@dana" -> "@dana @dana saw your mention at
          14:22"), which the a11y audit's mere name-exists check would never
          catch. */}
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </>
  );
}
