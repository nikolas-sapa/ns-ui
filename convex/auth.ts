// Convex Auth configuration — three providers: GitHub, Google, email OTP.
//
// GitHub/Google: `@convex-dev/auth` ships no provider-specific wrapper for
// them (verified: node_modules/@convex-dev/auth/dist/providers/ has only
// Anonymous, ConvexCredentials, Email, Password, Phone). Per §2 Phase 0 and
// §7.2, OAuth here goes straight through the underlying Auth.js providers —
// `@auth/core/providers/github` and `@auth/core/providers/google` — which
// `convexAuth()` accepts directly. Env vars follow the Auth.js convention
// confirmed by Phase 0 against `provider_utils.js`'s `setEnvDefaults`:
// AUTH_GITHUB_ID/AUTH_GITHUB_SECRET, AUTH_GOOGLE_ID/AUTH_GOOGLE_SECRET.
//
// Email OTP: adapted from reserved-app/convex/ResendOTP.ts (the spec's named
// template, §7.2 — "a template, not a starting point"), inlined here because
// this step's brief lists exactly four files to create. Every property of
// the template is preserved: CSPRNG numeric code, per-email rate limiting
// indistinguishable from a normal send, no logging of the token. Three
// deliberate deviations from the template:
//   1. maxAge is 5 minutes, not 15 — tighter than even A5's "valid 10
//      minutes" baseline, compensating for a verified library defect in
//      installed @convex-dev/auth 0.0.94 (full explanation and line refs on
//      the OTP_CODE_MAX_AGE_S constant below).
//   2. The rate limit is 5 requests/address/hour, not 3 — A5's own number.
//   3. The code is 8 digits, not 6 — same library-defect compensation as
//      (1); see the same comment.
// A third deviation, not a spec conflict: the `resend` npm package is not
// installed in this repo and this step is not permitted to add a dependency
// (brief: "pin nothing new"), so the email send uses a direct `fetch` to
// Resend's HTTP API instead of the `resend` SDK the template imports.
//
// API-name caution (§10): confirmed against installed 0.0.94 source, not
// memory — see the comment above `emailOTP` below re: provider `id`.
import GitHub from "@auth/core/providers/github";
import Google from "@auth/core/providers/google";
import { Email } from "@convex-dev/auth/providers/Email";
import { convexAuth } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";

// OTP_CODE_MAX_AGE_S and generateNumericCode's length (below, in emailOTP)
// are BOTH set stricter than A5's baseline ("valid 10 minutes", 6-digit) to
// compensate for a verified library defect in installed @convex-dev/auth
// 0.0.94, not a spec requirement — do not "simplify" these back without
// re-reading the three lines below on any auth version bump:
//   1. node_modules/@convex-dev/auth/dist/server/implementation/mutations/
//      verifyCodeAndSignIn.js:66-68 — the submitted code is looked up with
//      `.withIndex("code", q => q.eq("code", codeHash)).unique()`, a lookup
//      GLOBAL across the whole table, not scoped to the caller's email. The
//      account signed in is `verificationCode.accountId`, unrelated to what
//      the caller submitted as their email.
//   2. Same file, line 22 — `identifier = args.params.email ?? args.params.phone`,
//      the caller-supplied string, and the send-step rate limiter (below,
//      `checkAndRecordOtpRequest`) is keyed on it. An attacker who varies the
//      email per request gets a fresh bucket every time, so no send-side
//      throttle ever engages against a fixed-target guessing loop.
//   3. dist/server/implementation/signIn.js:42-48 (handleEmailAndPhoneProvider)
//      calls verifyCodeAndSignIn WITHOUT a `verifier`; `verifier` is only ever
//      populated for OAuth (mutations/userOAuth.js:43). So for email OTP both
//      sides of `verificationCode.verifier !== verifier` are `undefined` and
//      the check passes trivially — it does not gate anything here.
// Net effect: any caller can hit the library's own public `signIn` action
// directly (bypassing any wrapper we put in front of it) with an arbitrary
// email and a guessed code, at an effectively unbounded rate, and a hit
// against ANY outstanding code across ALL users signs the attacker in as
// that user. There is no upstream fix in 0.0.94 (latest as of writing), so
// the only lever we control is the codes themselves: more entropy, shorter
// life. See also generateNumericCode's call site in emailOTP below.
const OTP_CODE_MAX_AGE_S = 5 * 60;

