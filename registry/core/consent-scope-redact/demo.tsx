"use client";

import { LampBlack, type LampBlackScope, type LampBlackPart } from "./component";

const scopes: LampBlackScope[] = [
  { id: "location", label: "Location", hint: "City / region of the order", defaultShared: false },
  { id: "contact", label: "Contact info", hint: "Email and phone on file" },
  { id: "financial", label: "Payment amount", hint: "Refund total" },
];

const record: LampBlackPart[] = [
  "Order #48213 was placed by Priya Raghavan, shipped to ",
  { text: "Austin, TX", scope: "location", kind: "city" },
  ", confirmed by email at ",
  { text: "p.raghavan@helpmarq.com", scope: "contact", kind: "email" },
  " and by phone at ",
  { text: "(512) 555-0142", scope: "contact", kind: "phone" },
  ", with ",
  { text: "$284.50", scope: "financial", kind: "amount" },
  " refunded to the original card.",
];

export default function LampBlackDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">ns-ui / consent-scope-redact</p>
        <LampBlack scopes={scopes} record={record} />
        <p className="mt-3 font-mono text-[11px] text-ns-muted">
          toggle a scope to withhold or share the tokens it controls.
        </p>
      </div>
    </main>
  );
}
