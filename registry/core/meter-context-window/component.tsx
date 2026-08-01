"use client";

// A context-window budget meter: one hairline stacked bar segmenting the
// window into system prompt / tools / conversation history / current turn,
// plus the unclaimed remainder, with a Geist Mono token readout underneath.
// It reads at rest because the bar IS the thing it describes — no legend
// needed to decode "what does 40% mean," the segment widths are the answer.
//
// Segments carry no color of their own (the palette is monochrome by house
// rule) — they're told apart by a stepped weight ramp (four flat, clearly
// separated color-mix() tones, lightest for system up to heaviest for the
// live turn) plus a bonus pattern once a segment is wide enough to resolve
// it: tools a diagonal hatch, history a stipple, current turn a fine
// vertical hatch that breathes gently while it's live. A 1px hairline
// divider sits between every pair so the boundary reads even when two
// tones land close together. Pure CSS, built from color-mix() against
// --foreground and --background, never a hex literal and never --accent
// (accent is reserved for interaction, not decoration).
//
// Layout is plain flexbox: each segment's flex-basis is its share of
// max(capacity, used) as a percentage, with a min-width floor on any segment
// that has real tokens but would round below a legible sliver. The floor is
// enforced by the browser's own flex-shrink algorithm (larger segments give
// up the room), not by a hand-rolled pixel solver — a segment with tokens
// never disappears, one with none never fakes a sliver it didn't earn.
//
// Approaching capacity is signalled through form: the wrapper gains a
// pulsing inset ring, the readout goes bold and grows a triangle glyph, and
// the free segment (if any width remains) grows a hazard hatch — never a red
// fill, this palette doesn't have one. Compaction is just a prop change:
// react re-renders new percentages and the segments ease into them on a
// shared transition, so the resettle itself carries the news.
//
// All the numbers are real DOM text (a <p> readout plus a legend list), so
// assistive tech gets the actual figures regardless of what the bar looks
// like; the bar itself is aria-hidden as a redundant visual. The readout is
// a polite live region since it changes asynchronously as tokens accrue.
// prefers-reduced-motion drops the transition, the breathing, and the
// hazard pulse — every state stays fully legible, just static.

export interface BallastContextProps {
  /** total size of the context window, in tokens */
  capacity: number;
  /** tokens spent on the system prompt */
  system: number;
  /** tokens spent on tool/function definitions and results */
  tools: number;
  /** tokens spent on prior conversation turns */
  history: number;
  /** tokens spent on the turn currently being read or generated */
  turn: number;
  /**
   * fraction of capacity (0-1) below which the free segment is flagged as
   * low headroom. default 0.08 (8%)
   */
  lowFreeThreshold?: number;
  /** accessible name for the meter. default "Context window budget" */
  ariaLabel?: string;
  className?: string;
}

const ROLES = [
  { role: "system", label: "System" },
  { role: "tools", label: "Tools" },
  { role: "history", label: "History" },
  { role: "turn", label: "Turn" },
  { role: "free", label: "Free" },
] as const;

function formatTokens(n: number): string {
  return Math.round(Math.max(0, n)).toLocaleString("en-US");
}

function formatPct(tokens: number, denom: number): string {
  if (tokens <= 0 || denom <= 0) return "0%";
  const p = (tokens / denom) * 100;
  if (p < 1) return "<1%";
  return `${Math.round(p)}%`;
}

