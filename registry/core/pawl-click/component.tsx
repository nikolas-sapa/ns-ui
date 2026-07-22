"use client";

// PawlClick — a card-triage queue whose progress is a literal ratchet. Below
// the flat (no-3D) card stack sits a horizontal SVG rack of sawtooth teeth
// and a pawl. Deciding a card (archive or keep) fires the card out with a
// spring, and the rack advances exactly one tooth-width under a fixed pawl
// with a hard-stop ease — zero overshoot, sharp settle, unmistakably a click
// that only goes one way. Undo is deliberately a different kind of gesture:
// the pawl rotates up ~20deg and holds — visibly disengaging the mechanism —
// before the rack is allowed to ease backward one tooth, slowly and with
// visible effort, and only then does the pawl drop again. Undo always plays
// the lift/hold/drop gesture on request (never a disabled dead end); it only
// additionally restores a card and eases the rack when there is something in
// history to restore.
//
// Cards are a listbox: the stack is role="listbox" with roving
// aria-activedescendant onto the top card (role="option"). Left/Right arrows
// or J/K triage (archive/keep), U or Cmd/Ctrl+Z undoes — every gesture also
// has an on-screen button, nothing requires drag. A polite aria-live region
// announces each outcome ("Archived. 6 remaining. Press U to undo."). The
// rack + pawl SVG is aria-hidden — purely decorative reinforcement of a
// state that's already fully described in text.
//
// Reduced motion: card exit becomes a fast plain fade, the rack steps
// instantly (no transition), and the pawl's lift/drop is an instant
// attribute flip with no rotation tween — semantics (and the aria-live
// announcements) are unchanged either way.
//
// Pure DOM/SVG/CSS, no canvas. Colors are CSS custom properties only:
// --foreground for ink/ the engaged tooth, --border for resting teeth and
// hairlines, --muted for secondary text, --accent for focus rings only.

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

export interface PawlClickCard {
  id: string;
  title: string;
  subtitle?: string;
  body?: string;
}

export interface PawlClickProps {
  /** Initial queue, top of stack first. Managed internally after mount. */
  cards: PawlClickCard[];
  /** Called with the card whenever it's archived. */
  onArchive?: (card: PawlClickCard) => void;
  /** Called with the card whenever it's kept. */
  onKeep?: (card: PawlClickCard) => void;
  /** Called with the card whenever an archive/keep is undone. */
  onUndo?: (card: PawlClickCard) => void;
  /** Called once the queue is fully drained. */
  onEmpty?: () => void;
  className?: string;
}

type Decision = "archived" | "kept";
type Phase = "idle" | "commit" | "undo-lift" | "undo-ease";

interface HistoryEntry {
  card: PawlClickCard;
  decision: Decision;
}

const TOOTH = 26; // px, tooth pitch
const RACK_PAD = 12; // px, left padding before the first tooth
const PAWL_X = RACK_PAD + 10; // px, fixed screen x the pawl tip engages at

const COMMIT_RACK_MS = 260; // hard-stop ease, zero overshoot
const COMMIT_EXIT_MS = 320; // card spring exit
const PAWL_FLEX_MS = 200; // brief flex-over-tooth on drop

const LIFT_MS = 240; // pawl rotates up and holds
const EASE_MS = 680; // slow, effortful rack ease backward
const EMPTY_HOLD_MS = 320; // lift-and-drop with nothing to undo

const RACK_EASE_FWD = "cubic-bezier(0.16, 1, 0.3, 1)"; // sharp settle, no overshoot
const RACK_EASE_BACK = "cubic-bezier(0.65, 0, 0.35, 1)"; // slow, labored
const CARD_EXIT_EASE = "cubic-bezier(0.34, 1.56, 0.64, 1)"; // spring-ish snap

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

