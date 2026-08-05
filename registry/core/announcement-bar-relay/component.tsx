"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// AnnouncementBarRelay — a queued announcement bar that hands off honestly.
//
// The problem with every dismissible banner queue: the DOM swaps the message
// and the page below jumps by whatever the height difference happens to be.
// Here a hidden mirror row renders the NEXT message at the bar's exact content
// width, so its height h1 is known BEFORE the handoff starts. On dismiss the
// live height h0 is written to the bar as an explicit px height, and one rAF
// later three things start on the same clock:
//
//   (a) the outgoing message shears up and out   translateY(-100%) skewX(-3deg)
//   (b) the incoming message arrives from below  translateY(100%)  skewX(3deg)
//   (c) the BAR eases height h0 -> h1
//
// The 3deg shear is what makes the two messages read as one carriage
// travelling past a window rather than a crossfade. The height easing is what
// keeps the page below moving continuously instead of snapping at the swap.
// On settle the explicit height is cleared back to auto.
//
// The queue readout collapses in the same beat: the leaving pip animates its
// width (and margin) from 6px to 0, so the row of dots visibly gets shorter.
//
// Last item: same outgoing shear, the bar eases h0 -> 0, and the region
// unmounts on transitionend — guarded by a fallback timer, because a
// transitionend that never fires (tab hidden mid-flight) must not strand a
// zero-height region in the document.
//
// Tokens only: --border, --foreground, --ns-muted, --surface, --ns-accent. Accent is
// restricted to the action link and the focus rings; tone:"accent" shifts only
// the 2px leading rule, never the bar's background.
// ---------------------------------------------------------------------------

const SWAP_MS = 240; // message travel
const SWAP_DELAY_MS = 60; // lead-in on the incoming message
const HEIGHT_MS = 300; // bar height ease — outlasts the swap on purpose
const PIP_MS = 200; // queue pip collapse
const EASE = "cubic-bezier(0.4, 0, 0.2, 1)";
const SETTLE_FALLBACK_MS = 400; // transitionend guard

export interface AnnouncementItem {
  /** Stable id — also the localStorage suffix, so it must survive deploys. */
  id: string;
  /** The notice itself. One sentence; the bar is a single line at rest. */
  message: string;
  /** Optional inline link rendered after the message. */
  action?: { label: string; href: string };
  /** Shifts only the 2px leading rule. @default "muted" */
  tone?: "muted" | "accent";
}

export interface AnnouncementBarRelayProps {
  /** The queue, front to back. Dismissed ids are skipped. */
  items: AnnouncementItem[];
  /** Namespaced localStorage prefix; each dismissed id is written as
   * `${storageKeyPrefix}${id}` = "1". @default "ns-announcement-bar-relay:" */
  storageKeyPrefix?: string;
  /** Clear this queue's stored dismissals on mount — for demos and previews,
   * so a replaying page can't permanently empty itself. @default false */
  resetOnMount?: boolean;
  /** Fires once the last item has been dismissed and the bar has collapsed. */
  onExhausted?: () => void;
  className?: string;
}

function MessageBody({ item, linkTabIndex }: { item: AnnouncementItem; linkTabIndex?: number }) {
  return (
    <span className="block text-sm leading-6 text-foreground">
      {item.message}
      {item.action && (
        <>
          {" "}
          <a
            href={item.action.href}
            tabIndex={linkTabIndex}
            className="rounded-sm text-ns-accent underline decoration-ns-accent/40 underline-offset-[3px] outline-none transition-colors hover:decoration-ns-accent focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            {item.action.label}
          </a>
        </>
      )}
    </span>
  );
}

