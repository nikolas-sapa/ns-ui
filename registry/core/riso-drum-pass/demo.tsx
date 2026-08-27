"use client";

import { RisoDrumPass } from "./component";

export default function RisoDrumPassDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">ns-ui / riso-drum-pass</p>

      <div className="h-72 w-full max-w-sm overflow-hidden rounded-[14px] border border-border">
        <RisoDrumPass />
      </div>

      <p className="max-w-md text-center text-xs text-ns-muted">
        Three drum passes sweep the sheet in sequence, each landing a few pixels off the last —
        watch the shared dot field double up and drift as pass two and three land.
      </p>
    </div>
  );
}
