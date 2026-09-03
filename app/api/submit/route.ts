// `/submit`'s POST endpoint (docs/community-spec.md §2 Phase C, group D).
//
// Trust boundary, in order:
//   1. Convex Auth session required (401 before Origin, matching
//      `/api/saves` and `/api/testimonials`) — identity for OUR origin.
//   2. Origin validated against exactly this origin (403), no CORS header
//      ever set, on any path (§6.5).
//   3. A second, separately-granted GitHub token required (the incremental
//      `public_repo` consent from `app/api/submit/github/{authorize,
//      callback}`) — identity for GITHUB. Missing it is answered with a
//      distinct code (`github_not_connected`) rather than 401, since the
//      caller IS authenticated to us; they just haven't finished the
//      second consent yet.
//   3a. Security-review finding #1 (HIGH): that token cookie alone is not
//      bound to any Convex identity — a Convex sign-out only clears the
//      `__Host-` cookies (a different name/path this cookie has no
//      relationship to), so it would otherwise survive into whichever
//      identity signs in next on the same browser within its 1h lifetime.
//      `resolveGithubToken` below re-derives the CALLER'S OWN `userId` from
//      their live Convex session (never a caller-supplied id — §6.3) and
//      checks it against an HMAC recorded in `SUBMIT_BINDING_COOKIE` at
//      connect time (`app/api/submit/github/callback/route.ts`). A mismatch
//      — including the binding cookie being entirely absent — is treated
//      exactly like "GitHub not connected" (428), which is true from this
//      identity's point of view, and clears all three submit cookies so the
//      stale token can't be retried against a THIRD identity either.
//   4. Full server-side validation (`lib/submission-validation.ts`) —
//      D1/D2's static checks run here, BEFORE any GitHub call and before
//      the Convex rate-limit mutation, so a malformed payload never
//      consumes the caller's one submission per 10 minutes.
//   5. Convex `submissions.create` — durable rate limit (D4) plus an
//      audit-trail row. Still no code reaches Convex; only slug/collection.
//   6. Only now: fork -> branch -> commit (with the DCO trailer) -> PR,
//      all via the caller's own GitHub token (lib/github-submit.ts), so
//      D3's "PR appears under the submitting user's own GitHub identity"
//      holds by construction.
//
// What a hostile caller hitting Convex directly gets: `submissions.create`
// and `submissions.complete` (convex/submissions.ts) each re-derive
// `getAuthUserId` and re-validate independently of this route (§6.3) — a
// direct caller can, at most, write themselves a metadata row with no code
// attached and no GitHub side effect, subject to the same 1-per-10-minute
// limit as everyone else. There is no exported Convex function that ever
// receives `component.tsx`/`demo.tsx` source, so there is nothing for a
// direct caller to exfiltrate or corrupt beyond their own rate-limit state.
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { ConvexError } from "convex/values";
import { NextResponse, type NextRequest } from "next/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  createBranch,
  ensureFork,
  fetchAuthenticatedLogin,
  openPullRequest,
  putFile,
  waitForForkReady,
} from "@/lib/github-submit";
import {
  asGithubBodyText,
  dcoTrailer,
  FIXED_FILENAMES,
  submissionPath,
  validateSubmission,
  type SubmissionInput,
} from "@/lib/submission-validation";
import {
  clearSubmitOAuthCookies,
  computeSubmitTokenBinding,
  SUBMIT_BINDING_COOKIE,
  SUBMIT_TOKEN_COOKIE,
  submitBindingsMatch,
} from "@/lib/submit-oauth-cookies";
import registry from "@/registry.json";

export const dynamic = "force-dynamic";

function originIsAllowed(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  return origin === request.nextUrl.origin;
}

const registrySlugs = new Set(
  (registry as { items: { name: string }[] }).items.map((i) => i.name),
);

function errorCode(error: unknown): string | null {
  if (!(error instanceof ConvexError)) return null;
  const data = error.data as { code?: unknown } | null;
  return typeof data?.code === "string" ? data.code : null;
}

type GithubTokenResult =
  | { ok: true; token: string }
  | { ok: false; response: NextResponse };

/** Finding #1's fix, isolated so GET and POST share one implementation.
 *  `convexToken` must already be known-valid (caller checked `!convexToken`
 *  first) — this re-derives the caller's own `userId` from it via a fresh
 *  Convex call rather than trusting anything client-supplied. Every
 *  rejection path here also clears the three submit cookies: a mismatched
 *  binding means the token on this browser belongs to a DIFFERENT identity
 *  than the one asking now, so there is nothing to gain by leaving it for a
 *  later request to find again. */
