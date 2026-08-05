"use client";

import { ChunkSieve, type SieveChunk } from "./component";

// A realistic support-assistant retrieval: twelve chunks pulled for the query
// "why was I charged twice after upgrading?". Six clear the 0.742 cutoff and
// rest on the rule; three of those were actually cited and draw connectors to
// the answer rail — billing.md and macros.md were retrieved and never used,
// which is the whole point of the rail. The rest fall through as stubs.
const CHUNKS: SieveChunk[] = [
  {
    id: "runbook",
    doc: "runbook.md",
    span: [0, 412],
    score: 0.941,
    used: true,
    preview:
      "Duplicate charges after a mid-cycle upgrade are almost always the proration invoice landing before the credit note clears.",
  },
  {
    id: "api-ref",
    doc: "api-ref.md",
    span: [1200, 1480],
    score: 0.903,
    used: true,
    preview:
      "POST /v1/subscriptions/:id/upgrade issues an immediate invoice; the offsetting credit posts on the next billing run.",
  },
  {
    id: "billing",
    doc: "billing.md",
    span: [640, 980],
    score: 0.868,
    preview:
      "Annual plans are billed in advance. Downgrades take effect at the end of the current term, never mid-cycle.",
  },
  {
    id: "changelog",
    doc: "changes.md",
    span: [88, 402],
    score: 0.821,
    used: true,
    preview:
      "2026-01-14 — proration credits now post within the same invoice cycle instead of the following one.",
  },
  {
    id: "macros",
    doc: "macros.md",
    span: [2040, 2360],
    score: 0.779,
    preview:
      "Macro: refund-duplicate. Confirm both charge IDs with the customer before issuing the reversal.",
  },
  {
    id: "sso",
    doc: "sso.md",
    span: [310, 702],
    score: 0.746,
    preview:
      "Seat counts sync from the identity provider on every SAML assertion, which can change the invoiced quantity.",
  },
  {
    id: "pricing",
    doc: "pricing.md",
    span: [0, 260],
    score: 0.727,
    preview:
      "Team is $18 per seat per month. Enterprise pricing is quoted per contract.",
  },
  {
    id: "notes",
    doc: "notes.md",
    span: [1520, 1840],
    score: 0.715,
    preview:
      "v3.2 moved the invoice PDF renderer to the background queue; no billing logic changed.",
  },
  {
    id: "handbook",
    doc: "policy.md",
    span: [960, 1310],
    score: 0.668,
    preview:
      "Support escalates any billing dispute over $500 to the finance rotation within one business day.",
  },
  {
    id: "slack",
    doc: "slack.txt",
    span: [4400, 4760],
    score: 0.612,
    preview:
      "eng-billing: anyone else seeing the sandbox webhook fire twice? probably the retry, not real duplicates.",
  },
  {
    id: "brand",
    doc: "brand.pdf",
    span: [120, 540],
    score: 0.524,
    preview:
      "The wordmark clears at 24px minimum. Never set it in a weight lighter than medium.",
  },
  {
    id: "hr",
    doc: "hr-2019.md",
    span: [780, 1120],
    score: 0.371,
    preview:
      "Expense reimbursements are processed on the 15th and the last working day of each month.",
  },
];

export default function ChunkSieveDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-5xl">
        <p className="mb-10 text-center font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / retrieval-chunk-sieve
        </p>
        <div className="mx-auto mb-10 max-w-xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground">
            What actually reached the answer
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ns-muted">
            Twelve chunks retrieved for “why was I charged twice after
            upgrading?”. Six cleared the cutoff and rest on the rule. Only the
            three wired to the rail were cited.
          </p>
        </div>
        <ChunkSieve chunks={CHUNKS} defaultCutoff={0.742} />
        <p className="mt-8 text-center font-mono text-[11px] text-ns-muted">
          Drag the rule to move the cutoff, or focus it and use the arrow keys.
        </p>
      </div>
    </main>
  );
}
