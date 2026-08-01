"use client";

import { MortiseSlip } from "./component";

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2.5 last:border-b-0">
      <span className="text-sm text-muted">{label}</span>
      <span className="font-mono text-sm text-foreground">{value}</span>
    </div>
  );
}

function OverviewPanel() {
  return (
    <div className="p-5">
      <p className="mb-3 text-sm leading-relaxed text-muted">
        A quiet week — throughput held steady and nothing paged. The joint
        below marks which tab this content belongs to, at rest, with no
        motion needed to prove it.
      </p>
      <div>
        <StatRow label="Requests / min" value="4,208" />
        <StatRow label="p95 latency" value="118 ms" />
        <StatRow label="Error rate" value="0.02%" />
      </div>
    </div>
  );
}

function ActivityPanel() {
  const items = [
    { who: "deploy-bot", what: "shipped v2.14.0 to production", when: "2m" },
    { who: "K. Marsh", what: "acknowledged the p95 alert", when: "41m" },
    { who: "A. Reyes", what: "rotated the ingest API key", when: "3h" },
  ];
  return (
    <ul className="p-5">
      {items.map((it, i) => (
        <li
          key={i}
          className="flex items-baseline gap-3 border-b border-border py-2.5 last:border-b-0"
        >
          <span className="w-9 shrink-0 font-mono text-xs text-muted">
            {it.when}
          </span>
          <span className="text-sm text-foreground">
            <span className="font-medium">{it.who}</span> {it.what}
          </span>
        </li>
      ))}
    </ul>
  );
}

function MembersPanel() {
  const members = [
    { name: "Nikolas S.", role: "Owner" },
    { name: "K. Marsh", role: "Admin" },
    { name: "A. Reyes", role: "Member" },
    { name: "J. Lin", role: "Member" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 p-5">
      {members.map((m) => (
        <div
          key={m.name}
          className="rounded-md border border-border p-3"
        >
          <p className="text-sm font-medium text-foreground">{m.name}</p>
          <p className="mt-0.5 font-mono text-xs text-muted">{m.role}</p>
        </div>
      ))}
    </div>
  );
}

function SettingsPanel() {
  return (
    <div className="flex flex-col gap-3 p-5">
      <label className="flex items-center justify-between text-sm text-foreground">
        Email digests
        <span className="font-mono text-xs text-muted">Weekly</span>
      </label>
      <label className="flex items-center justify-between text-sm text-foreground">
        Two-factor auth
        <span className="font-mono text-xs text-muted">Enabled</span>
      </label>
      <label className="flex items-center justify-between text-sm text-foreground">
        API access
        <span className="font-mono text-xs text-muted">Restricted</span>
      </label>
    </div>
  );
}

export default function MortiseSlipDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / tabs-notch-tenon — tabs as joinery
      </p>

      <MortiseSlip
        aria-label="Project sections"
        className="w-full max-w-md"
        defaultTab="overview"
        tabs={[
          { id: "overview", label: "Overview", content: <OverviewPanel /> },
          { id: "activity", label: "Activity", content: <ActivityPanel /> },
          { id: "members", label: "Members", content: <MembersPanel /> },
          { id: "settings", label: "Settings", content: <SettingsPanel /> },
        ]}
      />

      <p className="max-w-md text-center text-xs text-muted">
        The bottom rule is one path, missing a notch under the active tab; the
        panel below carries a raised nub that slots into that gap. Switch
        tabs — arrow keys work too — and the joint travels, tapping home.
      </p>
    </div>
  );
}
