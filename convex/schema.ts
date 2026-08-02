import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables, // users, authAccounts, authSessions, authRefreshTokens,
  // authVerificationCodes, authVerifiers, authRateLimits

  // `authVerifiers` OVERRIDDEN below, right after the spread — same exact
  // field definitions as `authTables.authVerifiers`
  // (`@convex-dev/auth/dist/server/implementation/types.js:110-113`:
  // `sessionId: v.optional(v.id("authSessions")), signature:
  // v.optional(v.string())`, one index on `signature`), plus a second index
  // on `sessionId`. Reasoning lives on `convex/account.ts`'s `deleteAccount`
  // — short version: `authVerifiers` gains a row on every OAuth redirect
  // (`mutations/verifier.js`) and only loses one on a *successful* callback
  // (`mutations/userOAuth.js:28`), so an abandoned sign-in leaks a row
  // forever (no expiry field, no cron in the library). Before this override,
  // `deleteAccount` could only find a user's own verifiers with a full
  // `.collect()` of the whole table, which has Convex's ~32k-scanned-
  // document ceiling — meaning the table's own unbounded growth would
  // eventually break account deletion for everyone, worst first for anyone
  // trying to exercise a deletion right. This index makes that scan
  // unnecessary.
  //
  // VERIFIED SAFE, not assumed: the library touches `authVerifiers` in
  // exactly two places — `verifier.js`'s bare `ctx.db.insert(...)` (field
  // shape only, no index involved) and `userOAuth.js:20-22`'s
  // `.withIndex("signature", ...)` lookup. Both are grepped as the only
  // hits for `"authVerifiers"` across `dist/server/oauth/*.js` and
  // `dist/server/implementation/mutations/*.js`. Adding a second index
  // alongside an unchanged `signature` index is additive; it does not touch
  // the fields the library writes/reads or the one index name it already
  // uses. Confirmed empirically too, not just by reading: exercised the
  // library's own real mutations directly against precise-mosquito-491 with
  // this override deployed — `auth:store` type `"verifier"` (insert),
  // `"verifierSignature"` (patch), then `"userOAuth"` (the signature-indexed
  // lookup + delete, plus a real `users`/`authAccounts` upsert) — all
  // succeeded and produced a genuine signed-in-shaped account. See task
  // report for the exact commands.
  //
  // Indexing an optional field: Convex allows it. A document with
  // `sessionId` absent/undefined simply never matches `q.eq("sessionId",
  // <a real id>)` on this index.
  //
  // WHAT WAS OBSERVED vs WHAT WAS INFERRED (team-lead asked this recorded
  // explicitly, 2026-08-02, rather than left implicit): the EMPTY-match case
  // was directly observed — querying `by_sessionId` for a `sessionId` with
  // no matching row returned `[]`, and a real `deleteAccount` run against a
  // genuinely-created account (via the `auth:store` flow above) correctly
  // found and removed that account's own session-linked rows via this
  // index (zero, in that instance, matching the fact that it had none — see
  // task report). The POSITIVE-match case — a query for a `sessionId` that
  // DOES have a linked verifier, returning exactly that row — was NOT
  // independently observed: creating a session-linked verifier via CLI
  // `--identity` and via an authenticated `ConvexHttpClient` both hit
  // tooling limitations unrelated to this index (documented in the task
  // report) rather than succeeding or failing on the index itself. This is
  // inferred from Convex's documented, standard index-query semantics
  // (an index lookup returns exactly the matching row when `sessionId` was
  // written and matches), not from an observed positive match on this
  // specific index. If `by_sessionId` ever appears to miss a row that
  // should be there, re-derive this from scratch rather than trusting this
  // note — it was never the thing actually watched succeed.
  authVerifiers: defineTable({
    sessionId: v.optional(v.id("authSessions")),
    signature: v.optional(v.string()),
  })
    .index("signature", ["signature"])
    .index("by_sessionId", ["sessionId"]),

  profiles: defineTable({
    userId: v.id("users"),
    handle: v.string(), // stored lowercased
    displayName: v.union(v.string(), v.null()), // ≤ 50 code points, plain text
    bio: v.union(v.string(), v.null()), // ≤ 280 code points, rendered as plain text
    url: v.union(v.string(), v.null()), // http/https only, ≤ 200 chars, validated on write
    tags: v.array(v.string()), // ≤ 3, each a CATEGORIES id (§8.2). [] by default
    isPublic: v.boolean(), // FALSE on insert. §8.1 — gates /u/<handle>
    handleChangedAt: v.union(v.number(), v.null()), // one free change, then it is a support request
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_handle", ["handle"]),

  // Deliberately has NO visibility field. A save is never individually publishable — §8.1.
  saves: defineTable({
    userId: v.id("users"),
    slug: v.string(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_slug", ["userId", "slug"]),

  // isPublic is the ONLY publish switch in the schema, and it is false on insert.
  collections: defineTable({
    userId: v.id("users"),
    name: v.string(),
    isPublic: v.boolean(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  collectionItems: defineTable({
    collectionId: v.id("collections"),
    slug: v.string(),
    position: v.number(),
  }).index("by_collection", ["collectionId"]),

  // NOT in community-spec.md §3. Added because §7.4's premise — that
  // `authRateLimits` already covers rate limiting — only holds for the
  // library's own failed-sign-in-attempt throttle (verified against
  // node_modules/@convex-dev/auth/dist/server/implementation/rateLimit.js:
  // it's keyed by `identifier` and only ever decremented by
  // `recordFailedSignIn`, called from the code-guessing step). It does not
  // throttle the OTP *send* step, which is what A5's "max 5 requests per
  // address per hour" governs. Same gap documented in
  // reserved-app/convex/passwordResetRateLimit.ts for the analogous
  // password-reset-request case; this table is that pattern reused, with one
  // change: `emailHash` (a salted HMAC-SHA256, see `hmacHex` in auth.ts) in
  // place of a plaintext email column, so this table never stores the email
  // address of anyone who merely requested a code — including someone who
  // never completes sign-up and therefore has no account anywhere else.
  // Retention: at most one row per address, deleted (not just overwritten)
  // the instant its 1-hour window is stale — see the comment on
  // `checkAndRecordOtpRequest` in auth.ts. Written and read only by that one
  // internalMutation — never exported, so it is not part of the A15
  // unauthenticated-surface audit. Deliberately OUTSIDE the ten-table A9
  // deleteAccount cascade (§6.7): there is no account to cascade from — a
  // row here can outlive or predate any `users` doc — and its own inline
  // pruning is what keeps it from being orphan data instead.
  //
  // Add a new table keyed on userId? That one *does* belong in the
  // deleteAccount cascade and in A9's enumeration — this one doesn't.
  otpRequestLimits: defineTable({
    emailHash: v.string(), // salted HMAC-SHA256 of the trimmed, lowercased email — never plaintext
    windowStart: v.number(),
    count: v.number(),
  })
    .index("by_emailHash", ["emailHash"])
    .index("by_window", ["windowStart"]),

  // A13's durable rate limit for `saves.add`/`saves.remove` — an in-memory
  // per-instance counter in the route handler was rejected: on Vercel this
  // route runs as multiple serverless instances, so a per-process `Map`
  // turns a 30-per-10s cap into 30-per-instance, and a cold start resets the
  // window for free. Modeled on `otpRequestLimits` above, but the opposite
  // of it on the one property that matters: this table IS keyed on
  // `userId`, not a hash of something pre-account, so it belongs in the
  // ten-table A9 `deleteAccount` cascade and enumeration — add it there
  // when that mutation is built (Phase A step 10, not this step).
  // Check-and-increment happens inside the same mutation as the write it
  // guards (`saves.add`/`saves.remove` in convex/saves.ts), so Convex's
  // serializable-mutation guarantee makes the read-check-increment-write
  // atomic and closes the race a route-handler-side check would reopen.
  saveRateLimits: defineTable({
    userId: v.id("users"),
    windowStart: v.number(),
    count: v.number(),
  }).index("by_userId", ["userId"]),
});
