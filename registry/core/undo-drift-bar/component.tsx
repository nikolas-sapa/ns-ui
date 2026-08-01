"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// UndertowDrift — inline undo for destructive list actions where POSITION,
// not a number, is the clock. Deleting a row spring-collapses it in place to
// a compact 28px bar holding the title + an undo arrow; once collapsed the
// bar drifts, via a single linear WAAPI transform, toward the row's trailing
// edge over the grace window — distance already traveled reads as time
// already spent, distance left as time left. Reaching the edge fades the bar
// and finalizes the delete (list reflows). Clicking/Enter-ing the bar cancels
// with an ease-out-back spring on both its position and the row height,
// plus a one-shot border flash (--border -> --foreground -> --border).
// Hover or keyboard focus on the bar pauses the underlying Animation object
// directly, so the countdown genuinely stops rather than racing a separate
// timer. prefers-reduced-motion keeps the collapse (a state change, not a
// decoration) but never drifts the bar horizontally — instead a static
// visible "Ns" readout ticks down next to the title, since time-as-distance
// is an enhancement layered on top of a countdown that must survive without
// it, never the sole channel.
// ---------------------------------------------------------------------------

export interface UndertowItem {
  id: string;
  title: string;
}

export interface UndertowDriftProps {
  items: UndertowItem[];
  /** ms the collapsed bar takes to drift fully across before the delete commits */
  graceMs?: number;
  onDelete?: (item: UndertowItem) => void;
  onRestore?: (item: UndertowItem) => void;
  /** fires once the grace window elapses (or the bar is dismissed) and the item is gone for good */
  onExpire?: (item: UndertowItem) => void;
  className?: string;
}