// Per-email throttle on the send step: at most 5 requests/hour (A5).
const OTP_WINDOW_MS = 60 * 60 * 1000;
const OTP_MAX_REQUESTS_PER_WINDOW = 5;

// Numeric code from a CSPRNG (crypto.getRandomValues is available in the
// Convex action runtime). Never Math.random. Called below with length 8, not
// A5's baseline 6 — see the comment on OTP_CODE_MAX_AGE_S above for why:
// compensating for a library defect, not a spec requirement. Kept numeric
// rather than alphanumeric because alphanumeric would break email OTP
// autofill and the extra charset buys less entropy than two more digits do.
function generateNumericCode(length: number): string {
  const digits = new Uint32Array(length);
  crypto.getRandomValues(digits);
  return Array.from(digits, (n) => n % 10).join("");
}

// Keyed HMAC-SHA256 of a normalized email address, used only to key
// `otpRequestLimits` rows (below) without storing anyone's plaintext email
// there. A bare SHA-256 would not be enough — email addresses are low
// entropy and trivially rainbow-tabled — so this is keyed with a dedicated
// deployment secret, `OTP_RATE_LIMIT_SALT`, distinct from any other secret
// in this file. Uses Web Crypto (`crypto.subtle`), available in Convex's
// default (non-Node) runtime — the same runtime `@convex-dev/auth` itself
// relies on for JWT verification via `jose`'s webcrypto backend, so this
// does not require a `"use node"` action.
async function hmacHex(salt: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(salt),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Note: `Email()`'s returned config hardcodes `id: "email"` regardless of
// what's passed in — confirmed by reading
// node_modules/@convex-dev/auth/dist/providers/Email.js, which returns a
// literal `id: "email"` and ignores any `id` in its config argument. The
// spec's §2 Phase 0 narrative refers to calling `signIn("email-otp")`; that
// name does not exist in installed 0.0.94 for this provider type. The
// callable provider id from the client is `"email"`. Flagged per §10 —
// follow installed source over the spec's from-memory name.
const emailOTP = Email({
  apiKey: process.env.RESEND_API_KEY,
  maxAge: OTP_CODE_MAX_AGE_S,
  generateVerificationToken() {
    return generateNumericCode(8);
  },
  async sendVerificationRequest(
    { identifier: email, token }: { identifier: string; token: string },
    // Convex Auth's `signIn` action passes a second `ctx` argument here at
    // runtime even though @auth/core's upstream type for
    // `sendVerificationRequest` only declares one param (same situation as
    // the template — see dist/server/implementation/signIn.js,
    // handleEmailAndPhoneProvider, which has a matching `@ts-expect-error`).
    // Declared optional, not required, purely to stay assignable to the
    // 1-param upstream type; it is always actually provided by the SDK.
    ctx?: ActionCtx,
  ) {
    // Rate limit BEFORE the send, and made indistinguishable from a normal
    // send to the caller: no thrown error, no distinct return shape — just
    // skip the email. Throwing here would let an attacker probe "is this
    // email throttled" as a side channel (preserved from the template).
    const allowed = await ctx!.runMutation(
      internal.auth.checkAndRecordOtpRequest,
      { email },
    );
    if (!allowed) {
      return;
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OTP email could not be sent: RESEND_API_KEY is not set on the " +
          "Convex deployment. Run `npx convex env set RESEND_API_KEY <key>`.",
      );
    }
    const from = process.env.AUTH_EMAIL_FROM;
    if (!from) {
      throw new Error(
        "OTP email could not be sent: AUTH_EMAIL_FROM is not set on the " +
          "Convex deployment. Run `npx convex env set AUTH_EMAIL_FROM " +
          '"ns-ui <noreply@yourdomain.com>"`.',
      );
    }

    // Direct fetch to Resend's HTTP API rather than the `resend` SDK — see
    // file header. Three logging/leak properties, deliberate and audited:
    //   1. `token` (the OTP) and `apiKey` never appear in any thrown error,
    //      log line, or returned value on any path — only in the request
    //      body sent directly to Resend over HTTPS.
    //   2. On a non-2xx response, the error message below includes only
    //      Resend's HTTP status, never `res.text()`/`res.json()` — Resend's
    //      response body is never read, so it cannot leak to the caller.
    //   3. `email` itself is never logged either; it only appears in the
    //      request body's `to` field.
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: "Your sign-in code",
        text: `Your sign-in code is ${token}. It expires in 5 minutes. If you didn't request this, you can ignore this email.`,
      }),
    });
    if (!res.ok) {
      throw new Error(`Could not send OTP email: Resend responded ${res.status}`);
    }
  },
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [GitHub, Google, emailOTP],
});

