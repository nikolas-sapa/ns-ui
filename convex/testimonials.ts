// §6.3: every exported query/mutation here is a public, internet-facing
// endpoint with no row-security backstop — `NEXT_PUBLIC_CONVEX_URL` is in
// the client bundle. Public reads therefore return only explicitly-approved
// rows, and writes derive identity from `getAuthUserId(ctx)` rather than
// accepting a caller-supplied `userId`.
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import {
  scoreSubmission,
  validateSubmission,
} from "../lib/testimonial-moderation";

const SUBMISSION_WINDOW_MS = 24 * 60 * 60 * 1000;

// Same owner identity `convex/profiles.ts` uses for the reserved-name claim —
// one `OWNER_EMAILS` list, not a second parallel notion of "admin". An empty
// or unset list means nobody is an owner, so the moderation endpoints below
// are closed by default rather than open by default.
function configuredOwnerEmails(): Set<string> {
  return new Set(
    (process.env.OWNER_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLocaleLowerCase("en-US"))
      .filter(Boolean),
  );
}

async function requireOwner(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new ConvexError({ code: "not_authenticated" as const });
  }
  const configured = configuredOwnerEmails();
  if (configured.size === 0) {
    throw new ConvexError({ code: "not_authorized" as const });
  }
  const user = await ctx.db.get(userId);
  const email = typeof user?.email === "string" ? user.email.toLocaleLowerCase("en-US") : null;
  if (email === null || !configured.has(email)) {
    throw new ConvexError({ code: "not_authorized" as const });
  }
  return userId;
}

const testimonialArgs = {
  name: v.string(),
  role: v.string(),
  company: v.string(),
  profileUrl: v.string(),
  photoUrl: v.optional(v.string()),
  quote: v.string(),
};

const publicTestimonial = v.object({
  id: v.id("testimonials"),
  quote: v.string(),
  name: v.string(),
  role: v.string(),
  company: v.string(),
  profileUrl: v.string(),
  photoUrl: v.optional(v.string()),
  status: v.literal("approved"),
});

export const approved = query({
  args: {},
  returns: v.array(publicTestimonial),
  handler: async (ctx) => {
    const docs = await ctx.db
      .query("testimonials")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .collect();

    return docs
      .sort((left, right) => right.createdAt - left.createdAt)
      .map((doc) => ({
        id: doc._id,
        quote: doc.quote,
        name: doc.name,
        role: doc.role,
        company: doc.company,
        profileUrl: doc.profileUrl,
        ...(doc.photoUrl ? { photoUrl: doc.photoUrl } : {}),
        status: "approved" as const,
      }));
  },
});

export const submit = mutation({
  args: testimonialArgs,
  returns: v.object({ status: v.literal("pending") }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError({ code: "not_authenticated" as const });
    }

    const validated = validateSubmission(args);
    if (!validated.ok) {
      throw new ConvexError({ code: validated.code });
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("testimonials")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    const hasRecentPending = existing.some(
      (doc) => doc.status === "pending" && now - doc.createdAt < SUBMISSION_WINDOW_MS,
    );
    if (hasRecentPending) {
      throw new ConvexError({ code: "rate_limited" as const });
    }

    const { score, flags } = scoreSubmission(validated.value);
    await ctx.db.insert("testimonials", {
      userId,
      ...validated.value,
      status: "pending",
      spamScore: score,
      spamFlags: flags,
      createdAt: now,
      reviewedAt: null,
    });

    return { status: "pending" as const };
  },
});

// --- moderation (owner only) ---------------------------------------------
// These three are exported public endpoints like everything else in this file
// (§6.3), so each one re-derives the caller and re-checks ownership itself.
// None of them trusts an argument to say who is asking.

/** The review queue: every row regardless of status, newest first, WITH the
 *  spam score and flags — the one place those are exposed, and only to an
 *  owner. `approved` remains the public read and never returns them. */
export const queue = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.id("testimonials"),
      quote: v.string(),
      name: v.string(),
      role: v.string(),
      company: v.string(),
      profileUrl: v.string(),
      photoUrl: v.optional(v.string()),
      status: v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected"),
      ),
      spamScore: v.number(),
      spamFlags: v.array(v.string()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const docs = await ctx.db.query("testimonials").collect();
    return docs
      .sort((left, right) => right.createdAt - left.createdAt)
      .map((doc) => ({
        id: doc._id,
        quote: doc.quote,
        name: doc.name,
        role: doc.role,
        company: doc.company,
        profileUrl: doc.profileUrl,
        ...(doc.photoUrl ? { photoUrl: doc.photoUrl } : {}),
        status: doc.status,
        spamScore: doc.spamScore,
        spamFlags: doc.spamFlags,
        createdAt: doc.createdAt,
      }));
  },
});

/** Publish a submission. Idempotent: approving an approved row is a no-op
 *  rather than an error, so a double-click can't fail confusingly. */
export const approve = mutation({
  args: { id: v.id("testimonials") },
  returns: v.object({ status: v.literal("approved") }),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const doc = await ctx.db.get(args.id);
    if (doc === null) {
      throw new ConvexError({ code: "not_found" as const });
    }
    await ctx.db.patch(args.id, { status: "approved", reviewedAt: Date.now() });
    return { status: "approved" as const };
  },
});

/** Take a submission out of the public list (or keep it out). Rejected rows
 *  are retained rather than deleted so a repeat abuser stays attributable. */
export const reject = mutation({
  args: { id: v.id("testimonials") },
  returns: v.object({ status: v.literal("rejected") }),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const doc = await ctx.db.get(args.id);
    if (doc === null) {
      throw new ConvexError({ code: "not_found" as const });
    }
    await ctx.db.patch(args.id, { status: "rejected", reviewedAt: Date.now() });
    return { status: "rejected" as const };
  },
});
