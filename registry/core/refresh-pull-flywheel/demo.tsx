"use client";

import { FlywheelPull, type FlywheelPullItem } from "./component";

const SEED_ITEMS: FlywheelPullItem[] = [
  {
    id: "seed-1",
    title: "Sprint 24 board synced from Linear",
    meta: "2 min ago",
  },
  {
    id: "seed-2",
    title: "New comment on “Rack-and-pinion physics”",
    meta: "14 min ago",
  },
  {
    id: "seed-3",
    title: "Deploy finished: prod-web-42",
    meta: "31 min ago",
  },
  {
    id: "seed-4",
    title: "3 people starred ns-ui-lab",
    meta: "1 hr ago",
  },
  {
    id: "seed-5",
    title: "Weekly digest is ready",
    meta: "3 hrs ago",
  },
];

export default function FlywheelPullDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / refresh-pull-flywheel — wind it up, let it spin
      </p>

      <FlywheelPull defaultItems={SEED_ITEMS} label="Activity feed" />

      <p className="max-w-md text-center text-xs text-ns-muted">
        Grab the wheel and pull down — the rack, pinion and flywheel wind
        together, 1:1 with pull distance. Let go and the wheel spins on the
        energy you gave it, freewheeling through the request and braking to
        rest exactly as the new rows settle in. Or just press Refresh.
      </p>
    </div>
  );
}
