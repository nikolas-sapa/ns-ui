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
 * Height, and this is not decoration: colour is never the only carrier of a
 * bar's state. --success (#47a447) and --error (#ea001d) collapse toward the
 * same muddy tone under deuteranopia, and grey-vs-green — the pair that must
 * NEVER be confused, since it is no-data against healthy — differs by nothing
 * else at all. So every bar also encodes its state as how far it rises in a
 * fixed-height row: ok fills it, degraded reaches half, down is a stub, no
 * data is a flat baseline tick that cannot be mistaken for a day that worked.
 * The row's height is fixed and the bars are baseline-aligned, so this reads
 * as a profile rather than shifting any layout. The legend below shows the
 * same four heights next to their four words.
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

/** The non-colour half of the encoding — see the note at the top of the file.
 *  Read against the fixed `h-8` row the bars sit in. */
const BAR_HEIGHT: Record<BarState, string> = {
  ok: "h-8",
  degraded: "h-4",
  down: "h-2",
  nodata: "h-1",
};

/** The same four heights, scaled into the legend's 10px swatch box, so the
 *  key teaches the shape and not only the colour. */
const LEGEND_HEIGHT: Record<BarState, string> = {
  ok: "h-full",
  degraded: "h-1/2",
  down: "h-1/4",
  nodata: "h-px",
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

  return (
    <article className="rounded-md border border-border p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h3 className="text-[15px] font-medium tracking-[-0.01em] text-foreground">
          {service.name}
        </h3>
        {service.subtitle ? (
          <p className="font-mono text-xs text-ns-muted">{service.subtitle}</p>
        ) : null}
      </div>

      {/* The row's height is fixed and the bars are baseline-aligned, so the
          per-state heights below change the profile without moving anything. */}
      <div className="mt-4 flex h-8 w-full items-end gap-px overflow-hidden sm:gap-[2px]">
        {bars.map((bar) => (
          <span
            key={bar.day}
            title={`${bar.day} — ${WORD[bar.state]}${bar.detail ? `: ${bar.detail}` : ""}`}
            className={`min-w-0 flex-1 rounded-[1px] ${BAR_HEIGHT[bar.state]} ${BAR[bar.state]}`}
          />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 font-mono text-[11px] text-ns-muted">
        <span>90 days</span>
        <span className="tabular-nums">{figure}</span>
      </div>
    </article>
  );
}

/**
 * The key. The `title` on a bar is a hover, which a touch screen and most
 * assistive tech never surface, so the key is where a bar's state becomes
 * readable at all. Four swatches, four words, and each swatch carries the same
 * HEIGHT its bars do — read straight off the same maps the bars use, so
 * neither the colour nor the shape can drift from the word next to it.
 */
export function BarLegend() {
  const order: BarState[] = ["ok", "degraded", "down", "nodata"];
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] text-ns-muted">
      {order.map((state) => (
        <li key={state} className="flex items-center gap-2">
          <span aria-hidden className="flex h-2.5 w-2.5 items-end">
            <span className={`w-full rounded-[1px] ${LEGEND_HEIGHT[state]} ${BAR[state]}`} />
          </span>
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
