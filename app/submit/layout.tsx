// Server half of the auth provider pair, same shape as
// `app/account/layout.tsx` — `/submit` is the third and last route allowed
// to mount the Convex auth client (§6.1, §7.3, updated by Phase C). Never
// `app/layout.tsx` (B2), and this page's own signed-in state is still
// derived server-side via `isAuthenticatedNextjs()` (`app/submit/page.tsx`),
// never the client-side auth-state hook (§6.1a, A27 — A27's grep asserts
// zero matches for that hook's literal name anywhere under `app/`, so it is
// deliberately not spelled out even in this comment) — this layout only
// exists to give `SubmitSignedOut`'s `useAuthActions()` call somewhere to
// dispatch into.
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import type { ReactNode } from "react";
import { ConvexAccountProvider } from "@/app/_components/convex-account-provider";

export default async function SubmitLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ConvexAuthNextjsServerProvider storage="inMemory">
      <ConvexAccountProvider>{children}</ConvexAccountProvider>
    </ConvexAuthNextjsServerProvider>
  );
}
