// Pure day-bucketing and sample-accumulation semantics for the /status
// daily-bar strip.
// Deliberately imports NOTHING — not `convex/values`, not `./_generated/*` —
// for two reasons. First, `convex/status.test.ts` runs under plain
// `node --experimental-strip-types`, which cannot resolve the extensionless
// `./_generated/server` import that every real Convex module carries, so the
// logic under test has to live outside that module. Second, the two-dot
// filename means the Convex bundler skips this file as an entry point
// (`node_modules/convex/dist/cjs/bundler/index.js`: a basename with more than
// one dot is never registered), so it is bundled only as an import of
// `convex/status.ts` and never becomes a callable endpoint of its own.
//
// The honesty rule this file encodes: a day with no row is ABSENT. Nothing
// here invents a row, defaults a state, or fills a gap. `recordSample` can
// only ever touch the row for the day it is handed, and a day nobody sampled
// has no row to read — never an "ok" one.
//
// A day's bar is an AGGREGATE of every sample taken that day, not the last
// writer's opinion. The row carries the counters the aggregate is derived
// from (`sampleCount`, `degradedCount`, `downCount`), so the stored `state`
// is a function of measurements rather than of arrival order: one down
// sample at 04:10 still reads down after twelve ok samples that afternoon.

// This file also owns the READ side's day arithmetic and per-service summary
// (`dayWindow`, `toBarState`, `summarizeService`, `uptimeFigure`), for two
// reasons. It is the only module both `app/status/uptime.tsx` and the offline
// test can import — the .tsx cannot be loaded by plain node — so keeping the
// derivation here is what lets the strip's slot placement and uptime figure be
// PROVEN rather than asserted. And it puts the window length behind a single
// constant: the write-side cutoff and the render-side 90 bars are now the same
// number by construction instead of two literals that can drift apart.
// Colour and wording stay in `uptime.tsx`; nothing here knows a Tailwind class.

/** How far back the public read reaches. One bar per day, 90 bars. */
export const SNAPSHOT_WINDOW_DAYS = 90;

/**
 * The three states a snapshot may record. `"degraded"` is present because the
 * status layer already expresses it (`serviceChecks` in lib/status-checks.ts
 * marks `published-cli` and `published-mcp` degraded on version drift). The
 * poller (app/api/status-snapshot/route.ts) can now measure it too — see the
 * note in `convex/schema.ts` — by comparing the published version and
 * component count against the build-time facts in
 * `lib/status.generated.json`, which it reaches the same way
 * `app/status/page.tsx` does: a static import, not a runtime read.
 */
export type SnapshotState = "ok" | "degraded" | "down";

/** One measurement, at one moment, of one service. The unit the writer
 *  produces; several of these land on the same day once polling is
 *  continuous. */
export type SnapshotSample = {
  day: string;
  serviceId: string;
  state: SnapshotState;
  detail?: string;
  recordedAt: number;
};

/** The counters a day's bar is derived from. `sampleCount` counts every
 *  sample recorded that day; the other two count the ones that were not ok.
 *  A day with zero samples has NO ROW at all — these never legitimately read
 *  `sampleCount: 0`. */
export type SnapshotCounts = {
  sampleCount: number;
  degradedCount: number;
  downCount: number;
};

/** The stored row: the day's derived state plus the evidence for it. The
 *  pre-accumulation fields are unchanged, so an existing row still reads.
 *
 *  `lastState` is NOT an aggregate like `state` — it is simply the state of
 *  whichever sample landed most recently, overwritten unconditionally on
 *  every call. It exists so a recovered day (worst state degraded/down, but
 *  the last sample of the day was ok) can be told apart from a day still
 *  actively bad as of its last sample — both read as the same `state` and
 *  would otherwise be indistinguishable on the strip. A legacy row written
 *  before this field existed carries none, which must read as "ordering
 *  unknown", never as recovered and never as still-bad. */
export type SnapshotRow = SnapshotSample & SnapshotCounts & { lastState: SnapshotState };

/**
 * The day's state, derived from its samples and from nothing else:
 * down if ANY sample was down, ok only if EVERY sample was ok, degraded in
 * between. Callers must never invoke this with zero samples — that day is
 * absent, and this throws rather than returning a state for it.
 */
export function deriveState(counts: SnapshotCounts): SnapshotState {
  if (counts.sampleCount <= 0) {
    throw new Error("deriveState: a day with no samples has no state");
  }
  if (counts.downCount > 0) return "down";
  if (counts.degradedCount > 0) return "degraded";
  return "ok";
}

/** Counters for a row written before accumulation existed, where the whole
 *  row IS one recorded measurement: exactly one sample, in the state it
 *  recorded. Not a backfill — it re-states the single sample that row
 *  already represents, so today's poll adds to it instead of erasing it. */
