import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables, // users, authAccounts, authSessions, authRefreshTokens,
  // authVerificationCodes, authVerifiers, authRateLimits

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
});
