"use client";

import {
  ReachRuleTable,
  type CompareFeatureRow,
  type CompareTier,
} from "./component";

const TIERS: CompareTier[] = [
  { id: "hobby", name: "Hobby", price: "$0" },
  { id: "pro", name: "Pro", price: "$20/mo" },
  { id: "team", name: "Team", price: "$60/mo" },
  { id: "enterprise", name: "Enterprise", price: "Custom" },
];

const ROWS: CompareFeatureRow[] = [
  { id: "deploys", label: "Unlimited deployments", support: [true, true, true, true] },
  {
    id: "regions",
    label: "Edge regions",
    note: "Where your builds are served from",
    support: ["3", "18", "34", "34 + private"],
  },
  {
    id: "analytics",
    label: "Traffic analytics",
    note: "Retention window",
    support: [false, "30 days", "1 year", "3 years"],
  },
  { id: "seats", label: "Collaborator seats", support: ["1", "5", "25", "Unlimited"] },
  {
    id: "preview",
    label: "Password-protected previews",
    support: [false, true, true, true],
  },
  { id: "sso", label: "SAML single sign-on", support: [false, false, true, true] },
  {
    id: "audit",
    label: "Audit log export",
    note: "Streamed to a bucket you own",
    support: [false, false, false, true],
  },
  {
    id: "sla",
    label: "99.99% uptime SLA",
    support: [false, false, false, true],
  },
  {
    id: "checkout",
    label: "Self-serve checkout",
    note: "Enterprise is invoiced instead",
    support: [true, true, true, false],
  },
  {
    id: "forum",
    label: "Community forum support",
    note: "Replaced by a named contact on Enterprise",
    support: [true, true, true, false],
  },
  {
    id: "trial",
    label: "14-day trial, no card",
    support: [true, true, false, false],
  },
  {
    id: "badge",
    label: "Public project badge",
    note: "Free-tier attribution",
    support: [true, false, false, false],
  },
];

export default function CompareTableReachRuleDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-4xl">
        <p className="mb-10 text-center font-mono text-xs tracking-widest text-muted">
          ns-ui / compare-table-reach-rule
        </p>
        <div className="mx-auto mb-10 max-w-xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground">
            Where each feature stops
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Every row draws a rule that ends at the last plan that includes it,
            so the staircase is the comparison.
          </p>
        </div>
        <ReachRuleTable tiers={TIERS} rows={ROWS} title="Plan comparison" />
        <p className="mt-10 text-center font-mono text-[11px] text-muted">
          Hover or focus a row to redraw its rule. Click the label to pin it.
        </p>
      </div>
    </main>
  );
}