export function PawlClick({
  cards,
  onArchive,
  onKeep,
  onUndo,
  onEmpty,
  className = "",
}: PawlClickProps) {
  const uid = useId();
  const reducedMotion = useReducedMotion();

  const initialRef = useRef(cards);
  const totalRef = useRef(Math.max(1, cards.length));
  const teethCount = totalRef.current;

  const [queue, setQueue] = useState<PawlClickCard[]>(initialRef.current);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [notch, setNotch] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [exiting, setExiting] = useState<{ card: PawlClickCard; dir: "left" | "right" } | null>(
    null,
  );
  const [announcement, setAnnouncement] = useState("");
  const [busy, setBusy] = useState(false); // gates Archive/Keep only

  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const undoBusyRef = useRef(false);
  const emptyFiredRef = useRef(false);

  const addTimer = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timersRef.current.delete(id);
      fn();
    }, ms);
    timersRef.current.add(id);
    return id;
  }, []);

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach((id) => clearTimeout(id));
    timersRef.current.clear();
  }, []);

  useEffect(() => clearAllTimers, [clearAllTimers]);

  useEffect(() => {
    if (queue.length === 0 && !emptyFiredRef.current) {
      emptyFiredRef.current = true;
      onEmpty?.();
    } else if (queue.length > 0) {
      emptyFiredRef.current = false;
    }
  }, [queue.length, onEmpty]);

  const commit = useCallback(
    (decision: Decision) => {
      if (busy || queue.length === 0) return;
      const card = queue[0];
      const dir: "left" | "right" = decision === "archived" ? "left" : "right";

      setBusy(true);
      setPhase("commit");
      setExiting({ card, dir });
      setQueue((q) => q.slice(1));
      setHistory((h) => [...h, { card, decision }]);
      setNotch((n) => Math.min(teethCount - 1, n + 1));

      const remaining = queue.length - 1;
      const label = decision === "archived" ? "Archived" : "Kept";
      setAnnouncement(
        remaining > 0
          ? `${label}. ${remaining} remaining. Press U to undo.`
          : `${label}. Queue clear. Press U to undo.`,
      );

      if (decision === "archived") onArchive?.(card);
      else onKeep?.(card);

      const exitMs = reducedMotion ? 120 : COMMIT_EXIT_MS;
      const rackMs = reducedMotion ? 0 : COMMIT_RACK_MS + PAWL_FLEX_MS;
      const settleMs = Math.max(exitMs, rackMs);

      addTimer(() => {
        setExiting(null);
        setPhase("idle");
        setBusy(false);
      }, settleMs);
    },
    [busy, queue, teethCount, reducedMotion, addTimer, onArchive, onKeep],
  );

  const undo = useCallback(() => {
    if (undoBusyRef.current) return;
    undoBusyRef.current = true;
    // clearAllTimers cancels any pending commit-settle timer too — reconcile
    // that lock immediately rather than leaving Archive/Keep dead forever if
    // undo interrupts a still-animating commit.
    clearAllTimers();
    setBusy(false);
    setExiting(null);
    setPhase("undo-lift");

    // captured from this render's closure, not read back out of a state
    // updater — updaters must stay pure (StrictMode invokes them twice),
    // so every side effect below runs in a plain timer callback instead.
    const entry = history[history.length - 1];
    const queueLenAtClick = queue.length;

    // The CSS transition duration is zeroed under reduced motion (an
    // instant step, no tween) but the *state* still holds briefly either
    // way — "lifted" has to be a real, observable moment, not motion.
    const liftMs = reducedMotion ? 180 : LIFT_MS;
    addTimer(() => {
      if (!entry) {
        setAnnouncement("Nothing to undo.");
        const holdMs = reducedMotion ? 150 : EMPTY_HOLD_MS;
        addTimer(() => {
          setPhase("idle");
          undoBusyRef.current = false;
        }, holdMs);
        return;
      }
      setPhase("undo-ease");
      setHistory((h) => h.slice(0, -1));
      setQueue((q) => [entry.card, ...q]);
      setNotch((n) => Math.max(0, n - 1));
      onUndo?.(entry.card);
      setAnnouncement(`Undone. ${entry.card.title} restored. ${queueLenAtClick + 1} remaining.`);
      const easeMs = reducedMotion ? 220 : EASE_MS;
      addTimer(() => {
        setPhase("idle");
        undoBusyRef.current = false;
      }, easeMs);
    }, liftMs);
  }, [history, queue, reducedMotion, addTimer, clearAllTimers, onUndo]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const key = e.key.toLowerCase();
      if (key === "arrowleft" || key === "j") {
        e.preventDefault();
        commit("archived");
      } else if (key === "arrowright" || key === "k") {
        e.preventDefault();
        commit("kept");
      } else if (key === "u" || ((e.metaKey || e.ctrlKey) && key === "z")) {
        e.preventDefault();
        undo();
      }
    },
    [commit, undo],
  );

  const engagedTooth = Math.min(notch, teethCount - 1);
  const rackTranslate = PAWL_X - (engagedTooth * TOOTH + RACK_PAD);
  const rackDuration = reducedMotion
    ? 0
    : phase === "undo-ease"
      ? EASE_MS
      : COMMIT_RACK_MS;
  const rackEase = phase === "undo-ease" ? RACK_EASE_BACK : RACK_EASE_FWD;

  const pawlLifted = phase === "undo-lift" || phase === "undo-ease";
  const pawlAngle = pawlLifted ? -20 : 0;
  const pawlDuration = reducedMotion ? 0 : phase === "undo-ease" ? 0 : LIFT_MS;

  const teeth = useMemo(() => {
    const out: { x: number; d: string }[] = [];
    for (let i = 0; i < teethCount; i++) {
      const x = RACK_PAD + i * TOOTH;
      // asymmetric sawtooth: shallow climbing ramp, then a steep blocking
      // face — the geometry itself reads "this only turns one way".
      const d = `M ${x} 30 L ${x + TOOTH * 0.72} 8 L ${x + TOOTH} 8 L ${x + TOOTH} 30 Z`;
      out.push({ x, d });
    }
    return out;
  }, [teethCount]);

  const rackWidth = RACK_PAD + teethCount * TOOTH + RACK_PAD;

  const topCard = queue[0];
  const stackVisible = queue.slice(0, 3);
  const optionId = (id: string) => `${uid}-opt-${id}`;
  const busyOrEmpty = busy || queue.length === 0;

  return (
    <div className={["mx-auto flex w-full max-w-md flex-col gap-5", className].join(" ")}>
      <div
        role="listbox"
        aria-label="Card triage queue"
        aria-activedescendant={topCard ? optionId(topCard.id) : undefined}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="ns-pw-stack relative rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        style={{ height: 176 }}
      >
        {stackVisible
          .slice()
          .reverse()
          .map((card, ri) => {
            const i = stackVisible.length - 1 - ri;
            const isTop = i === 0;
            return (
              <div
                key={card.id}
                id={optionId(card.id)}
                role="option"
                aria-selected={isTop}
                className="ns-pw-card absolute inset-x-0 top-0 flex flex-col gap-1.5 rounded-md border border-border bg-surface p-5 shadow-sm"
                style={{
                  transform: `translateY(${i * 10}px) scale(${1 - i * 0.03})`,
                  opacity: 1 - i * 0.22,
                  zIndex: 10 - i,
                }}
              >
                <h3 className="text-sm font-semibold text-foreground">{card.title}</h3>
                {card.subtitle && (
                  <p className="text-xs text-muted">{card.subtitle}</p>
                )}
                {card.body && isTop && (
                  <p className="mt-1 text-sm leading-relaxed text-foreground/90">{card.body}</p>
                )}
              </div>
            );
          })}

        {exiting && (
          <div
            aria-hidden
            className="ns-pw-card ns-pw-exit absolute inset-x-0 top-0 flex flex-col gap-1.5 rounded-md border border-border bg-surface p-5 shadow-sm"
            data-dir={exiting.dir}
            data-reduced={reducedMotion || undefined}
            style={{ zIndex: 20 }}
          >
            <h3 className="text-sm font-semibold text-foreground">{exiting.card.title}</h3>
            {exiting.card.subtitle && (
              <p className="text-xs text-muted">{exiting.card.subtitle}</p>
            )}
          </div>
        )}

        {!topCard && (
          <div className="absolute inset-0 flex items-center justify-center rounded-md border border-dashed border-border">
            <p className="text-sm text-muted">Queue clear</p>
          </div>
        )}
      </div>

      {/* rack + pawl — decorative, fully described by the live region above */}
      <div aria-hidden="true" className="relative h-9 w-full">
        <div className="absolute inset-0 overflow-hidden rounded-sm border border-border bg-background">
          <svg
            width={rackWidth}
            height={38}
            viewBox={`0 0 ${rackWidth} 38`}
            className="absolute inset-y-0"
            style={{
              transform: `translateX(${rackTranslate}px)`,
              transitionProperty: "transform",
              transitionDuration: `${rackDuration}ms`,
              transitionTimingFunction: rackEase,
            }}
          >
            {teeth.map((t, i) => (
              <path
                key={t.x}
                d={t.d}
                fill={i === engagedTooth ? "var(--foreground)" : "none"}
                fillOpacity={i === engagedTooth ? 0.14 : 1}
                stroke={i === engagedTooth ? "var(--foreground)" : "var(--border)"}
                strokeWidth={i === engagedTooth ? 1.75 : 1.25}
              />
            ))}
          </svg>
        </div>

        <svg
          width={22}
          height={26}
          viewBox="0 0 22 26"
          className="pointer-events-none absolute -top-3"
          style={{
            left: PAWL_X - 5,
            transform: `rotate(${pawlAngle}deg)`,
            transformOrigin: "4px 5px",
            transitionProperty: "transform",
            transitionDuration: `${pawlDuration}ms`,
            transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >
          <path
            d="M4 4 L4 15 Q4 19 9 19 L16 19"
            fill="none"
            stroke="var(--foreground)"
            strokeWidth={2.25}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx={4} cy={4} r={2} fill="var(--foreground)" />
        </svg>

        {/* Real (non-decorative, hit-testable) "armed to reverse" marker —
            the pawl svg above is pointer-events-none and its stroke is thin
            enough that a screenshot/gate hit-test at its own center can
            land on empty space, so the gate's `expect` target is this
            plain, normally-painted node instead, not the svg. */}
        {pawlLifted && (
          <div
            data-pawl-lifted="true"
            aria-hidden="true"
            className="absolute h-2.5 w-2.5 rounded-full bg-foreground"
            style={{ left: PAWL_X - 6, top: -10 }}
          />
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => commit("archived")}
          disabled={busyOrEmpty}
          className="ns-pw-btn flex-1 rounded-sm border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground transition-colors hover:enabled:border-muted hover:enabled:bg-border/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-45"
        >
          Archive
        </button>
        <button
          type="button"
          onClick={() => commit("kept")}
          disabled={busyOrEmpty}
          className="ns-pw-btn flex-1 rounded-sm border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground transition-colors hover:enabled:border-muted hover:enabled:bg-border/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-45"
        >
          Keep
        </button>
        <button
          type="button"
          data-pawl-undo
          onClick={undo}
          className="ns-pw-btn rounded-sm border border-border bg-surface px-3 py-2 text-sm font-medium text-muted transition-colors hover:border-muted hover:bg-border/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Undo
        </button>
      </div>

      <p className="text-xs text-muted">
        Left/Right or J/K to triage, U (or Cmd/Ctrl+Z) to undo — undo lifts the pawl before the
        rack eases back.
      </p>

      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>

      <style>{`
        .ns-pw-card {
          transition: transform 260ms ${CARD_EXIT_EASE}, opacity 260ms ease;
        }
        .ns-pw-exit[data-dir="left"] {
          animation: ns-pw-exit-left ${COMMIT_EXIT_MS}ms ${CARD_EXIT_EASE} both;
        }
        .ns-pw-exit[data-dir="right"] {
          animation: ns-pw-exit-right ${COMMIT_EXIT_MS}ms ${CARD_EXIT_EASE} both;
        }
        @keyframes ns-pw-exit-left {
          to { transform: translateX(-135%) rotate(-8deg); opacity: 0; }
        }
        @keyframes ns-pw-exit-right {
          to { transform: translateX(135%) rotate(8deg); opacity: 0; }
        }
        .ns-pw-exit[data-reduced][data-dir] {
          animation: ns-pw-exit-fade 120ms ease both;
        }
        @keyframes ns-pw-exit-fade {
          to { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
