"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
} from "react";

// ---------------------------------------------------------------------------
// LitmusWick — inline per-field validation where the field's bottom border
// behaves like litmus paper. A validator either resolves synchronously
// ("definitely wrong", fast decisive soak) or returns a Promise ("still
// checking", slow tentative soak that pulses while pending). Either way the
// error tint doesn't flash on as a flat colored border — it diffuses in from
// the exact x-position of the character that broke the pattern (measured via
// an off-screen mirror span) and, once fixed, wicks back out and converges
// on that same point. Two registered custom properties (--validation-inline-wick-left/
// -right, percentages) drive the stop positions of the wick div's own
// mask-image, so a CSS transition on those properties genuinely animates the
// diffusion front with real easing rather than a border-color crossfade —
// unregistered custom properties can't be transitioned at all, which is
// exactly why @property is load-bearing here, not decorative.
//
// The wick is pure decoration (aria-hidden): the real, assistive-tech-facing
// surface is a plain native <input> with aria-invalid and an aria-describedby
// message naming the position ("Character 4: space not allowed"), living in
// one aria-live=polite paragraph that also carries async "still checking" /
// resolution announcements. Keyboard flow is an untouched plain input — no
// key interception anywhere.
//
// Deliberately unlike approval-inline-diff: this is per-field and positional (the tint
// originates under the offending character and the field stays live/editable
// the whole time), not a form-level approve/deny gate that collapses once
// and never reopens.
// ---------------------------------------------------------------------------

export type LitmusOutcome =
  | { valid: true }
  | { valid: false; index: number; reason: string };

export type LitmusStatus = "idle" | "checking" | "valid" | "invalid";

export interface LitmusWickProps {
  label: string;
  name?: string;
  id?: string;
  placeholder?: string;
  /** uncontrolled initial value */
  defaultValue?: string;
  /** controlled value; omit for uncontrolled */
  value?: string;
  onValueChange?: (value: string) => void;
  /**
   * Return synchronously for an instantly-known rule ("definitely wrong" —
   * fast, decisive diffusion) or return a Promise for anything that has to
   * ask elsewhere first (uniqueness, server-side rules — "still checking",
   * slower, tentative, pulsing diffusion until it settles).
   */
  validate?: (value: string) => LitmusOutcome | Promise<LitmusOutcome>;
  /** ms after the last keystroke before validate runs. Default 260. */
  debounceMs?: number;
  required?: boolean;
  disabled?: boolean;
  autoComplete?: string;
  className?: string;
}

// ease-out-expo-shaped — same curve approval-inline-diff's collapse and truncation-taper-fade's
// spring both use, kept consistent across the registry rather than inventing
// a new feel for the same "settle" grammar.
const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
const CHECK_HALF_SPAN = 16; // % either side of origin while "still checking"

function isPromiseLike(v: unknown): v is Promise<LitmusOutcome> {
  return (
    !!v &&
    (typeof v === "object" || typeof v === "function") &&
    typeof (v as { then?: unknown }).then === "function"
  );
}

// Measures where the offending character sits, in percent of the input's
// own box, using a hidden mirror span that copies the input's real computed
// font — the only reliable way to turn a character index into an x position
// without a canvas.
function measureOriginPercent(
  input: HTMLInputElement,
  mirror: HTMLSpanElement,
  text: string,
  index: number
): number {
  const cs = getComputedStyle(input);
  mirror.style.font = cs.font;
  mirror.style.letterSpacing = cs.letterSpacing;
  const clamped = Math.max(0, Math.min(index, text.length));

  mirror.textContent = text.slice(0, clamped);
  const prefixWidth = mirror.offsetWidth;

  mirror.textContent = text.slice(0, clamped) + (text[clamped] ?? " ");
  const throughWidth = mirror.offsetWidth;
  const charWidth = Math.max(1, throughWidth - prefixWidth);

  const paddingLeft = parseFloat(cs.paddingLeft) || 0;
  const total = input.clientWidth || 1;
  const centerPx = paddingLeft + prefixWidth + charWidth / 2;
  return Math.max(0, Math.min(100, (centerPx / total) * 100));
}

