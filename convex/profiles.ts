// §6.3: every exported query/mutation here is a public, internet-facing
// endpoint with no row-security backstop — `NEXT_PUBLIC_CONVEX_URL` is in
// the client bundle. Every export below derives identity from
// `getAuthUserId(ctx)` and returns null / throws for an unauthenticated
// caller; none accepts a caller-supplied `userId` (that would be an IDOR by
// construction). A15 calls each of these directly, unauthenticated.
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { CATEGORIES } from "../lib/search-categories";
import { validateProfileName } from "../lib/name-policy";

const CATEGORY_IDS = new Set(CATEGORIES.map((c) => c.id));

// §8.3's reserved list, verbatim — a route this site already owns or will
// own, so a handle equal to one of these would collide with it once
// `/u/<handle>` ships in Phase B. Checked lowercase-only, which is the only
// case that can ever reach here (see MUST_MATCH below).
const RESERVED_HANDLES = new Set([
  "account",
  "submit",
  "api",
  "u",
  "r",
  "preview",
  "writing",
  "guidelines",
  "contributors",
  "admin",
  "about",
  "new",
  "settings",
]);

// §8.3: "2-30 characters, `^[a-z0-9](-?[a-z0-9])*$`". This single character
// class is doing more work than it looks like — verified against A22's own
// fuzz list before writing this comment, not asserted from memory:
//   - uppercase is rejected (class is `a-z`, not `a-zA-Z`)
//   - a leading or trailing hyphen is rejected (the pattern requires the
//     string to both start AND end on `[a-z0-9]` — a hyphen can only ever
//     appear immediately before another alnum, never at either edge)
//   - a double hyphen is rejected (`-?[a-z0-9]` requires exactly one alnum
//     immediately after an optional single hyphen — a second consecutive
//     hyphen has no alnum to satisfy that group and the match fails)
//   - `.`, `_`, `/`, RTL override characters (U+202E etc.) and homoglyphs
//     (Cyrillic а vs Latin a, etc.) are all rejected as a side effect of the
//     class being ASCII `[a-z0-9-]` only — none of those characters are in
//     it, full stop.
// So the reserved-list check below is the only validation this file adds on
// top of the regex; everything else in A22's 40-input fuzz list is closed by
// this one pattern.
const HANDLE_PATTERN = /^[a-z0-9](-?[a-z0-9])*$/;
const HANDLE_MIN_LENGTH = 2;
const HANDLE_MAX_LENGTH = 30;

function configuredOwnerEmails(): Set<string> {
  return new Set(
    (process.env.OWNER_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLocaleLowerCase("en-US"))
      .filter(Boolean),
  );
}

async function callerMayClaimOwnerName(ctx: MutationCtx, userId: Id<"users">) {
  const configured = configuredOwnerEmails();
  if (configured.size === 0) return false;
  const user = await ctx.db.get(userId);
  return user !== null && typeof user.email === "string" && configured.has(user.email.toLocaleLowerCase("en-US"));
}

type HandleValidationError =
  | "invalid_type"
  | "invalid_length"
  | "invalid_format"
  | "reserved";

// Pure, no `ctx` — validates the string as submitted. Does NOT normalize
// (lowercase/strip/trim) on the way in: the client-side candidate generator
// (§8.3's normalize-for-prefill step) is a *separate* concern from what this
// function accepts, and silently correcting an invalid submission here would
// contradict A22's "40 rejections", which expects reject-not-repair.
//
// Order matters for defense against a hostile direct caller (§6.3): type
// and length are checked before the regex ever runs, so a caller cannot hand
// this a multi-megabyte string and make a public endpoint burn CPU on a
// regex match against it.
function validateHandleFormat(handle: unknown): HandleValidationError | null {
  if (typeof handle !== "string") return "invalid_type";
  if (handle.length < HANDLE_MIN_LENGTH || handle.length > HANDLE_MAX_LENGTH) {
    return "invalid_length";
  }
  if (!HANDLE_PATTERN.test(handle)) return "invalid_format";
  if (RESERVED_HANDLES.has(handle)) return "reserved";
  return null;
}

