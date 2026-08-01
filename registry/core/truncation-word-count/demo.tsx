"use client";

import { SelvageFold } from "./component";

const LONG = `The migration finished at 02:40 with zero dropped writes, but the interesting part is what did not happen. The dual-write shim stayed in place for eleven days, and in that window we diffed every row pair nightly: 14 mismatches total, all of them timestamps rounded differently by the old ORM. Nothing user-visible. The cutover itself was a single DNS flip behind the connection pooler, so rollback stayed one command away the whole time. What we'd do differently: start the nightly diffs a week earlier, and put the shim's latency cost (about 6ms p50) on a dashboard from day one instead of discovering it during review. The old cluster stays warm until Friday, then we snapshot and tear it down.`;

const MEDIUM = `Connection pooling moves to the new PgBouncer pair next sprint. The rollout mirrors this one: dual configuration for a week, nightly comparisons of connection counts and wait times, and a one-command rollback path via the load balancer. The only open question is whether the analytics batch jobs keep their dedicated pool or share the general one; benchmarks land Thursday and will settle it.`;

const SHORT = `Read replicas come next quarter. No schema changes planned before then.`;

export default function SelvageFoldDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg">
        <p className="mb-4 font-mono text-xs tracking-widest text-muted">
          ns-ui / selvage-fold
        </p>
        <div className="rounded-md border border-border bg-surface">
          <header className="border-b border-border px-5 py-3">
            <span className="font-mono text-xs tracking-widest text-muted">
              CHANGELOG · DB MIGRATION
            </span>
          </header>
          <div className="flex flex-col gap-5 px-5 py-5 text-sm leading-relaxed text-foreground">
            <SelvageFold lines={3}>{LONG}</SelvageFold>
            <SelvageFold lines={2}>{MEDIUM}</SelvageFold>
            {/* fits in its clamp → renders no fold control at all */}
            <SelvageFold lines={3}>{SHORT}</SelvageFold>
          </div>
        </div>
        <p className="mt-3 font-mono text-[11px] text-muted">
          the fold states exactly what it hides — a measured word count, not an
          ellipsis. text that fits gets no control.
        </p>
      </div>
    </main>
  );
}
