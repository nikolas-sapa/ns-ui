// `/welcome` — §8.3's onboarding, capped at two steps. Dynamic, `no-store`,
// already on the `proxy.ts` allowlist.
//
// Deliberately mounts NO Convex client here — unlike `/account`, this route
// never calls `useAuthActions`/`useConvexAuth` client-side; the handle claim
// and profile-fields writes both go through `/api/profile` (browser -> our
// origin -> Convex, same shape as `/api/saves`, §6.1). That keeps this route
// off the `ConvexAuthNextjsServerProvider`/`storage="inMemory"` machinery
// entirely — one less place for the §6.1a stale-closure constraint to apply,
// and `convex/react` out of one more bundle. `AccountLayout`
// (`app/account/layout.tsx`) is NOT reused here for that reason: it exists
// specifically to mount the provider pair, which this route doesn't need.
//
// Signed-in state comes from `isAuthenticatedNextjs()` on the server —
// §6.1a's rule, same as `app/account/page.tsx`.
import { redirect } from "next/navigation";
import {
  convexAuthNextjsToken,
  isAuthenticatedNextjs,
} from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { WelcomeForm } from "@/app/_components/welcome-form";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata = {
  robots: { index: false, follow: false },
};

// §8.3: "Normalize the candidate: lowercase, drop everything outside
// [a-z0-9-], collapse repeated hyphens, trim leading/trailing hyphens,
// truncate to 30." This is the PRE-FILL candidate only — `claimHandle`
// (convex/profiles.ts) validates whatever is actually submitted and never
// trusts this function's output as pre-validated.
function normalizeHandleCandidate(raw: string): string {
  const lowered = raw.toLowerCase().replace(/[^a-z0-9-]/g, "");
  const collapsed = lowered.replace(/-{2,}/g, "-");
  const trimmed = collapsed.replace(/^-+|-+$/g, "");
  return trimmed.slice(0, 30);
}

export default async function WelcomePage() {
  const authed = await isAuthenticatedNextjs();
  if (!authed) redirect("/account");

  const token = await convexAuthNextjsToken();
  const [viewer, profile] = await Promise.all([
    fetchQuery(api.users.viewer, {}, { token }),
    fetchQuery(api.profiles.mine, {}, { token }),
  ]);

  // Already claimed — §8.3's handle prompt only "reappears until it is
  // answered"; once answered, `/welcome` has nothing left to gate. Step 2 is
  // reachable from `/account` at any time, so there is no case where a
  // signed-in user with a handle needs to be sent back through this page.
  if (profile?.handle) redirect("/account");

  // GitHub's raw `login` isn't separately exposed by the installed
  // `@auth/core` GitHub provider once a display name is set — it maps
  // `users.name` to `profile.name ?? profile.login` (verified:
  // `node_modules/@auth/core/providers/github.js:108`), so this repo has no
  // stored field that is reliably "the login" once a name exists. The email
  // local part is available for every provider (GitHub, Google, OTP all
  // require an email), so it's used uniformly here rather than adding a
  // GitHub-only code path that only sometimes has better data. Flagged to
  // team-lead as a deliberate deviation from §8.3's literal "GitHub login or
  // email local part" wording — see task report.
  const emailLocalPart = viewer?.email?.split("@")[0] ?? "";
  const candidate = normalizeHandleCandidate(
    viewer?.displayName || emailLocalPart,
  );

  return (
    <main className="mx-auto flex max-w-md flex-col items-center px-6 py-16">
      <h1 className="text-xl font-medium text-foreground">Welcome</h1>
      <p className="mt-2 text-center text-sm text-muted">
        Pick a handle. Everything else is optional.
      </p>
      <div className="mt-8">
        <WelcomeForm candidateHandle={candidate} />
      </div>
    </main>
  );
}
