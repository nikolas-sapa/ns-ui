// `/api/auth/confirm-signout` — called on our own origin, immediately
// BEFORE the library's `signOut()` clears cookies, so the token this route
// reads from the httpOnly cookie still identifies a live session. Same
// shape as `/api/me` and `/api/saves`: reads the cookie server-side and
// calls Convex with an authed server client, so the browser never needs a
// usable Convex token of its own (§6.1, §7.3).
//
// Why this has to run BEFORE `signOut()`, not after: the library's own
// `auth:signOut` proxy action clears cookies unconditionally and returns
// 200 whether or not it deleted anything server-side — verified directly,
// a POST with no cookie and a POST with a wrong-signature JWT both come
// back 200/cleared-cookies/empty-body, byte-identical, nothing logged
// either way. Once cookies are cleared there is no token left to check
// anything with, so any confirmation step run after `signOut()` would
// report "no_identity" on literally every sign-out, successful or not — a
// smoke alarm that always screams. Calling `session:confirmSignOut`
// (`convex/session.ts`) here, first, while the cookie is still live, is
// what makes a genuine mismatch (a token that decodes fine but no longer
// resolves to an identity Convex will accept) distinguishable from the
// normal case.
//
// No matcher change needed: `/api/auth(.*)` is already in `proxy.ts`'s
// allowlist, and the library's own middleware only intercepts an EXACT
// `/api/auth` (or `/api/auth/`) path to proxy sign-in/out actions
// (`shouldProxyAuthAction` in `dist/nextjs/server/proxy.js`) — this route's
// longer path falls through untouched to normal Next.js routing.
//
// This route never blocks sign-out. Whatever it finds, the client always
// proceeds to call the library's `signOut()` right after — a bookkeeping
// failure here must never leave someone stuck signed in. The only thing
// this does is put the mismatch somewhere someone will actually see it:
// the server log, not a browser console that closes with the tab.
//
// Also the seam for finding #1's OTHER half (session binding, above, is the
// first): `app/_components/account-signout.tsx` calls this route BEFORE
// the library's own `signOut()`, which only clears the `__Host-` cookies —
// it has no idea `ns_ui_submit_gh_token`/`ns_ui_submit_gh_state`/
// `ns_ui_submit_gh_binding` exist, so those would otherwise survive a
// sign-out for up to an hour. Cleared here, unconditionally, before any
// other check in this handler — sign-out must clear them whether or not
// this route's own Convex confirmation succeeds, has a valid token to
// check, or even comes from an allowed Origin (a forged cross-origin call
// can only make a browser clear ITS OWN cookies early, which is at most an
// inconvenience, never a security regression).
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { NextResponse, type NextRequest } from "next/server";
import { api } from "@/convex/_generated/api";
import { clearSubmitOAuthCookies } from "@/lib/submit-oauth-cookies";

export const dynamic = "force-dynamic";

// Same origin check as `/api/saves` (`app/api/saves/route.ts:27-31`) — a
// cross-origin page must not be able to trigger this against a real
// session, even though it can't act on the response either way.
function originIsAllowed(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  return origin === request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  // Build the response object first so the submit-cookie clearing below can
  // attach to whichever body/status this handler ends up returning — every
  // return path clears the same three cookies, unconditionally.
  const respond = (body: Record<string, unknown>, status?: number) => {
    const response = NextResponse.json(body, status !== undefined ? { status } : undefined);
    clearSubmitOAuthCookies(response, request.headers.get("host"));
    return response;
  };

  // No cookie: there's nothing to confirm. Not itself the anomaly this
  // route exists to catch (that requires a token that's *present* but
  // doesn't resolve) — mirrors `/api/me` and `/api/saves`'s no-cookie fast
  // path, no Convex round trip.
  const token = await convexAuthNextjsToken();
  if (!token) {
    return respond({ checked: false });
  }

  if (!originIsAllowed(request)) {
    return respond({ error: "origin_not_allowed" }, 403);
  }

  try {
    const result = await fetchMutation(api.session.confirmSignOut, {}, { token });
    // Success must stay silent — a false positive here (logging on the
    // normal path) is worse than the alarm never firing, because it trains
    // whoever reads these logs to ignore them.
    if (result.reason !== "ok") {
      console.error(
        `api/auth/confirm-signout: sign-out about to no-op server-side (${result.reason}) — the session row was not deleted by this request`,
      );
    }
    return respond({ checked: true, ...result });
  } catch (error) {
    // The mutation call itself failing (network, Convex error) is exactly
    // as loud — the caller still gets signed out client-side right after
    // this, and here is the only record that the DB row may have survived.
    console.error("api/auth/confirm-signout: confirmSignOut call failed", error);
    return respond({ checked: false, error: "confirm_failed" });
  }
}
