"use client";

import { FrankRegister } from "./component";

export default function FrankRegisterDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm rounded-md border border-border bg-background p-6">
        <p className="mb-5 font-mono text-xs tracking-widest text-ns-muted">ns-ui / frank-register</p>
        <FrankRegister
          creditsPurchased={2000}
          defaultBalance={1000}
          amount={142.5}
          description="GPT-5 batch job — 2,850 credits"
          actionLabel="Charge"
        />
      </div>
    </main>
  );
}