async function resolveGithubToken(
  request: NextRequest,
  convexToken: string,
): Promise<GithubTokenResult> {
  const githubToken = request.cookies.get(SUBMIT_TOKEN_COOKIE)?.value ?? null;
  const storedBinding = request.cookies.get(SUBMIT_BINDING_COOKIE)?.value ?? null;
  if (!githubToken || !storedBinding) {
    return {
      ok: false,
      response: NextResponse.json({ error: "github_not_connected" }, { status: 428 }),
    };
  }

  const userId = await fetchQuery(api.users.currentUserId, {}, { token: convexToken });
  if (userId === null) {
    return {
      ok: false,
      response: NextResponse.json({ error: "unauthenticated" }, { status: 401 }),
    };
  }

  let expectedBinding: string;
  try {
    expectedBinding = await computeSubmitTokenBinding(userId);
  } catch {
    // SUBMIT_TOKEN_BINDING_SECRET missing — a deployment misconfiguration,
    // never something a caller can trigger by choice of input. Fails
    // closed: never falls through to trusting the token unbound, and never
    // surfaces as a bare unhandled 500 (matches the shape
    // `authorize`/`callback` already use for their own missing-config case).
    return {
      ok: false,
      response: NextResponse.json({ error: "github_not_configured" }, { status: 500 }),
    };
  }

  if (!submitBindingsMatch(storedBinding, expectedBinding)) {
    const response = NextResponse.json({ error: "github_not_connected" }, { status: 428 });
    clearSubmitOAuthCookies(response, request.headers.get("host"));
    return { ok: false, response };
  }

  return { ok: true, token: githubToken };
}

/** Exactly the fields the form may send. Declared explicitly so an extra key
 *  in the request body (a `status`, a `prUrl`, a version field — the
 *  versioning decision requires `/submit` carry none) can never ride along
 *  toward Convex or GitHub. */
type RequestBody = {
  slug?: unknown;
  collection?: unknown;
  title?: unknown;
  description?: unknown;
  tags?: unknown;
  dependencies?: unknown;
  instruction?: unknown;
  componentSource?: unknown;
  demoSource?: unknown;
  dcoName?: unknown;
  dcoEmail?: unknown;
  dcoAgreed?: unknown;
  verifyAttested?: unknown;
};

function toStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every((item) => typeof item === "string")) return null;
  return value;
}

