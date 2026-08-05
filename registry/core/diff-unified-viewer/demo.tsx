"use client";

import { useMemo } from "react";
import { SeamDiff } from "./component";

const DIFF = `diff --git a/src/lib/rate-limiter.ts b/src/lib/rate-limiter.ts
index 4b1f9a2..7c3e881 100644
--- a/src/lib/rate-limiter.ts
+++ b/src/lib/rate-limiter.ts
@@ -1,17 +1,21 @@ export interface RateLimiterOptions {
 export interface RateLimiterOptions {
   windowMs: number;
   max: number;
+  keyPrefix?: string;
 }

 export class RateLimiter {
   private hits = new Map<string, number[]>();
+  private readonly prefix: string;

   constructor(private options: RateLimiterOptions) {
+    this.prefix = options.keyPrefix ?? "rl";
   }

-  check(key: string): boolean {
-    const now = Date.now();
-    const bucket = this.hits.get(key) ?? [];
+  check(rawKey: string): boolean {
+    const key = \`\${this.prefix}:\${rawKey}\`;
+    const now = Date.now();
+    const bucket = this.hits.get(key) ?? [];
     const cutoff = now - this.options.windowMs;
     const recent = bucket.filter((t) => t > cutoff);

@@ -18,7 +22,7 @@ export class RateLimiter {
     return true;
   }

-  reset(key: string): void {
-    this.hits.delete(key);
+  reset(rawKey: string): void {
+    this.hits.delete(\`\${this.prefix}:\${rawKey}\`);
   }
 }
`;

function AnnotationCard({
  kind,
  children,
}: {
  kind: "ai" | "review" | "suggestion";
  children: React.ReactNode;
}) {
  const label = kind === "ai" ? "Agent review" : kind === "review" ? "Comment · @priya" : "Suggested edit";
  return (
    <div className="rounded-sm border border-border bg-background px-3 py-2 text-[13px] leading-5 text-foreground">
      <p className="mb-1 font-mono text-[11px] uppercase tracking-wide text-ns-muted">{label}</p>
      <div className="text-[13px]">{children}</div>
    </div>
  );
}

export default function SeamDiffDemo() {
  const widgets = useMemo(
    () => ({
      // added line: `  keyPrefix?: string;`
      n4: (
        <AnnotationCard kind="ai">
          Consider documenting this with a JSDoc comment, since it changes the
          public options shape callers pass in.
        </AnnotationCard>
      ),
      // deleted line: `-  check(key: string): boolean {`
      o12: (
        <AnnotationCard kind="review">
          Renaming the param to <code className="font-mono text-[12px]">rawKey</code> here reads
          well, but check callers of <code className="font-mono text-[12px]">check()</code> outside
          this file too.
        </AnnotationCard>
      ),
      // added line: `+    const key = `${this.prefix}:${rawKey}`;`
      n16: (
        <AnnotationCard kind="suggestion">
          <p className="mb-2">
            Guard against an empty <code className="font-mono text-[12px]">rawKey</code> so the
            derived key can never collide with the bare prefix.
          </p>
          <button
            type="button"
            className="rounded-sm border border-border px-2.5 py-1 font-mono text-[11px] text-foreground outline-none transition-colors hover:bg-foreground/[0.06] focus-visible:ring-2 focus-visible:ring-ns-accent"
          >
            Apply suggestion
          </button>
        </AnnotationCard>
      ),
    }),
    []
  );

  return (
    <main className="flex min-h-screen flex-col items-center gap-8 bg-background px-6 py-16 text-foreground">
      <div className="flex w-full max-w-3xl flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-ns-muted">ns-ui / diff-unified-viewer</p>
        <h1 className="text-2xl font-semibold tracking-tight">Pull request #482 — rate limiter</h1>
        <p className="max-w-xl text-sm text-ns-muted">
          Left-rail markers stand in for red/green: a solid bar for additions, a
          hairline hatch for deletions, both derived from the same ink. Any
          line can carry a widget — an agent&apos;s review note, a teammate&apos;s
          comment, or a suggested edit with its own controls.
        </p>
      </div>

      <div className="w-full max-w-3xl">
        <SeamDiff
          diff={DIFF}
          widgets={widgets}
          ariaLabel="Diff for src/lib/rate-limiter.ts"
        />
      </div>
    </main>
  );
}
