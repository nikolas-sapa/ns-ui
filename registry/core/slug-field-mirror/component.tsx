"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
} from "react";

// ---------------------------------------------------------------------------
// CarbonFlimsy — a primary text field with a "carbon copy" derived field
// stacked underneath it. Every keystroke in the primary is transformed
// (default: slugified) and stamped onto the flimsy sheet: each newly-arrived
// character mounts fresh and plays a short pressure-jitter keyframe
// (translate 0.4px, font-weight 600 -> 400), staggered ~15ms apart when
// several characters land at once (paste, or a full re-stamp). The flimsy
// sheet sits visually offset 4px down-right from the primary, like a second
// page peeking out from underneath — while linked its border and background
// read as a thin under-sheet (color-mix toward --ns-muted).
//
// Editing the flimsy directly detaches it: the offset springs back to zero,
// the border firms to --foreground at 30%, mirroring stops, and the value
// becomes independently editable. A "Relink" button (only rendered while
// detached) restores the coupling and replays a full re-stamp sweep across
// the freshly-derived value.
//
// Both fields are real, independently labelled <input> elements — the only
// decorative-only layer is the stamp overlay, an aria-hidden row of spans
// painted exactly over the flimsy input while its own text is transparent
// (caret-color kept so a real caret still shows). The flimsy input always
// carries the accessible value; the overlay never diverges from it. Detach
// and relink each fire one polite live-region announcement. Reduced motion
// drops the jitter and the spring transition; nothing about legibility or
// operability depends on either.
// ---------------------------------------------------------------------------

type Vars = CSSProperties & Record<`--${string}`, string | number>;

const CHAR_STAGGER_MS = 15;

