"use client";

import { TearStub } from "./component";

export default function TearStubDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / tear-stub — dismiss, then click the stub to reopen
      </p>
      <TearStub
        className="w-full max-w-md"
        title="Scheduled maintenance"
        description="This workspace will be read-only for about ten minutes starting at 02:00 UTC tonight."
      />
    </div>
  );
}
