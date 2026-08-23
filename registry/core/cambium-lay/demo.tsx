"use client";

import { useState } from "react";
import { CambiumLay } from "./component";

export default function CambiumLayDemo() {
  // Bucketed by 20s of real wall-clock time — comfortably under the default
  // 64-year cap at 500ms/year (64*500ms = 32s), which is what the live
  // front permanently freezes at. Measured: a card whose iframe has existed
  // (open tab, or reused localStorage across remounts while scrolling) for
  // more than that shows a fully-grown, permanently static tree — reads as
  // dead, not "aged". Raising maxYears instead was tried first and made it
  // worse: the per-year radial budget is normalised so all maxYears budgets
  // sum to the drawable radius, so a much larger maxYears divides that same
  // radius into far more, far thinner years — 14 years of a 4000-year cap
  // measured a live-front radius of ~6.7 viewBox units, barely past the
  // pith, vs ~35 units at the real 64-year cap. So the cap stays 64 (real
  // ring sizes), and instead the storage key itself rolls over well before
  // the cap can ever be reached: any window boundary just restarts the tree
  // at its normal 14-year seed rather than reaching a frozen full-grown
  // state. Computed once via useState's lazy initializer, so a card that's
  // been open past a bucket boundary keeps growing on its current key until
  // it next unmounts/remounts (matching the "ages while looked at" pitch)
  // rather than jumping mid-view. storageKey is namespaced with "demo-" so
  // it never collides with a real hero instance elsewhere on the same
  // origin.
  const [storageKey] = useState(() => `demo-${Math.floor(Date.now() / 20000)}`);
  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0">
        {/* Demo-only pace: 500ms per virtual year (default is 4000ms, was
            900ms in a prior pass — still judged too slow) so several rings
            land, wave and all, within the few seconds a catalog card is
            actually judged on, and the scar at years 5-6 with the healing
            that follows reads as visibly moving rather than a longer
            direct-link-only viewing window. */}
        <CambiumLay yearMs={500} storageKey={storageKey} />
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
