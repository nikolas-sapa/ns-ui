"use client";

import { TonearmSkate } from "./component";

export default function TonearmSkateDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / tonearm-skate
        </p>
        <TonearmSkate />
        <p className="mt-3 font-mono text-[11px] text-ns-muted">
          the arm sweeps the disc over one 48s side, the error needle centers at each
          null and drifts off it everywhere else
        </p>
      </div>
    </main>
  );
}
