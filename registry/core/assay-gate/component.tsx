"use client";

import { useEffect, useId, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// AssayGate — a human-in-the-loop approval row for an agent's proposed tool
// call. Every argument renders as a real, labelled, inline-editable field;
// touching one keeps the original value on the record and shows a Geist Mono
// old→new diff (strikethrough) beneath it rather than silently swapping the
// value. Approve and Deny are told apart by fill and weight, not colour —
// Approve is the solid accent action, Deny a plain outlined one, both with
// distinct glyphs. Deciding collapses the row into a one-line receipt
// (outcome · actor · time) that cannot be reopened for editing — the
// collapse is driven by grid-template-rows so it plays as a real motion, and
// once `decision` is set nothing in this component ever clears it. The full
// payload survives as-decided behind a native <details> disclosure on the
// receipt line.
// ---------------------------------------------------------------------------

export type AssayField = {
  key: string;
  /** short label shown above the field, e.g. "command" */
  label: string;
  value: string;
};

export type AssayDecision = {
  outcome: "approved" | "denied";
  /** who decided — the human at the console, not the requesting agent */
  actor: string;
  timestamp: number;
};

export interface AssayGateProps {
  /** the tool being called, e.g. "execute_shell" */
  toolName: string;
  /** the agent/identity that proposed the call */
  requestedBy?: string;
  fields: AssayField[];
  /** seed one or more fields as already edited, keyed by field.key — the
   * diff renders immediately instead of waiting for the human to type */
  initialValues?: Record<string, string>;
  /** recorded on the receipt as the decider — default "you" */
  approverName?: string;
  onDecision?: (decision: AssayDecision, fields: AssayField[]) => void;
  /** pre-seed as already decided (e.g. rendering decision history) */
  initialDecision?: AssayDecision;
  className?: string;
}

function timeLabel(ts: number) {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

// A wall-clock stamp is the one thing in this component that can legitimately
// differ between the server render and the client one: `toLocaleTimeString`
// resolves against the *renderer's* locale and time zone, and a server in UTC
// formatting the same epoch as a browser in Europe/Athens produces different
// text. Left alone that is a hydration text mismatch (React error #418) on
// every receipt. The client's formatting is the correct one to show, so the
// mismatch is expected rather than a bug — which is exactly what
// `suppressHydrationWarning` is for.
function TimeStamp({ ts }: { ts: number }) {
  return <span suppressHydrationWarning>{timeLabel(ts)}</span>;
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
      <path
        d="M3.5 8.5l3 3 6-7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DenyIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
      <path
        d="M4 4l8 8M12 4l-8 8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3 shrink-0" fill="none" aria-hidden>
      <path
        d="M2.5 8h10M8.5 4.5L12 8l-3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-open:rotate-180"
      fill="none"
      aria-hidden
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AssayGate({
  toolName,
  requestedBy = "agent",
  fields,
  initialValues,
  approverName = "you",
  onDecision,
  initialDecision,
  className = "",
}: AssayGateProps) {
  const uid = useId();
  const originals = useRef(
    Object.fromEntries(fields.map((f) => [f.key, f.value]))
  ).current;
  const [values, setValues] = useState<Record<string, string>>(() => ({
    ...originals,
    ...initialValues,
  }));
  const [decision, setDecision] = useState<AssayDecision | null>(
    initialDecision ?? null
  );
  const decidedRef = useRef(!!initialDecision);
  const summaryRef = useRef<HTMLElement>(null);
  const wasPending = useRef(!initialDecision);

  // move focus onto the receipt once a decision lands, so the outcome is
  // where focus is and gets announced rather than stranded on a collapsing
  // button; only for decisions made *in* this session, not the seeded ones.
  useEffect(() => {
    if (decision && wasPending.current) {
      wasPending.current = false;
      summaryRef.current?.focus();
    }
  }, [decision]);

  function decide(outcome: "approved" | "denied") {
    if (decidedRef.current) return; // irreversible: first decision wins, no path back
    decidedRef.current = true;
    const next: AssayDecision = {
      outcome,
      actor: approverName,
      timestamp: Date.now(),
    };
    const finalFields = fields.map((f) => ({
      ...f,
      value: values[f.key] ?? f.value,
    }));
    setDecision(next);
    onDecision?.(next, finalFields);
  }

  const approved = decision?.outcome === "approved";
  const receiptLabel = decision
    ? decision.outcome === "approved"
      ? "Approved"
      : "Denied"
    : "";

  return (
    <div className={className}>
      <style>{`
@keyframes ns-assay-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
.ns-assay-in{animation:ns-assay-in 320ms cubic-bezier(0.16,1,0.3,1) both}
.ns-assay-collapse{display:grid;transition:grid-template-rows 420ms cubic-bezier(0.16,1,0.3,1)}
@media (prefers-reduced-motion: reduce){
  .ns-assay-in{animation:none}
  .ns-assay-collapse{transition:none}
}
`}</style>

      {/* pending body — collapses to zero height, irreversibly, on decision */}
      <div
        className="ns-assay-collapse"
        style={{ gridTemplateRows: decision ? "0fr" : "1fr" }}
        // removed from hit-testing and the a11y tree the moment a decision
        // lands, so a stray Tab can never land on a control now sitting at
        // zero height inside the collapsing row
        inert={decision ? true : undefined}
      >
        <div className="overflow-hidden">
          <div className="rounded-md border border-border bg-surface p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-mono text-sm font-medium text-foreground">
                  {toolName}
                </p>
                <p className="truncate font-mono text-[11px] text-muted">
                  requested by {requestedBy}
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted">
                pending
              </span>
            </div>

            <div className="space-y-3">
              {fields.map((f) => {
                const id = `${uid}-${f.key}`;
                const current = values[f.key] ?? f.value;
                const dirty = current !== originals[f.key];
                return (
                  <div key={f.key}>
                    <label
                      htmlFor={id}
                      className="block font-mono text-[11px] uppercase tracking-wide text-muted"
                    >
                      {f.label}
                    </label>
                    <input
                      id={id}
                      type="text"
                      value={current}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [f.key]: e.target.value }))
                      }
                      className="mt-1 w-full rounded-sm border border-border bg-background px-2.5 py-1.5 font-mono text-sm text-foreground outline-none transition-colors focus-visible:border-accent"
                    />
                    {dirty ? (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 font-mono text-xs">
                        <span className="sr-only">changed from</span>
                        <s className="break-all text-muted decoration-1">
                          {originals[f.key]}
                        </s>
                        <span className="sr-only">to</span>
                        <span className="text-muted">
                          <ArrowIcon />
                        </span>
                        <span className="break-all text-foreground">
                          {current}
                        </span>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                data-assay-deny
                onClick={() => decide("denied")}
                className="inline-flex items-center gap-1.5 rounded-sm border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <DenyIcon />
                Deny
              </button>
              <button
                type="button"
                data-assay-approve
                onClick={() => decide("approved")}
                className="inline-flex items-center gap-1.5 rounded-sm bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <CheckIcon />
                Approve
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* receipt — mounts once, never unmounts, never edited again */}
      {decision ? (
        <div className="ns-assay-in">
          <details className="group rounded-md border border-border">
            <summary
              ref={summaryRef}
              tabIndex={0}
              data-assay-receipt
              className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 font-mono text-xs text-foreground [&::-webkit-details-marker]:hidden"
            >
              <span
                className={
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border " +
                  (approved
                    ? "border-foreground text-foreground"
                    : "border-border text-muted")
                }
                aria-hidden
              >
                {approved ? <CheckIcon /> : <DenyIcon />}
              </span>
              <span className={"shrink-0 " + (approved ? "font-medium" : "")}>
                {receiptLabel}
              </span>
              <span className="shrink-0 text-muted">·</span>
              {/* the one variable-length field on this row — it truncates so a
                  long tool name can't shove the payload affordance into the
                  timestamp (ml-auto yields nothing once the row is full) */}
              <span className="min-w-0 truncate text-muted">{toolName}</span>
              <span className="shrink-0 text-muted">·</span>
              <span className="shrink-0 text-muted">{decision.actor}</span>
              <span className="shrink-0 text-muted">·</span>
              {/* shrink-0 + nowrap: without it flex squeezed the stamp until
                  "4:33:04 PM" wrapped onto a second line and got clipped by the
                  row. The tool name above is the only field allowed to give. */}
              <span className="shrink-0 whitespace-nowrap text-muted">
                <TimeStamp ts={decision.timestamp} />
              </span>
              <span className="ml-auto flex shrink-0 items-center gap-1 pl-3 text-muted">
                payload
                <ChevronIcon />
              </span>
            </summary>
            <div
              data-assay-payload
              className="space-y-1.5 border-t border-border px-3 py-2.5"
            >
              {fields.map((f) => (
                <div key={f.key} className="flex gap-2 font-mono text-xs">
                  <span className="shrink-0 text-muted">{f.label}</span>
                  <span className="break-all text-foreground">
                    {values[f.key] ?? f.value}
                  </span>
                </div>
              ))}
            </div>
          </details>
          <p role="status" aria-live="polite" className="sr-only">
            {receiptLabel} by {decision.actor} at <TimeStamp ts={decision.timestamp} />
          </p>
        </div>
      ) : null}
    </div>
  );
}
