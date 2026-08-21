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
 * A RECOVERED day (worst state degraded/down, but the day's last sample was
 * ok — `Bar.recovered`, derived in `summarizeService`) keeps the SAME colour
 * as a still-bad day of that state: worst-of-day is the whole point of the
 * aggregate and a recovery does not get to soften it. The distinction is text
 * only, appended to the bar's name and tooltip ("degraded, recovered — last
 * sample ok"). Deliberately not phrased as the day having concluded: on the
 * rightmost (today's) bar the day has not ended and could still go bad again,
 * and this
 * page refuses claims it has not measured — what was actually measured is
 * that the newest sample read ok, so that is exactly what it says. No fifth
 * swatch, no separate legend entry — the smallest signal that answers "did
 * this get fixed" without building the incident-log UI this page
 * deliberately does not have.
 *
 * A BACKFILLED day (`Bar.backfilled`, from the sticky flag `convex/status.ts`'s
 * `backfill` mutation sets — see its doc comment) is the same story again: same
 * colour a live day of that state would have, distinguished by text only,
 * appended right after the recovered text if both apply. "backfilled — entered
 * after the fact" is deliberately not softer language ("estimated",
 * "reconstructed") — the row's own state and detail are exact, evidence-derived
 * facts (npm registry timestamps, git history), the ONLY thing not live is when
 * they were typed in.
 *
 * The uptime figure is computed from days that have data and from nothing else,
 * and it always prints its own denominator, so a reader can reconstruct it from
 * the bars in front of them. With zero recorded days it prints words, never a
 * number.
 *
 * WHERE THAT DERIVATION LIVES: not here. The day window, the state whitelist,
 * the per-service summary and the figure string are `convex/status.logic.ts` —
 * the one import-free module both this file and `convex/status.test.ts` can
 * load, since plain node cannot load a .tsx. This file owns colour and wording;
 * the arithmetic is proven offline against the same code the writer uses.
 */

// The day arithmetic and the per-service summary live in
// `convex/status.logic.ts` — the same import-free module the write side uses,
// which is what lets `convex/status.test.ts` prove the slot placement and the
// uptime figure offline. This file owns the colour and the words, and nothing
// else. Re-exported here so the page keeps one import for the strip.
import { CopyButton } from "@/app/_components/copy-button";
import type { CheckState } from "@/lib/status-checks";
import {
  dayWindow,
  prettyDay,
  summarizeService,
  uptimeFigure,
  type BarState,
  type HistoryEntry,
} from "@/convex/status.logic";

export { dayWindow };
export type { BarState, HistoryEntry };

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

/**
 * `CheckState` (this render's live read) and `BarState` (a recorded day) are
 * different vocabularies that happen to share three words — see the header
 * word vs. "now" split below for why they are never collapsed into one. An
 * `unknown` live read reuses the "no data" swatch: it is not a failure and
 * must never render in `--error` or `--success`, and "we could not look" is
 * visually the same shrug as "nobody recorded this day".
 */
