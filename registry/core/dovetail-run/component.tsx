"use client";

import type { CSSProperties } from "react";
import { useEffect, useId, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// DovetailRun — a multi-step form whose completed steps physically interlock.
// Each step is a real labelled <fieldset>; validating it on Next/Submit
// either SEATS its rail chip — a small SVG shape cut with dovetail edges
// (a flared tail on its trailing edge, a matching socket notch on its
// leading edge) that slides in from outside the rail on ease-out-expo, the
// final 12px settling on a spring with slight overshoot so the joint reads
// as mated — or REJECTS it: the same chip travels toward the joint,
// decelerates, bounces off it (a decaying two-swing recoil) and fades back
// out while per-field errors render below the form and an aria-live summary
// announces what still needs fixing. A step's chip only ever sits in the
// rail while its fields are genuinely valid; editing a seated step back into
// invalidity un-seats it — the dashed socket outline is the constant "gap"
// that shows exactly where work remains. Zero deps, DOM + SVG + CSS only.
// ---------------------------------------------------------------------------

export type DovetailField = {
  id: string;
  label: string;
  type?: "text" | "email" | "tel" | "number";
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
  /** return an error message for a non-empty value, or null/undefined if fine */
  validate?: (value: string) => string | null | undefined;
};

export type DovetailStep = {
  id: string;
  title: string;
  fields: DovetailField[];
};

export interface DovetailRunProps {
  steps: DovetailStep[];
  /** seed field values by field id, e.g. to demonstrate a pre-filled step */
  defaultValues?: Record<string, string>;
  /** label for the final step's submit button */
  submitLabel?: string;
  onComplete?: (values: Record<string, string>) => void;
  className?: string;
}

// chip geometry — one shared shape, module-level so it's identical (and
// deterministic across renders/screenshots) for every chip. A dovetail
// tail flares OUT past the trailing (right) edge; the socket is the same
// trapezoid cut IN from the leading (left) edge, so an identical neighbor's
// tail nests into it.
const CHIP_W = 104;
const CHIP_H = 34;
const DEPTH = 6; // how far the tail protrudes / the socket cuts in
const FLARE = 3; // extra half-width at the tip vs the base — the flare
const TOOTH_H = 14; // vertical extent of the tooth, centered
const TOP_Y = CHIP_H / 2 - TOOTH_H / 2;
const BOT_Y = CHIP_H / 2 + TOOTH_H / 2;
const SVG_W = CHIP_W + DEPTH;
const TRAVEL_PX = 40; // distance a chip flies in from before it seats/rejects
const SEAT_MS = 650;
const REJECT_MS = 700;

// full closed outline — used for both the fill and the default-colour stroke
const FULL_D = [
  `M0,0`,
  `L${CHIP_W},0`,
  `L${CHIP_W},${TOP_Y}`,
  `L${CHIP_W + DEPTH},${TOP_Y - FLARE}`,
  `L${CHIP_W + DEPTH},${BOT_Y + FLARE}`,
  `L${CHIP_W},${BOT_Y}`,
  `L${CHIP_W},${CHIP_H}`,
  `L0,${CHIP_H}`,
  `L0,${BOT_Y}`,
  `L${DEPTH},${BOT_Y + FLARE}`,
  `L${DEPTH},${TOP_Y - FLARE}`,
  `L0,${TOP_Y}`,
  "Z",
].join(" ");

// just the leading (left/pin) edge — drawn again on top so it alone can be
// recoloured to --accent on focus-within, without touching the fill path.
const LEFT_EDGE_D = [
  `M0,${CHIP_H}`,
  `L0,${BOT_Y}`,
  `L${DEPTH},${BOT_Y + FLARE}`,
  `L${DEPTH},${TOP_Y - FLARE}`,
  `L0,${TOP_Y}`,
  `L0,0`,
].join(" ");

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

type StepStatus = "pending" | "complete";
type AnimPhase = "idle" | "seat" | "reject";

function RailSlot({
  step,
  index,
  status,
  isCurrent,
  animPhase,
}: {
  step: DovetailStep;
  index: number;
  status: StepStatus;
  isCurrent: boolean;
  animPhase: AnimPhase;
}) {
  const animating = animPhase !== "idle";
  const showChip = status === "complete" || animating;
  const stateWord =
    status === "complete" ? "complete" : isCurrent ? "current" : "not started";
  const travelStyle = { "--travel": `${TRAVEL_PX}px` } as CSSProperties;

  return (
    <li
      aria-current={isCurrent ? "step" : undefined}
      className="relative shrink-0"
      style={{ width: CHIP_W, height: CHIP_H }}
    >
      <span className="sr-only">
        Step {index + 1}, {step.title}, {stateWord}
      </span>
      <svg
        width={SVG_W}
        height={CHIP_H}
        viewBox={`0 0 ${SVG_W} ${CHIP_H}`}
        className="absolute left-0 top-0 overflow-visible"
        aria-hidden
        focusable="false"
      >
        {/* the socket outline — always present; an empty dashed one IS the
            visible gap that shows a step hasn't joined yet */}
        <path
          d={FULL_D}
          fill="none"
          stroke="var(--border)"
          strokeWidth={1}
          strokeDasharray={status === "complete" ? undefined : "3 3"}
        />
        {showChip ? (
          <g
            data-dovetail-seated={
              status === "complete" && !animating ? "true" : undefined
            }
            className={
              animPhase === "seat"
                ? "ns-dove-seat"
                : animPhase === "reject"
                  ? "ns-dove-reject"
                  : undefined
            }
            style={animating ? travelStyle : undefined}
          >
            <path d={FULL_D} fill="var(--surface)" stroke="var(--border)" strokeWidth={1} />
          </g>
        ) : null}
        {isCurrent ? (
          <path
            data-current-pin
            d={LEFT_EDGE_D}
            fill="none"
            stroke="var(--border)"
            strokeWidth={1}
            className="ns-dove-pin"
          />
        ) : null}
      </svg>
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center truncate px-2 text-center font-mono text-[10px] tracking-wide text-foreground">
        {step.title}
      </span>
    </li>
  );
}

export function DovetailRun({
  steps,
  defaultValues,
  submitLabel = "Submit",
  onComplete,
  className = "",
}: DovetailRunProps) {
  const uid = useId();
  const reduced = useReducedMotion();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [values, setValues] = useState<Record<string, string>>(
    () => defaultValues ?? {}
  );
  const [stepStatus, setStepStatus] = useState<StepStatus[]>(() =>
    steps.map(() => "pending")
  );
  const [animPhase, setAnimPhase] = useState<Record<number, AnimPhase>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  const fieldRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const timeouts = useRef<number[]>([]);
  const prevIndexRef = useRef(currentIndex);

  useEffect(
    () => () => {
      timeouts.current.forEach((t) => window.clearTimeout(t));
    },
    []
  );

  // focus the new step's first field when Next actually advances — never on
  // first mount, and never on Back (a deliberate return needs no yank).
  useEffect(() => {
    if (prevIndexRef.current !== currentIndex && currentIndex > prevIndexRef.current) {
      const first = steps[currentIndex]?.fields[0];
      if (first) fieldRefs.current[first.id]?.focus();
    }
    prevIndexRef.current = currentIndex;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  function playAnim(index: number, phase: "seat" | "reject") {
    if (reduced) return;
    setAnimPhase((p) => ({ ...p, [index]: phase }));
    const ms = phase === "seat" ? SEAT_MS : REJECT_MS;
    const t = window.setTimeout(() => {
      setAnimPhase((p) => ({ ...p, [index]: "idle" }));
    }, ms);
    timeouts.current.push(t);
  }

  function validateStep(step: DovetailStep, vals: Record<string, string>) {
    const next: Record<string, string> = {};
    for (const field of step.fields) {
      const value = (vals[field.id] ?? "").trim();
      if (field.required && !value) {
        next[field.id] = `${field.label} is required.`;
        continue;
      }
      if (value && field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        next[field.id] = `Enter a valid ${field.label.toLowerCase()}.`;
        continue;
      }
      if (value && field.validate) {
        const msg = field.validate(value);
        if (msg) next[field.id] = msg;
      }
    }
    return next;
  }

  function handleFieldChange(id: string, value: string) {
    setValues((v) => ({ ...v, [id]: value }));
    setErrors((e) => {
      if (!(id in e)) return e;
      const { [id]: _drop, ...rest } = e;
      return rest;
    });
  }

  function handleSubmitStep(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if ((animPhase[currentIndex] ?? "idle") !== "idle") return;

    const step = steps[currentIndex];
    const stepErrors = validateStep(step, values);

    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      if (stepStatus[currentIndex] === "complete") {
        setStepStatus((s) => s.map((v, i) => (i === currentIndex ? "pending" : v)));
      }
      playAnim(currentIndex, "reject");
      const firstInvalid = step.fields.find((f) => stepErrors[f.id]);
      if (firstInvalid) fieldRefs.current[firstInvalid.id]?.focus();
      return;
    }

    setErrors({});
    setStepStatus((s) => s.map((v, i) => (i === currentIndex ? "complete" : v)));
    playAnim(currentIndex, "seat");

    if (currentIndex === steps.length - 1) {
      setDone(true);
      onComplete?.(values);
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }

  function goBack() {
    if (currentIndex === 0) return;
    setErrors({});
    setDone(false);
    setCurrentIndex((i) => i - 1);
  }

  const step = steps[currentIndex];
  const errorEntries = Object.entries(errors);
  const errorId = `${uid}-errors`;

  return (
    <div className={className}>
      <style>{`
@keyframes ns-dove-seat {
  0%   { transform: translateX(var(--travel)); opacity: 0; animation-timing-function: cubic-bezier(0.16,1,0.3,1); }
  18%  { opacity: 1; }
  72%  { transform: translateX(12px); animation-timing-function: cubic-bezier(0.34,1.56,0.64,1); }
  100% { transform: translateX(0); opacity: 1; }
}
@keyframes ns-dove-reject {
  0%   { transform: translateX(var(--travel)); opacity: 0; animation-timing-function: cubic-bezier(0.16,1,0.3,1); }
  15%  { opacity: 1; }
  55%  { transform: translateX(0px); animation-timing-function: linear; }
  62%  { transform: translateX(4px); }
  69%  { transform: translateX(-1.5px); }
  76%  { transform: translateX(2px); }
  83%  { transform: translateX(0px); animation-timing-function: cubic-bezier(0.4,0,1,1); }
  92%  { opacity: 1; }
  100% { transform: translateX(var(--travel)); opacity: 0; }
}
.ns-dove-seat { animation: ns-dove-seat ${SEAT_MS}ms both; }
.ns-dove-reject { animation: ns-dove-reject ${REJECT_MS}ms both; }
.ns-dove-root:focus-within [data-current-pin] { stroke: var(--accent); }
@media (prefers-reduced-motion: reduce) {
  .ns-dove-seat, .ns-dove-reject { animation: none; }
}
`}</style>

      <div className="ns-dove-root rounded-md border border-border bg-background p-4">
        {/* the rail — decorative summary of the joined run; a real list, but
            no interactive control lives inside it, so Tab never enters it */}
        <ol aria-label="Steps" className="mb-5 flex gap-1.5 overflow-x-auto pb-1">
          {steps.map((s, i) => (
            <RailSlot
              key={s.id}
              step={s}
              index={i}
              status={stepStatus[i]}
              isCurrent={i === currentIndex}
              animPhase={animPhase[i] ?? "idle"}
            />
          ))}
        </ol>

        {done ? (
          <div role="status" className="rounded-sm border border-border bg-surface p-4">
            <p className="font-mono text-xs tracking-wide text-muted">ALL STEPS JOINED</p>
            <p className="mt-1 text-sm text-foreground">
              Every step seated cleanly — the run is complete.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmitStep} noValidate>
            <fieldset>
              <legend className="text-sm font-semibold text-foreground">{step.title}</legend>

              {errorEntries.length > 0 ? (
                <p
                  id={errorId}
                  role="alert"
                  aria-live="assertive"
                  data-dovetail-errors
                  className="mt-3 rounded-sm border border-border bg-surface px-3 py-2 font-mono text-xs text-foreground"
                >
                  {errorEntries.length === 1
                    ? "1 error: "
                    : `${errorEntries.length} errors: `}
                  {errorEntries.map(([, msg]) => msg).join(" ")}
                </p>
              ) : null}

              <div className="mt-3 space-y-3">
                {step.fields.map((field) => {
                  const inputId = `${uid}-${step.id}-${field.id}`;
                  const fieldErrorId = `${inputId}-error`;
                  const hasError = Boolean(errors[field.id]);
                  return (
                    <div key={field.id}>
                      <label
                        htmlFor={inputId}
                        className="block font-mono text-[11px] uppercase tracking-wide text-muted"
                      >
                        {field.label}
                        {field.required ? " *" : ""}
                      </label>
                      <input
                        id={inputId}
                        ref={(el) => {
                          fieldRefs.current[field.id] = el;
                        }}
                        type={field.type ?? "text"}
                        value={values[field.id] ?? ""}
                        placeholder={field.placeholder}
                        autoComplete={field.autoComplete}
                        aria-invalid={hasError || undefined}
                        aria-describedby={hasError ? fieldErrorId : undefined}
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                        className={
                          "mt-1 w-full rounded-sm border bg-surface px-2.5 py-1.5 text-sm text-foreground outline-none transition-colors focus-visible:border-accent " +
                          (hasError ? "border-foreground" : "border-border")
                        }
                      />
                      {hasError ? (
                        <p id={fieldErrorId} className="mt-1 font-mono text-xs text-muted">
                          {errors[field.id]}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                {currentIndex > 0 ? (
                  <button
                    type="button"
                    onClick={goBack}
                    className="inline-flex items-center rounded-sm border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    Back
                  </button>
                ) : null}
                <button
                  type="submit"
                  data-dovetail-next
                  className="inline-flex items-center rounded-sm bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {currentIndex === steps.length - 1 ? submitLabel : "Next"}
                </button>
              </div>
            </fieldset>
          </form>
        )}
      </div>
    </div>
  );
}
