"use client";

import { useState } from "react";
import { AssayGate } from "./component";

// Fixed epochs, not `Date.now() - n`. This preview route is statically
// prerendered, so a module-scope `Date.now()` freezes into the server HTML at
// build time while the client recomputes it at page load — the two receipts
// then render different clock times and hydration mismatches on the text.
// A decision history is a record of when something happened, so a fixed
// timestamp is also the more honest fixture.
const DENIED_AT = Date.UTC(2026, 6, 21, 14, 9, 27);
const APPROVED_AT = Date.UTC(2026, 6, 21, 13, 33, 4);

export default function AssayGateDemo() {
  // the pending row queues a fresh call a few seconds after a decision, so
  // the same demo instance can be interacted with more than once — the
  // AssayGate itself never reopens a decided row, this just remounts a new one
  const [resetKey, setResetKey] = useState(0);

  return (
    <main className="flex min-h-screen justify-center bg-background px-6 py-16">
      <div className="w-full max-w-lg">
        <p className="mb-8 font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
          ns-ui / approval-inline-diff — tool-call approval
        </p>

        <section className="rounded-md border border-border bg-surface/40 p-5">
          <h2 className="text-sm font-medium text-foreground">
            Awaiting your review
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-ns-muted">
            deploy-agent wants to run a shell command — someone already
            caught the target and walked it back to staging. Edit any
            argument before you decide; the change is recorded, not
            silently applied.
          </p>
          <div className="mt-4">
            <AssayGate
              key={resetKey}
              toolName="execute_shell"
              requestedBy="deploy-agent"
              fields={[
                { key: "command", label: "command", value: "npm run deploy --env=prod" },
                { key: "cwd", label: "working directory", value: "/srv/app" },
                { key: "timeout_s", label: "timeout (s)", value: "30" },
              ]}
              initialValues={{ command: "npm run deploy --env=staging" }}
              onDecision={(decision) => {
                console.log("approval-inline-diff decision", decision);
                setTimeout(() => setResetKey((k) => k + 1), 2600);
              }}
            />
          </div>
        </section>

        <section className="mt-6 rounded-md border border-border bg-surface/40 p-5">
          <h2 className="text-sm font-medium text-foreground">
            Recent decisions
          </h2>
          <div className="mt-4 space-y-3">
            <AssayGate
              toolName="send_email"
              requestedBy="outreach-agent"
              fields={[
                { key: "to", label: "to", value: "finance@acme.co" },
                { key: "subject", label: "subject", value: "Q3 invoice — final notice" },
              ]}
              initialDecision={{
                outcome: "denied",
                actor: "you",
                timestamp: DENIED_AT,
              }}
            />
            <AssayGate
              toolName="update_dns_record"
              requestedBy="infra-agent"
              fields={[
                { key: "zone", label: "zone", value: "acme.co" },
                { key: "record", label: "record", value: "A  status.acme.co" },
                { key: "value", label: "new value", value: "203.0.113.42" },
              ]}
              initialDecision={{
                outcome: "approved",
                actor: "you",
                timestamp: APPROVED_AT,
              }}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
