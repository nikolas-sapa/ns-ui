"use client";

import { useState } from "react";
import { DecryptText } from "./component";

export default function DecryptTextDemo() {
  const [replayKey, setReplayKey] = useState(0);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / decrypt-text
      </p>
      <DecryptText
        replayKey={replayKey}
        text="ACCESS GRANTED"
        className="text-4xl font-semibold tracking-tight sm:text-5xl"
      />
      <button
        onClick={() => setReplayKey((k) => k + 1)}
        className="rounded-sm border border-border px-4 py-2 font-mono text-xs text-muted transition-colors duration-150 hover:border-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        replay
      </button>
    </div>
  );
}
