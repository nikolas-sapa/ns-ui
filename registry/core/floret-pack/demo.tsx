"use client";

import { FloretPack } from "./component";

export default function FloretPackDemo() {
  return (
    <div className="relative min-h-screen">
      <FloretPack className="min-h-screen">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Grown, not generated</h1>
        <p className="mt-2 max-w-[42ch] text-sm leading-relaxed text-ns-muted">
          Every primordium is birthed at the meristem, golden-angle sequenced, and relaxed into place as it advects
          outward toward the rim.
        </p>
      </FloretPack>
    </div>
  );
}
