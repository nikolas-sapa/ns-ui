"use client";

import { IdlerDrop, type Delegation } from "./component";

const now = Date.now();
const DAY = 24 * 60 * 60 * 1000;

const DELEGATIONS: Delegation[] = [
  {
    id: "priya",
    name: "Priya Nair",
    role: "admin",
    grantedAt: now - 42 * DAY,
    sessionExpiresAt: now + 26 * 60 * 1000,
  },
  {
    id: "sam",
    name: "Sam Okafor",
    role: "editor",
    // 14 minutes plus a small buffer, so the coasting readout still rounds
    // to a stable "14 min" a few seconds after mount.
    grantedAt: now - 11 * DAY,
    sessionExpiresAt: now + 14 * 60 * 1000 + 20 * 1000,
  },
  {
    id: "jordan",
    name: "Jordan Reyes",
    role: "viewer",
    grantedAt: now - 3 * DAY,
    sessionExpiresAt: now + 6 * 60 * 1000,
  },
];

export default function IdlerDropDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-2xl">
        <p className="mb-8 font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
          ns-ui / idler-drop — delegated admin
        </p>

        <section>
          <p className="mb-4 max-w-lg text-sm leading-relaxed text-ns-muted">
            Each delegate is a gear coupled to your account through a swinging
            idler. Revoke breaks the mesh — their gear freewheels to a stop
            while yours keeps turning, and their existing session coasts
            until it actually expires.
          </p>

          <IdlerDrop delegations={DELEGATIONS} title="Delegated admin" />
        </section>
      </div>
    </main>
  );
}
