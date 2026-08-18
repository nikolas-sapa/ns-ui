"use client";

import { useState } from "react";
import { PlateRegister } from "./component";

export default function PlateRegisterDemo() {
  // remounting after a resolution lets the same demo be interacted with more
  // than once — PlateRegister itself never un-resolves a decided block
  const [resetKeyA, setResetKeyA] = useState(0);
  const [resetKeyB, setResetKeyB] = useState(0);

  return (
    <main className="flex min-h-screen justify-center bg-background px-6 py-16">
      <div className="w-full max-w-lg space-y-10">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
          ns-ui / press-register — live divergence
        </p>

        <section>
          <h2 className="mb-3 text-sm font-medium text-foreground">
            Heavy rewrite
          </h2>
          <PlateRegister
            key={resetKeyA}
            collaboratorName="Nadia"
            text="The onboarding flow should ask for a workspace name before the invite step, then default new members to view-only until an admin promotes them."
            theirText="The onboarding flow should skip the workspace name question entirely and default new members to full editor access immediately, only prompting an admin if permissions need tightening later."
            onResolve={(outcome) => {
              console.log("press-register resolved (heavy)", outcome);
              window.setTimeout(() => setResetKeyA((k) => k + 1), 3200);
            }}
          />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium text-foreground">
            One word
          </h2>
          <PlateRegister
            key={resetKeyB}
            collaboratorName="Marcus"
            text="Retries back off exponentially, capped at five attempts before the job moves to the dead-letter queue."
            theirText="Retries back off exponentially, capped at three attempts before the job moves to the dead-letter queue."
            onResolve={(outcome) => {
              console.log("press-register resolved (light)", outcome);
              window.setTimeout(() => setResetKeyB((k) => k + 1), 3200);
            }}
          />
        </section>
      </div>
    </main>
  );
}
