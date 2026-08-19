"use client";

import { TallyCleave, type Invite } from "./component";

// Team settings > Invites, seeded across the whole lifecycle: a fresh
// pending invite (crisp seam), one riding close to its TTL (visibly eroded
// and faint — still a valid preview of what erosion looks like without
// waiting days for it), one already past its TTL (flat, faint, no accept
// affordance), and one already matched (foil solid, grain lines continuous
// across the seam, seam stroke faded to hairline). Accept plays live on any
// remaining pending row.
const DAY = 86400000;
const NOW = Date.now();

const SEED_INVITES: Invite[] = [
  {
    id: "inv-7f1c-priya",
    email: "priya@northfjord.dev",
    role: "Editor",
    createdAt: NOW - 0.4 * DAY,
    ttlMs: 7 * DAY,
    status: "pending",
  },
  {
    id: "inv-a92e-marcus",
    email: "marcus@northfjord.dev",
    role: "Viewer",
    createdAt: NOW - 2.8 * DAY,
    ttlMs: 3 * DAY,
    status: "pending",
  },
  {
    id: "inv-c410-devon",
    email: "devon@northfjord.dev",
    role: "Admin",
    createdAt: NOW - 5 * DAY,
    ttlMs: 2 * DAY,
    status: "pending",
  },
  {
    id: "inv-0b6d-sam",
    email: "sam@northfjord.dev",
    role: "Editor",
    createdAt: NOW - 9 * DAY,
    ttlMs: 7 * DAY,
    status: "accepted",
    acceptedBy: "sam@northfjord.dev",
    acceptedAt: NOW - 2 * DAY,
  },
];

export default function TallyCleaveDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">ns-ui / tally-cleave</p>

      <div className="w-full max-w-xl rounded-[16px] border border-border bg-background p-5">
        <TallyCleave initialInvites={SEED_INVITES} maxInvites={6} />
      </div>

      <p className="max-w-md text-center text-xs text-ns-muted">
        Each invite&apos;s seam is cut from its own token — same token, same jagged edge, every time.
        Accept slides the matching foil home with a spring; a TTL fraction elapsed erodes the seam and
        fades it until it can no longer prove a match, which is why an expired invite can&apos;t be
        renewed, only replaced.
      </p>
    </div>
  );
}
