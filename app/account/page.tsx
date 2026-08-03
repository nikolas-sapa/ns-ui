// §6.1a's load-bearing rule: signed-in state here comes from the server —
// `isAuthenticatedNextjs()` — never from the client-side auth-state hook.
// A27 greps `app/` for that hook's name and requires zero matches.
//
// The three Convex round trips (`api.users.viewer`, `api.profiles.mine`,
// `api.saves.library`) run in `iad1` while the edge is `fra1`
// (`docs/perf-audit-2026-07.md`). They're pushed into `_account-data.tsx`
// behind a `Suspense` boundary so the page shell can paint before those
// queries resolve — this fixes FCP, not TTFB (TTFB is the auth check +
// initial server response, which was already fast; the Convex latency
// this change hides was always paint-blocking, never TTFB-blocking).
import { Suspense } from "react";
import { isAuthenticatedNextjs } from "@convex-dev/auth/nextjs/server";
import { AccountSignedOut } from "@/app/_components/account-signed-out";
import { AccountData } from "@/app/account/_account-data";
import { AccountSkeleton } from "@/app/account/_account-skeleton";

export const dynamic = "force-dynamic";

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const authed = await isAuthenticatedNextjs();

  if (!authed) {
    return <AccountSignedOut />;
  }

  return (
    <Suspense fallback={<AccountSkeleton />}>
      <AccountData />
    </Suspense>
  );
}
