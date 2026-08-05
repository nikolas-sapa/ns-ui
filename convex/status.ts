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
// The caller never supplies the day. `day` is derived from the server clock
// here, so a leaked secret still cannot rewrite the past — only today.
import { ConvexError, v } from "convex/values";
import { type Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import {
  SNAPSHOT_WINDOW_DAYS,
  recordSample,
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
    }));
  },
});

// A single `!==`, not a constant-time compare. The secret is a fixed random
// string with no per-request variation to leak, and every call here crosses a
// network whose jitter dwarfs a string comparison — but if this ever guards
// something derived per-user, revisit that.
function requireSnapshotSecret(provided: string) {
  const configured = process.env.STATUS_SNAPSHOT_SECRET ?? "";
  if (configured.length === 0) {
    // Closed by default: unset means no writer exists, not that any writer is
    // allowed. The bars simply stay NO DATA until it is set.
    throw new ConvexError({ code: "not_configured" as const });
  }
  if (provided !== configured) {
    throw new ConvexError({ code: "not_authorized" as const });
  }
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

    const store: SnapshotStore<Id<"statusSnapshots">> = {
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
            };
      },
      insert: async (row) => {
        await ctx.db.insert("statusSnapshots", row);
      },
      patch: async (id, fields) => {
        await ctx.db.patch(id, fields);
      },
    };

    const result = await recordSample(store, {
      day,
      serviceId: args.serviceId,
      state: args.state,
      detail: args.detail,
      recordedAt: now,
    });

    return { day, result };
  },
});
