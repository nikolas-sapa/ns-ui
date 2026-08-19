"use client";

import { Suspense } from "react";
import { demos } from "@/registry/index";

/**
 * Resolves `demos[name]` on the client rather than in the server-rendered
 * `DemoFrame`/`EmbedPreviewPage` tree.
 *
 * Why this file exists: `demos` is a `Record<string, ComponentType>` built
 * from 389 `lazy(() => import(...))` entries (see `registry/index.tsx`,
 * generated). When a Server Component picked `demos[name]` with a runtime
 * key, Next's client-reference-manifest had no way to know which of the 389
 * lazy targets that Server Component would actually render — so it treated
 * all 389 as reachable client references and shipped them eagerly in one
 * ~3MB chunk on every single `/preview/<name>` and `/preview/<name>/embed`
 * request, i.e. every landing-page card iframe (measured: `"async": false`
 * for every demo module in `page_client-reference-manifest.js`, all pointing
 * at the same three chunk files).
 *
 * Moving the `demos[name]` lookup into a Client Component fixes it: the 389
 * `import()` calls now live in client-side code, where Turbopack has reason
 * to code-split them into genuinely on-demand async chunks — a visitor only
 * downloads the one demo their route actually needs. The lookup itself still
 * runs during SSR (Client Components render on the server too), so initial
 * HTML is unchanged: real markup, not a loading placeholder, which is what
 * `scripts/verify.ts`'s blank-render and Tab-reachability checks require.
 */
export function DemoLazy({ name }: { name: string }) {
  const Demo = demos[name];
  if (!Demo) return null;
  return (
    <Suspense fallback={null}>
      <Demo />
    </Suspense>
  );
}
