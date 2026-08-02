// `/api/me` — `{ signedIn, handle, displayName, hasImage }` or
// `{ signedIn: false }` (§5 step 8, §7.3). Dynamic, on our own origin, in
// the `proxy.ts` allowlist
// so the middleware's cookie handling reaches it — never on a cached
// catalog route.
//
// The unauthenticated path never touches Convex: `convexAuthNextjsToken()`
// only reads the request cookie (no network hop), so "no cookie" returns
// `{ signedIn: false }` without a round trip.
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = await convexAuthNextjsToken();
  if (!token) {
    return NextResponse.json({ signedIn: false });
  }

  const viewer = await fetchQuery(api.users.viewer, {}, { token });
  if (viewer === null) {
    return NextResponse.json({ signedIn: false });
  }

  return NextResponse.json({
    signedIn: true,
    handle: viewer.handle,
    displayName: viewer.displayName,
    // Never the provider URL itself (that's exactly what `/api/avatar`
    // exists to keep off the client) — just whether one exists, so the
    // client knows whether to point an <img> at `/api/avatar` or fall
    // back to the initial-letter badge.
    hasImage: viewer.image !== null,
  });
}
