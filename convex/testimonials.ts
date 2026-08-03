// §6.3: every exported query/mutation here is a public, internet-facing
// endpoint with no row-security backstop — `NEXT_PUBLIC_CONVEX_URL` is in
// the client bundle. Public reads therefore return only explicitly-approved
// rows, and writes derive identity from `getAuthUserId(ctx)` rather than
// accepting a caller-supplied `userId`.
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  scoreSubmission,
  validateSubmission,
} from "../lib/testimonial-moderation";

const SUBMISSION_WINDOW_MS = 24 * 60 * 60 * 1000;

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
