"use client";

import { FlockStack, type FlockMember } from "./component";

const TEAM: FlockMember[] = [
  { name: "Mara Chen" },
  { name: "Jonas Weber" },
  { name: "Aiko Tanaka" },
  { name: "Sam Okafor" },
  { name: "Lena Fischer" },
  { name: "Ravi Patel" },
  { name: "Nora Lindqvist" },
];

export default function FlockStackDemo() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
      <div
        aria-hidden
        className="absolute inset-0 [background-image:radial-gradient(circle,var(--color-border)_1px,transparent_1px)] [background-size:24px_24px]"
      />
      <div className="relative w-full max-w-sm">
        <p className="mb-4 text-center font-mono text-xs text-muted">
          ns-ui / avatar-stack-flock
        </p>
        <div className="rounded-md border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                On this project
              </h2>
              <p className="mt-1 text-xs text-muted">
                10 people shipped to production this week.
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-border bg-background px-2 py-0.5 font-mono text-[10px] text-muted">
              active
            </span>
          </div>

          <FlockStack members={TEAM} overflow={3} className="mt-5 h-[120px]" />
          <p className="mt-2 font-mono text-[10px] text-muted">
            hover the flock: it lines up for the group photo
          </p>

          <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
            <p className="text-xs text-muted">3 invites pending</p>
            <button
              type="button"
              className="rounded-sm border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:border-foreground/20 hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Invite
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