const BAR_HEIGHT = 28; // px — the collapsed bar's fixed height
const COLLAPSE_MS = 250; // height spring: full row -> bar
const SNAPBACK_MS = 420; // cancel: bar position + row height spring back together
// no-overshoot deceleration for the collapse (matches the "glide" curve used
// elsewhere in this registry for settle/collapse transitions)
const COLLAPSE_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
// ease-out-back: the explicit overshoot the brief calls for on cancel only
const SNAPBACK_EASE = "cubic-bezier(0.34, 1.56, 0.64, 1)";

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
      <path
        d="M3 4.5h10M6.5 4.5V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1.5M4.5 4.5l.6 8.2a1 1 0 0 0 1 .8h3.8a1 1 0 0 0 1-.8l.6-8.2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ReturnArrowIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3 shrink-0" fill="none" aria-hidden>
      <path
        d="M11.5 5.5H6a2.5 2.5 0 0 0 0 5h2.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.6 3.4 11.5 5.5 8.6 7.6"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Row({
  item,
  onDelete,
}: {
  item: UndertowItem;
  onDelete: (fromHeight: number) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  return (
    <li className="border-b border-border last:border-b-0" data-uw-row>
      <div ref={rowRef} className="flex items-center gap-3 px-4 py-3">
        <p className="min-w-0 flex-1 truncate text-sm text-foreground">{item.title}</p>
        <button
          type="button"
          data-uw-delete
          onClick={() => onDelete(rowRef.current?.getBoundingClientRect().height ?? 0)}
          aria-label={`Delete ${item.title}`}
          className="shrink-0 rounded-sm p-1.5 text-muted transition-colors hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <TrashIcon />
        </button>
      </div>
    </li>
  );
}

function BarRow({
  item,
  graceMs,
  reduced,
  fromHeight,
  onRestore,
  onExpire,
}: {
  item: UndertowItem;
  graceMs: number;
  reduced: boolean;
  fromHeight: number;
  onRestore: () => void;
  onExpire: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLButtonElement>(null);
  const driftRef = useRef<Animation | null>(null);
  const collapseRef = useRef<Animation | null>(null);
  const travelRef = useRef(0);
  const hoverRef = useRef(false);
  const focusRef = useRef(false);
  const settledRef = useRef(false); // true once restored or expired — guards double-fire
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [remaining, setRemaining] = useState(Math.ceil(graceMs / 1000));
  const [flash, setFlash] = useState(false);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const track = trackRef.current;
    const bar = barRef.current;
    if (!wrap || !track || !bar) return;

    // focus moves to the bar the instant it exists — Enter is immediate undo,
    // independent of whether the collapse has visually finished yet
    bar.focus();

    const startDrift = () => {
      const trackWidth = track.clientWidth;
      const barWidth = bar.offsetWidth;
      const travel = Math.max(0, trackWidth - barWidth);
      travelRef.current = travel;
      const targetX = reduced ? 0 : travel;
      const anim = bar.animate(
        [{ transform: "translateX(0px)" }, { transform: `translateX(${targetX}px)` }],
        { duration: Math.max(1, graceMs), easing: "linear", fill: "forwards" }
      );
      driftRef.current = anim;
      anim.onfinish = () => {
        if (settledRef.current) return;
        settledRef.current = true;
        const fade = bar.animate(
          [{ opacity: 1 }, { opacity: 0 }],
          { duration: reduced ? 1 : 200, easing: "ease-out", fill: "forwards" }
        );
        fade.onfinish = () => onExpire();
      };
    };

    if (reduced) {
      // reduced motion: no clock to race visually, but the state change
      // (full row -> bar) still happens, just without the spring
      wrap.style.height = `${BAR_HEIGHT}px`;
      startDrift();
    } else {
      wrap.style.height = `${fromHeight}px`;
      const anim = wrap.animate(
        [{ height: `${fromHeight}px` }, { height: `${BAR_HEIGHT}px` }],
        { duration: COLLAPSE_MS, easing: COLLAPSE_EASE, fill: "forwards" }
      );
      collapseRef.current = anim;
      anim.onfinish = () => {
        wrap.style.height = `${BAR_HEIGHT}px`;
        startDrift();
      };
    }

    return () => {
      driftRef.current?.cancel();
      collapseRef.current?.cancel();
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
    // fromHeight/graceMs/reduced are fixed for this bar's lifetime — a prop
    // change mid-flight shouldn't restart the clock out from under it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // aria-label's "N seconds left" updates on a coarse 1s tick, reading the
  // live Animation.currentTime rather than keeping a second, racy clock
  useEffect(() => {
    const tick = () => {
      const anim = driftRef.current;
      const elapsed = anim ? Number(anim.currentTime) || 0 : 0;
      setRemaining(Math.max(0, Math.ceil((graceMs - elapsed) / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [graceMs]);

  function pause() {
    (driftRef.current ?? collapseRef.current)?.pause();
  }
  function maybeResume() {
    if (hoverRef.current || focusRef.current) return;
    const anim = driftRef.current ?? collapseRef.current;
    if (anim && anim.playState === "paused") anim.play();
  }

  function handleUndo() {
    if (settledRef.current) return;
    settledRef.current = true;

    const wrap = wrapRef.current;
    const bar = barRef.current;

    flashTimerRef.current = setTimeout(() => setFlash(false), 300);
    setFlash(true);

    if (!wrap || !bar) {
      onRestore();
      return;
    }

    // read live state before cancelling — cancel() nulls Animation.currentTime
    const currentWrapHeight = wrap.getBoundingClientRect().height;
    const driftAnim = driftRef.current;
    const elapsed = driftAnim ? Number(driftAnim.currentTime) || 0 : 0;
    const frac = graceMs > 0 ? Math.min(1, elapsed / graceMs) : 0;
    const barX = frac * travelRef.current;

    driftAnim?.cancel();
    collapseRef.current?.cancel();

    if (reduced) {
      wrap.style.height = `${fromHeight}px`;
      onRestore();
      return;
    }

    bar.animate(
      [{ transform: `translateX(${barX}px)` }, { transform: "translateX(0px)" }],
      { duration: SNAPBACK_MS, easing: SNAPBACK_EASE, fill: "forwards" }
    );
    const grow = wrap.animate(
      [{ height: `${currentWrapHeight}px` }, { height: `${fromHeight}px` }],
      { duration: SNAPBACK_MS, easing: SNAPBACK_EASE, fill: "forwards" }
    );
    grow.onfinish = () => onRestore();
  }

  return (
    <li className="border-b border-border last:border-b-0" data-uw-row>
      <div ref={wrapRef} className="overflow-hidden">
        <div ref={trackRef} className="relative" style={{ height: BAR_HEIGHT }}>
          <button
            ref={barRef}
            type="button"
            data-uw-bar
            onClick={handleUndo}
            onPointerEnter={() => {
              hoverRef.current = true;
              pause();
            }}
            onPointerLeave={() => {
              hoverRef.current = false;
              maybeResume();
            }}
            onFocus={() => {
              focusRef.current = true;
              pause();
            }}
            onBlur={() => {
              focusRef.current = false;
              maybeResume();
            }}
            aria-label={`Deleted ${item.title}, undo, ${remaining} second${remaining === 1 ? "" : "s"} left`}
            className={[
              "absolute left-0 top-0 inline-flex h-full max-w-[65%] items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-sm border bg-surface px-2 font-mono text-xs text-muted",
              "transition-colors duration-150 hover:text-foreground",
              flash ? "border-foreground" : "border-border hover:border-foreground/50",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            ].join(" ")}
          >
            <ReturnArrowIcon />
            <span className="truncate">{item.title}</span>
            {reduced && (
              <span aria-hidden className="tabular-nums text-muted">
                {remaining}s
              </span>
            )}
          </button>
        </div>
      </div>
    </li>
  );
}

export function UndertowDrift({
  items,
  graceMs = 6000,
  onDelete,
  onRestore,
  onExpire,
  className = "",
}: UndertowDriftProps) {
  const [rows, setRows] = useState(() =>
    items.map((it) => ({ ...it, pending: false, fromHeight: 0 }))
  );
  const [announcement, setAnnouncement] = useState("");
  const reduced = useReducedMotion();
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  function handleDelete(id: string, fromHeight: number) {
    const item = rowsRef.current.find((r) => r.id === id);
    if (!item) return;
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, pending: true, fromHeight } : r)));
    onDelete?.(item);
    setAnnouncement(`Deleted ${item.title}. Undo available for ${Math.round(graceMs / 1000)} seconds.`);
  }

  function handleRestore(id: string) {
    const item = rowsRef.current.find((r) => r.id === id);
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, pending: false } : r)));
    if (item) {
      onRestore?.(item);
      setAnnouncement(`Restored ${item.title}.`);
    }
  }

  function handleExpire(id: string) {
    const item = rowsRef.current.find((r) => r.id === id);
    setRows((rs) => rs.filter((r) => r.id !== id));
    if (item) onExpire?.(item);
  }

  return (
    <div className={className}>
      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
          Nothing here.
        </p>
      ) : (
        <ul data-uw-list className="overflow-hidden rounded-md border border-border bg-surface">
          {rows.map((r) =>
            r.pending ? (
              <BarRow
                key={r.id}
                item={r}
                graceMs={graceMs}
                reduced={reduced}
                fromHeight={r.fromHeight}
                onRestore={() => handleRestore(r.id)}
                onExpire={() => handleExpire(r.id)}
              />
            ) : (
              <Row key={r.id} item={r} onDelete={(h) => handleDelete(r.id, h)} />
            )
          )}
        </ul>
      )}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
