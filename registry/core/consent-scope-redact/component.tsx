"use client";

import { useId, useState } from "react";

/** One sharing scope, rendered as a real switch. Toggling it redacts/reveals every token tagged with its `id`. */
export interface LampBlackScope {
  id: string;
  /** Visible + accessible label for the switch, e.g. "Location". */
  label: string;
  /** Optional one-line clarifier under the label. */
  hint?: string;
  /** Whether this scope is shared (visible) at mount. Defaults to true. */
  defaultShared?: boolean;
}

/** A redactable span of the record — literal text tied to a scope. */
export interface LampBlackToken {
  /** Literal text of this token exactly as it appears in the record. */
  text: string;
  /** Which scope's switch controls this token. Must match a `LampBlackScope.id`. */
  scope: string;
  /** Short noun used in the a11y string "[withheld: kind]" — defaults to `scope`. */
  kind?: string;
}

/** A part of the templated sentence: plain connective text, or a token tied to a scope. */
export type LampBlackPart = string | LampBlackToken;

export interface LampBlackProps {
  /** The switches — one per sharing scope. */
  scopes: LampBlackScope[];
  /** The sentence, templated as an ordered list of literal text and scope-tagged tokens. */
  record: LampBlackPart[];
  className?: string;
}

const SWEEP_MS = 260;
const STAGGER_MS = 40;

function isToken(part: LampBlackPart): part is LampBlackToken {
  return typeof part !== "string";
}

// Deterministic +/-0.3deg per bar so the strokes don't all sit dead-level — a
// hand-laid feel, not randomness that would differ mount to mount.
function rotationFor(text: string, groupIndex: number): number {
  const sign = (text.length + groupIndex) % 2 === 0 ? 1 : -1;
  return sign * 0.3;
}

/**
 * A consent surface that shows instead of tells: a live sentence built from
 * the user's own record, where each sharing scope is a real switch and
 * toggling one sweeps a felt-pen redaction bar over exactly the tokens that
 * scope withholds. The bar is the consent document.
 */
export function LampBlack({ scopes, record, className = "" }: LampBlackProps) {
  const [shared, setShared] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(scopes.map((s) => [s.id, s.defaultShared ?? true])),
  );
  const uid = useId();

  const toggle = (id: string) => {
    setShared((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // per-scope running counts, for the 40ms group stagger
  const groupCounts: Record<string, number> = {};

  const sharedLabels = scopes.filter((s) => shared[s.id]).map((s) => s.label);
  const withheldLabels = scopes.filter((s) => !shared[s.id]).map((s) => s.label);
  const summary =
    withheldLabels.length === 0
      ? `Sharing everything below: ${sharedLabels.join(", ")}.`
      : sharedLabels.length === 0
        ? `Withholding everything below: ${withheldLabels.join(", ")}.`
        : `Sharing ${sharedLabels.join(", ")}. Withholding ${withheldLabels.join(", ")}.`;

  return (
    <div
      className={`ns-lampblack w-full max-w-lg rounded-xl border border-border bg-surface ${className}`}
    >
      <style>{`
        .ns-lampblack-bar {
          transition: transform ${SWEEP_MS}ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .ns-lampblack-glyph {
          transition: color ${SWEEP_MS}ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .ns-lampblack-thumb {
          transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .ns-lampblack-track {
          transition: background-color 200ms ease-out, border-color 200ms ease-out, box-shadow 200ms ease-out;
        }
        .ns-lampblack-track:hover {
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--foreground) 12%, transparent);
        }
        @media (prefers-reduced-motion: reduce) {
          .ns-lampblack-bar, .ns-lampblack-glyph, .ns-lampblack-thumb, .ns-lampblack-track {
            transition: none;
          }
        }
      `}</style>

      <header className="border-b border-border px-5 py-3">
        <span className="font-mono text-xs tracking-widest text-muted">
          DATA SHARING PREVIEW
        </span>
      </header>

      <div className="px-5 py-5 text-sm leading-[1.9] text-foreground">
        <p>
          {record.map((part, i) => {
            if (!isToken(part)) {
              return <span key={i}>{part}</span>;
            }
            const groupIndex = groupCounts[part.scope] ?? 0;
            groupCounts[part.scope] = groupIndex + 1;
            const withheld = !shared[part.scope];
            const kind = part.kind ?? part.scope;
            const delayMs = groupIndex * STAGGER_MS;
            const rot = rotationFor(part.text, groupIndex);
            return (
              <span
                key={i}
                className="relative inline-block whitespace-nowrap rounded-[3px] px-[2px] align-baseline"
              >
                <span
                  aria-hidden={withheld}
                  className="ns-lampblack-glyph relative z-0"
                  style={{
                    color: withheld ? "transparent" : "var(--foreground)",
                    transitionDelay: `${delayMs}ms`,
                  }}
                >
                  {part.text}
                </span>
                {withheld && <span className="sr-only">{`[withheld: ${kind}]`}</span>}
                <span
                  aria-hidden
                  data-lampblack-bar={part.scope}
                  data-withheld={withheld ? "true" : "false"}
                  className="ns-lampblack-bar absolute inset-0 z-10 rounded-[2px] bg-foreground"
                  style={{
                    transform: `rotate(${rot}deg) scaleX(${withheld ? 1 : 0})`,
                    transformOrigin: "left center",
                    transitionDelay: `${delayMs}ms`,
                  }}
                />
              </span>
            );
          })}
        </p>
      </div>

      <div className="border-t border-border px-5 py-2">
        {scopes.map((scope) => {
          const labelId = `${uid}-${scope.id}-label`;
          const on = shared[scope.id];
          return (
            <div
              key={scope.id}
              className="flex items-start justify-between gap-4 py-2.5 first:pt-3 last:pb-3"
            >
              <div className="min-w-0">
                <div id={labelId} className="text-sm text-foreground">
                  {scope.label}
                </div>
                {scope.hint && <div className="mt-0.5 text-xs text-muted">{scope.hint}</div>}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-labelledby={labelId}
                data-lampblack-switch={scope.id}
                onClick={() => toggle(scope.id)}
                className="ns-lampblack-track relative h-5 w-9 shrink-0 rounded-full border border-border p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                style={{
                  backgroundColor: on ? "var(--accent)" : "var(--border)",
                  borderColor: on ? "var(--accent)" : "var(--border)",
                }}
              >
                <span
                  aria-hidden
                  className="ns-lampblack-thumb block h-4 w-4 rounded-full bg-background"
                  style={{ transform: on ? "translateX(16px)" : "translateX(0)" }}
                />
              </button>
            </div>
          );
        })}
      </div>

      <p aria-live="polite" className="border-t border-border px-5 py-3 text-xs text-muted">
        {summary}
      </p>
    </div>
  );
}
