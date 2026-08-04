/**
 * Cookie names/options shared by the incremental GitHub OAuth handshake
 * (`app/api/submit/github/{authorize,callback}/route.ts`) and the submit
 * route that consumes the resulting token (`app/api/submit/route.ts`).
 *
 * Deliberately separate from `@convex-dev/auth`'s own `__Host-` cookies —
 * this is a different credential (a GitHub API token, `public_repo` scope
 * only) for a different purpose, and mixing it into the Convex Auth cookie
 * would make `deleteAccount`'s and A9's cascade reasoning about "the auth
 * cookies" no longer complete.
 *
 * `secure: true` only in a real deployment — mirrors `proxy.ts`'s own
 * `isLocalhost` gate (`@convex-dev/auth`'s `dist/nextjs/server/cookies.js:
 * 21-22` does the same for the `__Host-` cookies) so a local production-build
 * run can actually complete this flow instead of the browser silently
 * dropping a `Secure` cookie sent over `http://localhost`.
 *
 * Session-binding (docs security review, finding #1 HIGH): `ns_ui_submit_gh_token`
 * on its own is a bearer credential with no link to the Convex identity that
 * obtained it. A Convex sign-out only clears the `__Host-` cookies (the
 * library's own logic — this cookie is a different name, on a different
 * path, and the library has no idea it exists), so this cookie alone would
 * survive a sign-out for up to `SUBMIT_TOKEN_MAX_AGE_S` and could then be
 * used by whichever Convex identity is signed in next on the same browser.
 * `SUBMIT_BINDING_COOKIE` closes that: it holds an HMAC-SHA256 of the Convex
 * `userId` that completed the GitHub handshake, keyed with a server-only
 * secret never sent to the browser. `app/api/submit/route.ts` re-derives the
 * CURRENT caller's `userId` from their live Convex session on every request
 * (never trusts a client-supplied id — §6.3) and recomputes the same HMAC;
 * a mismatch (including "no binding cookie at all") is treated identically
 * to "GitHub not connected", which is exactly true from that identity's
 * point of view. This is a second, independent line of defense on top of
 * cookie-clearing on sign-out/deletion (`app/api/auth/confirm-signout/route.ts`,
 * `app/api/profile/route.ts`'s DELETE) — even if that clearing step is ever
 * skipped or fails, a stale token cannot be used by a DIFFERENT signed-in
 * user, because the binding was computed for someone else's `userId`.
 *
 * Note the binding is keyed on `userId`, not on a particular session: the
 * SAME user signing out and back in (cookie-clearing not required for
 * correctness in that case, only for hygiene) keeps a matching binding.
 * That's intentional — the attack this defends against is a DIFFERENT
 * identity inheriting the token, not the same one re-authenticating.
 */
export const SUBMIT_STATE_COOKIE = "ns_ui_submit_gh_state";
export const SUBMIT_TOKEN_COOKIE = "ns_ui_submit_gh_token";
export const SUBMIT_BINDING_COOKIE = "ns_ui_submit_gh_binding";
export const SUBMIT_STATE_MAX_AGE_S = 10 * 60;
// Generous but bounded: a submit-scope token is useless for anything but
// opening this one kind of PR, and letting it linger a full session is not
// worth the exposure. An hour comfortably covers filling out the form.
export const SUBMIT_TOKEN_MAX_AGE_S = 60 * 60;

// Anchored (finding #4, LOW): the unanchored form let a `Host` of
// `localhost:8080.evil.example` match as a substring, which would
// erroneously drop `secure: true` on both OAuth cookies for a request that
// is not actually local. Read from installed `@convex-dev/auth@0.0.94`,
// `dist/server/utils.js`'s `isLocalHost` is ALSO unanchored — so this file's
// original comment claiming to mirror an anchored upstream check was wrong
// about upstream, not just about this copy. Anchoring here regardless: we
// control this file, the fix is free, and "the library does it too" is not
// a reason to leave it. Behavior for every host string that previously
// matched is unchanged — the anchors only reject the substring-match case.
const LOCALHOST_HOST = /^(localhost|127\.0\.0\.1):\d+$/;

export function isLocalRequestHost(host: string | null): boolean {
  return LOCALHOST_HOST.test(host ?? "");
}

/**
 * HMAC-SHA256(userId) keyed with a server-only secret, hex-encoded. Uses Web
 * Crypto (`crypto.subtle`), available as a global in both the Node and Edge
 * Next.js runtimes (and the one Convex's own `convex/auth.ts` already uses
 * for the same reason) — deliberately not `node:crypto`, so this module
 * never becomes a runtime hazard if something in its import graph is ever
 * pulled into an Edge-runtime route.
 *
 * Fails loud, not closed-over-a-default: a missing secret must never fall
 * back to an unkeyed digest (same posture as `convex/auth.ts`'s
 * `OTP_RATE_LIMIT_SALT` check) — the caller is responsible for turning this
 * into a clean `github_not_configured`-shaped response, not letting it
 * surface as a bare 500.
 */
export async function computeSubmitTokenBinding(userId: string): Promise<string> {
  const secret = process.env.SUBMIT_TOKEN_BINDING_SECRET;
  if (!secret) {
    throw new Error(
      "GitHub submit-token binding is not configured: SUBMIT_TOKEN_BINDING_SECRET " +
        "is not set on this Next.js deployment (Vercel env, not Convex — this " +
        "check runs in app/api/submit routes). Run `vercel env add " +
        "SUBMIT_TOKEN_BINDING_SECRET` (or set it in .env.local for a local run) " +
        "with a random value. Refusing to fall back to an unkeyed digest.",
    );
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(userId));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Constant-time comparison of two hex digests, without `node:crypto`'s
 * `timingSafeEqual` (would tie this module to the Node runtime — see the
 * comment on `computeSubmitTokenBinding`). Both inputs are expected to be
 * fixed-length (64 hex chars, SHA-256) HMAC outputs; still safe for
 * mismatched lengths, which short-circuit on the initial length check but
 * fall out of both binding-check call sites (a missing/empty cookie fails
 * the earlier existence check first) rather than a live per-request race.
 */
export function submitBindingsMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Expires all three submit-flow cookies with the SAME `path` they were set
 * with (`/api/submit`) — a mismatched path (finding #2's exact bug, applied
 * here to keep it from recurring) leaves the original live under the
 * browser's own Set-Cookie matching rules. Called from both sign-out seams
 * (`app/api/auth/confirm-signout/route.ts`, on every sign-out click, and
 * `app/api/profile/route.ts`'s `DELETE`, on account deletion) so a stale
 * token/state/binding cookie never outlives the identity it belongs to.
 *
 * `secure` is NOT hardcoded to `true` — computed the same way it was set,
 * via `isLocalRequestHost`, so clearing still works (rather than silently
 * no-opping) on a local production-build run over `http://localhost`.
 */
export function clearSubmitOAuthCookies(
  response: { cookies: { set: (name: string, value: string, options: Record<string, unknown>) => unknown } },
  host: string | null,
): void {
  const secure = !isLocalRequestHost(host);
  for (const name of [SUBMIT_TOKEN_COOKIE, SUBMIT_STATE_COOKIE, SUBMIT_BINDING_COOKIE]) {
    response.cookies.set(name, "", {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/api/submit",
      maxAge: 0,
    });
  }
}
