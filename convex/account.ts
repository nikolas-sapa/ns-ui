// `deleteAccount` — the one export in this file, and the only place account
// deletion happens. §6.7: "Convex has no cascade, so this is code, not a
// constraint." §6.3's rule applies here as much as anywhere: identity comes
// from `getAuthUserId(ctx)`, and there is no caller-supplied id — a caller
// can only ever delete their own account.
//
// Ten tables reachable by `userId` (§6.7, corrected 2026-08-02 — the section
// originally listed nine of these plus `authVerifiers`, and predated
// `saveRateLimits`; see the comment on `saveRateLimits` in schema.ts), plus
// `authVerifiers`, which is NOT one of the ten and is scoped by the caller's
// own session ids instead — see the comment on that block below for why.
//
//   users, authAccounts, authSessions, authRefreshTokens,
//   authVerificationCodes, profiles, saves, collections,
//   collectionItems (via owning collections), saveRateLimits
//   — plus authVerifiers, scoped by session, not userId
//
// `otpRequestLimits` stays OUT of this list on purpose (schema.ts's own
// comment on that table) — it is keyed on an unrecoverable HMAC of an
// address that may never have had an account, so there is nothing here to
// cascade it from.
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const deleteAccount = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    // --- auth* tables ---------------------------------------------------
    // Collect session ids BEFORE deleting anything: `authRefreshTokens` and
    // `authVerifiers` are both reached by session id, so a session deleted
    // first is a session id lost before its dependents are found.
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
    const sessionIds = new Set(sessions.map((s) => s._id));

    // `authVerifiers` (PKCE verifiers), via the `by_sessionId` index added in
    // `schema.ts` (that file's comment on the override has the full
    // reasoning and the verification performed before this was written this
    // way). Originally a full `.collect()` of the whole table plus an in-JS
    // membership check, because the library's own schema only indexes this
    // table on `signature`. That was replaced: `authVerifiers` gains a row
    // on every OAuth redirect and only loses one on a *successful* callback
    // (verified against installed source — see `schema.ts`), so the table
    // grows without bound from abandoned sign-ins specifically, and a
    // `.collect()` here would eventually hit Convex's per-mutation
    // scanned-document ceiling — meaning this account's OWN deletion could
    // fail because of OTHER users' abandoned sign-in attempts. One indexed
    // lookup per session (below) scans only this account's own rows,
    // regardless of how large the table gets.
    //
    // KNOWN GAP, flagged rather than hidden, and RULED on by team-lead
    // (2026-08-02): a verifier with `sessionId === undefined` (abandoned
    // mid-OAuth-flow, no session ever created) is not attributable to any
    // user by any field this table has — it is deleted by neither this
    // mutation nor any other, for this user or anyone else's. It was never
    // reachable from a userId in the first place, so it is out of scope for
    // this mutation by construction, not a missed row. §6.7 and A9
    // (docs/community-spec.md) were corrected to match: A9 now checks
    // `authVerifiers` by the deleted account's former session ids, not by
    // `userId`, and documents why the sessionless case can't be enumerated
    // that way by any implementation.
    //
    // Checked against installed source, not assumed: nothing in
    // `@convex-dev/auth` 0.0.94 ever sweeps a sessionless `authVerifiers`
    // row either. The only deletion of a verifier anywhere in the library is
    // `dist/server/implementation/mutations/userOAuth.js:28`, on a
    // *successful* OAuth callback matching that verifier's signature — an
    // abandoned redirect never reaches that line, the schema has no expiry
    // field, and there's no cron. So an abandoned OAuth attempt leaves a
    // permanent row. It holds no personal data (a random signature and,
    // usually, nothing else) — a slow storage-count leak, not a privacy one.
    //
    // DECIDED, not left open (team-lead, 2026-08-02, superseding an earlier
    // approval of a cron): no sweeper. A cron was briefly built and then
    // deliberately removed once the `by_sessionId` index above shipped — the
    // index severed the one property that made the leak dangerous rather
    // than merely untidy: an unbounded table sitting inside a single-
    // transaction scan in THIS deletion path. With the index in place,
    // `deleteAccount` cannot hit Convex's scan ceiling regardless of table
    // size, so what remains is storage growth alone — rows of two optional
    // fields, no personal data, on the order of 100 bytes each. Reaching a
    // scale where that matters against the 0.5 GB free-tier storage line
    // (§7.4) would take on the order of a million abandoned sign-ins, which
    // is not worth a scheduled job, new machinery, and a recurring failure
    // surface to pre-empt today. If that number ever gets interesting, it
    // will be visible in storage metrics for other reasons by then.
    for (const sessionId of sessionIds) {
      const verifiers = await ctx.db
        .query("authVerifiers")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
        .collect();
      for (const verifier of verifiers) {
        await ctx.db.delete(verifier._id);
      }
    }

    for (const session of sessions) {
      const refreshTokens = await ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
        .collect();
      for (const token of refreshTokens) {
        await ctx.db.delete(token._id);
      }
      await ctx.db.delete(session._id);
    }

    // `userIdAndProvider` is a compound index; querying it with only the
    // leading field bound (`userId`) is a valid prefix match — it returns
    // every account for this user regardless of provider, not just one.
    const accounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
      .collect();
    for (const account of accounts) {
      const codes = await ctx.db
        .query("authVerificationCodes")
        .withIndex("accountId", (q) => q.eq("accountId", account._id))
        .collect();
      for (const code of codes) {
        await ctx.db.delete(code._id);
      }
      await ctx.db.delete(account._id);
    }

    // --- app tables -------------------------------------------------------
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (profile !== null) await ctx.db.delete(profile._id);

    const saves = await ctx.db
      .query("saves")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const save of saves) {
      await ctx.db.delete(save._id);
    }

    const collections = await ctx.db
      .query("collections")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const collection of collections) {
      const items = await ctx.db
        .query("collectionItems")
        .withIndex("by_collection", (q) => q.eq("collectionId", collection._id))
        .collect();
      for (const item of items) {
        await ctx.db.delete(item._id);
      }
      await ctx.db.delete(collection._id);
    }

    const rateLimit = await ctx.db
      .query("saveRateLimits")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (rateLimit !== null) await ctx.db.delete(rateLimit._id);

    // `users` last — every other table above is reached via `userId`, so
    // deleting the `users` doc first would not break anything here (Convex
    // has no FK enforcement to trip), but deleting it last keeps the order
    // "leaves before root" for anyone reading this later.
    await ctx.db.delete(userId);

    return null;
  },
});
