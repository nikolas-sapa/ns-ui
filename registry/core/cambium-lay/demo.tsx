"use client";

import { CambiumLay } from "./component";

export default function CambiumLayDemo() {
  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0">
        {/* Demo-only pace: 2.6s per virtual year (default is ~20s) so the
            scar at years 5-6 and the healing that follows are visible within
            a normal viewing window. storageKey is namespaced so this demo's
            persisted age never collides with a real hero instance on the
            same origin. */}
        <CambiumLay yearMs={2600} storageKey="demo" />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-10 flex justify-center px-4">
        <p
          className="rounded-md border border-border px-4 py-2 text-center font-mono text-xs text-ns-muted"
          style={{ background: "color-mix(in srgb, var(--background) 82%, transparent)" }}
        >
          ns-ui / cambium-lay — a cambium ring laid outward from a live seasonal signal, one year at a time
        </p>
      </div>
    </div>
  );
}
