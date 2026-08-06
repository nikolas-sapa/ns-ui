"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";

// ---------------------------------------------------------------------------
// ImpulseCradle — a toast stack that behaves like a Newton's cradle. A new
// toast swings in from the top with an accelerating (ease-in) entrance and
// "strikes" the queue; the impact travels down through every already-queued
// toast as a fast domino of 2-3px shunts, staggered 35ms apart, so the eye
// reads how deep the stack is without counting anything. Under capacity that
// impulse simply dissipates — the last toast shunts and returns. At capacity
// the same impulse instead carries the oldest toast off the far (bottom) end:
// it inherits the shunt's momentum and departs with an ease-out arc, a slight
// rotation, and a fade — conservation of notifications, visibly enforced.
// Pure DOM transforms via the Web Animations API, tokens only, no canvas.
// ---------------------------------------------------------------------------

export type ImpulseSeverity = "info" | "error";

export interface ImpulseToastInput {
  severity?: ImpulseSeverity;
  title: string;
  message?: string;
  /** ms before auto-dismiss; 0 disables; defaults to the stack `duration` */
  duration?: number;
}

export interface ImpulseCradleHandle {
  /** swing a new toast into the stack, returns its id */
  push: (toast: ImpulseToastInput) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

type ToastRec = {
  id: string;
  severity: ImpulseSeverity;
  title: string;
  message?: string;
  duration: number;
};

type HistoryReason = "dismissed" | "expired" | "evicted";
type HistoryRec = ToastRec & { reason: HistoryReason; at: number };

type TimerEntry = { handle: number | null; deadline: number; remaining: number };
type PauseReason = "hover" | "focus";

const SHUNT_STAGGER = 35; // ms between each toast's impulse pulse
const SHUNT_MS = 60;
const SHUNT_PX = 3;
const EJECT_MS = 340;
const ENTER_MS = 200;
const EXIT_MS = 150;
const EASE_IN = "cubic-bezier(.55,.06,.68,.19)"; // accelerating, released-ball entrance
const EASE_OUT = "cubic-bezier(0.16,1,0.3,1)"; // decelerating, matches the eject's inherited velocity

const ICONS: Record<ImpulseSeverity, ReactNode> = {
  error: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="m15 9-6 6M9 9l6 6" />
    </svg>
  ),
  info: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 4.5-5" />
    </svg>
  ),
};

