// `/api/testimonials` — POST on our own origin, reading the `__Host-`
// session cookie server-side and calling Convex with an authed server
// client (§6.1's "Consequence for the data path"). The browser never holds a
// usable Convex token, so a submission never goes browser → Convex directly.
//
// `/community` also does not mount `ConvexAccountProvider` (only
// `app/account/layout.tsx` does), so there is no client-side Convex client on
// that route to call a mutation with even if §6.1 allowed it.
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { ConvexError } from "convex/values";
import { NextResponse, type NextRequest } from "next/server";
import { api } from "@/convex/_generated/api";

export const dynamic = "force-dynamic";

// §6.5, mirroring `/api/saves`: `SameSite=Lax` already blocks classic
// cross-site CSRF on POST, but a same-origin frame — or a browser not
// enforcing SameSite — can still carry the cookie, so every state-changing
// request validates `Origin` against exactly this origin and rejects a
// missing `Origin` too. No CORS header is ever set here, on any path.
function originIsAllowed(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  return origin === request.nextUrl.origin;
}

// The mutation is the enforcement point (§6.3) — it re-validates and re-scores
// everything. This map only turns its stable `ConvexError` codes into honest
// status codes so a rejected submission isn't reported as a generic 500.
const VALIDATION_CODES = new Set([
  "empty_name",
  "empty_role",
  "empty_company",
  "empty_quote",
  "name_too_long",
  "quote_too_long",
  "url_too_long",
  "invalid_url",
  "unsupported_url_protocol",
]);

function errorCode(error: unknown): string | null {
  if (!(error instanceof ConvexError)) return null;
  const data = error.data as { code?: unknown } | null;
  return typeof data?.code === "string" ? data.code : null;
}

/** Exactly the mutation's argument shape. Declared explicitly so an extra key
 *  in the request body can never reach Convex — `status`, `spamScore` and
 *  `spamFlags` are server-decided and must not be settable by a caller. */
type SubmissionArgs = {
  name: string;
  role: string;
  company: string;
  profileUrl: string;
  quote: string;
  photoUrl?: string;
};

export async function POST(request: NextRequest) {
  // Auth before Origin, so an unauthenticated cross-origin probe gets the
  // same fast 401 an unauthenticated same-origin one does.
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
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  const text = (key: string): string | undefined => {
    const value = record[key];
    return typeof value === "string" && value !== "" ? value : undefined;
  };

  const name = text("name");
  const role = text("role");
  const company = text("company");
  const profileUrl = text("profileUrl");
  const quote = text("quote");
  const photoUrl = text("photoUrl");

  if (!name) return NextResponse.json({ error: "empty_name" }, { status: 400 });
  if (!role) return NextResponse.json({ error: "empty_role" }, { status: 400 });
  if (!company) return NextResponse.json({ error: "empty_company" }, { status: 400 });
  if (!profileUrl) return NextResponse.json({ error: "invalid_url" }, { status: 400 });
  if (!quote) return NextResponse.json({ error: "empty_quote" }, { status: 400 });

  const args: SubmissionArgs = {
    name,
    role,
    company,
    profileUrl,
    quote,
    ...(photoUrl ? { photoUrl } : {}),
  };

  try {
    await fetchMutation(api.testimonials.submit, args, { token });
  } catch (error) {
    const code = errorCode(error);
    if (code === "not_authenticated") {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    if (code === "rate_limited") {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
    if (code !== null && VALIDATION_CODES.has(code)) {
      return NextResponse.json({ error: code }, { status: 400 });
    }
    throw error;
  }

  // Deliberately returns the moderation state and nothing else: never the
  // spam score or flags, which would tell a submitter exactly which rule to
  // sidestep on the next attempt.
  return NextResponse.json({ status: "pending" }, { status: 201 });
}
