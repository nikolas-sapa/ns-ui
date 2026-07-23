"use client";

import { useId, useState } from "react";
import { PlumbSway } from "./component";

function Avatar({ initials }: { initials: string }) {
  return (
    <div
      aria-hidden
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-background font-mono text-xs text-muted"
    >
      {initials}
    </div>
  );
}

function ProfileCard() {
  return (
    <div className="p-4">
      <div className="flex items-start gap-3">
        <Avatar initials="RC" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">Rosa Cortez</p>
          <p className="truncate font-mono text-xs text-muted">@rosacortez</p>
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Building developer tooling. Previously infra @ two seed-stage startups. Bikes further than
        is reasonable.
      </p>
      <div className="mt-3 flex items-center gap-4 font-mono text-xs text-muted">
        <span>
          <span className="text-foreground">312</span> following
        </span>
        <span>
          <span className="text-foreground">4,108</span> followers
        </span>
      </div>
      <button
        type="button"
        className="mt-3.5 w-full rounded-sm border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground outline-none transition-colors hover:border-foreground/25 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      >
        Follow
      </button>
    </div>
  );
}

const FILTERS = ["Open", "In review", "Merged", "Draft"] as const;

function FilterPanel({
  active,
  onToggle,
}: {
  active: Set<string>;
  onToggle: (v: string) => void;
}) {
  const groupId = useId();
  return (
    <div className="p-3.5" role="group" aria-labelledby={groupId}>
      <p id={groupId} className="px-1 pb-2 text-xs font-medium uppercase tracking-wide text-muted">
        Status
      </p>
      <div className="flex flex-col gap-0.5">
        {FILTERS.map((f) => {
          const checked = active.has(f);
          return (
            <label
              key={f}
              className="flex cursor-pointer items-center gap-2.5 rounded-sm px-1.5 py-1.5 text-sm text-foreground transition-colors hover:bg-background"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(f)}
                className="h-3.5 w-3.5 rounded-[3px] border-border accent-accent outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface"
              />
              {f}
            </label>
          );
        })}
      </div>
    </div>
  );
}

export default function PlumbSwayDemo() {
  const [active, setActive] = useState<Set<string>>(new Set(["Open", "In review"]));
  const toggle = (v: string) =>
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });

  return (
    <div className="flex min-h-screen items-start justify-center bg-background px-6 py-20 text-foreground">
      <div className="w-full max-w-xl">
        <p className="font-mono text-xs uppercase tracking-widest text-muted">ns-ui / plumb-sway</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Hangs like a plumb bob</h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
          A popover connected to its trigger by a hairline string. It drops in slightly off-vertical,
          sways twice on a damped pendulum, then settles perfectly plumb.
        </p>

        <div className="mt-10 rounded-md border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-medium">Issue triage</p>
            <PlumbSway
              interaction="click"
              label="Filter issues by status"
              trigger={
                <span className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-background px-2.5 py-1 text-xs">
                  Filters
                  <span className="font-mono text-muted">({active.size})</span>
                </span>
              }
            >
              <FilterPanel active={active} onToggle={toggle} />
            </PlumbSway>
          </div>

          <div className="flex flex-col divide-y divide-border px-4">
            {[
              { id: "1198", title: "Dark theme: focus ring invisible on filled inputs" },
              { id: "1187", title: "Add pagination cursor to /v1/deploys" },
            ].map((row) => (
              <div key={row.id} className="flex items-center gap-3 py-3 text-sm">
                <span className="shrink-0 font-mono text-xs text-muted">#{row.id}</span>
                <span className="min-w-0 flex-1 truncate">{row.title}</span>
              </div>
            ))}
            <div className="flex items-center gap-3 py-3 text-sm">
              <span className="shrink-0 font-mono text-xs text-muted">#1204</span>
              <span className="min-w-0 flex-1 truncate">Retry logic drops the last attempt&rsquo;s error</span>
              <span className="shrink-0 text-xs text-muted">
                by{" "}
                <PlumbSway interaction="hover" trigger="@rosacortez" triggerLabel="@rosacortez, view profile">
                  <ProfileCard />
                </PlumbSway>
              </span>
            </div>
          </div>
        </div>

        <p className="mt-4 max-w-md text-xs leading-relaxed text-muted">
          The <span className="font-mono">Filters</span> button opens a non-modal popover — focus
          moves in, Escape or an outside click dismisses it. <span className="font-mono">@rosacortez</span>{" "}
          opens a hovercard on hover or keyboard focus, without stealing focus from the trigger — try
          Tab.
        </p>
      </div>
    </div>
  );
}
