/**
 * The uptime strip: one card per service, ninety daily bars each.
 *
 * The single rule this file exists to enforce is that a bar is drawn ONLY from
 * a snapshot that was actually recorded. There is no seeding, no backfill and
 * no default: a day with no row is NO DATA and renders as an inert grey bar,
 * the same grey the day before recording began gets. On the day the first
 * snapshot lands, eighty-nine of these ninety bars are grey, and that is the
 * correct render — not a bug to design around.
 *
 * Colour:
 *   ok        → --success
 *   degraded  → --ns-accent (the blue). Amber/orange is banned in this project,
 *               and --warning exists but is never spent here.
 *   down      → --error
 *   no data   → --ns-muted at 25%, an inert grey that still reads as a bar. NOT
 *               --border: that token is tuned to be a near-invisible hairline
 *               (#ebebeb on white) and a card of ninety of them would render
 *               blank in light mode, which is the day-one state.
 * Every one of those is an existing token in app/globals.css; nothing was
 * added. --success and --error are written as `bg-[var(--x)]` because only
 * background/foreground/surface/border/muted/accent are lifted into Tailwind's
 * `--color-*` namespace by `@theme inline` — a bare `bg-success` would compile
 * to nothing at all.
 *
 * Bars are now UNIFORM height, colour-coded only — the reference the owner
 * chose. That drops the height-encoding this file used to carry as the
 * non-colour cue (ok fills the row, degraded half, down a stub, no data a
 * baseline tick), so the same information moves to three other places instead
 * of disappearing:
 *   (a) each card's header states its own most-recent-day status as a WORD,
 *       next to a colour dot, right beside the service name;
 *   (b) the legend below the strips pairs a colour swatch with each state
 *       word — swatch and word can never drift apart because both come off
 *       the same `BAR`/`WORD` maps the bars themselves use;
 *   (c) every bar carries an accessible name — `title` for a mouse hover and
 *       `aria-label` for anything that reads the DOM — spelling out its date
 *       and its state word in text, not colour. The on-hover tooltip under the
 *       bar is a sighted-user convenience layered on top of that name, marked
 *       `aria-hidden` so assistive tech is never told the same fact twice.
 * A colour-blind reader therefore never has to resolve --success vs --error by
 * hue: the word is on the card, in the legend, and in every bar's own name.
 *
 * The uptime figure is computed from days that have data and from nothing else,
 * and it always prints its own denominator, so a reader can reconstruct it from
 * the bars in front of them. With zero recorded days it prints words, never a
 * number.
 */

/** The shape the Convex history query returns, one row per service per day.
 *  `state` is typed as a plain string on purpose: anything this file does not
 *  recognise is treated as NO DATA rather than thrown on. */
export type HistoryEntry = {
  /** `YYYY-MM-DD`, UTC. */
  day: string;
  serviceId: string;
  state: string;
  detail?: string | null;
};

export type BarState = "ok" | "degraded" | "down" | "nodata";

const BAR: Record<BarState, string> = {
  ok: "bg-[var(--success)]",
  degraded: "bg-ns-accent",
  down: "bg-[var(--error)]",
  nodata: "bg-ns-muted/25",
};

const WORD: Record<BarState, string> = {
  ok: "operational",
  degraded: "degraded",
  down: "down",
  nodata: "no data",
};

const DAYS = 90;

/** The ninety `YYYY-MM-DD` keys ending today, built in UTC so a server render
 *  and a client hydration can never disagree about which day it is. */
export function dayWindow(now: Date = new Date()): string[] {
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days: string[] = [];
  for (let i = DAYS - 1; i >= 0; i -= 1) {
    days.push(new Date(end - i * 86_400_000).toISOString().slice(0, 10));
  }
  return days;
}

function toBarState(state: string): BarState {
  return state === "ok" || state === "degraded" || state === "down" ? state : "nodata";
}

/** `2026-08-05` → `5 Aug 2026`, sliced from the ISO day so no locale is read. */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function prettyDay(day: string): string {
  const [y, m, d] = day.split("-");
  const month = MONTHS[Number(m) - 1];
  if (!month) return day;
  return `${Number(d)} ${month} ${y}`;
}

export type ServiceRow = {
  /** Matches the check id in lib/status-checks.ts and the `serviceId` written
   *  by the snapshot job. */
  id: string;
  name: string;
  /** The host or package this row is actually about. Omitted rather than
   *  faked when the identifier is not configured. */
  subtitle?: string;
  /**
   * One sentence about what this row's history does NOT contain, printed under
   * the strip. It exists for a row whose service id is younger than the page:
   * a strip of grey bars is indistinguishable from a service nobody has ever
   * checked, and the difference belongs on the card rather than in a commit
   * message. Never used to explain away a bar that IS drawn.
   */
  note?: string;
};

/**
 * A card. `history` is every recorded row for every service; this component
 * takes only the rows whose `serviceId` matches, and only the ones that fall
 * inside the window.
 */
