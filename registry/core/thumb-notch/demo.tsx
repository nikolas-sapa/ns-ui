"use client";

import { useState } from "react";
import { ThumbNotch } from "./component";

export default function ThumbNotchDemo() {
  const [lastJump, setLastJump] = useState<string | null>(null);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / thumb-notch
      </p>

      <ThumbNotch label="Contacts" onJump={setLastJump} />

      <p className="max-w-sm text-center text-xs text-ns-muted">
        Tap or press-drag the die-cut edge to riffle through — the deeper,
        foreground-colored notch is always the on-screen letter, readable at
        rest with no scrollbar. Type a letter with the list focused for the
        same jump, keyboard-only.
        {lastJump ? ` Last jump: ${lastJump.toUpperCase()}.` : ""}
      </p>
    </div>
  );
}
