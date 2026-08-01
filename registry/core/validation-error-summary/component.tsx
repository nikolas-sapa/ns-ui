"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

// ---------------------------------------------------------------------------
// PunchList — form-error handling as a contractor's punch list. A failed
// submit doesn't paint every field red and leave the user to hunt: it pins a
// compact numbered defect list (Geist Mono) to the top of the form. Picking
// an item scrolls to its field and draws a temporary hairline SVG leader
// line from the list entry to the field's bounding box (stroke-dashoffset
// draw, 300ms, fading out ~1.5s later) while the field's own error border
// pulses once. Fixing a field draws a scaleX(0->1) strike-through rule over
// its list entry (house ease-out-expo, cubic-bezier(0.16,1,0.3,1)),
// decrements a remaining-count badge with a short number-settle, and once
// every item is struck the whole list collapses itself away.
//
// Unlike a stock WCAG error-summary (a static list of links into the form)
// this adds three things that pattern never renders: the spatial leader
// link between summary and field, live strike-through as items get fixed,
// and self-dismissal at zero — the summary is a live progress artifact, not
// a one-shot dump. Unlike approval-inline-diff (a single tool-call approved/denied
// once and never reopened) this is per-field, revalidates live, and can
// re-arm on a second failed submit.
//
// A11Y: the summary is a real role=alert region that receives focus on a
// failed submit; every item is a plain <a href="#field-id"> so Tab reaches
// it and Enter/click both work with no JS. Every field carries aria-invalid
// and aria-describedby pointing at its own inline error paragraph. Leader
// lines and strikes are aria-hidden decoration; a dedicated aria-live=polite
// region separately announces each resolution ("Email resolved, 2
// remaining"). Reduced motion: lines and strikes render at their end state
// instantly, no timers spent waiting on animation before state settles.
//
// Colors: --background/--foreground/--muted/--border/--accent throughout;
// error state reads the semantic --error custom property (house convention
// for status-only red, e.g. validation-inline-wick / toast-gravity-stack / stepper-needle)
// with a literal fallback so the component still reads correctly for a
// consumer who hasn't set --error. --accent is reserved for the submit
// button and focus rings — never used to indicate the error itself.
// ---------------------------------------------------------------------------

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)"; // house ease-out-expo approximation
const ERROR = "var(--error, #ea001d)";

const LEADER_DRAW_MS = 300;
const LEADER_HOLD_MS = 1500;
const LEADER_FADE_MS = 300;
const PULSE_MS = 520;
const RESOLVE_HOLD_MS = 700;
const ROW_COLLAPSE_MS = 240;
const PANEL_COLLAPSE_MS = 320;
const DISMISS_DELAY_MS = 260;

export interface PunchListField {
  /** also becomes the input's DOM id and the list item's #anchor target */
  id: string;
  label: string;
  type?: "text" | "email" | "tel" | "textarea";
  placeholder?: string;
  defaultValue?: string;
  /** return an error message, or null when the value is valid */
  validate: (value: string) => string | null;
}

export interface PunchListProps {
  fields: PunchListField[];
  title?: string;
  submitLabel?: string;
  onSubmit?: (values: Record<string, string>) => void;
  className?: string;
}

type Rect = { x1: number; y1: number; x2: number; y2: number };
type Leader = Rect & { id: string; drawn: boolean; fading: boolean };