// Own file, not `convex/users.ts` — `users.ts`'s `viewer` predates the
// handle claim (Phase A step 7) and only returns the four fields the header
// needs. This returns the full row for the caller's own profile, used by
// `/welcome` and `/account` to prefill the profile-edit form and to decide
// whether step 1 of onboarding is still outstanding. Never accepts an id —
// always the caller's own profile via `by_userId`.
export const mine = query({
  args: {},
  returns: v.union(
    v.object({
      handle: v.string(),
      displayName: v.union(v.string(), v.null()),
      bio: v.union(v.string(), v.null()),
      url: v.union(v.string(), v.null()),
      tags: v.array(v.string()),
      isPublic: v.boolean(),
      handleChangedAt: v.union(v.number(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (profile === null) return null;
    return {
      handle: profile.handle,
      displayName: profile.displayName,
      bio: profile.bio,
      url: profile.url,
      tags: profile.tags,
      isPublic: profile.isPublic,
      handleChangedAt: profile.handleChangedAt,
    };
  },
});

// Handles both the initial claim (§8.3 step 1, no existing `profiles` row)
// and the one free change afterwards (`/account`, existing row with
// `handleChangedAt === null`) — one mutation, because uniqueness has to be
// enforced by a single read-then-insert-or-patch inside one serializable
// Convex transaction (§3: "Convex has no unique index... the read-then-insert
// is atomic and a concurrent duplicate loses"). Splitting claim and change
// into two mutations would still be correct individually, but this keeps
// the one invariant ("read `by_handle`, then write, in the same
// transaction") in exactly one place rather than two that have to stay in
// sync by convention.
//
// A22 (40 fuzzed invalid handles, 40 rejections, zero writes): every
// rejection below is a `throw` before any `ctx.db.insert`/`ctx.db.patch`
// call, and a Convex mutation that throws rolls back its entire transaction
// — so even the "handle taken" and "already used your free change" branches,
// which run after the format/reserved checks, still cannot leave a partial
// write behind. Stated explicitly here rather than left implicit, because
// that rollback guarantee is exactly the property the test is asserting.
export const claimHandle = mutation({
  args: { handle: v.string() },
  returns: v.object({ handle: v.string() }),
  handler: async (ctx, { handle }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const formatError = validateHandleFormat(handle);
    if (formatError !== null) {
      throw new ConvexError({ code: formatError });
    }

    const ownerClaim = await callerMayClaimOwnerName(ctx, userId);
    const namePolicy = validateProfileName(handle, ownerClaim);
    if (!namePolicy.ok) throw new ConvexError({ code: namePolicy.code });

    const existingProfile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (existingProfile === null) {
      // Initial claim. `handleChangedAt` stays `null` — §3: the free change
      // is only consumed by an actual change, never by the claim itself.
      const taken = await ctx.db
        .query("profiles")
        .withIndex("by_handle", (q) => q.eq("handle", handle))
        .unique();
      if (taken !== null) throw new ConvexError({ code: "handle_taken" });

      await ctx.db.insert("profiles", {
        userId,
        handle,
        displayName: null,
        bio: null,
        url: null,
        tags: [],
        isPublic: false,
        handleChangedAt: null,
        createdAt: Date.now(),
      });
      return { handle };
    }

    if (existingProfile.handle === handle) {
      // Idempotent no-op: resubmitting the same handle (e.g. a client
      // retry) must not consume the one free change.
      return { handle };
    }

    if (existingProfile.handleChangedAt !== null) {
      throw new ConvexError({ code: "handle_change_used" });
    }

    const taken = await ctx.db
      .query("profiles")
      .withIndex("by_handle", (q) => q.eq("handle", handle))
      .unique();
    if (taken !== null) throw new ConvexError({ code: "handle_taken" });

    await ctx.db.patch(existingProfile._id, {
      handle,
      handleChangedAt: Date.now(),
    });
    return { handle };
  },
});

// Counted as Unicode code points, not UTF-16 units, per §8.2 ("or an emoji
// costs two") — `Array.from` (equivalently `[...str]`) iterates by code
// point, `.length` on the string itself does not.
function codePointLength(s: string): number {
  return Array.from(s).length;
}

// §8.2: "runs of blank lines collapsed to one", newlines preserved
// otherwise. Splits on `\n`, drops trailing whitespace-only lines beyond a
// single blank separator. CRLF normalized to LF first so a Windows client
// pasting text doesn't produce a blank line on every line (CR alone treated
// as part of the following blank-line run, not preserved as its own line).
function normalizeBio(bio: string): string {
  const lf = bio.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = lf.split("\n");
  const out: string[] = [];
  let lastWasBlank = false;
  for (const line of lines) {
    const isBlank = line.trim().length === 0;
    if (isBlank && lastWasBlank) continue;
    out.push(isBlank ? "" : line);
    lastWasBlank = isBlank;
  }
  return out.join("\n");
}

export const updateProfile = mutation({
  args: {
    displayName: v.union(v.string(), v.null()),
    bio: v.union(v.string(), v.null()),
    url: v.union(v.string(), v.null()),
    tags: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { displayName, bio, url, tags }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    // Profile fields can only be set once a handle exists — §8.3's step 2
    // is the second onboarding step, reachable only after step 1.
    if (profile === null) throw new ConvexError({ code: "no_profile" });

    const ownerClaim = await callerMayClaimOwnerName(ctx, userId);

    let normalizedDisplayName: string | null = null;
    if (displayName !== null) {
      const trimmed = displayName.trim();
      if (trimmed.length > 0) {
        if (codePointLength(trimmed) > 50) {
          throw new ConvexError({ code: "display_name_too_long" });
        }
        const namePolicy = validateProfileName(trimmed, ownerClaim);
        if (!namePolicy.ok) throw new ConvexError({ code: `display_${namePolicy.code}` });
        normalizedDisplayName = trimmed;
      }
    }

    let normalizedBio: string | null = null;
    if (bio !== null) {
      const normalized = normalizeBio(bio).trim();
      if (normalized.length > 0) {
        // Rendered as plain text everywhere (A17) — no markdown, no HTML,
        // no autolinking (§8.2). Nothing here interprets the string as
        // anything but characters; the render side (JSX text content) is
        // what makes `<script>` inert, not this validator.
        if (codePointLength(normalized) > 280) {
          throw new ConvexError({ code: "bio_too_long" });
        }
        normalizedBio = normalized;
      }
    }

    let normalizedUrl: string | null = null;
    if (url !== null && url.trim().length > 0) {
      const trimmed = url.trim();
      if (codePointLength(trimmed) > 200) {
        throw new ConvexError({ code: "url_too_long" });
      }
      let parsed: URL;
      try {
        parsed = new URL(trimmed);
      } catch {
        throw new ConvexError({ code: "url_invalid" });
      }
      // A17: `javascript:` (and every other non-http(s) scheme — `data:`,
      // `file:`, `mailto:`...) rejected here, at the mutation, not merely
      // hidden by how the client happens to render it.
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new ConvexError({ code: "url_invalid_scheme" });
      }
      normalizedUrl = trimmed;
    }

    if (tags.length > 3) throw new ConvexError({ code: "too_many_tags" });
    // Rejected, not silently dropped (A23) — `every` short-circuits on the
    // first bad id and the whole call throws before any write.
    if (!tags.every((t) => CATEGORY_IDS.has(t))) {
      throw new ConvexError({ code: "invalid_tag" });
    }

    await ctx.db.patch(profile._id, {
      displayName: normalizedDisplayName,
      bio: normalizedBio,
      url: normalizedUrl,
      tags,
    });
    return null;
  },
});