export function ServiceCard({
  service,
  days,
  history,
}: {
  service: ServiceRow;
  days: string[];
  history: HistoryEntry[];
}) {
  const byDay = new Map<string, HistoryEntry>();
  for (const row of history) {
    if (row.serviceId === service.id) byDay.set(row.day, row);
  }

  const bars = days.map((day) => {
    const row = byDay.get(day);
    return { day, state: row ? toBarState(row.state) : "nodata", detail: row?.detail ?? null };
  });

  const recorded = bars.filter((b) => b.state !== "nodata");
  // `degraded` counts as not-ok. A day the registry served a stale index was
  // not a day it worked, and rounding it up into the numerator is exactly the
  // kind of flattery this page exists to refuse.
  const okDays = recorded.filter((b) => b.state === "ok").length;
  const first = recorded[0]?.day;

  const figure =
    recorded.length === 0
      ? "no snapshots recorded yet"
      : `${((okDays / recorded.length) * 100).toFixed(1)}% · ${
          recorded.length === 1 ? "1 day" : `${recorded.length} days`
        } recorded since ${prettyDay(first as string)}`;

  // The most recent bar's own state, not the recorded-days-only figure above:
  // this is the word the card's header states out loud, and it must agree
  // with the colour of the rightmost bar a reader is looking at.
  const latest = bars[bars.length - 1]?.state ?? "nodata";

  return (
    <article className="rounded-md border border-border p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3 className="text-[15px] font-medium tracking-[-0.01em] text-foreground">
            {service.name}
          </h3>
          <span className="flex items-center gap-1.5 font-mono text-[11px] text-ns-muted">
            <span aria-hidden className={`h-2 w-2 rounded-full ${BAR[latest]}`} />
            {WORD[latest]}
          </span>
        </div>
        {service.subtitle ? (
          <p className="font-mono text-xs text-ns-muted">{service.subtitle}</p>
        ) : null}
      </div>

      {/* Uniform-height, colour-only bars — see the file-level note on where
          the non-colour cue moved. touch-pan-y lets a touch user scroll the
          page vertically through the strip instead of the strip eating the
          gesture. */}
      <div className="mt-4 flex h-6 w-full touch-pan-y items-stretch gap-[2px]">
        {bars.map((bar) => {
          const name = `${prettyDay(bar.day)} — ${WORD[bar.state]}${bar.detail ? `: ${bar.detail}` : ""}`;
          return (
            <div key={bar.day} className="group relative min-w-0 flex-1">
              <span
                title={name}
                aria-label={name}
                className={`block h-full w-full rounded-[1px] transition-opacity duration-100 ${BAR[bar.state]}`}
              />
              <div
                aria-hidden
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-[10px] border border-border bg-surface px-2.5 py-2 text-[12px] opacity-0 shadow-[0_12px_32px_rgba(0,0,0,0.18)] transition-opacity duration-100 group-hover:opacity-100"
              >
                <div className="font-medium text-foreground">{prettyDay(bar.day)}</div>
                <div className="mt-1 flex items-center gap-1.5 text-ns-muted">
                  <span aria-hidden className={`h-2 w-2 rounded-[3px] ${BAR[bar.state]}`} />
                  <span>
                    {WORD[bar.state]}
                    {bar.detail ? `: ${bar.detail}` : ""}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 font-mono text-[11px] text-ns-muted">
        <span>90 days</span>
        <span className="tabular-nums">{figure}</span>
      </div>

      {service.note ? (
        <p className="mt-3 max-w-prose text-xs leading-5 text-ns-muted">{service.note}</p>
      ) : null}
    </article>
  );
}

/**
 * The key. The `title`/`aria-label` on a bar is only reachable one bar at a
 * time; the legend is where every state's colour and word sit side by side at
 * once. Four swatches, four words, read straight off the same `BAR`/`WORD`
 * maps the bars and the card headers use, so none of the three can drift from
 * the other two.
 */
export function BarLegend() {
  const order: BarState[] = ["ok", "degraded", "down", "nodata"];
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] text-ns-muted">
      {order.map((state) => (
        <li key={state} className="flex items-center gap-2">
          <span aria-hidden className={`h-2 w-2 rounded-[3px] ${BAR[state]}`} />
          {WORD[state]}
        </li>
      ))}
    </ul>
  );
}

export type BannerState = "ok" | "degraded" | "down" | "unknown";

const BANNER: Record<BannerState, { headline: string; dot: string }> = {
  ok: { headline: "Fully operational", dot: "bg-[var(--success)]" },
  degraded: { headline: "Degraded", dot: "bg-ns-accent" },
  down: { headline: "Outage", dot: "bg-[var(--error)]" },
  unknown: { headline: "Partially measured", dot: "bg-ns-muted/25" },
};

/**
 * The banner reads THIS render's live service reads, never the history — on a
 * day with no snapshots a green banner derived from an empty table would be a
 * measurement nobody took. `caption` is written by the caller and names what
 * the state rests on.
 */
export function OverallBanner({
  state,
  caption,
}: {
  state: BannerState;
  caption: string;
}) {
  const { headline, dot } = BANNER[state];
  return (
    <section className="rounded-md border border-border bg-surface px-5 py-5 sm:px-6">
      <div className="flex items-center gap-3">
        {state === "ok" ? (
          <span
            aria-hidden
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--success)]"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
              <path
                d="M3.5 8.5 6.5 11.5 12.5 5"
                stroke="#ffffff"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        ) : (
          <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
        )}
        <h2 className="text-lg font-medium tracking-[-0.02em] text-foreground sm:text-xl">
          {headline}
        </h2>
      </div>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-ns-muted">{caption}</p>
    </section>
  );
}