function useReducedMotion() {
  const ref = useRef(false);
  useEffect(() => {
    ref.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);
  return ref;
}

export function PunchList({
  fields,
  title = "Punch list",
  submitLabel = "Submit",
  onSubmit,
  className = "",
}: PunchListProps) {
  const fieldsById = useMemo(() => {
    const m = new Map<string, PunchListField>();
    for (const f of fields) m.set(f.id, f);
    return m;
  }, [fields]);

  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.id, f.defaultValue ?? ""])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [numberMap, setNumberMap] = useState<Record<string, number>>({});
  const [resolving, setResolving] = useState<Set<string>>(new Set());
  const [collapsing, setCollapsing] = useState<Set<string>>(new Set());
  const [attempted, setAttempted] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [statusText, setStatusText] = useState("Nothing submitted yet.");
  const [liveMessage, setLiveMessage] = useState("");
  const [leader, setLeader] = useState<Leader | null>(null);
  const [pulseId, setPulseId] = useState<string | null>(null);

  const reducedRef = useReducedMotion();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const summaryRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const fieldWrapRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const inputRefs = useRef<
    Record<string, HTMLInputElement | HTMLTextAreaElement | null>
  >({});

  const leaderTimers = useRef<{
    fallback?: ReturnType<typeof setTimeout>;
    fade?: ReturnType<typeof setTimeout>;
    remove?: ReturnType<typeof setTimeout>;
    onEnd?: () => void;
  }>({});
  const resolveTimers = useRef<Record<string, ReturnType<typeof setTimeout>[]>>({});

  useEffect(() => {
    return () => {
      const lt = leaderTimers.current;
      clearTimeout(lt.fallback);
      clearTimeout(lt.fade);
      clearTimeout(lt.remove);
      if (lt.onEnd) window.removeEventListener("scrollend", lt.onEnd);
      Object.values(resolveTimers.current).forEach((arr) =>
        arr.forEach((t) => clearTimeout(t)),
      );
    };
  }, []);

  // self-dismiss once every open defect has drained and finished animating
  useEffect(() => {
    if (!attempted || dismissed) return;
    if (Object.keys(errors).length === 0 && resolving.size === 0) {
      const t = setTimeout(
        () => {
          setDismissed(true);
          setStatusText("All clear — nothing left to fix.");
        },
        reducedRef.current ? 0 : DISMISS_DELAY_MS,
      );
      return () => clearTimeout(t);
    }
  }, [attempted, dismissed, errors, resolving, reducedRef]);

  const orderedIds = useMemo(
    () =>
      fields
        .map((f) => f.id)
        .filter((id) => id in errors || resolving.has(id))
        .sort((a, b) => (numberMap[a] ?? 0) - (numberMap[b] ?? 0)),
    [fields, errors, resolving, numberMap],
  );

  const remaining = Object.keys(errors).length;

  function clearLeaderTimers() {
    const lt = leaderTimers.current;
    clearTimeout(lt.fallback);
    clearTimeout(lt.fade);
    clearTimeout(lt.remove);
    if (lt.onEnd) window.removeEventListener("scrollend", lt.onEnd);
    leaderTimers.current = {};
  }

  function pulseField(id: string) {
    if (reducedRef.current) return;
    setPulseId(null);
    // restart the CSS animation without remounting — same trick as the
    // house checkbox settle-pop: drop the class, force reflow, re-add it.
    requestAnimationFrame(() => setPulseId(id));
  }

  function drawLeader(id: string) {
    const container = containerRef.current;
    const item = itemRefs.current[id];
    const fieldWrap = fieldWrapRefs.current[id];
    if (!container || !item || !fieldWrap) return;
    const cRect = container.getBoundingClientRect();
    const iRect = item.getBoundingClientRect();
    const fRect = fieldWrap.getBoundingClientRect();
    const next: Leader = {
      id,
      x1: iRect.right - cRect.left,
      y1: iRect.top + iRect.height / 2 - cRect.top,
      x2: fRect.left - cRect.left,
      y2: fRect.top + fRect.height / 2 - cRect.top,
      drawn: false,
      fading: false,
    };
    setLeader(next);
    pulseField(id);
    if (reducedRef.current) {
      setLeader({ ...next, drawn: true });
      return;
    }
    requestAnimationFrame(() => setLeader((cur) => (cur ? { ...cur, drawn: true } : cur)));
    leaderTimers.current.fade = setTimeout(() => {
      setLeader((cur) => (cur ? { ...cur, fading: true } : cur));
    }, LEADER_DRAW_MS + LEADER_HOLD_MS);
    leaderTimers.current.remove = setTimeout(() => {
      setLeader(null);
    }, LEADER_DRAW_MS + LEADER_HOLD_MS + LEADER_FADE_MS);
  }

  function selectItem(id: string) {
    const input = inputRefs.current[id];
    const fieldWrap = fieldWrapRefs.current[id];
    if (!input || !fieldWrap) return;
    clearLeaderTimers();
    input.focus({ preventScroll: true });
    if (reducedRef.current) {
      fieldWrap.scrollIntoView({ behavior: "auto", block: "center" });
      drawLeader(id);
      return;
    }
    fieldWrap.scrollIntoView({ behavior: "smooth", block: "center" });
    let done = false;
    const onEnd = () => {
      if (done) return;
      done = true;
      window.removeEventListener("scrollend", onEnd);
      drawLeader(id);
    };
    leaderTimers.current.onEnd = onEnd;
    window.addEventListener("scrollend", onEnd, { once: true });
    leaderTimers.current.fallback = setTimeout(onEnd, 450);
  }

  function resolveField(id: string) {
    const field = fieldsById.get(id);
    if (!field) return;
    const nextRemaining = Object.keys(errors).length - 1;
    setErrors((prev) => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
    setResolving((prev) => new Set(prev).add(id));
    setLiveMessage(
      `${field.label} resolved, ${nextRemaining} remaining.`,
    );
    (resolveTimers.current[id] ??= []).forEach((t) => clearTimeout(t));
    resolveTimers.current[id] = [];

    const finish = () => {
      setResolving((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
      setCollapsing((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
    };

    if (reducedRef.current) {
      finish();
      return;
    }

    const t1 = setTimeout(() => {
      setCollapsing((prev) => new Set(prev).add(id));
      const t2 = setTimeout(finish, ROW_COLLAPSE_MS);
      resolveTimers.current[id].push(t2);
    }, RESOLVE_HOLD_MS);
    resolveTimers.current[id].push(t1);
  }

  function handleChange(id: string, val: string) {
    setValues((prev) => ({ ...prev, [id]: val }));
    if (!(id in errors)) return;
    const field = fieldsById.get(id);
    if (!field) return;
    const msg = field.validate(val);
    if (msg) {
      setErrors((prev) => ({ ...prev, [id]: msg }));
      return;
    }
    resolveField(id);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    for (const f of fields) {
      const msg = f.validate(values[f.id] ?? "");
      if (msg) nextErrors[f.id] = msg;
    }

    if (Object.keys(nextErrors).length === 0) {
      onSubmit?.(values);
      setErrors({});
      setAttempted(false);
      setDismissed(true);
      setStatusText("Submitted — no open issues.");
      setLiveMessage("Form submitted.");
      return;
    }

    const nm: Record<string, number> = {};
    let n = 0;
    for (const f of fields) if (nextErrors[f.id]) nm[f.id] = ++n;

    setErrors(nextErrors);
    setNumberMap(nm);
    setResolving(new Set());
    setCollapsing(new Set());
    setAttempted(true);
    setDismissed(false);
    setStatusText("");
    setLiveMessage("");
    requestAnimationFrame(() => summaryRef.current?.focus());
  }

  const showPanel = attempted && !dismissed;

  return (
    <div
      ref={containerRef}
      className={`relative w-full rounded-md border border-border bg-surface p-5 ${className}`}
    >
      <style>{`
        .ns-punch-strike {
          position: absolute;
          left: 0;
          right: 0;
          top: 50%;
          height: 1px;
          background: var(--foreground);
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 260ms ${EASE};
        }
        .ns-punch-strike[data-on="true"] { transform: scaleX(1); }
        .ns-punch-pulse { animation: ns-punch-pulse ${PULSE_MS}ms ease-out; }
        @keyframes ns-punch-pulse {
          0% { box-shadow: 0 0 0 0 color-mix(in srgb, ${ERROR} 55%, transparent); }
          65% { box-shadow: 0 0 0 5px color-mix(in srgb, ${ERROR} 0%, transparent); }
          100% { box-shadow: 0 0 0 0 transparent; }
        }
        .ns-punch-settle { animation: ns-punch-settle 240ms ${EASE}; }
        @keyframes ns-punch-settle {
          from { transform: translateY(30%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ns-punch-strike { transition: none; }
          .ns-punch-pulse { animation: none; }
          .ns-punch-settle { animation: none; }
        }
      `}</style>

      <div aria-live="polite" className="sr-only">
        {liveMessage}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateRows: showPanel ? "1fr" : "0fr",
          transition: reducedRef.current
            ? "none"
            : `grid-template-rows ${PANEL_COLLAPSE_MS}ms ${EASE}`,
        }}
      >
        <div className="overflow-hidden">
          <div
            ref={summaryRef}
            role="alert"
            tabIndex={-1}
            data-punch-summary
            className="sticky top-2 z-10 mb-4 rounded-md border border-border bg-background p-3 font-mono outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="text-[11px] uppercase tracking-wide text-foreground">
                {title} — {orderedIds.length ? "unresolved" : "clear"}
              </h2>
              <span className="relative inline-flex h-4 min-w-[2ch] items-center justify-end overflow-hidden text-[11px] tabular-nums text-muted">
                <span key={remaining} className={reducedRef.current ? "" : "ns-punch-settle"}>
                  {remaining} open
                </span>
              </span>
            </div>
            <ol className="flex flex-col gap-0.5">
              {orderedIds.map((id) => {
                const field = fieldsById.get(id)!;
                const isResolving = resolving.has(id);
                const isCollapsing = collapsing.has(id);
                return (
                  <li
                    key={id}
                    style={{
                      display: "grid",
                      gridTemplateRows: isCollapsing ? "0fr" : "1fr",
                      opacity: isCollapsing ? 0 : 1,
                      transition: reducedRef.current
                        ? "none"
                        : `grid-template-rows ${ROW_COLLAPSE_MS}ms ${EASE}, opacity ${ROW_COLLAPSE_MS}ms ease`,
                    }}
                  >
                    <div className="overflow-hidden">
                      <a
                        ref={(el) => {
                          itemRefs.current[id] = el;
                        }}
                        href={`#${id}`}
                        data-punch-item
                        onClick={(e) => {
                          e.preventDefault();
                          selectItem(id);
                        }}
                        className="flex items-baseline gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground outline-none transition-colors hover:bg-border/40 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-background"
                      >
                        <span className="shrink-0 text-muted tabular-nums">
                          {numberMap[id]}.
                        </span>
                        <span className="relative inline-block">
                          {field.label}
                          <span aria-hidden data-on={isResolving} className="ns-punch-strike" />
                        </span>
                      </a>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {fields.map((field) => {
          const errId = `${field.id}-error`;
          const hasError = field.id in errors;
          const inputClassName =
            "w-full rounded-sm border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface";
          const inputStyle = hasError ? { borderColor: ERROR } : undefined;
          return (
            <div key={field.id} className="flex flex-col gap-1.5">
              <label
                htmlFor={field.id}
                className="font-mono text-[11px] uppercase tracking-wide text-muted"
              >
                {field.label}
              </label>
              <div
                ref={(el) => {
                  fieldWrapRefs.current[field.id] = el;
                }}
                className={`rounded-sm ${pulseId === field.id ? "ns-punch-pulse" : ""}`}
                onAnimationEnd={() => setPulseId((cur) => (cur === field.id ? null : cur))}
              >
                {field.type === "textarea" ? (
                  <textarea
                    id={field.id}
                    ref={(el) => {
                      inputRefs.current[field.id] = el;
                    }}
                    rows={3}
                    value={values[field.id] ?? ""}
                    placeholder={field.placeholder}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                      handleChange(field.id, e.target.value)
                    }
                    aria-invalid={hasError || undefined}
                    aria-describedby={hasError ? errId : undefined}
                    className={inputClassName}
                    style={inputStyle}
                  />
                ) : (
                  <input
                    id={field.id}
                    ref={(el) => {
                      inputRefs.current[field.id] = el;
                    }}
                    type={field.type ?? "text"}
                    value={values[field.id] ?? ""}
                    placeholder={field.placeholder}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      handleChange(field.id, e.target.value)
                    }
                    aria-invalid={hasError || undefined}
                    aria-describedby={hasError ? errId : undefined}
                    className={inputClassName}
                    style={inputStyle}
                  />
                )}
              </div>
              {hasError ? (
                <p id={errId} className="text-xs" style={{ color: ERROR }}>
                  {errors[field.id]}
                </p>
              ) : null}
            </div>
          );
        })}

        <div className="mt-1 flex items-center gap-3">
          <button
            type="submit"
            data-punch-submit
            className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white outline-none transition-colors hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            {submitLabel}
          </button>
          {!showPanel && statusText ? (
            <span className="font-mono text-[11px] text-muted">{statusText}</span>
          ) : null}
        </div>
      </form>

      <svg
        aria-hidden
        focusable="false"
        className="pointer-events-none absolute inset-0 z-20 overflow-visible"
        width="100%"
        height="100%"
      >
        {leader ? (
          <path
            d={`M ${leader.x1} ${leader.y1} L ${leader.x2} ${leader.y2}`}
            pathLength={1}
            fill="none"
            stroke="var(--foreground)"
            strokeWidth={1.25}
            strokeDasharray={1}
            style={{
              strokeDashoffset: leader.drawn ? 0 : 1,
              opacity: leader.fading ? 0 : 0.85,
              transition: reducedRef.current
                ? "none"
                : `stroke-dashoffset ${LEADER_DRAW_MS}ms ${EASE}, opacity ${LEADER_FADE_MS}ms ease`,
            }}
          />
        ) : null}
      </svg>
    </div>
  );
}
