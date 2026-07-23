"use client";

import { PawlClick } from "./component";

const CARDS = [
  {
    id: "c1",
    title: "Renewal reminder — Atlas Studio",
    subtitle: "Billing · due in 4 days",
    body: "Plan renews at the current rate unless changed before the 26th. No action needed to continue as-is.",
  },
  {
    id: "c2",
    title: "New comment on PR #482",
    subtitle: "jrivera · code review",
    body: "\"Can we extract this into a hook? Same pattern shows up in three other components.\"",
  },
  {
    id: "c3",
    title: "Weekly usage digest",
    subtitle: "Automated report",
    body: "412 requests this week, up 6% from last week. No anomalies flagged.",
  },
  {
    id: "c4",
    title: "Design review requested",
    subtitle: "M. Okafor · needs sign-off by Fri",
    body: "Updated empty-state illustrations for the onboarding flow — three variants attached.",
  },
  {
    id: "c5",
    title: "Failed payment — retry scheduled",
    subtitle: "Billing · auto-retry in 2 days",
    body: "Card ending 4471 declined. We'll retry automatically; update the card to avoid a lapse.",
  },
  {
    id: "c6",
    title: "New teammate joined workspace",
    subtitle: "Admin · access pending",
    body: "priya@company.com joined via invite link. Default role assigned — review permissions.",
  },
  {
    id: "c7",
    title: "Incident postmortem ready",
    subtitle: "on-call · read before standup",
    body: "Draft postmortem for the Tuesday outage is ready for comments ahead of tomorrow's standup.",
  },
];

export default function PawlClickDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / pawl-click — triage queue with a one-way ratchet
      </p>
      <PawlClick cards={CARDS} />
    </div>
  );
}
