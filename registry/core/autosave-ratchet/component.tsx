"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

// ---------------------------------------------------------------------------
// PawlTick — autosave status rendered as a mechanical ratchet, not a spinner
// or a text swap. A 10-tooth gear (9 teeth in --muted, one index tooth in
// --foreground so a one-tooth-width rotation is actually visible against the
// gear's own 10-fold symmetry) sits under a fixed pawl triangle. Every
// SUCCESSFUL save advances the gear exactly one tooth-width and folds into a
// silent running tally; the position is cosmetic (it wraps every 10 saves),
// the count and timestamp are the real record and live in the tooltip text.
//
// Motion is three distinct, non-looping events, all direct-DOM CSS-transform
// writes on two SVG refs (no React state on the hot path):
//   - save-start ("saving"): a small anticipation backswing, winding the
//     wheel back against the pawl before the outcome is known.
//   - ack ("saved"): a 200ms ease-out-expo spring settle forward past the
//     wind-up to the next tooth. Count++, timestamp stamped, wind-up cleared.
//   - failure ("error"): the pawl slips — the wheel kicks back half a tooth
//     from its last good seat (not from wherever the wind-up left it, so
//     repeated failures hold the same broken pose rather than unraveling
//     further) and the pawl itself lifts off and thickens to 2px
//     --foreground. That pose holds — no loop — until the next successful
//     save resolves it.
//
// Accessibility: a dedicated sr-only span (not the whole wrapper) is the
// status live region — role=status/aria-live=polite/aria-atomic=true on
// just that span, so re-reading it atomically never picks up the button's
// label or an open tooltip's duplicated text, and hovering the tooltip
// (marked aria-live=off) can never itself trigger a spurious announcement.
// "Saving"/"Saved" chatter is throttled to at most one shared announcement
// per 30s so a bursty autosave doesn't spam a screen reader; "Save failed"
// always announces and resets that throttle window so the next resolution
// is guaranteed to announce too. The gear is aria-hidden; the only focusable
// element is the button that doubles as the tooltip trigger (hover or focus
// reveals a Geist Mono panel that duplicates every fact as text — status,
// session count, time since the last successful save), and Escape closes
// it. The failed state additionally renders the plain visible words
// "Not saved" beside the wheel, so the state is never carried by the
// graphic alone. prefers-reduced-motion drops the wind-up and the spring
// entirely — ack and failure both land as an instant discrete step to their
// resolved angle, no easing, no anticipation.
// ---------------------------------------------------------------------------

export type PawlTickStatus = "idle" | "saving" | "saved" | "error";

export interface PawlTickProps {
  /**
   * Current autosave status. Transitions drive everything: idle/saved/error
   * -> "saving" plays the anticipation wind-up; "saving" -> "saved" advances
   * one tooth with a spring settle and folds into the session tally;
   * any -> "error" plays the pawl-slip kick-back and holds until the next
   * "saved".
   */
  status: PawlTickStatus;
  /** Gear glyph size in px. Default 20. */
  size?: number;
  className?: string;
}

const TOOTH_COUNT = 10;
const TOOTH_DEG = 360 / TOOTH_COUNT;
const ANTICIPATE_DEG = 8;
const FAIL_KICK_DEG = TOOTH_DEG / 2;

const EASE_OUT_EXPO = "cubic-bezier(0.16, 1, 0.3, 1)";
const EASE_WINDUP = "cubic-bezier(0.55, 0, 1, 0.45)";
const EASE_KICK = "cubic-bezier(0.7, 0, 0.84, 0)";

const SETTLE_MS = 200;
const ANTICIPATE_MS = 130;
const KICK_MS = 160;
const PAWL_MS = 160;

const ANNOUNCE_THROTTLE_MS = 30_000;
const HOVER_OPEN_DELAY_MS = 400;
const TOUCH_AUTOCLOSE_MS = 4000;
const TICK_MS = 1000;

const CENTER = 12;
const R_INNER = 6.2;
const R_OUTER = 9.6;

interface Tooth {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  index: boolean;
}

// 10 radial ticks, clock-style, index tooth (the only asymmetric one) at
// 12 o'clock — its position is the only thing that makes a one-tooth
// rotation of an otherwise 10-fold-symmetric ring visible at all.
const TEETH: Tooth[] = Array.from({ length: TOOTH_COUNT }, (_, i) => {
  const deg = -90 + i * TOOTH_DEG;
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x1: CENTER + R_INNER * cos,
    y1: CENTER + R_INNER * sin,
    x2: CENTER + R_OUTER * cos,
    y2: CENTER + R_OUTER * sin,
    index: i === 0,
  };
});

// Fixed pawl triangle, apex resting just inside the tooth ring at 12
// o'clock, base above it — never rotates with the wheel. Kept well clear of
// the viewBox edge so the thickened+lifted failure pose never clips.
const PAWL_PATH = `M ${CENTER} ${CENTER - R_OUTER + 1.2} L ${CENTER - 2.1} ${CENTER - R_OUTER - 0.6} L ${CENTER + 2.1} ${CENTER - R_OUTER - 0.6} Z`;

