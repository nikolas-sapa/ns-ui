"use client";

import { ToppleRun, type ToppleRunItem } from "./component";

const ITEMS: ToppleRunItem[] = [
  { id: "1", label: "Q3 roadmap review", description: "Priya Nair · 2h ago" },
  { id: "2", label: "Invoice #4471 overdue", description: "Billing · 5h ago" },
  { id: "3", label: "Design system sync notes", description: "Marcus Webb · 1d ago" },
  { id: "4", label: "New device sign-in", description: "Security · 1d ago" },
  { id: "5", label: "Weekly digest — team", description: "Digest bot · 2d ago" },
  { id: "6", label: "PR #892 ready for review", description: "Jae Kim · 2d ago" },
  { id: "7", label: "Storage nearing limit", description: "System · 3d ago" },
  { id: "8", label: "Onboarding checklist done", description: "HR · 4d ago" },
  { id: "9", label: "Customer escalation: Acme", description: "Support · 5d ago" },
  { id: "10", label: "Backup completed", description: "System · 6d ago" },
];

export default function ToppleRunDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / checkbox-domino-run
      </p>

      <div className="w-full max-w-md">
        <ToppleRun items={ITEMS} label="Mark all as read" />
      </div>

      <p className="max-w-md text-center text-xs text-ns-muted">
        Flip the master checkbox — a wavefront tips down the list, marking
        each row read as it passes. Click any row while the wave is live to
        halt it there; everything below stays untouched.
      </p>
    </div>
  );
}
