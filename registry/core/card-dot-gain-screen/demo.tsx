"use client";

import { CardDotGainScreen } from "./component";

export default function CardDotGainScreenDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">ns-ui / card-dot-gain-screen</p>

      <CardDotGainScreen />

      <p className="max-w-md text-center text-xs text-ns-muted">
        The screen runs the full plate — highlight to shadow — behind the copy; watch the bottom-right
        corner over a few seconds as the dots swell, bridge and plug solid, then ease back.
      </p>
    </div>
  );
}
