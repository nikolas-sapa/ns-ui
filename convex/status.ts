// §6.3: every exported query/mutation here is a public, internet-facing
// endpoint with no row-security backstop — `NEXT_PUBLIC_CONVEX_URL` is in the
// client bundle. That is fine for `recent` (the /status page is public and
// this is exactly the data it renders) and is the whole problem for `record`.
//
// `record` is the FIRST write in this deployment that no signed-in identity
// backs: it is called by scheduled pollers (a GitHub Actions schedule, plus
// the Vercel cron as a fallback), which have no Convex session. Left
// unguarded, anyone holding the public deployment URL could forge uptime
// history — which would destroy the only thing /status is for. So it carries
// its own shared-secret check, in the same closed-by-default shape
// `convex/testimonials.ts` uses for `OWNER_EMAILS`: the secret lives in the
// deployment's `STATUS_SNAPSHOT_SECRET` env var, and an unset or empty value
// means NOBODY can write, rather than everybody. The route
// (app/api/status-snapshot/route.ts) has its own, separate `CRON_SECRET`
// check; neither guard is a substitute for the other, because the route guard
// does not stand between a stranger and this endpoint.
//
// `record`'s caller never supplies the day: `day` is derived from the server
// clock, so a leaked secret still cannot rewrite the past through THIS
// mutation — only today. `backfill` below is the one narrow, audited
// exception (an owner reconstructing a real incident noticed too late to
// land as a live sample) — same secret, but three of its own guards
// (strict-format day, no future day, a 30-day trailing window) and a sticky
// `backfilled` flag that makes every row it touches say so, in both the data
// and the /status UI. See `backfill`'s own doc comment for why that is a
// second mutation rather than an optional `day` on this one.
import { ConvexError, v } from "convex/values";
import { type Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import {
  BACKFILL_WINDOW_DAYS,
  SNAPSHOT_WINDOW_DAYS,
  backfillDetail,
  isDayInBackfillWindow,
  isValidCalendarDay,
  recordSample,
  secretMatches,
  utcDay,
  windowStartDay,
  type SnapshotStore,
} from "./status.logic";

const snapshotState = v.union(
  v.literal("ok"),
  v.literal("degraded"),
  v.literal("down"),
);

const publicSnapshot = v.object({
  day: v.string(),
  serviceId: v.string(),
  state: snapshotState,
  detail: v.optional(v.string()),
  recordedAt: v.number(),
  // How much evidence stands behind that state. Optional because rows written
  // before continuous polling existed carry no counters — a reader must treat
  // an absent `sampleCount` as unknown, NOT as zero and not as many. What the
  // page does with these numbers is the page's business; this layer computes
  // no percentage from them, because a percentage over an unknown number of
  // unevenly spaced samples is not an uptime figure.
  sampleCount: v.optional(v.number()),
  degradedCount: v.optional(v.number()),
  downCount: v.optional(v.number()),
  // The newest sample's own state — not an aggregate, see convex/schema.ts.
  // Optional for the same reason the counters are: a row written before this
  // field existed carries none.
  lastState: v.optional(snapshotState),
  // Sticky provenance flag — see convex/schema.ts and status.backfill below.
  // Optional for the same reason as lastState: absent means "not known to be
  // backfilled", not "measured live".
  backfilled: v.optional(v.boolean()),
});

/**
 * The last 90 UTC days of snapshots, every service, oldest first. Public and
 * unauthenticated on purpose — /status is a public page.
 *
 * It returns ONLY the rows that exist. It does not pad the window, and it must
 * never be made to: a day missing from this array is a day nothing was
 * measured, and the caller has to render that as NO DATA. On the first day
 * after this ships, that is 89 of 90 bars.
 */
export const recent = query({
  args: {},
  returns: v.array(publicSnapshot),
  handler: async (ctx) => {
    const cutoff = windowStartDay(Date.now(), SNAPSHOT_WINDOW_DAYS);
    const docs = await ctx.db
      .query("statusSnapshots")
      .withIndex("by_day_service", (q) => q.gte("day", cutoff))
      .collect();

    return docs.map((doc) => ({
      day: doc.day,
      serviceId: doc.serviceId,
      state: doc.state,
      ...(doc.detail === undefined ? {} : { detail: doc.detail }),
      recordedAt: doc.recordedAt,
      ...(doc.sampleCount === undefined
        ? {}
        : {
            sampleCount: doc.sampleCount,
            degradedCount: doc.degradedCount ?? 0,
            downCount: doc.downCount ?? 0,
          }),
      ...(doc.lastState === undefined ? {} : { lastState: doc.lastState }),
      ...(doc.backfilled === undefined ? {} : { backfilled: doc.backfilled }),
    }));
  },
});

// `secretMatches` (convex/status.logic.ts) is a single `!==`, not a
// constant-time compare. The secret is a fixed random string with no
// per-request variation to leak, and every call here crosses a network whose
// jitter dwarfs a string comparison — but if this ever guards something
// derived per-user, revisit that. Shared by `record` AND `backfill`: the
// backfill path is not a weaker cousin with its own copy of this check, it is
// the exact same gate.
function requireSnapshotSecret(provided: string) {
  const configured = process.env.STATUS_SNAPSHOT_SECRET ?? "";
  if (configured.length === 0) {
    // Closed by default: unset means no writer exists, not that any writer is
    // allowed. The bars simply stay NO DATA until it is set.
    throw new ConvexError({ code: "not_configured" as const });
  }
  if (!secretMatches(provided, configured)) {
    throw new ConvexError({ code: "not_authorized" as const });
  }
}

/** The `SnapshotStore` both `record` and `backfill` run `recordSample`
 *  against — one implementation over `ctx.db`, so the accumulation and
 *  `deriveState` logic in `status.logic.ts` is the only place either mutation
 *  can diverge from the other, and it can't: they call the same function. */
function snapshotStore(ctx: MutationCtx): SnapshotStore<Id<"statusSnapshots">> {
  return {
    find: async (d, serviceId) => {
      const doc = await ctx.db
        .query("statusSnapshots")
        .withIndex("by_day_service", (q) =>
          q.eq("day", d).eq("serviceId", serviceId),
        )
        .unique();
      return doc === null
        ? null
        : {
            id: doc._id,
            state: doc.state,
            detail: doc.detail,
            sampleCount: doc.sampleCount,
            degradedCount: doc.degradedCount,
            downCount: doc.downCount,
            backfilled: doc.backfilled,
          };
    },
    insert: async (row) => {
      await ctx.db.insert("statusSnapshots", row);
    },
    patch: async (id, fields) => {
      await ctx.db.patch(id, fields);
    },
  };
}

/**
 * Add one measurement of one service to today's row. One row — one bar — per
 * (day, serviceId) no matter how often the poller runs, so a 10-minute
 * schedule cannot produce 144 bars for one day. What each call DOES change is
 * the evidence: the day's counters grow, and its state is re-derived from
 * them, so a single down sample keeps the day down for the rest of the day.
 *
 * There is deliberately no way to record "nothing was measured". A check that
 * could not determine its state simply does not call this — absence is the
 * recording, and a day nobody sampled has no row at all.
 */
export const record = mutation({
  args: {
    secret: v.string(),
    serviceId: v.string(),
    state: snapshotState,
    detail: v.optional(v.string()),
  },
  returns: v.object({
    day: v.string(),
    result: v.union(v.literal("inserted"), v.literal("updated")),
  }),
  handler: async (ctx, args) => {
    requireSnapshotSecret(args.secret);

    const now = Date.now();
    const day = utcDay(now);

    const result = await recordSample(snapshotStore(ctx), {
      day,
      serviceId: args.serviceId,
      state: args.state,
      detail: args.detail,
      recordedAt: now,
      // `record` never backfills — see `status.backfill` for the only path
      // that can.
      backfilled: false,
    });

    return { day, result };
  },
});

/**
 * Write ONE measurement into a SPECIFIC past day, rather than today's — the
 * one gap `record` cannot close, because `record`'s whole safety property is
 * that the day comes from the server clock and no caller can override it. An
 * incident noticed late (or, as here, reconstructed after the fact from
 * npm's registry timestamps and this repo's git history) would otherwise
 * never be entered, and the days it happened on would read NO DATA forever.
 *
 * A SEPARATE mutation, not `record` with an optional `day` argument, on
 * purpose: `record`'s day-derivation guarantee is the exact property that
 * makes it safe to expose the poller's shared secret to a plain HTTP GET
 * route (`app/api/status-snapshot/route.ts`) — "a leaked secret still cannot
 * rewrite the past" is a sentence about `record` specifically, stated at the
 * top of this file, and it stays true only because `record` has no `day`
 * parameter to leak alongside the secret. Adding one, even guarded, means
 * every future reader of `record` has to re-verify the guard instead of
 * trusting the shape of the function. Two mutations with two names also means
 * `npx convex logs` / the dashboard's function list shows exactly which
 * writer produced a row, which a single overloaded `record` would blur.
 *
 * Same secret as `record` (`requireSnapshotSecret`) — this is not a weaker
 * door into the same room. Three more guards specific to writing history:
 *   - `day` must be a real, strictly-formatted `YYYY-MM-DD` calendar date
 *     (`isValidCalendarDay`) — not merely regex-shaped.
 *   - `day` must not be in the future (`isDayInBackfillWindow`).
 *   - `day` must be within `BACKFILL_WINDOW_DAYS` (30) of today
 *     (`isDayInBackfillWindow`) — a narrow trailing window, not "any day
 *     ever", so a leaked secret's blast radius on history is bounded.
 *
 * Routes through the exact same `recordSample`/`deriveState` accumulation
 * `record` uses (`snapshotStore` above is shared, not duplicated), and always
 * writes `backfilled: true` on the sample — never `state` directly — so a
 * backfilled day is derived from its evidence exactly like a live one.
 *
 * Distinguishable TWICE over, neither one skippable by the caller: the sticky
 * `backfilled` flag on the row (see convex/schema.ts), which makes it
 * readable as entered-after-the-fact in both the data and (via
 * `HistoryEntry.backfilled` → `Bar.backfilled`) the /status UI's tooltip and
 * accessible name; and `backfillDetail`, applied here to whatever `detail`
 * the caller sent — never left for the caller to remember — which appends
 * "(entered after the fact; not measured live)" while leaving the actual
 * measurement text (the same `driftOf` wording a live sample would carry)
 * untouched and still matching how the same drift reads on a live row.
 */
export const backfill = mutation({
  args: {
    secret: v.string(),
    day: v.string(),
    serviceId: v.string(),
    state: snapshotState,
    detail: v.optional(v.string()),
  },
  returns: v.object({
    day: v.string(),
    result: v.union(v.literal("inserted"), v.literal("updated")),
  }),
  handler: async (ctx, args) => {
    requireSnapshotSecret(args.secret);

    if (!isValidCalendarDay(args.day)) {
      throw new ConvexError({ code: "invalid_day" as const });
    }
    if (!isDayInBackfillWindow(args.day, Date.now(), BACKFILL_WINDOW_DAYS)) {
      throw new ConvexError({ code: "day_outside_backfill_window" as const });
    }

    const result = await recordSample(snapshotStore(ctx), {
      day: args.day,
      serviceId: args.serviceId,
      state: args.state,
      // The marker lives here, applied to whatever the caller sent, never
      // trusted FROM the caller — see `backfillDetail`'s doc comment.
      detail: backfillDetail(args.detail),
      recordedAt: Date.now(),
      backfilled: true,
    });

    return { day: args.day, result };
  },
});
