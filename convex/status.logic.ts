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

/** How far back the public read reaches. One bar per day, 90 bars. */
export const SNAPSHOT_WINDOW_DAYS = 90;

/**
 * The three states a snapshot may record. `"degraded"` is present because the
 * status layer already expresses it (`serviceChecks` in lib/status-checks.ts
 * marks `published-cli` and `published-mcp` degraded on version drift) — but see the note in
 * `convex/schema.ts`: the daily writer cannot currently MEASURE drift, so no
 * bar has ever been recorded degraded. A missing degraded bar is evidence of
 * nothing.
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
 *  pre-accumulation fields are unchanged, so an existing row still reads. */
export type SnapshotRow = SnapshotSample & SnapshotCounts;

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
    ...counts,
  });
  return "updated";
}
