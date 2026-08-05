// Pure day-bucketing and upsert semantics for the /status daily-bar strip.
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
// here invents a row, defaults a state, or fills a gap. `upsertSnapshot` can
// only ever touch the row for the day it is handed.

/** How far back the public read reaches. One bar per day, 90 bars. */
export const SNAPSHOT_WINDOW_DAYS = 90;

/**
 * The three states a snapshot may record. `"degraded"` is present because the
 * status layer already expresses it (`serviceChecks` in lib/status-checks.ts
 * marks `published-packages` degraded on version drift) — but see the note in
 * `convex/schema.ts`: the daily writer cannot currently MEASURE drift, so no
 * bar has ever been recorded degraded. A missing degraded bar is evidence of
 * nothing.
 */
export type SnapshotState = "ok" | "degraded" | "down";

export type SnapshotRow = {
  day: string;
  serviceId: string;
  state: SnapshotState;
  detail?: string;
  recordedAt: number;
};

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

/** The narrow slice of `ctx.db` this logic needs, so the same code runs
 *  against the real database and against the fake in `status.test.ts`. */
export type SnapshotStore<Id> = {
  /** The existing row for exactly this (day, serviceId), or null. */
  find(day: string, serviceId: string): Promise<{ id: Id } | null>;
  /** Never receives an explicit `detail: undefined` key — see `upsertSnapshot`. */
  insert(row: SnapshotRow | Omit<SnapshotRow, "detail">): Promise<void>;
  patch(id: Id, fields: Omit<SnapshotRow, "day" | "serviceId">): Promise<void>;
};

/**
 * Idempotent per (day, serviceId): the second call of a day overwrites the
 * first rather than adding a second bar. Running the cron twice — or a retry
 * after a timeout — must not double-count.
 */
export async function upsertSnapshot<Id>(
  store: SnapshotStore<Id>,
  row: SnapshotRow,
): Promise<"inserted" | "updated"> {
  const existing = await store.find(row.day, row.serviceId);
  // `detail` is always written, `undefined` included — Convex's `patch` treats
  // an explicit `undefined` as "remove this field", which is what a re-run
  // that measured no detail should do. Carrying yesterday's caption forward
  // onto today's measurement would be a stale fact stamped with a new time.
  const fields = {
    state: row.state,
    detail: row.detail,
    recordedAt: row.recordedAt,
  };
  if (existing === null) {
    // Insert OMITS `detail` entirely when nothing was measured, rather than
    // passing an explicit `undefined` key: `patch`'s undefined-means-delete
    // semantics are documented, an insert's are not, and this repo's own
    // idiom for an optional field is the same conditional spread
    // (`convex/testimonials.ts`).
    const { detail, ...withoutDetail } = row;
    await store.insert(detail === undefined ? withoutDetail : row);
    return "inserted";
  }
  await store.patch(existing.id, fields);
  return "updated";
}