const LIVE_BAR: Record<CheckState, string> = {
  ok: BAR.ok,
  degraded: BAR.degraded,
  down: BAR.down,
  unknown: BAR.nodata,
};
const LIVE_WORD: Record<CheckState, string> = {
  ok: "operational",
  degraded: "degraded",
  down: "down",
  unknown: "unknown",
};

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
  /**
   * THIS render's live read for this exact service id — the same
   * `StatusCheck` `bannerState()` ranked to choose the banner's headline.
   * Required, not optional: a card with no live fact is the bug this field
   * exists to close. See the header-vs-"now" split in `ServiceCard` for why
   * this is never blended into `latest`.
   */
  live: { state: CheckState; detail: string };
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
  // Every bar, the figure and the header word come off ONE derivation, proven
  // in convex/status.test.ts: `degraded` is not ok, a day with no row keeps its
  // slot as NO DATA, and the figure prints words when nothing was recorded.
  const summary = summarizeService(service.id, days, history);
  const bars = summary.bars;
  const figure = uptimeFigure(summary);
  // The most recent RECORDED day's own state, not the recorded-days-only
  // figure above: this is the word the card's header states out loud, and it
  // must agree with the colour of the rightmost bar a reader is looking at.
  const latest = summary.latest;

  // `service.live` is THIS render's read of the same check — the one
  // `bannerState()` ranked to write the banner headline above the whole grid.
  // It is deliberately a SEPARATE fact from `latest`, never merged into it:
  // the daily snapshot writer polls at most every ~10 minutes (see
  // .github/workflows/status-poll.yml) while this render happens on every
  // request, so `latest` — yesterday's or earlier today's worst recorded
  // sample — can legitimately lag a live read that changed since the last
  // poll. That lag is exactly what made the banner read "Degraded" over four
  // rows that all said "operational" with nothing on the card naming which
  // one or why. Showing both, each under its own word, is what makes
  // BANNER_CAPTION's "the rows below name which" (app/status/page.tsx) an
  // actually true sentence rather than a promise the card couldn't keep.
  const live = service.live;

  return (
    <article className="rounded-md border border-border p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3 className="text-[15px] font-medium tracking-[-0.01em] text-foreground">
            {service.name}
          </h3>
          <span
            className="flex items-center gap-1.5 font-mono text-[11px] text-ns-muted"
            title={`Live, read for this render: ${LIVE_WORD[live.state]} — ${live.detail}`}
          >
            <span aria-hidden className={`h-2 w-2 rounded-full ${LIVE_BAR[live.state]}`} />
            now: {LIVE_WORD[live.state]}
          </span>
          <span
            className="flex items-center gap-1.5 font-mono text-[11px] text-ns-muted"
            title={`Most recent recorded day (${bars[bars.length - 1]?.day ?? "—"}): ${WORD[latest]}`}
          >
            <span aria-hidden className={`h-2 w-2 rounded-full ${BAR[latest]}`} />
            last recorded day: {WORD[latest]}
          </span>
        </div>
        {service.subtitle ? (
          <span className="flex items-center gap-1">
            <p className="font-mono text-xs text-ns-muted">{service.subtitle}</p>
            <CopyButton value={service.subtitle} label={`Copy ${service.name} identifier`} />
          </span>
        ) : null}
      </div>
      {live.state !== "ok" ? (
        <p className="mt-2 max-w-prose text-xs leading-5 text-ns-muted">{live.detail}</p>
      ) : null}

      {/* Uniform-height, colour-only bars — see the file-level note on where
          the non-colour cue moved. touch-pan-y lets a touch user scroll the
          page vertically through the strip instead of the strip eating the
          gesture. */}
      <div className="mt-4 flex h-6 w-full touch-pan-y items-stretch gap-[2px]">
        {bars.map((bar, i) => {
          // A recovered day IS a degraded/down day — its bar keeps that
          // colour, worst-of-day is not softened for having ended well — but
          // its name says so, the smallest honest way to tell "this happened
          // and was resolved" apart from "this is still going" without a
          // second colour or a whole incident-log UI.
          const name = `${prettyDay(bar.day)} — ${WORD[bar.state]}${bar.recovered ? ", recovered — last sample ok" : ""}${bar.backfilled ? ", backfilled — entered after the fact" : ""}${bar.detail ? `: ${bar.detail}` : ""}`;
          // Centered (`left-1/2 -translate-x-1/2`) is right for every bar except
          // the handful nearest either end of the strip, where a centered,
          // whitespace-nowrap tooltip spills past the card's own edge — and,
          // for the first/last card in the page grid, past the viewport itself.
          // Pin those to the edge they're closest to instead. Purely an anchor
          // swap (`left`/`right`), no measurement: the tooltip is still exactly
          // as wide, just growing away from the strip's edge instead of past it.
          const nearStart = i < 4;
          const nearEnd = i > bars.length - 5;
          const anchorClass = nearStart
            ? "left-0"
            : nearEnd
              ? "right-0"
              : "left-1/2 -translate-x-1/2";
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
                // Hidden (not just opacity-0) until hovered: an always-in-DOM,
                // opacity-0 tooltip still occupies its full box, and centered
                // on a bar near either end of a 90-bar strip that box reaches
                // past the viewport — inflating the page's scrollWidth even
                // when nobody is hovering anything. `hidden` + `group-hover:block`
                // drops it from layout entirely at rest, the same plain-
                // display-swap, no-transition shape the homepage catalog gate
                // uses in app/globals.css for the same reason: this is meant
                // to have never been there, not to fade away.
                //
                // No `whitespace-nowrap`: a long `bar.detail` (an incident
                // description, not just the one-word state) was the thing
                // actually forcing this past 580px wide. Capped instead at
                // `min(20rem, 100vw-2rem)` so it wraps rather than run past
                // the screen — on a phone-width window that's the difference
                // between "readable, wrapped" and "half of it off-canvas".
                className={`pointer-events-none absolute bottom-full z-10 mb-2 hidden w-max max-w-[min(20rem,calc(100vw-2rem))] rounded-[10px] border border-border bg-surface px-2.5 py-2 text-[12px] shadow-[0_12px_32px_rgba(0,0,0,0.18)] group-hover:block ${anchorClass}`}
              >
                <div className="font-medium text-foreground">{prettyDay(bar.day)}</div>
                <div className="mt-1 flex items-center gap-1.5 text-ns-muted">
                  <span aria-hidden className={`h-2 w-2 rounded-[3px] ${BAR[bar.state]}`} />
                  <span>
                    {WORD[bar.state]}
                    {bar.recovered ? ", recovered — last sample ok" : ""}
                    {bar.backfilled ? ", backfilled — entered after the fact" : ""}
                    {bar.detail ? `: ${bar.detail}` : ""}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 font-mono text-[11px] text-ns-muted">
        {/* Counted off the strip that was actually drawn, not typed again: the
            label and the bars cannot disagree about how long the window is. */}
        <span>{bars.length} days</span>
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