function defaultTransform(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function commonPrefixLength(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i;
}

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

interface Stamp {
  text: string;
  /** per-character "batch" id — a span's React key includes this, so only
   *  characters whose gen just changed remount and replay the jitter. */
  gen: number[];
  /** index the current batch's newly-stamped run starts at, for stagger delay. */
  from: number;
}

export interface CarbonFlimsyProps {
  /** Accessible label for the primary field, e.g. "Project title". */
  label: string;
  /** Accessible label for the derived flimsy field, e.g. "Slug". */
  derivedLabel: string;
  /** Controlled primary value. */
  value?: string;
  /** Initial primary value when uncontrolled. @default "" */
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Fires whenever the derived value changes, with whether it's still linked. */
  onDerivedChange?: (value: string, linked: boolean) => void;
  /** Transforms the primary value into the derived one. @default slugify */
  transform?: (value: string) => string;
  placeholder?: string;
  /** Shown in the flimsy field while its value is empty. @default "auto-generated" */
  derivedPlaceholder?: string;
  className?: string;
}

export function CarbonFlimsy({
  label,
  derivedLabel,
  value,
  defaultValue = "",
  onValueChange,
  onDerivedChange,
  transform = defaultTransform,
  placeholder,
  derivedPlaceholder = "auto-generated",
  className = "",
}: CarbonFlimsyProps) {
  const isControlled = value !== undefined;
  const [internalPrimary, setInternalPrimary] = useState(defaultValue);
  const primary = isControlled ? (value as string) : internalPrimary;

  const [linked, setLinked] = useState(true);
  const [stamp, setStamp] = useState<Stamp>(() => {
    const t = transform(defaultValue);
    return { text: t, gen: Array.from(t, () => 0), from: 0 };
  });
  const [live, setLive] = useState("");

  const reducedMotion = useReducedMotion();
  const stampGenRef = useRef(0);
  const prevPrimaryRef = useRef(primary);
  const uid = useId();
  const primaryId = `${uid}-primary`;
  const derivedId = `${uid}-derived`;
  const hintId = `${uid}-hint`;

  const stampDerived = useCallback((next: string, full = false) => {
    setStamp((prev) => {
      const prefixLen = full ? 0 : commonPrefixLength(prev.text, next);
      stampGenRef.current += 1;
      const gen = stampGenRef.current;
      return {
        text: next,
        gen: Array.from(next, (_, i) => (i < prefixLen ? (prev.gen[i] ?? 0) : gen)),
        from: prefixLen,
      };
    });
  }, []);

  // Re-derive whenever the primary value actually changes while linked —
  // covers both the uncontrolled onChange path and an externally controlled
  // `value` update, without duplicating the derivation logic in either handler.
  useEffect(() => {
    if (!linked) {
      prevPrimaryRef.current = primary;
      return;
    }
    if (primary === prevPrimaryRef.current) return;
    prevPrimaryRef.current = primary;
    const next = transform(primary);
    stampDerived(next);
    onDerivedChange?.(next, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primary, linked]);

  const handlePrimaryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    if (!isControlled) setInternalPrimary(next);
    onValueChange?.(next);
  };

  const handleFlimsyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setStamp((prev) => ({ ...prev, text: next }));
    if (linked) {
      setLinked(false);
      setLive(`Detached. ${derivedLabel} no longer follows ${label}.`);
    }
    onDerivedChange?.(next, false);
  };

  const handleRelink = () => {
    const next = transform(primary);
    setLinked(true);
    stampDerived(next, true);
    setLive(`Relinked. ${derivedLabel} restored from ${label}.`);
    onDerivedChange?.(next, true);
  };

  return (
    <div
      className={`ns-cf-root flex w-full flex-col gap-1.5 ${className}`}
      data-reduced={reducedMotion || undefined}
    >
      <style>{`
.ns-cf-flimsy-box{transition:transform 340ms cubic-bezier(.34,1.56,.64,1),border-color 200ms ease,background-color 200ms ease,box-shadow 150ms ease}
.ns-cf-flimsy-box[data-linked]{transform:translate(4px,4px);border-color:var(--border);background:color-mix(in oklab,var(--ns-muted) 14%,var(--background))}
.ns-cf-flimsy-box[data-detached]{transform:translate(0,0);border-color:color-mix(in oklab,var(--foreground) 30%,transparent);background:var(--background)}
.ns-cf-flimsy-box:focus-within{border-color:var(--ns-accent);box-shadow:0 0 0 3px color-mix(in oklab,var(--ns-accent) 18%,transparent)}
.ns-cf-flimsy-input[data-linked]{color:transparent;caret-color:var(--foreground)}
.ns-cf-char{display:inline-block;animation:ns-cf-stamp 120ms ease-out both;animation-delay:var(--cf-delay,0ms)}
@keyframes ns-cf-stamp{0%{transform:translate(0,0);font-weight:600}45%{transform:translate(.4px,.4px);font-weight:500}100%{transform:translate(0,0);font-weight:400}}
.ns-cf-primary-input:focus-visible,.ns-cf-flimsy-input:focus-visible{outline:2px solid var(--ns-accent);outline-offset:2px}
.ns-cf-relink:focus-visible{outline:2px solid var(--ns-accent);outline-offset:2px}
.ns-cf-root[data-reduced] .ns-cf-char{animation:none;font-weight:400}
.ns-cf-root[data-reduced] .ns-cf-flimsy-box{transition:none}
@media (prefers-reduced-motion: reduce){
.ns-cf-char{animation:none;font-weight:400}
.ns-cf-flimsy-box{transition:none}
}
`}</style>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={primaryId}
          className="text-[13px] font-medium tracking-tight text-foreground"
        >
          {label}
        </label>
        <input
          id={primaryId}
          type="text"
          value={primary}
          placeholder={placeholder}
          onChange={handlePrimaryChange}
          data-cf-role="primary"
          className="ns-cf-primary-input h-9 rounded-[6px] border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors duration-150 placeholder:text-ns-muted/70 hover:border-foreground/25 focus:border-ns-accent"
        />
      </div>

      <div className="relative mt-1 pb-1 pr-1">
        <div
          data-linked={linked || undefined}
          data-detached={!linked || undefined}
          className="ns-cf-flimsy-box flex flex-col gap-1 rounded-[12px] border px-3 py-2"
        >
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor={derivedId}
              className="text-[11px] font-medium uppercase tracking-[0.08em] text-ns-muted"
            >
              {derivedLabel}
            </label>
            {!linked && (
              <button
                type="button"
                onClick={handleRelink}
                className="ns-cf-relink inline-flex items-center gap-1 rounded-[6px] px-1.5 py-0.5 text-[11px] font-medium text-ns-accent transition-colors hover:text-ns-accent-hover"
              >
                <svg aria-hidden="true" viewBox="0 0 12 12" className="h-[10px] w-[10px]">
                  <path
                    d="M4.6 4.6 1.8 7.4a1.7 1.7 0 0 0 2.4 2.4L7 7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                  />
                  <path
                    d="M7.4 7.4l2.8-2.8a1.7 1.7 0 0 0-2.4-2.4L5 5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                  />
                </svg>
                Relink
              </button>
            )}
          </div>

          <div className="relative">
            <input
              id={derivedId}
              type="text"
              value={stamp.text}
              placeholder={derivedPlaceholder}
              onChange={handleFlimsyChange}
              aria-describedby={hintId}
              data-linked={linked || undefined}
              className="ns-cf-flimsy-input h-7 w-full border-0 bg-transparent p-0 font-mono text-[13px] leading-7 text-foreground outline-none placeholder:text-ns-muted/70"
            />
            {linked && (
              <div
                aria-hidden="true"
                className="ns-cf-overlay pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-nowrap font-mono text-[13px] leading-7 text-foreground"
              >
                {Array.from(stamp.text).map((ch, i) => {
                  const delay = i >= stamp.from ? (i - stamp.from) * CHAR_STAGGER_MS : 0;
                  return (
                    <span
                      key={`${i}-${stamp.gen[i] ?? 0}`}
                      className="ns-cf-char"
                      style={{ "--cf-delay": `${delay}ms` } as Vars}
                    >
                      {ch === " " ? " " : ch}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <p id={hintId} className="text-[12px] leading-4 text-ns-muted">
        Auto-generated from {label}. Editing detaches it.
      </p>

      <span role="status" aria-live="polite" className="sr-only">
        {live}
      </span>
    </div>
  );
}
