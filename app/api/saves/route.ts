// `/api/saves` — GET/POST/DELETE on our own origin, reading the `__Host-`
// session cookie server-side and calling Convex with an authed server
// client (§6.1's "Consequence for the data path"). The browser never holds
// a usable Convex token, so saves never go browser → Convex directly.
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { ConvexError } from "convex/values";
import { NextResponse, type NextRequest } from "next/server";
import { api } from "@/convex/_generated/api";
// Same source `app/page.tsx:26` and `convex/saves.ts` read — one slug list,
// not a second one (A7).
import registry from "@/registry.json";

export const dynamic = "force-dynamic";

const registrySlugs = new Set(
  (registry as { items: { name: string }[] }).items.map((i) => i.name),
);

// §6.5: `SameSite=Lax` on the `__Host-` cookies already blocks classic
// cross-site CSRF on POST/DELETE for a normal cross-site navigation, but a
// same-origin frame — or a browser that doesn't enforce SameSite — can still
// carry the cookie. On top of it, every state-changing request here
// validates `Origin` against exactly this origin, rejecting a missing
// `Origin` too (A14). This never sets any CORS header, so there is no
// `Access-Control-Allow-Origin` for any origin, permissive or not.
function originIsAllowed(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  return origin === request.nextUrl.origin;
}

// A13: 100 POSTs in 10s on one session must see 429 by the 31st, with at
// most 30 documents written. The count-and-check itself is NOT here — an
// in-memory `Map` in a route handler is per-serverless-instance, so on
// Vercel it silently multiplies the cap by however many instances happen to
// be warm and resets on every cold start. It lives in
// `convex/saves.ts`/`checkAndRecordSaveRateLimit`, inside the same
// serializable mutation as the write it guards, backed by the durable
// `saveRateLimits` table (schema.ts). This helper only recognizes that
// outcome and maps it to 429 instead of a generic 500 — so a rate-limited
// caller is told "try again shortly", not "your save failed".
function isRateLimitError(error: unknown): boolean {
  if (
    error instanceof ConvexError &&
    typeof error.data === "object" &&
    error.data !== null &&
    (error.data as { code?: unknown }).code === "rate_limited"
  ) {
    return true;
  }
  // A single `saveRateLimits` row per user is a deliberate serialization
  // point — every concurrent call from the same session contends on it —
  // so a real burst (A13's scenario) can exhaust Convex's own optimistic-
  // concurrency retry budget on that row rather than reach either outcome
  // of `checkAndRecordSaveRateLimit`. Observed directly: a 100-request,
  // 25-way-concurrent burst against the real dev deployment produced a
  // handful of `OptimisticConcurrencyControlFailure`s alongside the 201s
  // and 429s. That failure means "this request lost a race for the rate
  // limit's own bookkeeping row" — telling the caller to retry (429) is the
  // conservative, honest answer; a bare 500 would violate the same rule
  // A13 exists to enforce: a rate-limited caller must not be told their
  // save failed for some unrelated reason.
  return (
    error instanceof Error &&
    error.message.includes("OptimisticConcurrencyControlFailure")
  );
}

export async function GET() {
  // A1: no cookie → 401, no user data, < 100ms. `convexAuthNextjsToken()`
  // only reads the request cookie, so this path never calls Convex.
  const token = await convexAuthNextjsToken();
  if (!token) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const slugs = await fetchQuery(api.saves.list, {}, { token });
  if (slugs === null) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  return NextResponse.json({ slugs });
}

export async function POST(request: NextRequest) {
  // A2: no cookie → 401, saves count unchanged. Checked before Origin so an
  // unauthenticated cross-origin probe gets the same fast 401 an
  // unauthenticated same-origin one does.
  const token = await convexAuthNextjsToken();
  if (!token) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  // A14: cross-origin POST with credentials is blocked, writes nothing, and
  // gets no permissive Access-Control-Allow-Origin (this handler never sets
  // one, on any path).
  if (!originIsAllowed(request)) {
    return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const slug = (body as { slug?: unknown } | null)?.slug;
  if (typeof slug !== "string" || slug.length === 0) {
    return NextResponse.json({ error: "invalid_slug" }, { status: 400 });
  }

  // A7: a slug absent from the registry is rejected here, before Convex is
  // ever called — no doc is written.
  if (!registrySlugs.has(slug)) {
    return NextResponse.json({ error: "unknown_slug" }, { status: 400 });
  }

  try {
    await fetchMutation(api.saves.add, { slug }, { token });
  } catch (error) {
    if (isRateLimitError(error)) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
    throw error;
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
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
  const slug = (body as { slug?: unknown } | null)?.slug;
  if (typeof slug !== "string" || slug.length === 0) {
    return NextResponse.json({ error: "invalid_slug" }, { status: 400 });
  }

  try {
    await fetchMutation(api.saves.remove, { slug }, { token });
  } catch (error) {
    if (isRateLimitError(error)) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
    throw error;
  }
  return NextResponse.json({ ok: true });
}