export function LitmusWick({
  label,
  name,
  id,
  placeholder,
  defaultValue = "",
  value,
  onValueChange,
  validate,
  debounceMs = 260,
  required,
  disabled,
  autoComplete,
  className = "",
}: LitmusWickProps) {
  const uid = useId();
  const inputId = id ?? `litmus-${uid}`;
  const msgId = `litmus-msg-${uid}`;

  const inputRef = useRef<HTMLInputElement>(null);
  const mirrorRef = useRef<HTMLSpanElement>(null);
  const requestIdRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isControlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue);
  const current = isControlled ? (value as string) : inner;

  const [status, setStatus] = useState<LitmusStatus>("idle");
  const [message, setMessage] = useState("");
  const [origin, setOrigin] = useState(50);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function settle(
    id: number,
    text: string,
    outcome: LitmusOutcome,
    wasAsync: boolean
  ) {
    // A newer keystroke already superseded this in-flight check — a stale
    // async result must never overwrite what the user is looking at now.
    if (id !== requestIdRef.current) return;
    if (outcome.valid) {
      setStatus("valid");
      // Only the async path gets an explicit "it's fine" announcement —
      // that's the one case where the user was genuinely waiting on a
      // result. A sync rule quietly clearing on every valid keystroke would
      // just be aria-live noise while someone types normally.
      setMessage(wasAsync ? "Looks good." : "");
      return;
    }
    const input = inputRef.current;
    const mirror = mirrorRef.current;
    if (input && mirror) {
      setOrigin(measureOriginPercent(input, mirror, text, outcome.index));
    }
    setStatus("invalid");
    setMessage(`Character ${outcome.index + 1}: ${outcome.reason}`);
  }

  function runValidate(text: string) {
    const id = ++requestIdRef.current;
    if (!validate) return;
    const result = validate(text);
    if (isPromiseLike(result)) {
      // Origin while pending: the end of what's currently typed — an async
      // check (uniqueness, server rule) judges the value as a whole, not one
      // character, so the tentative blot grows from the caret's neighborhood
      // rather than claiming to already know where a fault is.
      const input = inputRef.current;
      const mirror = mirrorRef.current;
      if (input && mirror) {
        setOrigin(measureOriginPercent(input, mirror, text, text.length));
      }
      setStatus("checking");
      setMessage("Checking…");
      result.then(
        (o) => settle(id, text, o, true),
        () =>
          settle(
            id,
            text,
            { valid: false, index: Math.max(0, text.length - 1), reason: "check failed" },
            true
          )
      );
    } else {
      settle(id, text, result, false);
    }
  }

  function handleChange(next: string) {
    if (!isControlled) setInner(next);
    onValueChange?.(next);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (next === "") {
      requestIdRef.current++; // invalidates any in-flight async check
      setStatus("idle");
      setMessage("");
      return;
    }
    debounceRef.current = setTimeout(() => runValidate(next), debounceMs);
  }

  const left =
    status === "invalid"
      ? 0
      : status === "checking"
        ? Math.max(0, origin - CHECK_HALF_SPAN)
        : origin;
  const right =
    status === "invalid"
      ? 100
      : status === "checking"
        ? Math.min(100, origin + CHECK_HALF_SPAN)
        : origin;

  const wickStyle = {
    "--validation-inline-wick-left": `${left}%`,
    "--validation-inline-wick-right": `${right}%`,
    backgroundColor: "var(--error, #ea001d)",
  } as CSSProperties;

  const messageStyle: CSSProperties | undefined =
    status === "invalid" ? { color: "var(--error, #ea001d)" } : undefined;

  return (
    <div className={className}>
      <style>{`
        @property --validation-inline-wick-left {
          syntax: '<percentage>';
          inherits: false;
          initial-value: 50%;
        }
        @property --validation-inline-wick-right {
          syntax: '<percentage>';
          inherits: false;
          initial-value: 50%;
        }
        .ns-validation-inline-wick {
          transition:
            --validation-inline-wick-left 480ms ${EASE},
            --validation-inline-wick-right 480ms ${EASE},
            opacity 480ms ease;
          opacity: 1;
          mask-image: linear-gradient(
            to right,
            transparent 0%, transparent var(--validation-inline-wick-left),
            black var(--validation-inline-wick-left), black var(--validation-inline-wick-right),
            transparent var(--validation-inline-wick-right), transparent 100%
          );
          -webkit-mask-image: linear-gradient(
            to right,
            transparent 0%, transparent var(--validation-inline-wick-left),
            black var(--validation-inline-wick-left), black var(--validation-inline-wick-right),
            transparent var(--validation-inline-wick-right), transparent 100%
          );
        }
        .ns-validation-inline-wick[data-phase="checking"] {
          transition-duration: 1100ms;
          opacity: .6;
          animation: ns-litmus-pulse 900ms ease-in-out infinite;
        }
        .ns-validation-inline-wick[data-phase="invalid"] {
          transition-duration: 420ms;
          opacity: 1;
        }
        @keyframes ns-litmus-pulse {
          0%, 100% { opacity: .4; }
          50% { opacity: .72; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ns-validation-inline-wick {
            transition: none;
          }
          .ns-validation-inline-wick[data-phase="checking"] {
            animation: none;
            opacity: .6;
          }
        }
      `}</style>

      <label
        htmlFor={inputId}
        className="block font-mono text-[11px] uppercase tracking-wide text-muted"
      >
        {label}
      </label>

      <div className="group relative mt-1.5">
        <input
          ref={inputRef}
          id={inputId}
          name={name}
          type="text"
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          autoComplete={autoComplete}
          value={current}
          onChange={(e) => handleChange(e.target.value)}
          aria-invalid={status === "invalid"}
          aria-describedby={msgId}
          className="w-full bg-transparent px-0 py-2 text-sm text-foreground outline-none placeholder:text-muted disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />

        {/* baseline border — the field's resting bottom edge */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-border transition-colors group-hover:bg-foreground/25"
        />

        {/* the wick — decorative only, masked to the diffused span */}
        <div
          aria-hidden
          data-phase={status}
          className="ns-validation-inline-wick pointer-events-none absolute inset-x-0 bottom-0 h-[2px]"
          style={wickStyle}
        />

        {/* off-screen mirror: measures the x-position of a given character
            index against the input's real computed font. Never read by AT
            (empty at rest, visibility hidden, not part of layout flow). */}
        <span
          ref={mirrorRef}
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 -z-10 whitespace-pre"
          style={{ visibility: "hidden" }}
        />
      </div>

      <p
        id={msgId}
        aria-live="polite"
        className="mt-1.5 min-h-[1em] font-mono text-xs text-muted"
        style={messageStyle}
      >
        {message}
      </p>
    </div>
  );
}
