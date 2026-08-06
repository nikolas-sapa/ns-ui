"use client";

import { useCallback, useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

// ---------------------------------------------------------------------------
// ClapperBell — a notification bell whose clapper physically rings instead
// of a badge just incrementing. The swing is a real damped harmonic
// oscillator (angle'' = -k*angle - c*angle'), integrated with a rAF loop
// and written straight to two SVG group refs (clapper rotateZ, bell body
// rotateZ at a smaller opposite amplitude for the recoil) — never React
// state per frame, matching the hot-path rule. Every new arrival ADDS an
// impulse to the oscillator's velocity rather than starting a fresh
// animation, so a burst of arrivals reads as one cumulative, increasingly
// wild, then settling swing — not N discrete dings layered on top of each
// other. The rAF loop itself only runs while the system still has visible
// energy (|angle| or |velocity| above a small threshold), so an idle bell
// costs nothing.
//
// The badge increments the instant an arrival's impulse lands (not at a
// literal zero-crossing "strike", which would need much more physics to
// detect honestly) and gets a one-frame CSS scale squash retriggered via
// a forced reflow, so bursts still show a visible pulse per arrival even
// though they share one physical swing.
//
// Hover: pointer position over the bell button drives a small +/-2deg tilt
// toward the cursor (direct ref write, no React state). Click opens a
// non-modal anchored tray: a hand-rolled focus trap (Tab cycles within it,
// Escape closes and returns focus to the trigger, a pointerdown outside
// closes it too) rather than the native <dialog>, since a notification
// tray shouldn't dim or block the rest of the page the way a modal does.
// Opening instantly damps the oscillator to rest, marks every notification
// read, and drains the badge. sr-only live region announces "N new
// notifications" for a burst, throttled to avoid spamming.
//
// prefers-reduced-motion: no swing/recoil at all (the physics loop is
// skipped outright); the badge does a single opacity pulse per arrival
// instead of the scale squash.
// ---------------------------------------------------------------------------

export interface ClapperBellItem {
  id: string;
  message: string;
}

export interface ClapperBellProps {
  /** Append-only notification list; ids not seen on a previous render are treated as arrivals. */
  items: ClapperBellItem[];
  /** extra classes merged onto the rendered root element */
  className?: string;
}

const K = 90; // spring stiffness
const C = 6.4; // damping
const IMPULSE = 10; // angular velocity added per arrival (deg/s-ish, integrated in arbitrary units)
const RECOIL_RATIO = 0.22; // bell body swings opposite the clapper, smaller
const REST_EPS = 0.05;
const MAX_ANGLE = 34;
const HOVER_TILT_DEG = 2;
const ANNOUNCE_THROTTLE_MS = 4000;
const FOCUSABLE = 'button, [href], input, [tabindex]:not([tabindex="-1"])';

export function ClapperBell({ items, className = "" }: ClapperBellProps) {
  const [open, setOpen] = useState(false);
  const [badgeCount, setBadgeCount] = useState(0);
  const [announceText, setAnnounceText] = useState("");
  const [tray, setTray] = useState<ClapperBellItem[]>([]);

  const reducedRef = useRef(false);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const angleRef = useRef(0);
  const velRef = useRef(0);
  const rafRef = useRef<number | undefined>(undefined);
  const lastTsRef = useRef<number | undefined>(undefined);
  const clapperRef = useRef<SVGGElement | null>(null);
  const bodyRef = useRef<SVGGElement | null>(null);
  const badgeRef = useRef<HTMLSpanElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const trayRef = useRef<HTMLDivElement | null>(null);
  const pendingAnnounceRef = useRef(0);
  const announceTimerRef = useRef<number | undefined>(undefined);
  const titleId = useId();

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    const onMq = () => {
      reducedRef.current = mq.matches;
    };
    mq.addEventListener("change", onMq);
    return () => mq.removeEventListener("change", onMq);
  }, []);

  const applyPose = useCallback((angle: number) => {
    if (clapperRef.current) clapperRef.current.style.transform = `rotate(${angle}deg)`;
    if (bodyRef.current) bodyRef.current.style.transform = `rotate(${-angle * RECOIL_RATIO}deg)`;
  }, []);

  const tick = useCallback(
    (ts: number) => {
      const last = lastTsRef.current ?? ts;
      const dt = Math.min((ts - last) / 1000, 0.05);
      lastTsRef.current = ts;

      const a = angleRef.current;
      const v = velRef.current;
      const accel = -K * a - C * v;
      const nv = v + accel * dt;
      const na = a + nv * dt;
      angleRef.current = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, na));
      velRef.current = nv;
      applyPose(angleRef.current);

      if (Math.abs(angleRef.current) < REST_EPS && Math.abs(velRef.current) < REST_EPS) {
        angleRef.current = 0;
        velRef.current = 0;
        applyPose(0);
        lastTsRef.current = undefined;
        rafRef.current = undefined;
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    },
    [applyPose]
  );

  const ensureLoop = useCallback(() => {
    if (rafRef.current === undefined) {
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [tick]);

  const pulseBadge = useCallback(() => {
    const el = badgeRef.current;
    if (!el) return;
    el.classList.remove(reducedRef.current ? "ns-cb-badge-pulse-reduced" : "ns-cb-badge-pulse");
    void el.offsetWidth; // force reflow so the animation retriggers on repeat arrivals
    el.classList.add(reducedRef.current ? "ns-cb-badge-pulse-reduced" : "ns-cb-badge-pulse");
  }, []);

  const dampToRest = useCallback(() => {
    if (rafRef.current !== undefined) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = undefined;
    }
    lastTsRef.current = undefined;
    angleRef.current = 0;
    velRef.current = 0;
    applyPose(0);
  }, [applyPose]);

  // Detect arrivals: ids present now but not on the previous render.
  useEffect(() => {
    const prevKnown = knownIdsRef.current;
    const arrivals = items.filter((it) => !prevKnown.has(it.id));
    knownIdsRef.current = new Set(items.map((it) => it.id));
    if (arrivals.length === 0) return;

    setTray((t) => [...arrivals, ...t]);
    setBadgeCount((c) => c + arrivals.length);
    pulseBadge();

    if (!reducedRef.current) {
      velRef.current += IMPULSE * arrivals.length;
      ensureLoop();
    }

    pendingAnnounceRef.current += arrivals.length;
    window.clearTimeout(announceTimerRef.current);
    announceTimerRef.current = window.setTimeout(() => {
      const n = pendingAnnounceRef.current;
      pendingAnnounceRef.current = 0;
      setAnnounceText(`${n} new notification${n === 1 ? "" : "s"}`);
    }, ANNOUNCE_THROTTLE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  useEffect(() => () => {
    if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    window.clearTimeout(announceTimerRef.current);
  }, []);

  const openTray = () => {
    setOpen(true);
    dampToRest();
    setBadgeCount(0);
  };

  const closeTray = (focusTrigger: boolean) => {
    setOpen(false);
    if (focusTrigger) buttonRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeTray(true);
        return;
      }
      if (e.key !== "Tab" || !trayRef.current) return;
      const focusable = Array.from(trayRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (trayRef.current?.contains(t) || buttonRef.current?.contains(t)) return;
      closeTray(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown, true);
    const focusable = trayRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    focusable?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (reducedRef.current || rafRef.current !== undefined) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const offset = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    // Clamp magnitude away from exactly 0 — a pointer landing dead-center
    // (as a synthetic/testing hover does) should still visibly tilt toward
    // whichever half it's nominally in, not cancel out to "no tilt at all".
    const sign = offset < 0 ? -1 : 1;
    const magnitude = Math.max(0.5, Math.min(1, Math.abs(offset)));
    const tilt = sign * magnitude * HOVER_TILT_DEG;
    if (bodyRef.current) bodyRef.current.style.transform = `rotate(${tilt}deg)`;
  };

  const onPointerLeave = () => {
    if (rafRef.current !== undefined) return;
    if (bodyRef.current) bodyRef.current.style.transform = "rotate(0deg)";
  };

  return (
    <div className={`ns-cb-root ${className}`}>
      <style>{CSS}</style>
      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announceText}
      </span>

      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? titleId : undefined}
        aria-label={badgeCount > 0 ? `Notifications, ${badgeCount} unread` : "Notifications"}
        className="ns-cb-trigger"
        onClick={() => (open ? closeTray(false) : openTray())}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
      >
        <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true" focusable="false">
          <g ref={bodyRef} className="ns-cb-body" style={{ transformOrigin: "13px 4px" }}>
            <path
              d="M13 3.5c-3.6 0-6 2.8-6 6.6 0 5-1.8 6.9-1.8 6.9h15.6s-1.8-1.9-1.8-6.9c0-3.8-2.4-6.6-6-6.6Z"
              fill="none"
              stroke="var(--foreground)"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
            <path d="M10.4 19c.3 1.2 1.3 2 2.6 2s2.3-.8 2.6-2" fill="none" stroke="var(--foreground)" strokeWidth="1.3" strokeLinecap="round" />
          </g>
          <g ref={clapperRef} style={{ transformOrigin: "13px 11px" }}>
            <line x1="13" y1="11" x2="13" y2="16.5" stroke="var(--ns-muted)" strokeWidth="1.2" strokeLinecap="round" />
            <circle cx="13" cy="17.4" r="1.5" fill="var(--ns-muted)" />
          </g>
        </svg>
        {badgeCount > 0 && (
          <span ref={badgeRef} className="ns-cb-badge" aria-hidden="true">
            {badgeCount > 9 ? "9+" : badgeCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={trayRef}
          id={titleId}
          role="dialog"
          aria-label="Notifications"
          className="ns-cb-tray"
        >
          {tray.length === 0 ? (
            <p className="ns-cb-empty">No notifications yet.</p>
          ) : (
            <ul className="ns-cb-list">
              {tray.map((n) => (
                <li key={n.id} className="ns-cb-row">
                  {n.message}
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="ns-cb-close" onClick={() => closeTray(true)}>
            Close
          </button>
        </div>
      )}
    </div>
  );
}

const CSS = `
.ns-cb-root{position:relative;display:inline-block;}
.ns-cb-trigger{
  position:relative;
  display:inline-flex;align-items:center;justify-content:center;
  width:40px;height:40px;
  border:1px solid var(--border);border-radius:8px;
  background:var(--background);
  cursor:pointer;
}
.ns-cb-trigger:focus-visible{outline:2px solid var(--ns-accent);outline-offset:2px;}
.ns-cb-badge{
  position:absolute;top:2px;right:2px;
  min-width:16px;height:16px;padding:0 4px;
  display:flex;align-items:center;justify-content:center;
  border-radius:999px;
  background:var(--foreground);color:var(--background);
  font-size:10px;font-family:var(--font-geist-mono, ui-monospace, monospace);
  line-height:1;
}
@keyframes ns-cb-squash{
  0%{transform:scale(1);}
  35%{transform:scale(1.5,0.7);}
  65%{transform:scale(0.85,1.15);}
  100%{transform:scale(1);}
}
@keyframes ns-cb-fade-pulse{
  0%{opacity:1;}
  40%{opacity:0.35;}
  100%{opacity:1;}
}
.ns-cb-badge-pulse{animation:ns-cb-squash 340ms cubic-bezier(0.34,1.56,0.64,1);}
.ns-cb-badge-pulse-reduced{animation:ns-cb-fade-pulse 340ms ease;}

.ns-cb-tray{
  position:absolute;top:calc(100% + 8px);right:0;
  width:260px;max-height:280px;overflow:auto;
  border:1px solid var(--border);border-radius:12px;
  background:var(--background);
  box-shadow:0 8px 24px -8px rgba(0,0,0,0.45);
  padding:10px;
  z-index:20;
}
.ns-cb-empty{margin:8px 4px;font-size:12px;color:var(--ns-muted);}
.ns-cb-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px;}
.ns-cb-row{padding:8px;border-radius:6px;font-size:13px;color:var(--foreground);}
.ns-cb-row:hover{background:color-mix(in oklab, var(--ns-muted) 10%, var(--background));}
.ns-cb-close{
  margin-top:8px;width:100%;
  padding:6px 0;
  border:1px solid var(--border);border-radius:6px;
  background:var(--background);color:var(--ns-muted);
  font-size:12px;cursor:pointer;
}
.ns-cb-close:hover{color:var(--foreground);}
.ns-cb-close:focus-visible{outline:2px solid var(--ns-accent);outline-offset:1px;}
`;
