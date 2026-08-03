// `/api/submit/github/authorize` — starts the INCREMENTAL GitHub OAuth
// consent the Phase C spec calls for: "all through the GitHub API under an
// incremental OAuth scope requested at submit time" (community-spec.md §2).
//
// Why this exists as a second flow, separate from sign-in: `@convex-dev/auth`
// signs a user in through GitHub (convex/auth.ts) but never persists a
// reusable GitHub access token anywhere reachable by us — verified against
// installed `@convex-dev/auth@0.0.94`: `authAccounts`'s schema
// (`node_modules/@convex-dev/auth/dist/server/implementation/types.js:55-64`)
// has no `access_token`/`refresh_token` field, only `provider` and
// `providerAccountId`. The library only reads the OAuth token transiently,
// inside its own callback, to fetch the user's profile
// (`dist/server/oauth/callback.js:137,152`) — it is never stored. So opening
// a fork, pushing a branch and creating a PR needs its own token, obtained
// here, scoped to exactly `public_repo` and nothing broader (no `repo`,
// no org access, no admin scopes).
//
// This reuses the SAME GitHub OAuth App as sign-in (AUTH_GITHUB_ID /
// AUTH_GITHUB_SECRET, already required on the Convex deployment per §5 step
// 4 — also read here, on the Next.js side, since this handshake runs in our
// own route handlers, not inside Convex). Classic GitHub OAuth Apps merge
// scopes across authorizations for the same app+user, so requesting
// `public_repo` here is exactly the "incremental scope" the spec names,
// not a second app registration.
//
// Gated on Convex Auth first (401) — only a signed-in user may start this,
// mirroring every other state-adjacent route on this origin.
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import {
  SUBMIT_STATE_COOKIE,
  SUBMIT_STATE_MAX_AGE_S,
  isLocalRequestHost,
} from "@/lib/submit-oauth-cookies";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = await convexAuthNextjsToken();
  if (!token) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const clientId = process.env.AUTH_GITHUB_ID;
  if (!clientId) {
    return NextResponse.json({ error: "github_not_configured" }, { status: 500 });
  }

  const state = crypto.randomUUID();
  const redirectUri = new URL("/api/submit/github/callback", request.nextUrl.origin).toString();

  const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", "public_repo");
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(SUBMIT_STATE_COOKIE, state, {
    httpOnly: true,
    secure: !isLocalRequestHost(request.headers.get("host")),
    sameSite: "lax",
    path: "/api/submit",
    maxAge: SUBMIT_STATE_MAX_AGE_S,
  });
  return response;
}