export function BallastContext({
  capacity,
  system,
  tools,
  history,
  turn,
  lowFreeThreshold = 0.08,
  ariaLabel = "Context window budget",
  className = "",
}: BallastContextProps) {
  const safeSystem = Math.max(0, system);
  const safeTools = Math.max(0, tools);
  const safeHistory = Math.max(0, history);
  const safeTurn = Math.max(0, turn);
  const safeCapacity = Math.max(0, capacity);

  const used = safeSystem + safeTools + safeHistory + safeTurn;
  const overBudget = safeCapacity > 0 && used > safeCapacity;
  const free = Math.max(0, safeCapacity - used);
  // denominator the bar fills to 100% against: capacity normally, or the
  // used total itself once over budget, so the four segments still sum to
  // a full bar instead of visually shrinking below their real weight
  const denom = Math.max(safeCapacity, used, 1);

  const freeFraction = safeCapacity > 0 ? free / safeCapacity : 0;
  const warn = safeCapacity > 0 && (overBudget || freeFraction <= lowFreeThreshold);

  const tokensByRole: Record<(typeof ROLES)[number]["role"], number> = {
    system: safeSystem,
    tools: safeTools,
    history: safeHistory,
    turn: safeTurn,
    free,
  };

  const pct = safeCapacity > 0 ? Math.round((used / safeCapacity) * 100) : 0;
  const statusSuffix = overBudget ? " · over budget" : warn ? " · low headroom" : "";

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      data-warn={warn}
      className={["ns-ballast", className].join(" ")}
    >
      <style>{`
.ns-ballast-track{transition:box-shadow 300ms ease-out}
.ns-ballast[data-warn="true"] .ns-ballast-track{animation:ns-ballast-ring 1.8s ease-in-out infinite}
.ns-ballast-seg{transition:flex-basis 520ms cubic-bezier(.22,1,.36,1)}
.ns-ballast-track .ns-ballast-seg:not([data-role="free"]){border-right:1px solid var(--background)}
.ns-ballast-seg[data-role="system"]{background:color-mix(in srgb, var(--foreground) 22%, var(--background))}
.ns-ballast-seg[data-role="tools"]{background-color:color-mix(in srgb, var(--foreground) 30%, var(--background));background-image:repeating-linear-gradient(45deg, color-mix(in srgb, var(--foreground) 46%, var(--background)) 0 2px, transparent 2px 5px)}
.ns-ballast-seg[data-role="history"]{background-color:color-mix(in srgb, var(--foreground) 40%, var(--background));background-image:radial-gradient(color-mix(in srgb, var(--foreground) 60%, var(--background)) 1.1px, transparent 1.3px);background-size:5px 5px}
.ns-ballast-seg[data-role="turn"]{background-color:color-mix(in srgb, var(--foreground) 52%, var(--background));background-image:repeating-linear-gradient(90deg, color-mix(in srgb, var(--foreground) 72%, var(--background)) 0 1.5px, transparent 1.5px 4px);animation:ns-ballast-breathe 2.6s ease-in-out infinite}
.ns-ballast-seg[data-role="free"]{background:transparent}
.ns-ballast[data-warn="true"] .ns-ballast-seg[data-role="free"]{background-image:repeating-linear-gradient(135deg, color-mix(in srgb, var(--foreground) 26%, transparent) 0 1px, transparent 1px 6px);animation:ns-ballast-hazard 1.6s ease-in-out infinite}
@keyframes ns-ballast-breathe{0%,100%{opacity:.82}50%{opacity:1}}
@keyframes ns-ballast-hazard{0%,100%{opacity:.5}50%{opacity:1}}
@keyframes ns-ballast-ring{0%,100%{box-shadow:inset 0 0 0 1px var(--border)}50%{box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--foreground) 45%, transparent)}}
@media (prefers-reduced-motion: reduce){
  .ns-ballast-seg{transition:none;animation:none !important;opacity:1 !important}
  .ns-ballast-track{animation:none !important;box-shadow:inset 0 0 0 1px var(--border) !important}
}
`}</style>

      <div
        aria-hidden="true"
        className="ns-ballast-track flex h-2.5 w-full overflow-hidden rounded-full border border-border bg-background"
      >
        {ROLES.map(({ role }) => {
          const t = tokensByRole[role];
          return (
            <div
              key={role}
              data-role={role}
              className="ns-ballast-seg h-full shrink"
              style={{
                flexBasis: `${(t / denom) * 100}%`,
                flexGrow: 0,
                minWidth: t > 0 ? "3px" : "0px",
              }}
            />
          );
        })}
      </div>

      <p
        aria-live="polite"
        className={[
          "mt-3 flex items-center gap-1.5 font-mono text-xs tabular-nums text-muted",
          warn ? "font-semibold text-foreground" : "",
        ].join(" ")}
      >
        {warn ? (
          <svg
            aria-hidden="true"
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            className="shrink-0 text-foreground"
          >
            <path
              d="M8 2.4 14.6 13.6H1.4L8 2.4Z"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
            <path d="M8 6.6v3.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            <circle cx="8" cy="11.9" r="0.85" fill="currentColor" />
          </svg>
        ) : null}
        <span>
          {formatTokens(used)} / {formatTokens(safeCapacity)} tokens · {pct}%{statusSuffix}
        </span>
      </p>

      <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 font-mono text-[11px] tabular-nums text-muted">
        {ROLES.map(({ role, label }) => {
          const t = tokensByRole[role];
          return (
            <li key={role} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                data-role={role}
                className="ns-ballast-seg h-2.5 w-2.5 shrink-0 rounded-[2px] border border-border"
              />
              <span className="tracking-wide text-muted">{label}</span>
              <span className="text-foreground">{formatTokens(t)}</span>
              <span>{formatPct(t, denom)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