// Called only from `emailOTP.sendVerificationRequest` above via
// `ctx.runMutation` (the action ctx the SDK invokes it with — see
// dist/server/implementation/index.js, `convexAuth`'s `signIn` is an
// `actionGeneric`, hence internalMutation + runMutation rather than direct
// `ctx.db` access from the provider callback). `internalMutation`s are not
// listed in `convex/_generated/api.d.ts`'s public surface, so this is
// unreachable via A15's unauthenticated-direct-call audit by construction.
//
// Retention property (§6.7-adjacent, though this table is outside the A9
// cascade — see the comment on `otpRequestLimits` in schema.ts): rows are
// keyed on `emailHash`, an unrecoverable HMAC, never the plaintext address,
// and this mutation deletes the row for the calling address the moment its
// window is stale rather than letting it linger — so at any instant there is
// at most one live row per address, and it is at most one window (1h) old.
// No cron: pruning happens inline, on the request that would otherwise be
// throttled by it.
//
// Returns true (and records the request) if under the limit, false if the
// email has hit 5 requests in the current rolling hour (A5). Callers MUST
// treat both outcomes identically from the client's perspective — this
// function never throws for "over the limit"; only a missing
// `OTP_RATE_LIMIT_SALT` (a deployment misconfiguration, not something an
// attacker can trigger by choice of email) throws, matching how the missing
// RESEND_API_KEY/AUTH_EMAIL_FROM checks above fail loudly rather than
// silently.
export const checkAndRecordOtpRequest = internalMutation({
  args: { email: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { email }) => {
    const salt = process.env.OTP_RATE_LIMIT_SALT;
    if (!salt) {
      throw new Error(
        "OTP rate limiting is not configured: OTP_RATE_LIMIT_SALT is not " +
          "set on the Convex deployment. Run `npx convex env set " +
          "OTP_RATE_LIMIT_SALT <random value>`. Refusing to fall back to an " +
          "unkeyed hash of the email address.",
      );
    }

    const normalized = email.trim().toLowerCase();
    const emailHash = await hmacHex(salt, normalized);
    const now = Date.now();

    // Prune this address's own row first if its window has already
    // expired, rather than reusing/patching it — the row is deleted, not
    // just overwritten, so there is never a moment where a stale row for
    // this address both exists and is readable as "current".
    const existing = await ctx.db
      .query("otpRequestLimits")
      .withIndex("by_emailHash", (q) => q.eq("emailHash", emailHash))
      .unique();
    const current =
      existing !== null && now - existing.windowStart < OTP_WINDOW_MS
        ? existing
        : null;
    if (existing !== null && current === null) {
      await ctx.db.delete(existing._id);
    }

    let allowed: boolean;
    if (current === null) {
      await ctx.db.insert("otpRequestLimits", {
        emailHash,
        windowStart: now,
        count: 1,
      });
      allowed = true;
    } else if (current.count >= OTP_MAX_REQUESTS_PER_WINDOW) {
      allowed = false;
    } else {
      await ctx.db.patch(current._id, { count: current.count + 1 });
      allowed = true;
    }

    // Opportunistic pruning of OTHER addresses' long-expired rows,
    // piggybacked on every call — bounds growth across distinct addresses,
    // not just repeats of the same one. Never touches `current`/`existing`
    // above (already handled). `take(20)` bounds per-call write cost;
    // growth self-drains without needing a cron.
    const stale = await ctx.db
      .query("otpRequestLimits")
      .withIndex("by_window", (q) => q.lt("windowStart", now - OTP_WINDOW_MS))
      .take(20);
    for (const row of stale) {
      await ctx.db.delete(row._id);
    }

    return allowed;
  },
});
