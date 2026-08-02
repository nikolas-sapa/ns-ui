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
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { NextResponse, type NextRequest } from "next/server";
import { api } from "@/convex/_generated/api";

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
  // No cookie: there's nothing to confirm. Not itself the anomaly this
  // route exists to catch (that requires a token that's *present* but
  // doesn't resolve) — mirrors `/api/me` and `/api/saves`'s no-cookie fast
  // path, no Convex round trip.
  const token = await convexAuthNextjsToken();
  if (!token) {
    return NextResponse.json({ checked: false });
  }

  if (!originIsAllowed(request)) {
    return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
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
    return NextResponse.json({ checked: true, ...result });
  } catch (error) {
    // The mutation call itself failing (network, Convex error) is exactly
    // as loud — the caller still gets signed out client-side right after
    // this, and here is the only record that the DB row may have survived.
    console.error("api/auth/confirm-signout: confirmSignOut call failed", error);
    return NextResponse.json({ checked: false, error: "confirm_failed" });
  }
}
