// §6.3: every exported query/mutation here is a public, internet-facing
// endpoint with no row-security backstop — `NEXT_PUBLIC_CONVEX_URL` is in
// the client bundle. Identity always comes from `getAuthUserId(ctx)`, never
// a caller-supplied `userId`.
//
// This table is metadata-only (schema.ts's comment on `submissions`): slug,
// collection, status and the resulting PR URL, nothing else. The actual
// `component.tsx`/`demo.tsx`/`meta.json` payload a contributor submits is
// never passed to this file and never reaches Convex at all — it goes
// straight from `app/api/submit/route.ts` to the GitHub API, matching D1
// ("0 import/eval/new Function/dangerouslySetInnerHTML/dynamic import()
// deriving from submitted content") by construction: there is no code path
// here that could import it, because it was never given the code.
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// D4: at most 1 submission per user per rolling 10-minute window. Durable in
// `submissionRateLimits` (schema.ts) rather than an in-memory counter in the
// route handler, for the same reason `checkAndRecordSaveRateLimit` in
// convex/saves.ts gives: a per-serverless-instance `Map` turns a per-user
// cap into a per-instance one and a cold start resets the window for free.
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 1;

async function checkAndRecordSubmissionRateLimit(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  const now = Date.now();
  const existing = await ctx.db
    .query("submissionRateLimits")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  const current =
    existing !== null && now - existing.windowStart < RATE_LIMIT_WINDOW_MS
      ? existing
      : null;
  if (existing !== null && current === null) {
    await ctx.db.delete(existing._id);
  }

  if (current !== null && current.count >= RATE_LIMIT_MAX) {
    throw new ConvexError({ code: "rate_limited" as const });
  }

  if (current === null) {
    await ctx.db.insert("submissionRateLimits", { userId, windowStart: now, count: 1 });
  } else {
    await ctx.db.patch(current._id, { count: current.count + 1 });
  }
}

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Finding #5 (LOW): `complete`'s `result.prUrl` was `v.string()` with no
// shape check — the row's owner (re-derived below, never a caller-supplied
// id) could write an arbitrary string, including a `javascript:` URI.
// Nothing reads `prUrl` back today (there is no "your submissions" view
// yet), so this was inert, not exploitable, but it becomes live the moment
// one exists. `app/api/submit/route.ts` only ever passes GitHub's own
// `html_url` from a successful `POST .../pulls` response
// (`lib/github-submit.ts`'s `openPullRequest`), which always has this
// shape — so this rejects nothing a legitimate caller would ever send.
const PR_URL_PATTERN = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+$/;

/** Opens the audit-trail row and reserves the rate-limit slot, BEFORE the
 *  route handler makes any GitHub API call — a caller who is rate-limited
 *  or who fails validation writes nothing and reaches GitHub never. Re-runs
 *  the slug/collection shape check independently of `app/api/submit/route.ts`
 *  (§6.3: this mutation is itself a public endpoint, callable directly by
 *  anyone who knows the deployment URL, and must not trust that its only
 *  caller is our own validated route). */
export const create = mutation({
  args: {
    slug: v.string(),
    collection: v.union(v.literal("core"), v.literal("loud")),
  },
  returns: v.object({ id: v.id("submissions") }),
  handler: async (ctx, { slug, collection }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError({ code: "not_authenticated" as const });
    }
    if (!SLUG_PATTERN.test(slug) || slug.length < 2 || slug.length > 60) {
      throw new ConvexError({ code: "invalid_slug" as const });
    }

    await checkAndRecordSubmissionRateLimit(ctx, userId);

    const id = await ctx.db.insert("submissions", {
      userId,
      slug,
      collection,
      status: "pending",
      prUrl: null,
      createdAt: Date.now(),
    });
    return { id };
  },
});

/** Called once the route handler knows whether the GitHub call chain
 *  succeeded. The caller must own the row — re-checked here rather than
 *  trusted from the route, same reason as `create` above. */
export const complete = mutation({
  args: {
    id: v.id("submissions"),
    result: v.union(
      v.object({ status: v.literal("opened"), prUrl: v.string() }),
      v.object({ status: v.literal("failed") }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, { id, result }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError({ code: "not_authenticated" as const });
    }
    const doc = await ctx.db.get(id);
    if (doc === null || doc.userId !== userId) {
      throw new ConvexError({ code: "not_found" as const });
    }
    if (result.status === "opened") {
      if (!PR_URL_PATTERN.test(result.prUrl)) {
        throw new ConvexError({ code: "invalid_pr_url" as const });
      }
      await ctx.db.patch(id, { status: "opened", prUrl: result.prUrl });
    } else {
      await ctx.db.patch(id, { status: "failed" });
    }
    return null;
  },
});
