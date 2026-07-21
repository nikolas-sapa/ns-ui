"use client";

import { useEffect, useRef, useState } from "react";

// A collapsible agent-reasoning timeline. Status lives entirely in the node
// glyph strung on a 1px vertical rail — no colored badges, no status pills:
// a hollow ring is pending, a pulsing dot is running, a filled dot is done,
// and a stroked diamond with a cross is failed (a distinct FORM, not a
// color — --accent stays reserved for the fold affordance and focus rings).
// Steps stream in over time as the `steps` array grows; the currently
// running step (or, once nothing is running, the most recent step) stays
// expanded by default while every earlier step folds to a single line, so a
// 40-step run reads as a scrollable log rather than a wall of open text.
// Any step can be expanded or re-collapsed by hand — that choice is kept
// per step id even as new steps arrive. New arrivals and status changes are
// announced through a polite (not assertive) visually-hidden live region.
// Pure DOM: the fold uses a CSS grid-rows transition (no JS height
// measuring), the running glyph uses Tailwind's built-in ping keyframes.
// Zero dependencies.

export type SoundingRailStatus = "pending" | "running" | "done" | "failed";

export interface SoundingRailEvidence {
  /** short field name, e.g. "tool" or "files" */
  label: string;
  value: string;
}

export interface SoundingRailStep {
  /** stable id — used for the expand/collapse memory and the aria-live diff */
  id: string;
  label: string;
  status: SoundingRailStatus;
  /** short elapsed/absolute stamp shown beside the label, e.g. "0:14" */
  time?: string;
  /** longer explanation, only rendered once the step is expanded */
  detail?: string;
  /** flat bordered chips of tool output, only rendered once expanded */
  evidence?: SoundingRailEvidence[];
}

export interface SoundingRailProps {
  /** the run, oldest first — append to stream new steps in */
  steps: SoundingRailStep[];
  /** accessible name for the timeline region */
  label?: string;
  className?: string;
}

function statusWord(status: SoundingRailStatus) {
  switch (status) {
    case "pending":
      return "pending";
    case "running":
      return "running";
    case "done":
      return "done";
    case "failed":
      return "failed";
  }
}

