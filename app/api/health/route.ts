// `/api/health` — a URL that goes red when Convex is unreachable. `/community`
// deliberately degrades to the seed list on an outage (see that page), so the
// only externally visible signal of a dead backend is this route.
//
// It calls the same public `testimonials.approved` query `/community` uses,
// with no token, so it exercises the real read path rather than a synthetic
// ping. The body carries a boolean and the error message and nothing else.
import { fetchQuery } from "convex/nextjs";
import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await fetchQuery(api.testimonials.approved, {});
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("health: convex unreachable", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 503 });
  }
}
