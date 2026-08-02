// `/api/avatar` — same-origin avatar proxy (docs/community-spec.md §8.2,
// test A26). GitHub/Google hand `users.image` back as a raw
// `avatars.githubusercontent.com` / `lh3.googleusercontent.com` URL;
// rendering that URL directly would make every viewer's browser fetch it
// from that third party on every page load, leaking who is browsing this
// site and when. This route fetches the bytes server-side and serves them
// from our own origin instead.
//
// Input contract: none. No query parameters, no caller-supplied URL — a
// route that accepts `?url=` is an open SSRF proxy that will fetch
// anything, internal addresses included. The only image this route will
// ever request is the signed-in caller's own `users.image`, resolved
// server-side from the session cookie exactly like `/api/me` resolves
// `viewer`. There is nothing here for a caller to redirect elsewhere.
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";

export const dynamic = "force-dynamic";

// Exact hostname match, not a suffix check — `.endsWith("githubusercontent.com")`
// would also pass `evil-githubusercontent.com`. https only.
const ALLOWED_HOSTS = new Set([
  "avatars.githubusercontent.com",
  "lh3.googleusercontent.com",
]);

// What we'll actually serve `Content-Type` as, keyed by what the upstream
// claims — our own values, never echoed from upstream, and only these four
// pass at all. Anything else (including an upstream error page served as
// `text/html`) fails the check below.
const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  "image/png": "image/png",
  "image/jpeg": "image/jpeg",
  "image/gif": "image/gif",
  "image/webp": "image/webp",
};

const FETCH_TIMEOUT_MS = 5_000;
const MAX_BYTES = 2 * 1024 * 1024; // real avatars are tens of KB; this is generous headroom

// Every failure path — no session, no image, disallowed host, timeout,
// oversized body, wrong content-type, network error — lands here. Same
// empty 404 either way: never reflect an upstream error body or upstream
// headers to the caller, and never let a broken image or a 500 reach the
// client. The initial-letter badge is the fallback for all of these.
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

export async function GET() {
  const token = await convexAuthNextjsToken();
  if (!token) return empty404();

  const viewer = await fetchQuery(api.users.viewer, {}, { token });
  if (viewer === null || !viewer.image) return empty404();

  const upstreamUrl = isAllowedUrl(viewer.image);
  if (upstreamUrl === null) return empty404();

  // One timeout for the whole operation — fetch *and* body read — not just
  // the initial connect. Clearing it as soon as headers arrive would leave
  // the streaming read below with no deadline at all.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    // `manual` rather than `error`: a redirect straight off the allowlist
    // is still refused below, but this lets a same-allowlist redirect
    // (e.g. avatars.githubusercontent.com issuing one to itself) through
    // without silently trusting where it points. One hop, re-validated
    // against the exact same allowlist check as the original URL — never
    // chased past that.
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
      // A second redirect is refused outright rather than followed again.
      if (upstream.status >= 300 && upstream.status < 400) return empty404();
    }

    if (!upstream.ok || !upstream.body) return empty404();

    const upstreamType =
      upstream.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
    const contentType = ALLOWED_CONTENT_TYPES[upstreamType];
    if (!contentType) return empty404();

    // Stream with a hard cap instead of buffering an unbounded body — a
    // malicious or misbehaving host advertising a small Content-Type but
    // sending gigabytes is still bounded here.
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
      // Cached in the browser, not in any shared cache — this response is
      // only ever reachable behind the session cookie the middleware reads
      // (see proxy.ts), so `private` keeps a CDN/proxy from pooling one
      // caller's bytes under a shared key. `max-age` is what keeps this to
      // one fetch per day per visitor instead of one per page view.
      "cache-control": "private, max-age=86400, must-revalidate",
    },
  });
}
