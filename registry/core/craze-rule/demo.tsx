"use client";

import { CrazeRule } from "./component";

// A product page: sections that would otherwise sit under a plain <hr> or
// border-top, but the seam between them arrives as a running fracture the
// instant the divider comes on screen, then keeps a faint idle creep going
// at rest — never a static rule.
export default function CrazeRuleDemo() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / craze-rule
      </p>

      <section className="mt-6">
        <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
          Built for cold storage
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ns-muted">
          Every archive is written once, checksummed, and replicated across
          three regions before the upload confirms — retrieval is the only
          operation that ever touches it again.
        </p>
      </section>

      <CrazeRule className="my-10" />

      <section>
        <h2 className="text-lg font-semibold text-foreground">
          Retrieval, on your schedule
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ns-muted">
          Standard restores land in under twelve hours. Bulk restores queue
          behind nothing — request the whole vault and it starts moving the
          same minute.
        </p>
      </section>

      <CrazeRule className="my-10" />

      <section>
        <h2 className="text-lg font-semibold text-foreground">Pricing</h2>
        <p className="mt-3 text-sm leading-relaxed text-ns-muted">
          $0.004/GB-month to store, no minimum retention. Egress and restore
          requests are billed separately and shown before you confirm.
        </p>
      </section>
    </main>
  );
}
