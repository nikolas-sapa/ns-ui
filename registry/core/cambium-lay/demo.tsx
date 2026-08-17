"use client";

import { CambiumLay } from "./component";

export default function CambiumLayDemo() {
  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0">
        {/* Demo-only pace: 900ms per virtual year (default is 4000ms) so the
            live front's boundary sweep — and the scar at years 5-6 with the
            healing that follows — reads as visibly moving within the few
            seconds a catalog card is actually judged on, not just within a
            longer direct-link viewing window. storageKey is namespaced so
            this demo's persisted age never collides with a real hero
            instance on the same origin. */}
        <CambiumLay yearMs={900} storageKey="demo" />
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
