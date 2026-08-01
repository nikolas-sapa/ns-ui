"use client";

import { useEffect, useId, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// PatinaPip — an unread badge that ages like brass instead of just counting.
// Its data-stage is derived from the newest item's timestamp, not the count:
// fresh (< 1 day) is a solid --foreground fill with background-token digits,
// waning (< 1 week) thins to a transparent fill with a 1.5px --foreground
// ring, dormant (>= 1 week) settles into a 1px --muted ring with --muted
// digits — fill, outline weight and text tone all move together so the three
// stages read apart under monochrome viewing, never by hue alone. Ordinary
// aging (the interval tick, or a prop simply reflecting more elapsed time)
// crossfades those properties over 400ms via a plain CSS transition; new
// activity is different in kind, not degree, so it's fast-pathed around that
// transition (a one-frame transitionDuration:0 clamp) straight to "fresh"
// and topped with a 200ms spring-eased scale(1 → 1.12 → 1) flare via the Web
// Animations API, so re-polish always reads as instantaneous, not eased.
// The pip itself is decorative (role="img", not a control) — the accessible
// name lives on it as an aria-label ("3 unread, newest 2 days ago") for a
// focusable nav item to pull in via aria-describedby, and a visually-hidden
// aria-live region separately announces new arrivals as they happen. Pure
// DOM + CSS, zero dependencies, no canvas.
// ---------------------------------------------------------------------------

export type PatinaPipStage = "fresh" | "waning" | "dormant";

export interface PatinaPipProps {
  /** unread item count. Incidental to the component's point — see newestTimestamp. */
  count: number;
  /** timestamp of the newest unread item; the sole driver of the tarnish stage. */
  newestTimestamp: number | Date;
  /** id placed on the pip itself, e.g. so a nav item can aria-describedby it. Defaults to an internal useId. */
  id?: string;
  className?: string;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

// how often the pip re-checks its own age while mounted, so a badge left
// open on screen tarnishes on its own without any new prop ever arriving.
const TICK_MS = MINUTE_MS;

const FLARE_KEYFRAMES: Keyframe[] = [
  { transform: "scale(1)" },
  { transform: "scale(1.12)", offset: 0.5 },
  { transform: "scale(1)" },
];
const FLARE_OPTIONS: KeyframeAnimationOptions = {
  duration: 200,
  easing: "cubic-bezier(0.34, 1.56, 0.64, 1)", // spring-like overshoot, not linear/ease
};

function toMs(ts: number | Date): number {
  return ts instanceof Date ? ts.getTime() : ts;
}

function computeStage(ageMs: number): PatinaPipStage {
  if (ageMs < DAY_MS) return "fresh";
  if (ageMs < WEEK_MS) return "waning";
  return "dormant";
}

function formatAge(ageMs: number): string {
  const ms = Math.max(0, ageMs);
  if (ms < MINUTE_MS) return "just now";
  if (ms < HOUR_MS) {
    const m = Math.round(ms / MINUTE_MS);
    return `${m} minute${m === 1 ? "" : "s"} ago`;
  }
  if (ms < DAY_MS) {
    const h = Math.round(ms / HOUR_MS);
    return `${h} hour${h === 1 ? "" : "s"} ago`;
  }
  if (ms < WEEK_MS) {
    const d = Math.round(ms / DAY_MS);
    return `${d} day${d === 1 ? "" : "s"} ago`;
  }
  const w = Math.round(ms / WEEK_MS);
  return `${w} week${w === 1 ? "" : "s"} ago`;
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

const STAGE_CLASSES: Record<PatinaPipStage, string> = {
  fresh: "bg-foreground text-background border border-foreground font-semibold",
  waning: "bg-transparent text-foreground border-[1.5px] border-foreground font-medium",
  dormant: "bg-transparent text-muted border border-muted font-normal",
};

const BASE_CLASSES =
  "ns-patina-pip inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 font-mono text-[11px] leading-none tabular-nums select-none transition-[background-color,border-color,color,border-width] duration-[400ms] ease-out";

export function PatinaPip({ count, newestTimestamp, id, className }: PatinaPipProps) {
  const autoId = useId();
  const pipId = id ?? autoId;
  const nodeRef = useRef<HTMLSpanElement>(null);
  const prevTsRef = useRef(toMs(newestTimestamp));
  const mountedRef = useRef(false);
  const reducedMotion = useReducedMotion();

  // SSR-safe placeholder: never reads Date.now() during render (server and
  // client's pre-effect render must match exactly), corrected to the real
  // elapsed age the moment effects can run on the client.
  const [ageMs, setAgeMs] = useState(0);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const ts = toMs(newestTimestamp);

    if (!mountedRef.current) {
      // first client-side pass after hydration: adopt the real elapsed time
      // silently, no crossfade suppression and no flare — this is settling
      // in, not new activity.
      mountedRef.current = true;
      prevTsRef.current = ts;
      setAgeMs(Math.max(0, Date.now() - ts));
      return;
    }

    const prev = prevTsRef.current;
    prevTsRef.current = ts;
    const isNewer = ts > prev;
    const nextAge = Math.max(0, Date.now() - ts);

    if (isNewer) {
      const node = nodeRef.current;
      // clamp the transition to instant for exactly this update, so the
      // reset to "fresh" reads as a snap, not a 400ms crossfade — then
      // restore normal crossfade timing for whatever ages naturally next.
      if (node) node.style.transitionDuration = "0s";
      setAgeMs(nextAge);
      setAnnouncement(`New unread activity, ${count} unread`);
      requestAnimationFrame(() => {
        if (node) node.style.transitionDuration = "";
        if (node && !reducedMotion) node.animate(FLARE_KEYFRAMES, FLARE_OPTIONS);
      });
    } else {
      setAgeMs(nextAge);
    }
  }, [newestTimestamp, count, reducedMotion]);

  useEffect(() => {
    const tick = window.setInterval(() => {
      setAgeMs(Math.max(0, Date.now() - prevTsRef.current));
    }, TICK_MS);
    return () => window.clearInterval(tick);
  }, []);

  if (count <= 0) return null;

  const stage = computeStage(ageMs);
  const label = `${count} unread, newest ${formatAge(ageMs)}`;

  return (
    <>
      <span
        ref={nodeRef}
        id={pipId}
        role="img"
        aria-label={label}
        data-stage={stage}
        className={[BASE_CLASSES, STAGE_CLASSES[stage], className].filter(Boolean).join(" ")}
      >
        <span aria-hidden="true">{count}</span>
      </span>
      {/* async re-polish announcements — the resting description above already
          covers "how stale", this only ever speaks up when new mail lands */}
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </>
  );
}
