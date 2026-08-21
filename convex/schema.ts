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

  // Phase C (docs/community-spec.md §2/§4 group D). Metadata-only audit trail
  // for the PR-opening submission portal (`/submit`) — the ACTUAL component
  // code is never written here. It goes browser -> `/api/submit` -> the
  // GitHub API directly (fork/branch/commit/PR) and is never imported, built,
  // rendered or persisted on this origin (D1, non-goal #1). This table exists
  // only so D4's "max 1 submission per user per 10 minutes" is durable and
  // race-free (mirrors `saveRateLimits`'s reasoning exactly: an in-memory
  // counter in the route handler is wrong on serverless) and so there is an
  // audit trail of who opened what PR, for abuse review.
  //
  // No version field (docs/decisions/2026-08-03-component-versioning.md) —
  // a contributor bumps nothing; the registry's version is `CHANGELOG.md`
  // alone. `prUrl` is null until the GitHub call chain finishes; a failed
  // attempt is recorded as `status: "failed"` rather than deleted, so a
  // retry pattern (or abuse pattern) is visible to whoever reviews this
  // table, matching how `testimonials` keeps rejected rows rather than
  // deleting them — EXCEPT via `deleteAccount` (convex/account.ts), which
  // deletes a caller's own rows here regardless of status, `"failed"`
  // included. That's a deliberate exception to this table's own retention
  // preference, not a contradiction of it: see the comment on
  // `deleteAccount`'s header for why the deletion right wins.
  //
  // Now IN the `deleteAccount` cascade (added for security-review finding
  // #6 — this table and `submissionRateLimits` below were both missing from
  // it since Phase C shipped), indexed on `userId` here for exactly that.
  submissions: defineTable({
    userId: v.id("users"),
    slug: v.string(),
    collection: v.union(v.literal("core"), v.literal("loud")),
    status: v.union(
      v.literal("pending"),
      v.literal("opened"),
      v.literal("failed"),
    ),
    prUrl: v.union(v.string(), v.null()),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_slug", ["slug"]),

  // D4's durable rate limit, same shape and same reasoning as
  // `saveRateLimits` above: check-and-increment happens inside the same
  // mutation as the write it guards (`submissions.create` in
  // convex/submissions.ts), so Convex's serializable-mutation guarantee
  // makes the read-check-increment-write atomic. Now IN the `deleteAccount`
  // cascade (security-review finding #6) alongside `submissions` above —
  // §6.7 and A9 in docs/community-spec.md still describe the ten-table
  // shape from before Phase C added these two and haven't been updated to
  // match (flagged in the task report, not silently rewritten here).
  submissionRateLimits: defineTable({
    userId: v.id("users"),
    windowStart: v.number(),
    count: v.number(),
  }).index("by_userId", ["userId"]),

  // The only time-series store in this repo, and the reason
  // lib/status-checks.ts's `uptime-history` row could ever stop saying "no
  // time-series store exists in this repo". One row per (UTC day, service),
  // accumulated from every `/api/status-snapshot` run through
  // `convex/status.ts`, read by /status to draw a 90-day daily-bar strip.
  // The route is polled by a GitHub Actions schedule (every 10 minutes,
  // subject to GitHub's own delays under load) with the once-a-day Vercel
  // cron kept as a fallback, so a day's row is many samples, not one ping.
  //
  // ABSENCE IS THE POINT. A day with no row for a service means nothing was
  // measured that day — the cron had not been created yet, it did not run, or
  // the check could not determine a state — and it must render as NO DATA,
  // never as a healthy bar. Nothing backfills or seeds this table; the
  // earliest honest bar is the day the first snapshot was written. `day` is
  // computed from the server clock inside the mutation and is never accepted
  // from the caller, so no caller can write a row into the past.
  //
  // `state` carries `"degraded"` because the check layer already expresses it
  // (`serviceChecks` marks `published-cli` and `published-mcp` degraded on
  // version drift), and the snapshot writer (app/api/status-snapshot/route.ts)
  // measures it the same way: by comparing the published version and
  // component count against the build-time facts in
  // `lib/status.generated.json`, reached the same way `app/status/page.tsx`
  // reaches them — a static import baked in at build time, not a runtime
  // filesystem read a cron lacks. `"down"` is
  // only ever written for `live-origin`, and only when the origin itself
  // answered with a 5xx; every other failure mode is recorded as absence,
  // because a fetch that throws cannot tell an outage from this machine's
  // network. Same reasoning as `RuntimeReads.convexReachable` being typed
  // `true | null` rather than `boolean`.
  //
  // Retention: unbounded by design for now — 4 services x 365 days is ~1.5k
  // rows a year, and the read is index-bounded to 90 days regardless, so
  // growth does not slow it down. Pruning is a later decision, not a silent
  // one: deleting old rows destroys history that cannot be re-measured.
  //
  // OUTSIDE the `deleteAccount` cascade (convex/account.ts), deliberately and
  // permanently: there is no `userId` here and no personal data of any kind —
  // these are service-level measurements about this deployment, like
  // `otpRequestLimits`, not rows belonging to an account. Adding a table keyed
  // on `userId`? That one belongs in the cascade; this one does not.
  //
  // One index, serving both access patterns: `[day, serviceId]` answers the
  // 90-day read for ALL services as a single range scan
  // (`q.gte("day", cutoff)`) and the per-service upsert as a point lookup
  // (`q.eq("day", d).eq("serviceId", s)`). A `[serviceId, day]` index would
  // have forced one query per service for the read.
  // The counters below are what makes a bar an aggregate of the day rather
  // than whatever the last writer thought. `state` is DERIVED from them
  // (convex/status.logic.ts `deriveState`): down if `downCount > 0`, ok only
  // if every sample was ok, degraded in between. They are OPTIONAL only
  // because rows written before continuous polling existed do not carry them;
  // such a row is read as the one sample it always was (`countsOf`), never as
  // zero samples. Zero samples is not a value this table stores — it is the
  // absence of a row, and it must stay that way.
  statusSnapshots: defineTable({
    day: v.string(), // UTC calendar day, YYYY-MM-DD
    serviceId: v.string(), // a StatusCheck id from lib/status-checks.ts
    state: v.union(v.literal("ok"), v.literal("degraded"), v.literal("down")),
    detail: v.optional(v.string()), // what was actually measured, in words
    recordedAt: v.number(), // when the LATEST sample of this day landed
    sampleCount: v.optional(v.number()), // samples recorded this day
    degradedCount: v.optional(v.number()), // of those, how many were degraded
    downCount: v.optional(v.number()), // of those, how many were down
    // The state of the newest sample, not an aggregate: overwritten
    // unconditionally on every recordSample call (convex/status.logic.ts).
    // Lets a recovered day (worst state bad, last sample ok) render
    // differently from a day still bad as of its last sample — both would
    // otherwise share the same `state`. Optional because rows written before
    // this field existed carry none, which reads as ordering-unknown, never
    // as recovered.
    //
    // Deploy note: `record`'s ARGUMENTS did not change when this field was
    // added — lastState is derived inside recordSample, never caller-supplied.
    // So a Next-only deploy is NOT the hazard: it simply leaves the old
    // function bundle running against the old schema, which is self-consistent.
    // The real failure is a PARTIAL Convex push — new functions (which write
    // lastState unconditionally) against a schema that has not been told the
    // field exists, which Convex rejects on write. vercel.json pushes schema
    // and functions as one atomic step, so this repo has no path to that state;
    // do not introduce one with a manual `npx convex deploy`.
    lastState: v.optional(
      v.union(v.literal("ok"), v.literal("degraded"), v.literal("down")),
    ),
  }).index("by_day_service", ["day", "serviceId"]),

  // Durable rate limit for `testimonials.submit`, same shape and same
  // reasoning as `submissionRateLimits`/`saveRateLimits` above: an in-memory
  // per-instance counter is wrong on serverless, and check-and-increment
  // happens inside `submit` itself, so Convex's serializable-mutation
  // guarantee makes the read-check-increment-write atomic.
  //
  // Replaces an earlier scheme that counted `testimonials` rows with
  // `status === "pending"` in the last `SUBMISSION_WINDOW_MS` — that made
  // the cap status-dependent: the moment an owner rejected a submission
  // (`testimonials.reject`), the pending count dropped back to zero and the
  // same user could submit again immediately, so total submission volume
  // was bounded only by how fast the queue was reviewed, not by this window.
  // This table counts submissions, not rows in one status, so a reject no
  // longer resets it. `SUBMISSION_WINDOW_MS` (24h) and the one-per-window
  // cap are unchanged.
  //
  // Keyed on `userId`, so — same rule as `saveRateLimits`/
  // `submissionRateLimits` — belongs in the `deleteAccount` cascade
  // (convex/account.ts).
  testimonialRateLimits: defineTable({
    userId: v.id("users"),
    windowStart: v.number(),
    count: v.number(),
  }).index("by_userId", ["userId"]),

  testimonials: defineTable({
    userId: v.id("users"),
    name: v.string(),
    role: v.string(),
    company: v.string(),
    profileUrl: v.string(),
    photoUrl: v.optional(v.string()),
    quote: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
    ),
    spamScore: v.number(),
    spamFlags: v.array(v.string()),
    createdAt: v.number(),
    reviewedAt: v.union(v.number(), v.null()),
  })
    .index("by_status", ["status"])
    .index("by_userId", ["userId"]),
});