export async function POST(request: NextRequest) {
  const convexToken = await convexAuthNextjsToken();
  if (!convexToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  if (!originIsAllowed(request)) {
    return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
  }

  // Ordering is load-bearing: this runs BEFORE `submissions.create` (D4's
  // rate-limit mutation) so a stale/unbound token never consumes the
  // caller's one-submission-per-10-minutes slot on a request that was
  // always going to be rejected.
  const githubTokenResult = await resolveGithubToken(request, convexToken);
  if (!githubTokenResult.ok) {
    return githubTokenResult.response;
  }
  const githubToken = githubTokenResult.token;

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const tags = toStringArray(body.tags);
  const dependencies = toStringArray(body.dependencies);
  if (tags === null || dependencies === null) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const input: SubmissionInput = {
    slug: typeof body.slug === "string" ? body.slug : "",
    collection: typeof body.collection === "string" ? body.collection : "",
    title: typeof body.title === "string" ? body.title : "",
    description: typeof body.description === "string" ? body.description : "",
    tags,
    dependencies,
    instruction: typeof body.instruction === "string" ? body.instruction : "",
    componentSource: typeof body.componentSource === "string" ? body.componentSource : "",
    demoSource: typeof body.demoSource === "string" ? body.demoSource : "",
    dcoName: typeof body.dcoName === "string" ? body.dcoName : "",
    dcoEmail: typeof body.dcoEmail === "string" ? body.dcoEmail : "",
    dcoAgreed: body.dcoAgreed === true,
    verifyAttested: body.verifyAttested === true,
  };

  const validated = validateSubmission(input);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.code }, { status: 400 });
  }
  const value = validated.value;

  // D2, re-asserted at the route level in addition to the mutation's own
  // check (§6.3 — never trust a single enforcement point): a slug already
  // in the published registry can't be this submission's identity. The
  // versioning decision (docs/decisions/2026-08-03-component-versioning.md)
  // makes a new slug the ONLY way to change an existing component's
  // contract, so a collision here is always either a duplicate submission
  // or an attempted overwrite, never a legitimate update.
  if (registrySlugs.has(value.slug)) {
    return NextResponse.json({ error: "slug_already_exists" }, { status: 409 });
  }

  let submissionId: Id<"submissions">;
  try {
    const created = await fetchMutation(
      api.submissions.create,
      { slug: value.slug, collection: value.collection },
      { token: convexToken },
    );
    submissionId = created.id;
  } catch (error) {
    const code = errorCode(error);
    if (code === "not_authenticated") {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    if (code === "rate_limited") {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
    if (code === "invalid_slug") {
      return NextResponse.json({ error: "invalid_slug" }, { status: 400 });
    }
    throw error;
  }

  try {
    const login = await fetchAuthenticatedLogin(githubToken);
    const fork = await ensureFork(githubToken);
    await waitForForkReady(githubToken, fork.owner, fork.repo);

    const branch = `submit/${value.slug}`;
    await createBranch(githubToken, fork.owner, fork.repo, fork.defaultBranch, branch);

    const trailer = dcoTrailer(value.dcoName, value.dcoEmail);
    const commitMessage = `feat(${value.collection}): add ${value.slug}\n\n${trailer}`;

    const metaJson = JSON.stringify(
      {
        name: value.slug,
        title: value.title,
        description: value.description,
        collection: value.collection,
        tags: value.tags,
        instruction: value.instruction,
        dependencies: value.dependencies,
      },
      null,
      2,
    );

    const files: Record<(typeof FIXED_FILENAMES)[number], string> = {
      "component.tsx": value.componentSource,
      "demo.tsx": value.demoSource,
      "meta.json": metaJson,
    };
    for (const filename of FIXED_FILENAMES) {
      await putFile(
        githubToken,
        fork.owner,
        fork.repo,
        branch,
        submissionPath(value.collection, value.slug, filename),
        files[filename],
        commitMessage,
      );
    }

    const prBody = [
      `New component: \`${value.slug}\` (${value.collection}).`,
      "",
      // Finding #3: `description` is caller-controlled free text — fenced
      // rather than interpolated raw so a Markdown link can't present a
      // spoofed destination and an `@mention` can't page an arbitrary
      // GitHub user/team the moment this PR opens (lib/submission-
      // validation.ts's `asGithubBodyText` has the full reasoning,
      // including why it's airtight given this text has no newlines).
      asGithubBodyText(value.description),
      "",
      "**Checklist** (per CONTRIBUTING.md):",
      "- [x] Submitted via /submit: DCO sign-off captured above.",
      `- [${input.verifyAttested ? "x" : " "}] I ran \`npm run verify\` locally and it passed for this component.`,
      "- [ ] Dark and light themes both checked (maintainer/contributor to confirm before merge).",
      "- [ ] Screenshots attached to this PR (verify's local output, not uploaded through the site; non-goal #12).",
      "",
      `No version field was set on submission. This repo versions the registry, not the component ` +
        `(docs/decisions/2026-08-03-component-versioning.md). If this change would break an existing ` +
        `installed copy, the maintainer's call at review time is a new slug, not a bump here.`,
      "",
      trailer,
    ].join("\n");

    // `value.title` goes to the PR's `title` field, not `prBody` — GitHub
    // renders an issue/PR title as plain text (no Markdown, no `@mention`
    // parsing), so it carries neither injection surface finding #3 raises
    // and needs no `asGithubBodyText` treatment.
    const prUrl = await openPullRequest(
      githubToken,
      fork.owner,
      branch,
      `Add ${value.title}`,
      prBody,
    );

    await fetchMutation(
      api.submissions.complete,
      { id: submissionId, result: { status: "opened", prUrl } },
      { token: convexToken },
    );

    return NextResponse.json({ status: "opened", prUrl, login }, { status: 201 });
  } catch (error) {
    await fetchMutation(
      api.submissions.complete,
      { id: submissionId, result: { status: "failed" } },
      { token: convexToken },
    ).catch(() => {
      // Best-effort — the submission row staying "pending" forever is a
      // minor audit-trail inaccuracy, not a security issue, and must not
      // mask the real error below.
    });
    const message = error instanceof Error ? error.message : "GitHub submission failed";
    return NextResponse.json({ error: "github_submission_failed", message }, { status: 502 });
  }
}

/** Lets the client form ask "do I need to send the visitor through the
 *  GitHub consent screen before showing the submit button" without ever
 *  exposing the token itself — only whether the cookie is present AND
 *  bound to the caller's own, currently-signed-in identity. A presence-only
 *  check here (the pre-fix behavior) would tell a second user's browser
 *  "connected" off the first user's stale token, only to have the actual
 *  POST reject it with 428 anyway — so this reuses the same
 *  `resolveGithubToken` check POST does, clearing the stale cookies on a
 *  mismatch here too, rather than leaving that only to happen on submit. */
export async function GET(request: NextRequest) {
  const convexToken = await convexAuthNextjsToken();
  if (!convexToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const githubTokenResult = await resolveGithubToken(request, convexToken);
  if (!githubTokenResult.ok) {
    // 428 ("not connected", including a binding mismatch) keeps this
    // route's original 200/`{ githubConnected: false }` contract rather
    // than surfacing the 428 itself — this endpoint has never returned
    // anything but 200 or the unauthenticated 401 above, and the client
    // form only reads the boolean. Cookies are cleared regardless of
    // whether there was anything to clear (idempotent either way) so a
    // stale/mismatched token doesn't wait for an actual POST to be swept.
    // Any other failure (401 from a token that stopped resolving between
    // the check above and now, or 500 from a missing binding secret) is
    // propagated as-is.
    if (githubTokenResult.response.status === 428) {
      const response = NextResponse.json({ githubConnected: false });
      clearSubmitOAuthCookies(response, request.headers.get("host"));
      return response;
    }
    return githubTokenResult.response;
  }
  return NextResponse.json({ githubConnected: true });
}
