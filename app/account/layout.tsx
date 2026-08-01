// Server half of the auth provider pair. `ConvexAuthNextjsServerProvider` is
// an async, cookie-reading server component (§6.4's "related trap") — it
// belongs here, nested under `/account`, and nowhere near `app/layout.tsx`
// (B2 greps the root layout and `site-shell.tsx` for exactly this import and
// requires zero matches, per non-goal #4/#11).
//
// `storage="inMemory"` is the §6.1 mitigation: it suppresses the
// `localStorage` mirror (A11). §6.1a documents the cost — the client-side
// auth-state hook never settles under this mode — which is why nothing
// under `/account` may use it (A27) and why this page's signed-in state is
// derived from `isAuthenticatedNextjs()` on the server instead.
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import type { ReactNode } from "react";
import { ConvexAccountProvider } from "@/app/_components/convex-account-provider";

export default async function AccountLayout({
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