function countsOf(existing: ExistingSnapshot): SnapshotCounts {
  if (existing.sampleCount === undefined) {
    return {
      sampleCount: 1,
      degradedCount: existing.state === "degraded" ? 1 : 0,
      downCount: existing.state === "down" ? 1 : 0,
    };
  }
  return {
    sampleCount: existing.sampleCount,
    degradedCount: existing.degradedCount ?? 0,
    downCount: existing.downCount ?? 0,
  };
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** UTC calendar day as YYYY-MM-DD. UTC, not local: the writer runs on Vercel
 *  in whatever region the cron lands in, and a local-time day boundary would
 *  produce two rows for one day (or none) depending on the region. */
export function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** First day the public read returns, inclusive. `days` counts the window
 *  including today, so the default returns today plus the 89 days before it. */
export function windowStartDay(nowMs: number, days = SNAPSHOT_WINDOW_DAYS): string {
  return utcDay(nowMs - (days - 1) * MS_PER_DAY);
}

/** What `find` hands back: enough of the existing row to add a sample to it.
 *  The counters are optional because rows written before accumulation
 *  existed do not carry them — see `countsOf`. */
export type ExistingSnapshot = {
  state: SnapshotState;
  detail?: string;
  sampleCount?: number;
  degradedCount?: number;
  downCount?: number;
};

/** The narrow slice of `ctx.db` this logic needs, so the same code runs
 *  against the real database and against the fake in `status.test.ts`. */
export type SnapshotStore<Id> = {
  /** The existing row for exactly this (day, serviceId), or null. */
  find(
    day: string,
    serviceId: string,
  ): Promise<({ id: Id } & ExistingSnapshot) | null>;
  /** Never receives an explicit `detail: undefined` key — see `recordSample`. */
  insert(row: SnapshotRow | Omit<SnapshotRow, "detail">): Promise<void>;
  patch(id: Id, fields: Omit<SnapshotRow, "day" | "serviceId">): Promise<void>;
};

/**
 * Add ONE sample to its (day, serviceId) row, and re-derive the day's state
 * from the accumulated counters.
 *
 * Idempotent per (day, serviceId) in the sense that matters for the strip:
 * one row, one bar per service per day, however many times the poller runs.
 * It is deliberately NOT idempotent in the counters — every call is a real
 * measurement that happened, and a day polled 144 times is 144 samples. That
 * is the whole point: the day's bar stops being whoever wrote last.
 */
export async function recordSample<Id>(
  store: SnapshotStore<Id>,
  sample: SnapshotSample,
): Promise<"inserted" | "updated"> {
  const existing = await store.find(sample.day, sample.serviceId);

  if (existing === null) {
    const row: SnapshotRow = {
      ...sample,
      lastState: sample.state,
      sampleCount: 1,
      degradedCount: sample.state === "degraded" ? 1 : 0,
      downCount: sample.state === "down" ? 1 : 0,
    };
    // Insert OMITS `detail` entirely when nothing was measured, rather than
    // passing an explicit `undefined` key: `patch`'s undefined-means-delete
    // semantics are documented, an insert's are not, and this repo's own
    // idiom for an optional field is the same conditional spread
    // (`convex/testimonials.ts`).
    const { detail, ...withoutDetail } = row;
    await store.insert(detail === undefined ? withoutDetail : row);
    return "inserted";
  }

  const prior = countsOf(existing);
  const counts: SnapshotCounts = {
    sampleCount: prior.sampleCount + 1,
    degradedCount: prior.degradedCount + (sample.state === "degraded" ? 1 : 0),
    downCount: prior.downCount + (sample.state === "down" ? 1 : 0),
  };
  const state = deriveState(counts);

  // `detail` describes the state the bar now shows, so it is only replaced by
  // a sample that MATCHES that state. An ok sample arriving after a down one
  // must not caption a down day with "everything fine" — and it must not
  // carry a stale caption under a fresh timestamp either, which is why a
  // matching sample with no detail writes `undefined` (Convex's `patch`
  // reads that as "remove this field").
  const detail = sample.state === state ? sample.detail : existing.detail;

  await store.patch(existing.id, {
    state,
    detail,
    recordedAt: sample.recordedAt,
    // Unlike `detail`, `lastState` is overwritten unconditionally — it never
    // "keeps" a prior value the way a non-matching sample's detail does. It
    // is not the aggregate; it is a plain record of what the newest sample
    // said, so a reader can tell a recovered day from a still-bad one.
    lastState: sample.state,
    ...counts,
  });
  return "updated";
}

// ---------------------------------------------------------------------------
// READ SIDE — what the ninety bars of one card are, given the rows that exist.
// ---------------------------------------------------------------------------

/** A bar's state. `"nodata"` is the only value not in `SnapshotState`: it is
 *  what a day with no row is, and what any state string this build does not
 *  recognise degrades to. There is deliberately no path from an unknown or
 *  missing state to `"ok"`. */
export type BarState = SnapshotState | "nodata";

/** The row shape the page hands the strip — `state` typed as a plain string on
 *  purpose, so a value written by a newer writer is narrowed here rather than
 *  trusted. */
export type HistoryEntry = {
  /** `YYYY-MM-DD`, UTC. */
  day: string;
  serviceId: string;
  state: string;
  detail?: string | null;
  /** The state of the LAST sample recorded that day — not an aggregate, and
   *  typed as a plain string for the same reason `state` is: narrowed here,
   *  not trusted. Absent on a row written before this field existed, which
   *  reads as ordering-unknown (see `Bar.recovered`). */
  lastState?: string | null;
};

export type Bar = {
  day: string;
  state: BarState;
  detail: string | null;
  /** True only when the day's worst state was degraded/down AND its last
   *  recorded sample was ok — a day that went bad and came back, same UTC
   *  day. `false` for a day that never degraded (nothing to recover from)
   *  and for a legacy row with no `lastState` (ordering unknown, so this
   *  never guesses recovered). Never true for `"nodata"`. */
  recovered: boolean;
};

/** Whitelist, not a blacklist: only the three recorded states survive, and
 *  everything else — `""`, `"OK"`, `"unknown"`, a trailing space — is NO DATA. */
export function toBarState(state: string): BarState {
  return state === "ok" || state === "degraded" || state === "down" ? state : "nodata";
}

/** The window's `YYYY-MM-DD` keys, oldest first, ending on `now`'s UTC day.
 *  UTC so a server render and a client hydration cannot disagree about which
 *  day it is, and `SNAPSHOT_WINDOW_DAYS` long so the strip and the query's
 *  cutoff cover the same span. */
export function dayWindow(now: Date = new Date(), days = SNAPSHOT_WINDOW_DAYS): string[] {
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) out.push(utcDay(end - i * MS_PER_DAY));
  return out;
}

