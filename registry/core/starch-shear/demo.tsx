"use client";

import { useState } from "react";
import { StarchShear, type StarchShearItem } from "./component";

const ITEMS: StarchShearItem[] = Array.from({ length: 12 }, (_, i) => ({
  id: `frame-${i}`,
  label: `Frame ${i + 1}`,
  caption: `0:${String((i + 1) * 4).padStart(2, "0")}`,
}));

export default function StarchShearDemo() {
  const [index, setIndex] = useState(1);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">ns-ui / starch-shear</p>

      <div className="w-full max-w-lg rounded-[12px] border border-border bg-background p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="text-sm text-foreground">Reel_master.mov</span>
          <span className="font-mono text-xs tabular-nums text-ns-muted">
            Frame {index + 1} / {ITEMS.length}
          </span>
        </div>

        <StarchShear items={ITEMS} value={index} onValueChange={setIndex} label="Reel frames" />
      </div>

      <p className="max-w-md text-center text-xs text-ns-muted">
        Drag slowly and the strip flows, each frame lagging its neighbor. Flick
        it and the strip locks rigid, moving as one piece.
      </p>
    </div>
  );
}
