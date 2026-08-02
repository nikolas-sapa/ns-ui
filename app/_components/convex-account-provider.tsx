"use client";

// Client half of the auth provider pair for `/account` and `/welcome` — the
// only two routes in Phase A that mount the Convex auth client (§6.1,
// §7.3). `storage="inMemory"` is set on `ConvexAuthNextjsServerProvider`,
// the server half in `app/account/layout.tsx`; that prop does NOT forward
// through this client component (§6.1's own caution: `ConvexAuthNextjsProvider`
// — `dist/nextjs/index.js:31-34` — takes only `client` and `children`).
//
// This mounts `convex/react` and `ConvexReactClient`, which is why it must
// never be imported from anything the catalog bundle reaches — B9 asserts
// zero `convex/react` in `/`'s JS.
import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexAccountProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexAuthNextjsProvider client={convex}>
      {children}
    </ConvexAuthNextjsProvider>
  );
}