function CardShell({ toast, onDismiss }: { toast: ToastRec; onDismiss: () => void }) {
  return (
    <div className="flex items-start gap-2.5 py-2.5 pl-3 pr-1.5">
      <span className="mt-0.5 shrink-0 text-ns-muted">{ICONS[toast.severity]}</span>
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-[13px] leading-tight text-foreground ${
            toast.severity === "error" ? "font-semibold" : "font-medium"
          }`}
        >
          {toast.title}
        </p>
        {toast.message ? (
          <p className="mt-0.5 truncate font-mono text-[11px] leading-tight text-ns-muted">
            {toast.message}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        aria-label={`Dismiss: ${toast.title}`}
        onClick={onDismiss}
        className="shrink-0 cursor-pointer rounded-sm p-1 text-ns-muted transition-colors duration-150 hover:bg-foreground/10 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ns-accent"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export const ImpulseCradle = forwardRef<
  ImpulseCradleHandle,
  {
    /** how many toasts the stack shows before the impulse starts ejecting */
    maxVisible?: number;
    /** ms before a toast auto-dismisses (paused on hover/focus); 0 disables */
    duration?: number;
    /** toasts present at mount */
    initial?: ImpulseToastInput[];
    /** extra classes merged onto the rendered root element */
    className?: string;
    /** accessible name for the toast stack */
    "aria-label"?: string;
  }
>(function ImpulseCradle(
  {
    maxVisible = 4,
    duration = 5000,
    initial,
    className = "w-full max-w-sm",
    "aria-label": ariaLabel = "Notifications",
  },
  ref
) {
  const cap = Math.max(1, maxVisible);
  const regionRef = useRef<HTMLDivElement>(null);
  const historyPanelId = useId();

  const seqRef = useRef(0);
  const liveSeqRef = useRef(0);
  const toastsRef = useRef<ToastRec[]>([]);
  const timersRef = useRef<Map<string, TimerEntry>>(new Map());
  const pauseReasonsRef = useRef<Map<string, Set<PauseReason>>>(new Map());
  const cardElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const enteredRef = useRef<Set<string>>(new Set());
  const exitingIdsRef = useRef<Set<string>>(new Set());
  const evictDelayRef = useRef<Map<string, number>>(new Map());
  const evictAttachedRef = useRef<Set<string>>(new Set());

  const [toasts, setToasts] = useState<ToastRec[]>(() =>
    (initial ?? []).map((t, i) => ({
      id: `ic-init-${i}`,
      severity: t.severity ?? "info",
      title: t.title,
      message: t.message,
      duration: t.duration ?? duration,
    }))
  );
  toastsRef.current = toasts;
  const [evicting, setEvicting] = useState<ToastRec[]>([]);
  const [history, setHistory] = useState<HistoryRec[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [live, setLive] = useState<{ text: string; level: "polite" | "assertive"; seq: number }>({
    text: "",
    level: "polite",
    seq: -1,
  });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const announce = useCallback((text: string, level: "polite" | "assertive") => {
    setLive({ text, level, seq: ++liveSeqRef.current });
  }, []);

  const pushHistory = useCallback((t: ToastRec, reason: HistoryReason) => {
    setHistory((prev) => [{ ...t, reason, at: Date.now() }, ...prev].slice(0, 12));
  }, []);

  const clearTimer = useCallback((id: string) => {
    const entry = timersRef.current.get(id);
    if (entry?.handle !== null && entry) clearTimeout(entry.handle);
    timersRef.current.delete(id);
    pauseReasonsRef.current.delete(id);
  }, []);

  const dismiss = useCallback(
    (id: string, reason: HistoryReason = "dismissed") => {
      if (exitingIdsRef.current.has(id)) return;
      const t = toastsRef.current.find((x) => x.id === id);
      if (!t) return;
      exitingIdsRef.current.add(id);
      clearTimer(id);
      const el = cardElsRef.current.get(id);
      const finish = () => {
        exitingIdsRef.current.delete(id);
        cardElsRef.current.delete(id);
        enteredRef.current.delete(id);
        setToasts((prev) => prev.filter((x) => x.id !== id));
        pushHistory(t, reason);
      };
      if (el) {
        const anim = el.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: EXIT_MS,
          easing: "ease-out",
          fill: "forwards",
        });
        anim.finished.catch(() => {}).finally(finish);
      } else {
        finish();
      }
    },
    [clearTimer, pushHistory]
  );

  const armTimer = useCallback(
    (t: ToastRec) => {
      if (t.duration <= 0) return;
      timersRef.current.set(t.id, {
        handle: window.setTimeout(() => dismiss(t.id, "expired"), t.duration),
        deadline: Date.now() + t.duration,
        remaining: t.duration,
      });
    },
    [dismiss]
  );

  const pauseTimer = useCallback((id: string, reason: PauseReason) => {
    const reasons = pauseReasonsRef.current.get(id) ?? new Set<PauseReason>();
    reasons.add(reason);
    pauseReasonsRef.current.set(id, reasons);
    const entry = timersRef.current.get(id);
    if (entry?.handle !== null && entry) {
      clearTimeout(entry.handle);
      entry.handle = null;
      entry.remaining = Math.max(0, entry.deadline - Date.now());
    }
  }, []);

  const resumeTimer = useCallback(
    (id: string, reason: PauseReason) => {
      const reasons = pauseReasonsRef.current.get(id);
      if (reasons) {
        reasons.delete(reason);
        if (reasons.size > 0) return;
      }
      const entry = timersRef.current.get(id);
      if (!entry || entry.handle !== null) return;
      const ms = Math.max(400, entry.remaining);
      entry.deadline = Date.now() + ms;
      entry.handle = window.setTimeout(() => dismiss(id, "expired"), ms);
    },
    [dismiss]
  );

  const finalizeEvict = useCallback(
    (t: ToastRec) => {
      evictAttachedRef.current.delete(t.id);
      cardElsRef.current.delete(t.id);
      setEvicting((prev) => prev.filter((x) => x.id !== t.id));
      pushHistory(t, "evicted");
    },
    [pushHistory]
  );

  // entrance: every freshly-mounted toast card plays this exactly once — by
  // construction the only card that ever mounts fresh is the newest arrival,
  // since surviving cards keep their DOM identity (same React key) and just
  // ride out the shunt in place instead of remounting.
  const attachCard = useCallback(
    (id: string, el: HTMLDivElement | null) => {
      if (!el) return;
      cardElsRef.current.set(id, el);
      if (enteredRef.current.has(id)) return;
      enteredRef.current.add(id);
      if (reduced) {
        el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: EXIT_MS, easing: "ease-out" });
      } else {
        el.animate(
          [
            { transform: "translateY(-26px) scale(0.97)", opacity: 0 },
            { transform: "translateY(0) scale(1)", opacity: 1 },
          ],
          { duration: ENTER_MS, easing: EASE_IN }
        );
      }
    },
    [reduced]
  );

  // eviction: the oldest toast, bumped out of the visible cap, keeps
  // rendering (in an inert overlay list) just long enough to play its
  // departure, inheriting the same stagger slot the shunt cascade would have
  // given it had it survived.
  const attachEvicting = useCallback(
    (t: ToastRec, el: HTMLDivElement | null) => {
      if (!el || evictAttachedRef.current.has(t.id)) return;
      evictAttachedRef.current.add(t.id);
      const delay = evictDelayRef.current.get(t.id) ?? 0;
      const anim = reduced
        ? el.animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: EXIT_MS,
            easing: "ease-out",
            fill: "forwards",
          })
        : el.animate(
            [
              { transform: "translateY(0px) rotate(0deg)", opacity: 1 },
              { transform: "translateY(10px) rotate(2deg)", opacity: 1, offset: 0.35 },
              { transform: "translateY(46px) rotate(9deg)", opacity: 0 },
            ],
            { duration: EJECT_MS, delay, easing: EASE_OUT, fill: "forwards" }
          );
      anim.finished
        .catch(() => {})
        .finally(() => finalizeEvict(t));
    },
    [reduced, finalizeEvict]
  );

  const push = useCallback(
    (input: ImpulseToastInput): string => {
      const id = `ic-${++seqRef.current}`;
      const severity: ImpulseSeverity = input.severity ?? "info";
      const rec: ToastRec = {
        id,
        severity,
        title: input.title,
        message: input.message,
        duration: input.duration ?? duration,
      };

      const prev = toastsRef.current;
      const overCap = prev.length >= cap;
      const kept = overCap ? prev.slice(0, Math.max(0, cap - 1)) : prev;
      const ejected = overCap ? prev[prev.length - 1] : null;
      const next = [rec, ...kept];
      toastsRef.current = next;
      setToasts(next);

      if (ejected) {
        clearTimer(ejected.id);
        evictDelayRef.current.set(ejected.id, kept.length * SHUNT_STAGGER);
        setEvicting((ev) => [...ev, ejected]);
      }

      armTimer(rec);
      announce(
        `${severity === "error" ? "Error" : "Notification"}: ${rec.title}${
          rec.message ? `. ${rec.message}` : ""
        }`,
        severity === "error" ? "assertive" : "polite"
      );

      // the impulse cascade — every toast that survives the push (i.e. every
      // toast except the new arrival) gets a 3px shunt toward the far end,
      // staggered 35ms deeper per position, then springs back. The ejected
      // toast plays the matching (but non-returning) motion in attachEvicting.
      if (!reduced) {
        requestAnimationFrame(() => {
          kept.forEach((t, i) => {
            const el = cardElsRef.current.get(t.id);
            el?.animate(
              [
                { transform: "translateY(0px)" },
                { transform: `translateY(${SHUNT_PX}px)`, offset: 0.4 },
                { transform: "translateY(0px)" },
              ],
              { duration: SHUNT_MS, delay: (i + 1) * SHUNT_STAGGER, easing: "ease-out" }
            );
          });
        });
      }

      return id;
    },
    [cap, duration, armTimer, announce, clearTimer, reduced]
  );

  const clear = useCallback(() => {
    for (const t of toastsRef.current) dismiss(t.id);
  }, [dismiss]);

  useImperativeHandle(ref, () => ({ push, dismiss, clear }), [push, dismiss, clear]);

  // arm timers for `initial` toasts seeded at mount (push() handles its own)
  useEffect(() => {
    for (const t of toastsRef.current) {
      if (!timersRef.current.has(t.id)) armTimer(t);
    }
    // deliberately mount-only: push() arms its own toasts as they arrive
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // teardown: every pending timer dies with the component
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const entry of timers.values()) if (entry.handle !== null) clearTimeout(entry.handle);
      timers.clear();
    };
  }, []);

  // F6 (pane-jump convention): send focus straight to the toast region —
  // the newest toast if one is present, otherwise the region landmark itself.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "F6") return;
      const root = regionRef.current;
      if (!root) return;
      e.preventDefault();
      const firstToast = root.querySelector<HTMLElement>("[data-ic-toast]");
      (firstToast ?? root).focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={`relative ${className}`}>
      <div
        ref={regionRef}
        role="region"
        aria-label={ariaLabel}
        tabIndex={-1}
        className="flex flex-col gap-2 outline-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            ref={(el) => attachCard(t.id, el)}
            data-ic-toast
            role={t.severity === "error" ? "alert" : "status"}
            aria-label={`${t.severity === "error" ? "Error" : "Notification"}: ${t.title}`}
            tabIndex={0}
            onPointerEnter={() => pauseTimer(t.id, "hover")}
            onPointerLeave={() => resumeTimer(t.id, "hover")}
            onFocus={() => pauseTimer(t.id, "focus")}
            onBlur={() => resumeTimer(t.id, "focus")}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                dismiss(t.id);
              }
            }}
            className="overflow-hidden rounded-sm border border-border bg-background will-change-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            <CardShell toast={t} onDismiss={() => dismiss(t.id)} />
          </div>
        ))}
        {evicting.map((t) => (
          <div
            key={`evict-${t.id}`}
            ref={(el) => attachEvicting(t, el)}
            aria-hidden="true"
            className="pointer-events-none overflow-hidden rounded-sm border border-border bg-background will-change-transform"
          >
            <CardShell toast={t} onDismiss={() => {}} />
          </div>
        ))}
      </div>

      {history.length > 0 ? (
        <div className="mt-2">
          <button
            type="button"
            data-ic-history-toggle
            aria-expanded={historyOpen}
            aria-controls={historyPanelId}
            onClick={() => setHistoryOpen((v) => !v)}
            className="cursor-pointer rounded-sm border border-border px-2 py-1 font-mono text-[11px] tracking-wide text-ns-muted transition-colors duration-150 hover:border-foreground/20 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            History ({history.length})
          </button>
          {historyOpen ? (
            <ul
              id={historyPanelId}
              className="mt-1.5 flex flex-col gap-1 rounded-sm border border-border p-2"
            >
              {history.map((h) => (
                <li
                  key={`${h.id}-${h.at}`}
                  data-ic-history-item
                  className="flex items-baseline justify-between gap-3 font-mono text-[11px]"
                >
                  <span className="truncate text-foreground">{h.title}</span>
                  <span className="shrink-0 text-ns-muted">{h.reason}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {/* single shared announcer: politeness swaps between info and error by
          remounting on `seq`, since a live region's live-ness is typically
          fixed at first AT encounter — physics-only reflow never touches
          this, so an existing toast is never re-announced */}
      <div key={live.seq} role="status" aria-live={live.level} aria-atomic="true" className="sr-only">
        {live.text}
      </div>
    </div>
  );
});
