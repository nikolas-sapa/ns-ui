// `/api/profile` — POST (claim/change handle), PATCH (profile fields), DELETE
// (account deletion). Same shape as `/api/saves` (§6.1's "Consequence for
// the data path"): the browser never holds a usable Convex token, so every
// write here reads the `__Host-` session cookie server-side and calls Convex
// with an authed server client. One `originIsAllowed` + one token read for
// all three methods, on purpose — §6.5's Origin check is the thing that must
// not be forgotten on any state-changing method, and three separate route
// files would be three separate places to forget it.
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { ConvexError } from "convex/values";
import { NextResponse, type NextRequest } from "next/server";
import { api } from "@/convex/_generated/api";
import { clearSubmitOAuthCookies } from "@/lib/submit-oauth-cookies";

export const dynamic = "force-dynamic";

// Identical check to `app/api/saves/route.ts`'s `originIsAllowed` — kept as
// a literal copy rather than a shared import, matching that file's own
// choice not to factor this into `lib/` (small enough that two call sites
// staying in sync by inspection is simpler than a shared module both routes
// depend on for a three-line check).
function originIsAllowed(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  return origin === request.nextUrl.origin;
}

function convexErrorCode(error: unknown): string | null {
  if (
    error instanceof ConvexError &&
    typeof error.data === "object" &&
    error.data !== null &&
    typeof (error.data as { code?: unknown }).code === "string"
  ) {
    return (error.data as { code: string }).code;
  }
  return null;
}

// Every `ConvexError` code thrown by `convex/profiles.ts`/`convex/account.ts`
// maps to 400/409/422 here rather than a bare 500 — a validation rejection
// is not a server error.
const CODE_STATUS: Record<string, number> = {
  invalid_type: 400,
  invalid_length: 400,
  invalid_format: 400,
  reserved: 400,
  name_not_allowed: 400,
  owner_name_reserved: 400,
  display_name_not_allowed: 400,
  display_owner_name_reserved: 400,
  handle_taken: 409,
  handle_change_used: 409,
  no_profile: 400,
  display_name_too_long: 400,
  bio_too_long: 400,
  url_too_long: 400,
  url_invalid: 400,
  url_invalid_scheme: 400,
  too_many_tags: 400,
  invalid_tag: 400,
};

export async function POST(request: NextRequest) {
  const token = await convexAuthNextjsToken();
  if (!token) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (!originIsAllowed(request)) {
    return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const handle = (body as { handle?: unknown } | null)?.handle;
  if (typeof handle !== "string") {
    return NextResponse.json({ error: "invalid_handle" }, { status: 400 });
  }

  try {
    const result = await fetchMutation(api.profiles.claimHandle, { handle }, { token });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const code = convexErrorCode(error);
    if (code !== null) {
      return NextResponse.json({ error: code }, { status: CODE_STATUS[code] ?? 400 });
    }
    throw error;
  }
}

export async function PATCH(request: NextRequest) {
  const token = await convexAuthNextjsToken();
  if (!token) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (!originIsAllowed(request)) {
    return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const b = body as {
    displayName?: unknown;
    bio?: unknown;
    url?: unknown;
    tags?: unknown;
  } | null;

  const displayName =
    typeof b?.displayName === "string" ? b.displayName : null;
  const bio = typeof b?.bio === "string" ? b.bio : null;
  const url = typeof b?.url === "string" ? b.url : null;
  const tags = Array.isArray(b?.tags)
    ? b.tags.filter((t): t is string => typeof t === "string")
    : [];
  // Length mismatch after the filter above means a non-string tag was
  // submitted — reject rather than silently drop it (A23's rule applies to
  // malformed request bodies too, not just out-of-vocabulary strings).
  if (Array.isArray(b?.tags) && tags.length !== b.tags.length) {
    return NextResponse.json({ error: "invalid_tag" }, { status: 400 });
  }

  try {
    await fetchMutation(
      api.profiles.updateProfile,
      { displayName, bio, url, tags },
      { token },
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = convexErrorCode(error);
    if (code !== null) {
      return NextResponse.json({ error: code }, { status: CODE_STATUS[code] ?? 400 });
    }
    throw error;
  }
}

export async function DELETE(request: NextRequest) {
  const token = await convexAuthNextjsToken();
  if (!token) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (!originIsAllowed(request)) {
    return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
  }

  await fetchMutation(api.account.deleteAccount, {}, { token });
  // `__Host-`-prefixed cookie clearing is deliberately NOT done here.
  // `convex/account.ts` already deletes the caller's `authSessions`/
  // `authRefreshTokens` rows; the client (`app/_components/account-
  // delete.tsx`) calls the library's own `signOut()` immediately after this
  // resolves, which clears those cookies through the same isLocalhost-aware
  // logic `dist/nextjs/server/cookies.js` uses everywhere else
  // (`convex/session.ts` documents that this proxy clears cookies whether
  // or not the session it is asked to delete still exists) — hand-rolling
  // the cookie name/prefix a second time here would be a second place for
  // that logic to drift.
  //
  // The submit-flow cookies are a DIFFERENT case (finding #1): the library's
  // `signOut()` has no idea `ns_ui_submit_gh_token`/`_state`/`_binding`
  // exist — they're on a different path, a different name, and nothing
  // convex-auth owns — so nothing else in this deletion flow ever clears
  // them. Without this, a deleted account's GitHub token cookie would
  // survive deletion for up to an hour, on a browser some OTHER identity
  // could sign into next, exactly the scenario finding #1 closes for
  // sign-out; account deletion needed the identical fix.
  const response = NextResponse.json({ ok: true });
  clearSubmitOAuthCookies(response, request.headers.get("host"));
  return response;
}
