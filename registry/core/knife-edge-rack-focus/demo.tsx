"use client";

import { KnifeEdgeRackFocus } from "./component";

export default function KnifeEdgeRackFocusDemo() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / knife-edge-rack-focus
      </p>
      <KnifeEdgeRackFocus />
      <p className="max-w-sm text-center font-mono text-[11px] tracking-widest text-ns-muted">
        knife racks through focus, zones cross null at their own moment
      </p>
    </main>
  );
}
