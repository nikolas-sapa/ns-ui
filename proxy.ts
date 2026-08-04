// Next 16 renamed `middleware.ts` to `proxy.ts` (same export shape; the
// build compiles it back to `middleware.js` internally). §6.4 is explicit
// that this file is "the single likeliest way to break this site": the
// owner's other Convex Auth setup (`marketmyapp/src/proxy.ts:28-32`) uses a
// deny-list matcher that runs on essentially every route, which would put
// `convexAuthNextjsMiddleware` — and therefore a possible `Set-Cookie` — on
// `/`, `/preview/<name>/embed` and `/r/<slug>.json`, exactly the cached,
// anonymous, CDN-served set `docs/perf-audit-2026-07.md` measured.
//
// So the matcher here is the opposite shape: an explicit allowlist of the
// six auth-bearing route groups, and nothing else. `/u/(.*)` is deliberately
// absent — §8.1 keeps that route anonymous-only forever, and putting it on
// this matcher is exactly how it would quietly acquire a cookie read. B3
// asserts this array by reading the file; B4-B6 assert the observable
// effect (no Set-Cookie, no vary: cookie) on the routes left off it.
import { convexAuthNextjsMiddleware } from "@convex-dev/auth/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

// Wave 4 gate, A1: an anonymous `GET /api/saves` was measuring 400-450ms —
// real server time, not network (`time_connect` ~30ms on the same
// requests) — because the route is dynamic, so even a request that only
// gets told "no" pays a full serverless function invocation. That's also
// the request an abusive client sends most often.
//
// This is a FAST PATH, not the security boundary — §6.4 spends four pages
// on why middleware must not become the thing standing between an
// anonymous caller and the data. The route handler (`app/api/saves/route.ts`)
// keeps its own complete, unchanged auth check; this only short-circuits
// the one case that's unambiguous at the edge: no auth cookie present at
// all. It never parses or trusts a cookie's contents — presence is the
// only signal read here — and the 401 body/shape below is identical to the
// route's own `{ error: "unauthenticated" }` so nothing above can tell a
// request rejected here apart from one rejected in the route.
//
// Cookie-name/prefix logic mirrors `@convex-dev/auth`'s own
// `dist/server/utils.js` (`isLocalHost`) and
// `dist/nextjs/server/cookies.js:21-22` (prefix gated on that check) —
// not re-derived, copied so the two never drift silently.
const SAVES_PATHNAME = "/api/saves";
// Anchored (finding #4, LOW — same fix as `lib/submit-oauth-cookies.ts`'s
// own copy, and kept duplicated on purpose per that file's own comment on
// why this isn't factored into a shared import: this file runs in the
// middleware/Edge runtime and must not gain a dependency on anything that
// could pull in a Node-only module transitively). Unanchored, a `Host` of
// `localhost:3000.evil.example` matched as a substring, misclassifying a
// non-local request as local. Read from installed `@convex-dev/auth@0.0.94`
// — `dist/server/utils.js`'s own `isLocalHost` is ALSO unanchored, so this
// file's comment above claiming to mirror it was correct about the source
// but the source itself has the same gap; anchoring our copy regardless
// since we control it. Behavior is unchanged for every host string that
// matched before — only the substring-match case is now rejected.
const LOCALHOST_HOST = /^(localhost|127\.0\.0\.1):\d+$/;

function authCookiePresent(request: NextRequest): boolean {
  const isLocal = LOCALHOST_HOST.test(request.headers.get("host") ?? "");
  const cookieName = (isLocal ? "" : "__Host-") + "__convexAuthJWT";
  return request.cookies.has(cookieName);
}

export default convexAuthNextjsMiddleware((request) => {
  if (request.nextUrl.pathname !== SAVES_PATHNAME) {
    // Every other allowlisted route (`/api/auth`, `/api/me`, `/account`,
    // `/welcome`, `/submit`) is untouched: returning nothing here falls
    // through to the library's own default `NextResponse.next()`.
    return;
  }
  if (!authCookiePresent(request)) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  // Cookie present — no verdict at the edge either way; the route handler
  // does the real check.
  return;
});

export const config = {
  matcher: [
    "/api/auth(.*)",
    "/api/me",
    // Same reason as /api/me: the route reads the session cookie via
    // convexAuthNextjsToken(), so the middleware's cookie handling has to
    // reach it. Adding a route here is never routine - it is the one list
    // standing between the CDN-cached catalog and a Set-Cookie - but this is
    // an auth-bearing API route that serves nothing anonymous, so it belongs
    // on the same footing as /api/me rather than off the list.
    "/api/avatar",
    "/api/saves",
    "/account(.*)",
    "/welcome",
    "/submit(.*)",
  ],
};
