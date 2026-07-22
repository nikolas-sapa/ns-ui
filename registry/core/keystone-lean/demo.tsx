"use client";

import { KeystoneLean } from "./component";

// The keystone (DATABASE_URL) is deliberately first in the array — its
// delete control can never actually remove anything, so it's a safe first
// interactive control for automated interaction passes to land on.
const ITEMS = [
  {
    id: "database-url",
    label: "DATABASE_URL",
    detail: "postgres://prod-db.internal:5432/app",
    dependents: ["migrations-runner", "connection-pool"],
  },
  {
    id: "api-timeout",
    label: "API_TIMEOUT_MS",
    detail: "30000",
  },
  {
    id: "log-level",
    label: "LOG_LEVEL",
    detail: "info",
  },
  {
    id: "feature-beta",
    label: "FEATURE_FLAG_BETA",
    detail: "false",
  },
  {
    id: "migrations-runner",
    label: "MIGRATIONS_RUNNER",
    detail: "stage: idle",
  },
  {
    id: "connection-pool",
    label: "CONNECTION_POOL_SIZE",
    detail: "20",
  },
];

export default function KeystoneLeanDemo() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-6 py-16">
      <div className="w-full max-w-3xl">
        <p className="mb-8 text-center font-mono text-xs uppercase tracking-[0.2em] text-muted">
          ns-ui / keystone-lean — deleting from a dependency-bearing list
        </p>
        <p className="mx-auto mb-10 max-w-md text-center text-sm leading-relaxed text-muted">
          Hover or focus a delete control. An ordinary variable previews the
          collapse the moment you touch it. DATABASE_URL can&apos;t — two
          other variables still need it, and it shows you that instead of
          letting you find out later.
        </p>
        <KeystoneLean
          items={ITEMS}
          onDelete={(item) => console.log("keystone-lean deleted", item.id)}
        />
      </div>
    </main>
  );
}
