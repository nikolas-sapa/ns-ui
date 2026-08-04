// `/api/submit/github/callback` — the redirect target GitHub sends the user
// back to after granting `public_repo` (see the authorize route's header for
// why this second, incremental consent exists at all). Exchanges the
// authorization code for an access token server-side — the token is never
// sent to the browser as JS-readable state, only as an `httpOnly` cookie,
// for the same reason §6.1 forbids a JS-readable Convex Auth token: a
// same-origin script (including one running inside a demo iframe elsewhere
// on this origin — not on `/submit`, which mounts no iframe, but the
// principle in §6.1 is "don't make an exception for this page") must not be
// able to read a bearer credential.
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { NextResponse, type NextRequest } from "next/server";
import { api } from "@/convex/_generated/api";
import {
  computeSubmitTokenBinding,
  isLocalRequestHost,
  SUBMIT_BINDING_COOKIE,
  SUBMIT_STATE_COOKIE,
  SUBMIT_TOKEN_COOKIE,
  SUBMIT_TOKEN_MAX_AGE_S,
  submitBindingsMatch,
} from "@/lib/submit-oauth-cookies";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = await convexAuthNextjsToken();
  if (!token) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const storedState = request.cookies.get(SUBMIT_STATE_COOKIE)?.value ?? null;

  // CSRF check on the OAuth `state` param — a missing/mismatched state means
  // this callback wasn't reached via our own `/authorize` redirect. `state`
  // itself is generated with `crypto.randomUUID()` (`authorize/route.ts`) —
  // a CSPRNG, 122 bits of entropy, not `Math.random()`. Compared with
  // `submitBindingsMatch` rather than `!==`: while this value isn't secret
  // once round-tripped through a redirect URL the browser itself sends, a
  // non-constant-time `!==` on a value the caller partly controls (`state`
  // from the query string) is unnecessary risk for a one-line fix.
  if (!code || !state || !storedState || !submitBindingsMatch(state, storedState)) {
    return NextResponse.json({ error: "invalid_oauth_state" }, { status: 400 });
  }

  const clientId = process.env.AUTH_GITHUB_ID;
  const clientSecret = process.env.AUTH_GITHUB_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "github_not_configured" }, { status: 500 });
  }

  // Fail closed BEFORE spending a GitHub token-exchange call: if the
  // session-binding secret (finding #1) isn't set on this deployment, there
  // is no safe way to mint `SUBMIT_TOKEN_COOKIE` below without leaving it
  // unbound to any identity — the exact defect this whole change fixes.
  // Same `github_not_configured` shape as the missing-OAuth-credential case
  // just above, not a distinct code — from the caller's perspective both
  // mean "this deployment can't complete the GitHub connect flow yet".
  let userId: string | null;
  try {
    userId = await fetchQuery(api.users.currentUserId, {}, { token });
  } catch {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (userId === null) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  let binding: string;
  try {
    binding = await computeSubmitTokenBinding(userId);
  } catch {
    return NextResponse.json({ error: "github_not_configured" }, { status: 500 });
  }

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: new URL("/api/submit/github/callback", request.nextUrl.origin).toString(),
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.json({ error: "github_token_exchange_failed" }, { status: 502 });
  }

  const data = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!data.access_token) {
    return NextResponse.json({ error: data.error ?? "github_token_exchange_failed" }, { status: 502 });
  }

  const response = NextResponse.redirect(new URL("/submit?github=connected", request.nextUrl.origin));
  const secure = !isLocalRequestHost(request.headers.get("host"));
  // Finding #2 (MEDIUM): the state cookie was SET with `path: "/api/submit"`
  // (`authorize/route.ts`) but cleared here with no `path` at all, which
  // defaults to `/` — a different scope than the one it was set with, so
  // the ORIGINAL cookie under `/api/submit` was left live for its full
  // 600s `maxAge` (this call only ever created a second, separate,
  // already-empty cookie at `/`). `response.cookies.delete(name, options)`
  // is a version-sensitive overload — using an explicit `set(...,
  // { maxAge: 0 })` with the matching path instead, so there's no
  // ambiguity about which cookie this clears.
  response.cookies.set(SUBMIT_STATE_COOKIE, "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/api/submit",
    maxAge: 0,
  });
  response.cookies.set(SUBMIT_TOKEN_COOKIE, data.access_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/api/submit",
    maxAge: SUBMIT_TOKEN_MAX_AGE_S,
  });
  // Finding #1's other half: bind the token to the identity that obtained
  // it, recorded alongside it with identical scope/lifetime so the two
  // cookies always expire together.
  response.cookies.set(SUBMIT_BINDING_COOKIE, binding, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/api/submit",
    maxAge: SUBMIT_TOKEN_MAX_AGE_S,
  });
  return response;
}
