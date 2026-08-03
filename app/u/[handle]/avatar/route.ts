// `/u/<handle>/avatar` — the anonymous, same-origin avatar proxy for a
// PUBLIC profile page (§8.2/A26: never make a stranger's browser fetch
// `avatars.githubusercontent.com`/`lh3.googleusercontent.com` directly —
// that leaks every viewer's IP to the provider on every profile view).
//
// Deliberately a near-duplicate of `app/api/avatar/route.ts` rather than a
// shared helper: that route resolves the SIGNED-IN caller's own image from
// their session cookie; this one resolves a HANDLE's image with no cookie
// read at all and gates on `profiles.isPublic` (via
// `convex/profiles.ts`'s `publicAvatarSource`) instead of an auth token.
// Different trust boundary, so a shared function would need a boolean flag
// threading through it to tell the two apart — not worth it for a ~90-line
// file already following the "small enough to stay in sync by inspection"
// precedent `app/api/profile/route.ts` sets for `originIsAllowed`.
//
// Same privacy shape as the page itself: a private profile and an unclaimed
// handle both resolve to `null` from `publicAvatarSource` and both produce
// the same empty 404 here — never a different response that would make
// this route a second handle-enumeration oracle next to the page it backs.
//
// Input contract: only the `handle` route param. No query parameters, no
// caller-supplied URL — this can only ever fetch the URL Convex already has
// on file for that handle's `users.image`, exactly like `/api/avatar`'s own
// comment states for its own (different) trust boundary.
import { fetchQuery } from "convex/nextjs";
import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";

export const dynamic = "force-dynamic";

const ALLOWED_HOSTS = new Set([
  "avatars.githubusercontent.com",
  "lh3.googleusercontent.com",
]);

const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  "image/png": "image/png",
  "image/jpeg": "image/jpeg",
  "image/gif": "image/gif",
  "image/webp": "image/webp",
};

const FETCH_TIMEOUT_MS = 5_000;
const MAX_BYTES = 2 * 1024 * 1024;

function empty404() {
  return new NextResponse(null, { status: 404 });
}

function isAllowedUrl(candidate: string): URL | null {
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname)) return null;
  return url;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ handle: string }> },
) {
  const { handle } = await params;

  // Same gate as `publicProfile` (§8.1): private profile and unclaimed
  // handle are indistinguishable, both 404.
  const image = await fetchQuery(api.profiles.publicAvatarSource, { handle });
  if (image === null) return empty404();

  const upstreamUrl = isAllowedUrl(image);
  if (upstreamUrl === null) return empty404();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    let upstream = await fetch(upstreamUrl, {
      signal: controller.signal,
      redirect: "manual",
      headers: { accept: "image/*" },
    });

    if (upstream.status >= 300 && upstream.status < 400) {
      const location = upstream.headers.get("location");
      if (!location) return empty404();
      const redirectTarget = isAllowedUrl(new URL(location, upstreamUrl).toString());
      if (redirectTarget === null) return empty404();
      upstream = await fetch(redirectTarget, {
        signal: controller.signal,
        redirect: "manual",
        headers: { accept: "image/*" },
      });
      if (upstream.status >= 300 && upstream.status < 400) return empty404();
    }

    if (!upstream.ok || !upstream.body) return empty404();

    const upstreamType =
      upstream.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
    const contentType = ALLOWED_CONTENT_TYPES[upstreamType];
    if (!contentType) return empty404();

    const reader = upstream.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel();
        return empty404();
      }
      chunks.push(value);
    }

    return buildResponse(chunks, total, contentType);
  } catch {
    return empty404();
  } finally {
    clearTimeout(timeout);
  }
}

function buildResponse(chunks: Uint8Array[], total: number, contentType: string) {
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": contentType,
      // `private`, NOT `public` — and the distinction is the whole point.
      // "Same bytes for every caller" and "bytes that are still authorized"
      // are different properties, and only the first one is true here. The
      // `isPublic` gate above is a REVOCABLE authorization checked at fetch
      // time: unpublishing the last collection, or deleting the account
      // (§6.7), makes a fresh request 404 — but a `public` entry already
      // sitting in a shared/CDN cache would keep serving the avatar for the
      // rest of its TTL, outliving the revocation that was supposed to stop
      // it. `private` keeps the cache in the one browser that already saw
      // the image, and `must-revalidate` makes it re-ask rather than serve
      // stale, so revocation takes effect on the next request everywhere
      // that matters. Same reasoning and same directives as `/api/avatar`.
      "cache-control": "private, max-age=3600, must-revalidate",
    },
  });
}
