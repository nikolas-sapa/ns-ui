// The `viewer` query backs both `/api/me` (route.ts) and `/account`'s
// server-rendered signed-in state. §6.3: every exported query/mutation is a
// public, internet-facing endpoint with no row-security backstop, so this
// derives identity from `getAuthUserId(ctx)` and returns null for anyone
// unauthenticated rather than accepting a caller-supplied id (which A15
// exercises directly and unauthenticated).
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query } from "./_generated/server";

export const viewer = query({
  args: {},
  returns: v.union(
    v.object({
      displayName: v.union(v.string(), v.null()),
      email: v.union(v.string(), v.null()),
      image: v.union(v.string(), v.null()),
      // null until the `/welcome` handle claim (Phase A step 10, not this
      // step) writes a `profiles` row for this user — a valid, resumable
      // state per §8.3's abandonment rules, not an error.
      handle: v.union(v.string(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    if (user === null) return null;
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    return {
      displayName: user.name ?? null,
      email: user.email ?? null,
      image: user.image ?? null,
      handle: profile?.handle ?? null,
    };
  },
});
