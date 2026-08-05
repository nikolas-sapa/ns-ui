"use client";

import { useState } from "react";
import { SlackRail } from "./component";

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2 text-sm last:border-b-0">
      <span className="text-ns-muted">{label}</span>
      <span className="font-mono text-foreground">{value}</span>
    </div>
  );
}

function OverviewPanel() {
  return (
    <div>
      <p className="text-sm leading-relaxed text-foreground">
        ns-ui/registry is up to date. Last publish shipped 42 core components
        and 8 loud ones, all passing the screenshot verifier.
      </p>
      <div className="mt-4">
        <StatRow label="Components" value="50" />
        <StatRow label="Open PRs" value="3" />
        <StatRow label="Last deploy" value="12 min ago" />
      </div>
    </div>
  );
}

function ActivityPanel() {
  const events = [
    { who: "AR", what: "opened PR #214 — feeler-gap threshold copy", when: "3m" },
    { who: "NS", what: "merged registry:build cache fix", when: "1h" },
    { who: "KM", what: "flagged a light-theme contrast issue", when: "2h" },
    { who: "JL", what: "shipped dropdown-drape physics tuning", when: "5h" },
  ];
  return (
    <ul className="flex flex-col gap-3">
      {events.map((e, i) => (
        <li key={i} className="flex items-start gap-3 text-sm">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border font-mono text-[10px] text-ns-muted">
            {e.who}
          </span>
          <span className="min-w-0 flex-1 text-foreground">{e.what}</span>
          <span className="shrink-0 font-mono text-xs text-ns-muted">{e.when}</span>
        </li>
      ))}
    </ul>
  );
}

function MembersPanel() {
  const members = [
    { name: "Nikolas S.", role: "Owner" },
    { name: "Amara R.", role: "Maintainer" },
    { name: "Kian M.", role: "Contributor" },
  ];
  return (
    <div className="flex flex-col gap-3">
      {members.map((m) => (
        <div
          key={m.name}
          className="flex items-center justify-between rounded-sm border border-border px-3 py-2"
        >
          <span className="text-sm text-foreground">{m.name}</span>
          <span className="font-mono text-xs text-ns-muted">{m.role}</span>
        </div>
      ))}
    </div>
  );
}

function SettingsPanel() {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <StatRow label="Visibility" value="Public" />
      <StatRow label="Default branch" value="main" />
      <StatRow label="Autoplay descriptors" value="required" />
    </div>
  );
}

export default function SlackRailDemo() {
  // Start on the second tab so the first tab is a non-active one at rest —
  // its hover affordance (color lift + 3px cable tug) is the state worth
  // demonstrating, and the cable resting mid-list reads better than flush-left.
  const [tab, setTab] = useState("activity");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / tabs-slack-cable — the underline is a cable, not a bar
      </p>

      <div className="w-full max-w-lg rounded-md border border-border bg-background p-6">
        <SlackRail
          aria-label="Repository sections"
          value={tab}
          onValueChange={setTab}
          items={[
            { value: "overview", label: "Overview", content: <OverviewPanel /> },
            { value: "activity", label: "Activity", content: <ActivityPanel /> },
            { value: "members", label: "Members", content: <MembersPanel /> },
            { value: "settings", label: "Settings", content: <SettingsPanel /> },
          ]}
        />
      </div>

      <p className="max-w-md text-center text-xs text-ns-muted">
        Click a tab — the cable pays out and sags across the jump, more for a
        far tab than a near one, then tautens flat with a small snap. Hover a
        tab you're not on and the nearest end tugs 3px toward it. Arrow keys,
        Home and End move focus and selection together.
      </p>
    </div>
  );
}
