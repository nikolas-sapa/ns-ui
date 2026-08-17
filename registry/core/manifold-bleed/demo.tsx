"use client";

import { ManifoldBleed } from "./component";

// Real, user-driven state — clicking a valve is a genuine click, no timer
// drives it locally. meta.json's `autoplay: { mode: "press" }` has the
// shared driver synthesize a press on read:email's switch, landing on the
// same onClick handler below; it fires the component's own built-in
// simulated ~320ms server round trip since no onGrantChange is passed here.
//
// admin:org starts pre-revoked (defaultGranted: false) on purpose: the
// resting/idle screenshot already shows one drained hairline among the
// three live lines, so "the list never shortens" is visible before any
// interaction happens at all.
export default function ManifoldBleedDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">ns-ui / manifold-bleed</p>

      <ManifoldBleed
        appName="Northlake CI"
        scopes={[
          {
            id: "read:repos",
            label: "read:repos",
            description: "Read your repository contents and metadata.",
            defaultGranted: true,
          },
          {
            id: "read:email",
            label: "read:email",
            description: "Read the primary email on your account.",
            defaultGranted: true,
          },
          {
            id: "write:issues",
            label: "write:issues",
            description: "Open and comment on issues in your repos.",
            defaultGranted: true,
          },
          {
            id: "admin:org",
            label: "admin:org",
            description: "Manage organization members and settings.",
            defaultGranted: false,
          },
        ]}
      />

      <p className="max-w-md text-center text-xs text-ns-muted">
        Each switch is a valve on a supply line from your account to the app. Closing one drains
        its line backward toward you, only once the server confirms — the drained line stays on
        the board as a record of what was once granted.
      </p>
    </div>
  );
}
