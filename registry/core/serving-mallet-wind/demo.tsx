"use client";

import { ServingMalletWind } from "./component";

export default function ServingMalletWindDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / serving-mallet-wind
      </p>

      <ServingMalletWind label="Provisioning workspace" />

      <p className="max-w-md text-center text-xs text-ns-muted">
        No known duration — this ambient bar just confirms the process is still
        consuming work, not stalled.
      </p>
    </div>
  );
}
