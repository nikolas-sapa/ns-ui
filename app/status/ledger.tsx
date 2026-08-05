/**
 * The ledger below the answers: one row per check, three columns.
 *
 *   1. the state, as a WORD. Not a dot, not a pill, not a colour on its own —
 *      the row still reads correctly printed in black and white.
 *   2. the claim, and under it the provenance clause the check wrote about
 *      itself: where the number came from, or what a shortfall costs.
 *   3. the numeric spine, mono and tabular so the numerals line up down the
 *      right edge of a sixteen-row page.
 *
 * Colour appears on exactly two of the four states. A healthy row is silent:
 * no colour, no dot, no badge. Colour on three hundred fine rows is what
 * destroys the signal from the one bad one.
 */
import type { CheckState, StatusCheck } from "@/lib/status-checks";

const WORD: Record<CheckState, string> = {
  ok: "Fine",
  degraded: "Drift",
  down: "Failed",
  unknown: "Not measured",
};

// `ok` and `unknown` share the muted tone on purpose: neither is an alarm, and
// the word alone separates them. Amber is banned here even though --warning
// exists — accent blue carries drift; --error is spent only on a real failure.
const TONE: Record<CheckState, string> = {
  ok: "text-ns-muted",
  degraded: "text-ns-accent",
  down: "text-[var(--error)]",
  unknown: "text-ns-muted",
};

/** `2026-08-04 17:20 UTC`, sliced off the ISO string so the server and the
 *  client can never disagree about a locale or a timezone. */
export function stamp(iso: string): string {
  return `${iso.slice(0, 16).replace("T", " ")} UTC`;
}

export function LedgerSection({
  heading,
  at,
  checks,
}: {
  heading: string;
  /** When this section was measured. A row measured at another moment prints
   *  its own stamp rather than inheriting one that would be a small lie.
   *  Omitted for the permanently unmeasurable, where any timestamp would
   *  imply a look that never happened. */
  at?: string;
  checks: StatusCheck[];
}) {
  return (
    <section className="mt-16">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-foreground">
          {heading}
        </h2>
        {at ? <p className="font-mono text-[11px] text-ns-muted">{stamp(at)}</p> : null}
      </div>
      <div className="mt-4">
        {checks.map((check) => (
          <LedgerRow key={check.id} check={check} sectionAt={at} />
        ))}
      </div>
    </section>
  );
}

function LedgerRow({ check, sectionAt }: { check: StatusCheck; sectionAt?: string }) {
  return (
    <div className="grid gap-x-8 gap-y-1 border-t border-border py-4 sm:grid-cols-[8rem_minmax(0,1fr)_auto] sm:items-baseline">
      <p className={`font-mono text-xs ${TONE[check.state]}`}>{WORD[check.state]}</p>
      <div>
        <p className="text-sm text-foreground">{check.label}</p>
        <p className="mt-1 max-w-prose text-sm leading-6 text-ns-muted">
          {check.detail}
          {!sectionAt || check.measuredAt === sectionAt ? null : (
            <span className="font-mono text-[11px]"> · {stamp(check.measuredAt)}</span>
          )}
        </p>
      </div>
      <p className="font-mono text-sm tabular-nums text-foreground sm:text-right">
        {check.value}
      </p>
    </div>
  );
}
