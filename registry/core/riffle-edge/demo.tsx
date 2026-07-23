"use client";

import { RiffleEdge, type RiffleEdgeItem } from "./component";

const STEPS: RiffleEdgeItem[] = [
  {
    id: "workspace",
    eyebrow: "Step 1 · Setup",
    title: "Name your workspace",
    description: "Pick a name your team will recognize — you can rename it later from settings.",
  },
  {
    id: "invite",
    eyebrow: "Step 2 · Team",
    title: "Invite teammates",
    description: "Add up to 10 people now by email; more can join anytime with an invite link.",
  },
  {
    id: "connect",
    eyebrow: "Step 3 · Data",
    title: "Connect a data source",
    description: "Link a database, spreadsheet, or API — the dashboard fills in once one is live.",
  },
  {
    id: "roles",
    eyebrow: "Step 4 · Access",
    title: "Set default roles",
    description: "New members land as Editors; change the default or set exceptions per person.",
  },
  {
    id: "notify",
    eyebrow: "Step 5 · Alerts",
    title: "Choose notification channels",
    description: "Route incidents to email, Slack, or both — quiet hours apply automatically.",
  },
  {
    id: "billing",
    eyebrow: "Step 6 · Plan",
    title: "Confirm your plan",
    description: "You're starting on the free tier; upgrade anytime as usage grows.",
  },
  {
    id: "review",
    eyebrow: "Step 7 · Review",
    title: "Review and finish",
    description: "Everything above can be changed later — this just gets the workspace live.",
  },
];

export default function RiffleEdgeDemo() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
          Onboarding
        </p>
        <RiffleEdge items={STEPS} defaultIndex={0} aria-label="Onboarding steps" />
        <p className="mt-3 text-xs text-muted">
          Drag the edge on the right, scroll over it, or focus it and use arrow keys.
        </p>
      </div>
    </div>
  );
}