// Returns a complete relative-time phrase ("just now", "5s ago") so callers
// never append "ago" themselves — "just now ago" shipped once.
function formatAgo(ms: number): string {
  if (ms < 1000) return "just now";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return `${h}h ago`;
}

function setWheelAngle(el: SVGGElement | null, deg: number, ms: number, ease: string) {
  if (!el) return;
  el.style.transition = ms > 0 ? `transform ${ms}ms ${ease}` : "none";
  el.style.transform = `rotate(${deg}deg)`;
}

function setPawlPose(el: SVGPathElement | null, slipped: boolean, ms: number) {
  if (!el) return;
  el.style.transition =
    ms > 0
      ? `transform ${ms}ms ${EASE_OUT_EXPO}, stroke-width ${ms}ms ${EASE_OUT_EXPO}, stroke ${ms}ms linear`
      : "none";
  el.style.transform = slipped ? "translateY(-1.2px)" : "translateY(0)";
  el.style.strokeWidth = slipped ? "2" : "1.4";
  el.style.stroke = slipped ? "var(--foreground)" : "var(--muted)";
}

function buildTooltipText(
  status: PawlTickStatus,
  count: number,
  failed: boolean,
  lastSavedAt: number | null,
  now: number
): string {
  if (failed) {
    if (count > 0 && lastSavedAt) {
      return `Save failed. ${count} saved this session, last successful save ${formatAgo(now - lastSavedAt)}.`;
    }
    return "Save failed. No successful saves yet this session.";
  }
  if (status === "saving") return "Saving…";
  if (count === 0) return "No saves yet this session.";
  const times = count === 1 ? "time" : "times";
  return `Saved ${count} ${times}, last ${formatAgo(now - (lastSavedAt ?? now))}.`;
}

