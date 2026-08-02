// A thin, permanent counterpart to the library's `auth:signOut` action
// (`@convex-dev/auth/dist/server/implementation/mutations/signOut.js`).
// That action's failure mode is invisible by design: if the caller's token
// doesn't resolve to an identity — signature rejected by the deployment's
// current JWKS, among other causes — `signOutImpl` returns `null` and
// throws nothing, so `proxyAuthActionToConvex` never hits its `catch`. The
// proxy clears cookies and answers 200 regardless. Verified directly: a
// `POST /api/auth {action:"auth:signOut"}` with no cookie at all and the
// same POST with a well-formed but wrong-signature JWT produce
// byte-identical responses — 200, all cookies cleared, empty body, nothing
// in the Convex logs either way.
//
// This mutation does the same deletion `deleteSession` does
// (`dist/server/implementation/sessions.js`: delete the `authSessions` row,
// then every `authRefreshTokens` row for that session), but reports whether
// it actually found and deleted something, and logs loudly — greppable,
// distinguishable from a normal sign-out — when it didn't. The client calls
// this in addition to (not instead of) the library's own sign-out, so a
// caller whose token doesn't resolve still ends up signed out locally, but
// the discrepancy is no longer silent.
//
// Public and internet-facing like every other export in `convex/` (§6.3 —
// no row-security backstop, `NEXT_PUBLIC_CONVEX_URL` is in the client
// bundle) — safe against an unauthenticated caller because it only ever
// acts on the session its own caller's token resolves to; there is no
// caller-supplied session or user ID here to make this an IDOR.
import { getAuthSessionId, getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const confirmSignOut = mutation({
  args: {},
  returns: v.object({
    deleted: v.boolean(),
    reason: v.union(
      v.literal("ok"),
      v.literal("no_identity"),
      v.literal("session_missing"),
    ),
  }),
  handler: async (ctx) => {
    // Same pattern every other export here uses (saves.ts, users.ts):
    // `getAuthUserId(ctx)` is null exactly when the caller's token didn't
    // resolve to an identity — the case this mutation exists to catch.
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      console.error(
        "session:confirmSignOut — no identity resolved from caller's token; nothing to delete",
      );
      return { deleted: false, reason: "no_identity" as const };
    }

    // `getAuthSessionId` derives from the same identity, so it's normally
    // non-null here — but it comes from splitting the token's `sub` claim
    // on a divider (`sessions.js`) and returns `undefined`, not `null`,
    // if that ever doesn't contain one, so this checks for either rather
    // than assuming `signOutImpl`'s `!== null` shape is exhaustive.
    const sessionId = await getAuthSessionId(ctx);
    const session = sessionId != null ? await ctx.db.get(sessionId) : null;
    if (session === null) {
      console.error(
        `session:confirmSignOut — identity resolved but session ${sessionId} was already gone; nothing to delete`,
      );
      return { deleted: false, reason: "session_missing" as const };
    }

    await ctx.db.delete(session._id);
    const refreshTokens = await ctx.db
      .query("authRefreshTokens")
      .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
      .collect();
    for (const token of refreshTokens) {
      await ctx.db.delete(token._id);
    }

    return { deleted: true, reason: "ok" as const };
  },
});
