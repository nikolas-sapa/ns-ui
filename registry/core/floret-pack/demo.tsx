"use client";

import { FloretPack } from "./component";

export default function FloretPackDemo() {
  return (
    <div className="relative min-h-screen">
      {/* Demo-only pace: the documented defaults (plastochron 1400ms,
          maxPrimordia 700) give a radial-lifetime of ~980s, which resolves
          to well under 1px/s of drift at mid-radius — invisible within the
          few seconds a catalog card is judged on, even though the field is
          moving correctly. plastochron 100ms / maxPrimordia 250 gives a
          ~25s lifetime, ~11px/s at mid-radius (rRim ~0.92 * min(cx,cy) at
          typical card size) and a ~31px mean inter-floret spacing — florets
          visibly stream from meristem to rim while the 34/55 parastichy
          families still read. */}
      <FloretPack className="min-h-screen" plastochron={100} maxPrimordia={250}>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Grown, not generated</h1>
        <p className="mt-2 max-w-[42ch] text-sm leading-relaxed text-ns-muted">
          Every primordium is birthed at the meristem, golden-angle sequenced, and relaxed into place as it advects
          outward toward the rim.
        </p>
      </FloretPack>
    </div>
  );
}