function StepGlyph({ status }: { status: SoundingRailStatus }) {
  if (status === "pending") {
    return (
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        <circle
          cx="5"
          cy="5"
          r="3.25"
          fill="var(--surface)"
          stroke="var(--border)"
          strokeWidth="1.5"
        />
      </svg>
    );
  }
  if (status === "running") {
    return (
      // Running needs a resting FORM, not only a resting animation. The ping
      // halo spends most of its cycle fully transparent, so a bare dot inside
      // it screenshots as — and, glanced at, reads as — the plain solid dot
      // that means "done". The static concentric ring is the actual signal:
      // a dot held inside a ring, distinct from pending's empty ring and from
      // done's filled dot whether or not anything is moving.
      <span className="relative flex h-[10px] w-[10px] items-center justify-center">
        <span className="absolute inline-flex h-full w-full rounded-full border border-foreground/50" />
        <span className="absolute inline-flex h-full w-full rounded-full border border-foreground/60 motion-safe:animate-ping" />
        <span className="relative h-[4px] w-[4px] rounded-full bg-foreground" />
      </span>
    );
  }
  if (status === "failed") {
    return (
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        <rect
          x="1.4"
          y="1.4"
          width="7.2"
          height="7.2"
          rx="1"
          transform="rotate(45 5 5)"
          fill="var(--surface)"
          stroke="var(--foreground)"
          strokeWidth="1.3"
        />
        <path
          d="M3.3 3.3l3.4 3.4M6.7 3.3l-3.4 3.4"
          stroke="var(--foreground)"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  // done
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <circle cx="5" cy="5" r="4" fill="var(--foreground)" />
    </svg>
  );
}

export function SoundingRail({
  steps,
  label = "Agent reasoning timeline",
  className = "",
}: SoundingRailProps) {
  // per-id manual expand/collapse override — survives new steps streaming in
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [live, setLive] = useState("");
  const prevRef = useRef<Map<string, SoundingRailStatus>>(new Map());
  const scrollRef = useRef<HTMLOListElement>(null);
  const firstRun = useRef(true);

  // the step that should be open with nothing asked of the user: the
  // running one, or — once the run has nothing in flight — the last step
  let autoId: string | null = null;
  for (let i = steps.length - 1; i >= 0; i--) {
    const s = steps[i];
    if (s && s.status === "running") {
      autoId = s.id;
      break;
    }
  }
  if (autoId === null && steps.length > 0) {
    autoId = steps[steps.length - 1]!.id;
  }

  // announce arrivals and status flips politely, diffed against last render
  useEffect(() => {
    const prev = prevRef.current;
    const next = new Map<string, SoundingRailStatus>();
    const messages: string[] = [];
    for (const s of steps) {
      next.set(s.id, s.status);
      const before = prev.get(s.id);
      if (before === undefined) {
        messages.push(
          s.status === "pending" ? `Queued: ${s.label}` : s.label
        );
      } else if (before !== s.status) {
        messages.push(`${s.label} ${statusWord(s.status)}`);
      }
    }
    prevRef.current = next;
    if (!firstRun.current && messages.length > 0) {
      setLive(messages.join(". "));
    }
    firstRun.current = false;
  }, [steps]);

  // keep the current step in view as the run streams — only on new/changed
  // steps, never on a manual expand/collapse, so exploring history doesn't
  // get yanked back down
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    el.scrollTo({ top: el.scrollHeight, behavior: reduced ? "auto" : "smooth" });
  }, [steps]);

  return (
    <div
      role="region"
      aria-label={label}
      className={`rounded-md border border-border bg-surface ${className}`}
    >
      <ol ref={scrollRef} className="max-h-[420px] overflow-y-auto p-4">
        {steps.map((step, i) => {
          const expanded = overrides[step.id] ?? step.id === autoId;
          const hasDetail = Boolean(
            step.detail || (step.evidence && step.evidence.length > 0)
          );
          const detailId = `sounding-rail-detail-${step.id}`;
          const toggle = () =>
            setOverrides((o) => ({ ...o, [step.id]: !expanded }));

          return (
            <li key={step.id} className="relative flex">
              {/* rail: a single continuous line, the glyph rides on top */}
              <div className="relative mr-3 flex w-4 shrink-0 justify-center">
                {i > 0 && (
                  <span className="absolute left-1/2 top-0 h-[7px] w-px -translate-x-1/2 bg-border" />
                )}
                {i < steps.length - 1 && (
                  <span className="absolute left-1/2 top-[17px] bottom-0 w-px -translate-x-1/2 bg-border" />
                )}
                <span className="relative z-10 mt-[7px]">
                  <StepGlyph status={step.status} />
                </span>
              </div>

              <div className="min-w-0 flex-1 pb-4 last:pb-0">
                {hasDetail ? (
                  <button
                    type="button"
                    onClick={toggle}
                    aria-expanded={expanded}
                    aria-controls={detailId}
                    aria-label={`${expanded ? "Collapse" : "Expand"} ${step.label}`}
                    className="group -mx-1 flex min-h-6 w-full items-center gap-2 rounded-sm px-1 text-left outline-none transition-colors duration-150 hover:bg-foreground/[0.04] focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                      {step.label}
                    </span>
                    {step.time ? (
                      <span className="shrink-0 font-mono text-[10px] text-muted">
                        {step.time}
                      </span>
                    ) : null}
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 10 10"
                      aria-hidden="true"
                      className={`shrink-0 text-muted transition-transform duration-200 motion-reduce:transition-none ${
                        expanded ? "rotate-90" : ""
                      } group-hover:text-foreground`}
                    >
                      <path
                        d="M3 1.5l4 3.5-4 3.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                ) : (
                  <div className="flex min-h-6 w-full items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                      {step.label}
                    </span>
                    {step.time ? (
                      <span className="shrink-0 font-mono text-[10px] text-muted">
                        {step.time}
                      </span>
                    ) : null}
                  </div>
                )}

                {hasDetail ? (
                  <div
                    className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none motion-reduce:duration-0"
                    style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
                  >
                    <div className="overflow-hidden">
                      <div id={detailId} className="pt-1.5">
                        {step.detail ? (
                          <p className="max-w-[60ch] text-sm leading-relaxed text-muted">
                            {step.detail}
                          </p>
                        ) : null}
                        {step.evidence && step.evidence.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {step.evidence.map((e, ei) => (
                              <span
                                key={ei}
                                className="inline-flex items-center gap-1 rounded-sm border border-border bg-background px-1.5 py-0.5 font-mono text-[11px] text-muted"
                              >
                                <span className="text-foreground">
                                  {e.label}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span>{e.value}</span>
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {live}
      </div>
    </div>
  );
}
