// `/api/testimonials/moderate` — owner-only review queue and approve/reject.
// Same boundary as every other write on this origin (§6.1): the browser never
// holds a usable Convex token, so this reads the `__Host-` cookie server-side
// and calls Convex with an authed server client.
//
// Authorization is NOT decided here. `convex/testimonials.ts` re-derives the
// caller and re-checks `OWNER_EMAILS` inside each function (§6.3 — those are
// public endpoints reachable without this route). This handler only maps the
// resulting error codes onto HTTP status codes.
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { ConvexError } from "convex/values";
import { NextResponse, type NextRequest } from "next/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export const dynamic = "force-dynamic";

function originIsAllowed(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  return origin === request.nextUrl.origin;
}

function codeOf(error: unknown): string | null {
  if (!(error instanceof ConvexError)) return null;
  const data = error.data as { code?: unknown } | null;
  return typeof data?.code === "string" ? data.code : null;
}

/** A non-owner and a signed-out caller both get a plain 403/401 with no body
 *  detail — the response must not reveal that a moderation queue exists. */
function mapError(error: unknown): NextResponse | null {
  const code = codeOf(error);
  if (code === "not_authenticated") {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (code === "not_authorized") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (code === "not_found") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return null;
}

export async function GET() {
  const token = await convexAuthNextjsToken();
  if (!token) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  try {
    const rows = await fetchQuery(api.testimonials.queue, {}, { token });
    return NextResponse.json({ rows });
  } catch (error) {
    const mapped = mapError(error);
    if (mapped) return mapped;
    throw error;
  }
}

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
  const { id, action } = (body ?? {}) as { id?: unknown; action?: unknown };
  if (typeof id !== "string" || (action !== "approve" && action !== "reject")) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    const fn =
      action === "approve" ? api.testimonials.approve : api.testimonials.reject;
    const result = await fetchMutation(
      fn,
      { id: id as Id<"testimonials"> },
      { token },
    );
    return NextResponse.json(result);
  } catch (error) {
    const mapped = mapError(error);
    if (mapped) return mapped;
    throw error;
  }
}