export function PawlTick({ status, size = 20, className = "" }: PawlTickProps) {
  const autoId = useId();
  const tooltipId = `autosave-ratchet-tip-${autoId.replace(/:/g, "")}`;

  const rootRef = useRef<HTMLSpanElement | null>(null);
  const wheelRef = useRef<SVGGElement | null>(null);
  const pawlRef = useRef<SVGPathElement | null>(null);

  const reducedRef = useRef(false);
  const prevStatusRef = useRef<PawlTickStatus>(status);
  const angleRef = useRef(0); // angle currently applied to the wheel
  const successBaseRef = useRef(0); // angle of the last confirmed good seat
  const lastSavedAtRef = useRef<number | null>(null);
  const lastRoutineAnnounceRef = useRef(0);
  const parityRef = useRef(false);

  const [count, setCount] = useState(0);
  const [failed, setFailed] = useState(false);
  const [announceText, setAnnounceText] = useState("");

  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const hoverRef = useRef(false);
  const focusRef = useRef(false);
  const viaTouchRef = useRef(false);
  const openTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    const onChange = () => {
      reducedRef.current = mq.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const announce = useCallback((message: "Saving" | "Saved" | "Save failed", force: boolean) => {
    const at = Date.now();
    if (!force) {
      if (at - lastRoutineAnnounceRef.current < ANNOUNCE_THROTTLE_MS) return;
      lastRoutineAnnounceRef.current = at;
    } else {
      lastRoutineAnnounceRef.current = 0; // guarantee the next routine announcement also goes through
    }
    // A zero-width toggle forces a real text-node change even when the
    // message text repeats (e.g. two "Save failed" in a row), which is what
    // actually re-triggers an aria-live announcement.
    parityRef.current = !parityRef.current;
    setAnnounceText(message + (parityRef.current ? "​" : ""));
  }, []);

  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;
    if (prev === status) return;

    const reduced = reducedRef.current;

    if (status === "saving") {
      if (!reduced) {
        const target = angleRef.current - ANTICIPATE_DEG;
        setWheelAngle(wheelRef.current, target, ANTICIPATE_MS, EASE_WINDUP);
        angleRef.current = target;
      }
      announce("Saving", false);
      return;
    }

    if (status === "saved") {
      const target = successBaseRef.current + TOOTH_DEG;
      setWheelAngle(wheelRef.current, target, reduced ? 0 : SETTLE_MS, EASE_OUT_EXPO);
      angleRef.current = target;
      successBaseRef.current = target;
      setPawlPose(pawlRef.current, false, reduced ? 0 : PAWL_MS);
      setFailed(false);
      lastSavedAtRef.current = Date.now();
      setCount((c) => c + 1);
      announce("Saved", false);
      return;
    }

    if (status === "error") {
      const target = successBaseRef.current - FAIL_KICK_DEG;
      setWheelAngle(wheelRef.current, target, reduced ? 0 : KICK_MS, EASE_KICK);
      angleRef.current = target;
      setPawlPose(pawlRef.current, true, reduced ? 0 : PAWL_MS);
      setFailed(true);
      announce("Save failed", true);
      return;
    }
    // "idle": no motion — a held failure pose stays held until a save
    // actually resolves it, never on a plain idle transition.
  }, [status, announce]);

  // Tick the tooltip's relative timestamp once a second while it's open.
  useEffect(() => {
    if (!open) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(id);
  }, [open]);

  const evaluate = useCallback(() => {
    const should = hoverRef.current || focusRef.current;
    if (should && !open) {
      if (focusRef.current) {
        window.clearTimeout(openTimerRef.current);
        setOpen(true);
        return;
      }
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = window.setTimeout(() => setOpen(true), HOVER_OPEN_DELAY_MS);
    } else if (!should) {
      window.clearTimeout(openTimerRef.current);
      if (open) setOpen(false);
    }
  }, [open]);

  // Escape always closes; a touch-opened peek also gets outside-tap, scroll
  // and a safety timeout, since touch has no hover to release it on.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);

    let onOutside: ((e: PointerEvent) => void) | undefined;
    let onScroll: (() => void) | undefined;
    let safety: number | undefined;
    if (viaTouchRef.current) {
      onOutside = (e) => {
        const t = e.target as Node;
        if (rootRef.current?.contains(t)) return;
        setOpen(false);
      };
      onScroll = () => setOpen(false);
      document.addEventListener("pointerdown", onOutside, true);
      window.addEventListener("scroll", onScroll, true);
      safety = window.setTimeout(() => setOpen(false), TOUCH_AUTOCLOSE_MS);
    }

    return () => {
      document.removeEventListener("keydown", onKey);
      if (onOutside) document.removeEventListener("pointerdown", onOutside, true);
      if (onScroll) window.removeEventListener("scroll", onScroll, true);
      if (safety !== undefined) window.clearTimeout(safety);
    };
  }, [open]);

  useEffect(() => () => window.clearTimeout(openTimerRef.current), []);

  const tooltipText = useMemo(
    () => buildTooltipText(status, count, failed, lastSavedAtRef.current, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status, count, failed, now]
  );

  return (
    <span ref={rootRef} className={`relative inline-flex items-center gap-1.5 ${className}`}>
      <style>{CSS}</style>
      {/* The announcer, not the whole wrapper, is the live region: it holds
          only the throttled status message, so aria-atomic re-reading it
          on every change never picks up the button's label or an open
          tooltip's duplicated text along with it. */}
      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announceText}
      </span>

      <button
        type="button"
        aria-label="Autosave status"
        aria-describedby={open ? tooltipId : undefined}
        className="inline-flex shrink-0 items-center justify-center rounded-[6px] p-0.5 text-foreground hover:bg-border/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        onPointerEnter={(e: ReactPointerEvent) => {
          if (e.pointerType === "touch") return;
          hoverRef.current = true;
          evaluate();
        }}
        onPointerLeave={(e: ReactPointerEvent) => {
          if (e.pointerType === "touch") return;
          hoverRef.current = false;
          evaluate();
        }}
        onPointerDown={(e: ReactPointerEvent) => {
          if (e.pointerType !== "touch") return;
          viaTouchRef.current = true;
          setOpen((v) => !v);
        }}
        onFocus={() => {
          focusRef.current = true;
          evaluate();
        }}
        onBlur={() => {
          focusRef.current = false;
          evaluate();
        }}
        onKeyDown={(e: ReactKeyboardEvent) => {
          if (e.key === "Escape" && open) {
            e.stopPropagation();
            setOpen(false);
          }
        }}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <g ref={wheelRef} className="ns-pt-wheel">
            <circle
              cx={CENTER}
              cy={CENTER}
              r={R_INNER - 0.4}
              fill="none"
              stroke="var(--border)"
              strokeWidth={1}
            />
            <circle cx={CENTER} cy={CENTER} r={1.6} fill="var(--border)" />
            {TEETH.map((t, i) => (
              <line
                key={i}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                strokeWidth={1.6}
                strokeLinecap="round"
                stroke={t.index ? "var(--foreground)" : "var(--muted)"}
              />
            ))}
          </g>
          <path
            ref={pawlRef}
            d={PAWL_PATH}
            className="ns-pt-pawl"
            fill="none"
            stroke="var(--muted)"
            strokeWidth={1.4}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {failed && (
        <span aria-hidden="true" className="font-mono text-[11px] uppercase tracking-wide text-foreground">
          Not saved
        </span>
      )}

      {open && (
        <div
          id={tooltipId}
          role="tooltip"
          aria-live="off"
          className="absolute left-1/2 top-full z-10 mt-2 w-max max-w-56 -translate-x-1/2 rounded-[6px] border border-border bg-background px-2.5 py-1.5 font-mono text-[11px] leading-snug text-foreground shadow-sm"
        >
          {tooltipText}
        </div>
      )}
    </span>
  );
}

const CSS = `
.ns-pt-wheel{transform-box:fill-box;transform-origin:center;}
.ns-pt-pawl{transform-box:fill-box;transform-origin:center;}
@media (prefers-reduced-motion: reduce){
  .ns-pt-wheel,.ns-pt-pawl{transition:none !important;}
}
`;
