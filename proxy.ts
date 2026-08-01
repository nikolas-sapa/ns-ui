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

export default convexAuthNextjsMiddleware();

export const config = {
  matcher: [
    "/api/auth(.*)",
    "/api/me",
    "/api/saves",
    "/account(.*)",
    "/welcome",
    "/submit(.*)",
  ],
};
