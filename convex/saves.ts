// §6.3: every exported query/mutation here is a public, internet-facing
// endpoint with no row-security backstop — `NEXT_PUBLIC_CONVEX_URL` is in
// the client bundle. Every export below derives identity from
// `getAuthUserId(ctx)` and returns null / throws for an unauthenticated
// caller; none accepts a caller-supplied `userId` (that would be an IDOR by
// construction). A15 calls each of these directly, unauthenticated.
//
// `saves` deliberately has no visibility field (schema.ts, §3, §8.1) — a
// save is never individually publishable, so nothing here needs to filter
// on one.
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
// Same source `app/page.tsx:26` reads to filter FEATURED against what
// actually exists in the registry — not a second slug list. A7: saving a
// slug absent here must fail without writing a doc.
import registry from "../registry.json";

const registrySlugs = new Set(
  (registry as { items: { name: string }[] }).items.map((i) => i.name),
);

// A13: at most 30 `saves.add`/`saves.remove` calls per user per rolling 10s
// window; the 31st+ in that window is rejected. Durable in `saveRateLimits`
// (schema.ts) rather than an in-memory counter in the route handler — see
// that table's comment for why an in-memory `Map` is wrong on serverless.
//
// The thrown `ConvexError`'s `data.code` is what `app/api/saves/route.ts`
// reads to answer 429 rather than a generic 500, so a rate-limited caller is
// told "try again shortly", not "your save failed".
const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_MAX = 30;

// Runs inside the same mutation as the write it guards (called from
// `add`/`remove` below, never on its own) so the read-check-increment is
// part of one serializable Convex transaction with the write that follows
// it — two concurrent requests from the same user cannot both pass the
// check, the way they could if this lived in the Next.js route handler
// ahead of a separate `runMutation` call.
async function checkAndRecordSaveRateLimit(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  const now = Date.now();
  const existing = await ctx.db
    .query("saveRateLimits")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  const current =
    existing !== null && now - existing.windowStart < RATE_LIMIT_WINDOW_MS
      ? existing
      : null;
  // Stale window: delete rather than reuse, same as `otpRequestLimits` in
  // auth.ts — there is never a moment where an expired row both exists and
  // reads as "current".
  if (existing !== null && current === null) {
    await ctx.db.delete(existing._id);
  }

  if (current !== null && current.count >= RATE_LIMIT_MAX) {
    throw new ConvexError({ code: "rate_limited" as const });
  }

  if (current === null) {
    await ctx.db.insert("saveRateLimits", { userId, windowStart: now, count: 1 });
  } else {
    await ctx.db.patch(current._id, { count: current.count + 1 });
  }
}

export const list = query({
  args: {},
  returns: v.union(v.array(v.string()), v.null()),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const docs = await ctx.db
      .query("saves")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return docs.map((d) => d.slug);
  },
});

export const add = mutation({
  args: { slug: v.string() },
  returns: v.null(),
  handler: async (ctx, { slug }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    // Defense in depth: `app/api/saves/route.ts` already rejects an unknown
    // slug with 400 before ever calling this mutation (A7). Re-checked here
    // too, because this mutation is independently callable by anyone who
    // knows the deployment URL (§6.3) — a direct caller bypassing the route
    // handler must not be able to write an unresolvable slug either.
    if (!registrySlugs.has(slug)) throw new Error("Unknown slug");

    // Rate limit before touching `saves` — a limited caller writes nothing,
    // on this call or the one that pushed them over the cap.
    await checkAndRecordSaveRateLimit(ctx, userId);

    const existing = await ctx.db
      .query("saves")
      .withIndex("by_user_slug", (q) =>
        q.eq("userId", userId).eq("slug", slug),
      )
      .unique();
    if (existing !== null) return null; // already saved — idempotent, no dupe row
    await ctx.db.insert("saves", { userId, slug, createdAt: Date.now() });
    return null;
  },
});

export const remove = mutation({
  args: { slug: v.string() },
  returns: v.null(),
  handler: async (ctx, { slug }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    await checkAndRecordSaveRateLimit(ctx, userId);

    const existing = await ctx.db
      .query("saves")
      .withIndex("by_user_slug", (q) =>
        q.eq("userId", userId).eq("slug", slug),
      )
      .unique();
    if (existing !== null) await ctx.db.delete(existing._id);
    return null;
  },
});