export function AnnouncementBarRelay({
  items,
  storageKeyPrefix = "ns-announcement-bar-relay:",
  resetOnMount = false,
  onExhausted,
  className = "",
}: AnnouncementBarRelayProps) {
  // Storage is read in an effect, never during render, so the server markup and
  // the first client paint agree: item 0 renders optimistically and is swapped
  // after hydration if it turns out to be already dismissed.
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [outgoing, setOutgoing] = useState<AnnouncementItem | null>(null);
  const [entering, setEntering] = useState(false); // incoming still at its start pose
  const [leaving, setLeaving] = useState(false); // outgoing shearing out
  const [barHeight, setBarHeight] = useState<number | null>(null);
  const [animating, setAnimating] = useState(false);
  const [gone, setGone] = useState(false);

  const barRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const pendingRef = useRef<{ h1: number; last: boolean } | null>(null);
  const finishRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const rafRef = useRef(0);
  const onExhaustedRef = useRef(onExhausted);
  onExhaustedRef.current = onExhausted;

  const labelId = useId();

  useEffect(() => {
    if (typeof window === "undefined") return;
    let store: Storage | null = null;
    try {
      store = window.localStorage;
    } catch {
      return; // storage denied — the bar simply never persists
    }
    if (!store) return;
    if (resetOnMount) {
      for (const item of items) {
        try {
          store.removeItem(`${storageKeyPrefix}${item.id}`);
        } catch {
          /* quota / private mode — nothing to do */
        }
      }
      return;
    }
    const seen: string[] = [];
    for (const item of items) {
      try {
        if (store.getItem(`${storageKeyPrefix}${item.id}`) === "1") seen.push(item.id);
      } catch {
        /* ignore */
      }
    }
    if (seen.length) setDismissed(seen);
    // Intentionally mount-only: the queue is fixed for the bar's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      window.clearTimeout(timerRef.current);
      cancelAnimationFrame(rafRef.current);
    },
    []
  );

  const remaining = items.filter((item) => !dismissed.includes(item.id));
  const current = remaining[0] ?? null;
  const next = remaining[1] ?? null;
  const position = Math.min(items.length, items.length - remaining.length + 1);

  const handleDismiss = useCallback(() => {
    if (busyRef.current || !current) return;
    const bar = barRef.current;
    const content = contentRef.current;
    if (!bar || !content) return;
    busyRef.current = true;

    try {
      window.localStorage.setItem(`${storageKeyPrefix}${current.id}`, "1");
    } catch {
      /* storage denied — dismissal is still honoured for this session */
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isLast = next == null;

    if (reduced) {
      // One paint: no shear, no height easing, no pip collapse.
      setDismissed((d) => [...d, current.id]);
      if (isLast) {
        setGone(true);
        onExhaustedRef.current?.();
      }
      busyRef.current = false;
      return;
    }

    // h0 is the live border-box height; h1 comes from the mirror, which is
    // already rendering `next` at the bar's exact content width. `chrome` is
    // whatever the bar adds around its content row (the hairline rule), so the
    // two measurements are in the same box model.
    const h0 = bar.getBoundingClientRect().height;
    const chrome = bar.offsetHeight - content.offsetHeight;
    const h1 = isLast ? 0 : (mirrorRef.current?.offsetHeight ?? content.offsetHeight) + chrome;

    pendingRef.current = { h1, last: isLast };
    setBarHeight(h0);
    setAnimating(true);
    setOutgoing(current);
    setEntering(true);
    setDismissed((d) => [...d, current.id]);
  }, [current, next, storageKeyPrefix]);

  // Start every clock in the same rAF, one paint after the start poses have
  // actually rendered — otherwise the browser coalesces start and end and
  // nothing transitions.
  useLayoutEffect(() => {
    const pending = pendingRef.current;
    if (!pending || !outgoing) return;
    pendingRef.current = null;

    rafRef.current = requestAnimationFrame(() => {
      setBarHeight(pending.h1);
      setEntering(false);
      setLeaving(true);
    });

    const finish = () => {
      if (!finishRef.current) return;
      finishRef.current = null;
      window.clearTimeout(timerRef.current);
      setAnimating(false);
      setBarHeight(null);
      setOutgoing(null);
      setLeaving(false);
      busyRef.current = false;
      if (pending.last) {
        setGone(true);
        onExhaustedRef.current?.();
      }
    };
    finishRef.current = finish;
    timerRef.current = window.setTimeout(finish, HEIGHT_MS + SETTLE_FALLBACK_MS);
    return () => cancelAnimationFrame(rafRef.current);
  }, [outgoing]);

  const onBarTransitionEnd = (event: React.TransitionEvent<HTMLDivElement>) => {
    if (event.propertyName !== "height" || event.target !== barRef.current) return;
    finishRef.current?.();
  };

  if (gone || (!current && !outgoing)) return null;

  const shown = current ?? outgoing;
  if (!shown) return null;

  const toneAccent = (current ?? outgoing)?.tone === "accent";

  return (
    <div
      ref={barRef}
      role="region"
      aria-labelledby={labelId}
      data-announcement-bar=""
      onTransitionEnd={onBarTransitionEnd}
      style={{
        height: barHeight == null ? undefined : `${barHeight}px`,
        transition: animating ? `height ${HEIGHT_MS}ms ${EASE}` : undefined,
      }}
      className={`ns-abr relative w-full overflow-hidden border-b border-border bg-surface ${className}`}
    >
      <span id={labelId} className="sr-only">
        Announcements
      </span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-[2px]"
        style={{ background: toneAccent ? "var(--ns-accent)" : "var(--border)" }}
      />

      <div ref={contentRef} className="flex items-center gap-4 px-4 py-2.5 pl-5 sm:px-6 sm:pl-7">
        <div className="relative min-w-0 flex-1" aria-live="polite">
          {outgoing && (
            <div aria-hidden="true" className="ns-abr-msg absolute inset-x-0 top-0" data-leave={leaving ? "" : undefined}>
              <MessageBody item={outgoing} linkTabIndex={-1} />
            </div>
          )}
          {current && (
            <div key={current.id} className="ns-abr-msg" data-enter={entering ? "" : undefined}>
              <MessageBody item={current} />
            </div>
          )}
          {/* Inside the live region on purpose: the pips and the counter are
              aria-hidden, so this is the only way the new position is spoken
              at all — outside it, it would change silently. */}
          <span className="sr-only">
            Announcement {position} of {items.length}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="flex items-center" aria-hidden="true">
            <span className="flex items-center">
              {outgoing && <span className="ns-abr-pip ns-abr-pip-on" data-collapse={leaving ? "" : undefined} />}
              {remaining.map((item, i) => (
                <span key={item.id} className={`ns-abr-pip ${i === 0 ? "ns-abr-pip-on" : ""}`} />
              ))}
            </span>
            <span className="ml-1 font-mono text-[11px] tabular-nums text-ns-muted">
              {position}/{items.length}
            </span>
          </div>

          <button
            type="button"
            data-announcement-dismiss=""
            onClick={handleDismiss}
            aria-label={`Dismiss: ${shown.message}`}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-ns-muted outline-none transition-colors hover:bg-foreground/[0.07] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-inset"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="h-3.5 w-3.5" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Height oracle: the next message rendered at the bar's exact content
          width, so h1 is a measured fact before the handoff starts. */}
      <div
        ref={mirrorRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-4 px-4 py-2.5 pl-5 sm:px-6 sm:pl-7"
        style={{ visibility: "hidden" }}
      >
        <div className="min-w-0 flex-1">{next && <MessageBody item={next} linkTabIndex={-1} />}</div>
        {/* The right-hand block is reproduced exactly — pips, counter, button box —
            at the count it will have AFTER the dismissal, so the mirror's message
            column is the same width as the real one and a wrap is measured, not
            missed. */}
        <div className="flex shrink-0 items-center gap-3">
          <div className="flex items-center">
            <span className="flex items-center">
              {remaining.slice(1).map((item) => (
                <span key={item.id} className="ns-abr-pip" />
              ))}
            </span>
            <span className="ml-1 font-mono text-[11px] tabular-nums text-ns-muted">
              {Math.min(items.length, position + 1)}/{items.length}
            </span>
          </div>
          <span className="h-7 w-7" />
        </div>
      </div>

      <style>{`
        .ns-abr-msg {
          transform: translateY(0) skewX(0deg);
          opacity: 1;
          transition: transform ${SWAP_MS}ms ${EASE} ${SWAP_DELAY_MS}ms, opacity ${SWAP_MS}ms ${EASE} ${SWAP_DELAY_MS}ms;
          will-change: transform;
        }
        .ns-abr-msg[data-enter] {
          transform: translateY(100%) skewX(3deg);
          opacity: 0;
          transition: none;
        }
        .ns-abr-msg[data-leave] {
          transform: translateY(-100%) skewX(-3deg);
          opacity: 0;
          transition: transform ${SWAP_MS}ms ${EASE}, opacity ${SWAP_MS}ms ${EASE};
        }
        .ns-abr-pip {
          box-sizing: border-box;
          display: inline-block;
          width: 6px;
          height: 6px;
          margin-right: 6px;
          border-radius: 9999px;
          border: 1px solid var(--border);
          transition: width ${PIP_MS}ms ${EASE}, margin-right ${PIP_MS}ms ${EASE};
        }
        .ns-abr-pip-on {
          background: var(--foreground);
          border-color: var(--foreground);
        }
        .ns-abr-pip[data-collapse] {
          width: 0;
          margin-right: 0;
          border-width: 0;
        }
        @media (prefers-reduced-motion: reduce) {
          .ns-abr-msg,
          .ns-abr-msg[data-leave],
          .ns-abr-pip {
            transition: none;
          }
        }
      `}</style>
    </div>
  );
}
