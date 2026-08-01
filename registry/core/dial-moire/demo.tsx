"use client";

import { useState } from "react";
import { MoireDial } from "./component";

const START_ANGLES = [-132, 97, -61, 149];

export default function MoireDialDemo() {
  const [seed, setSeed] = useState(0);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 bg-background px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / dial-moire
      </p>
      <MoireDial
        key={seed}
        message="SIGNAL"
        initialAngle={START_ANGLES[seed % START_ANGLES.length]}
        className="max-w-md"
      />
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted">
        TUNE TO ALIGN
      </p>
      <button
        onClick={() => setSeed((s) => s + 1)}
        className="rounded-sm border border-border px-4 py-2 font-mono text-xs text-muted transition-colors duration-150 hover:border-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        scramble
      </button>
    </div>
  );
}