/** `2026-08-05` → `5 Aug 2026`, sliced from the ISO day so no locale is read. */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function prettyDay(day: string): string {
  const [y, m, d] = day.split("-");
  const month = MONTHS[Number(m) - 1];
  if (!month) return day;
  return `${Number(d)} ${month} ${y}`;
}

export type ServiceSummary = {
  /** Exactly one bar per day in `days`, in that order. A day with no row keeps
   *  its slot as `"nodata"`, so a gap never shifts the days after it. */
  bars: Bar[];
  /** Days that have a row. The uptime figure's denominator. */
  recordedDays: number;
  /** Days every sample of which was ok. `degraded` is NOT counted here. */
  okDays: number;
  /** Oldest day with a row, or null when nothing was ever recorded. */
  firstRecordedDay: string | null;
  /** The rightmost bar's state — what the card's header says out loud. */
  latest: BarState;
};

/**
 * One service's ninety bars, from the rows that exist and from nothing else.
 * Rows for other services are ignored; rows outside `days` are dropped rather
 * than pulled into a neighbouring slot.
 */
export function summarizeService(
  serviceId: string,
  days: string[],
  history: HistoryEntry[],
): ServiceSummary {
  const byDay = new Map<string, HistoryEntry>();
  for (const row of history) {
    if (row.serviceId === serviceId) byDay.set(row.day, row);
  }

  const bars: Bar[] = days.map((day) => {
    const row = byDay.get(day);
    const state: BarState = row ? toBarState(row.state) : "nodata";
    // Recovered = the day's worst state was bad, but the newest sample that
    // day read ok. `lastState` absent (legacy row) leaves this false — an
    // unknown ordering is never rendered as a recovery.
    const lastState = row?.lastState != null ? toBarState(row.lastState) : null;
    const recovered =
      (state === "degraded" || state === "down") && lastState === "ok";
    return {
      day,
      state,
      // A NO DATA bar carries NO caption. A row whose state this build does not
      // recognise still has a `detail` on it, and keeping it would label a bar
      // "no data: 298 items in /r/registry.json" — a measurement caption under
      // a bar that says nothing was measured. The state is the thing that could
      // not be read; its caption describes a state we are not showing.
      detail: state === "nodata" ? null : row?.detail ?? null,
      recovered,
    };
  });

  const recorded = bars.filter((b) => b.state !== "nodata");
  return {
    bars,
    recordedDays: recorded.length,
    // A day the registry served a stale index was not a day it worked, and
    // rounding it up into the numerator is exactly the kind of flattery this
    // page exists to refuse.
    okDays: recorded.filter((b) => b.state === "ok").length,
    firstRecordedDay: recorded[0]?.day ?? null,
    latest: bars[bars.length - 1]?.state ?? "nodata",
  };
}

/** The figure under a strip: a percentage over the days that HAVE data, always
 *  printing its own denominator so a reader can reconstruct it from the bars.
 *  With zero recorded days it prints words — never `0%`, never `100%`. */
export function uptimeFigure(summary: ServiceSummary): string {
  if (summary.recordedDays === 0 || summary.firstRecordedDay === null) {
    return "no snapshots recorded yet";
  }
  const pct = ((summary.okDays / summary.recordedDays) * 100).toFixed(1);
  const days = summary.recordedDays === 1 ? "1 day" : `${summary.recordedDays} days`;
  return `${pct}% · ${days} recorded since ${prettyDay(summary.firstRecordedDay)}`;
}
