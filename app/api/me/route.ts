// `/api/me` — `{ signedIn, handle, displayName }` or `{ signedIn: false }`
// (§5 step 8, §7.3). Dynamic, on our own origin, in the `proxy.ts` allowlist
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
  });
}
