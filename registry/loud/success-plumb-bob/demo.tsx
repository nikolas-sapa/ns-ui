"use client";

import { PlumbTrue } from "./component";

export default function PlumbTrueDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-xs">
        <p className="mb-4 text-center font-mono text-xs tracking-widest text-muted">
          ns-ui / success-plumb-bob
        </p>
        <PlumbTrue />
      </div>
    </main>
  );
}
