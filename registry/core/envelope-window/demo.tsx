"use client";

import { useState } from "react";
import { EnvelopeWindow, type EnvelopeScope } from "./component";

const scopes: EnvelopeScope[] = [
  {
    id: "profile",
    label: "Profile",
    required: true,
    sample: "your name and email",
    fields: [
      { label: "Name", value: "Priya Raghavan" },
      { label: "Email", value: "priya.raghavan@helpmarq.dev" },
    ],
  },
  {
    id: "calendar",
    label: "Calendar",
    defaultOpen: true,
    sample: "14 events this week",
    fields: [
      { label: "Today", value: "14:00 Product sync" },
      { label: "Fri", value: "09:30 1:1 with Sam" },
    ],
  },
  {
    id: "repos",
    label: "Repositories",
    sample: "6 private repositories",
    fields: [
      { label: "Repo", value: "helpmarq/ns-ui" },
      { label: "Repo", value: "helpmarq/design-tokens" },
    ],
  },
  {
    id: "billing",
    label: "Billing",
    sample: "plan and card on file",
    fields: [
      { label: "Plan", value: "Pro — $28/mo" },
      { label: "Card", value: "Visa •••• 4417" },
    ],
  },
  {
    id: "account",
    label: "Account ID",
    required: true,
    sample: "your account identifier",
    fields: [{ label: "Account ID", value: "acct_8841raghavan" }],
  },
];

export default function EnvelopeWindowDemo() {
  const [status, setStatus] = useState<string>("");

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">ns-ui / envelope-window</p>
        <EnvelopeWindow
          appName="Northlake Analytics"
          scopes={scopes}
          onAllow={(open) => setStatus(`Allowed: ${open.join(", ")}`)}
          onDeny={() => setStatus("Denied — only required scopes remain open.")}
        />
        <p aria-live="polite" className="mt-3 font-mono text-[11px] text-ns-muted">
          {status || "toggle a scope to cut or seal its window over the real row beneath."}
        </p>
      </div>
    </main>
  );
}
