"use client";

import { GlyphCast } from "./component";

export default function GlyphCastDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-10">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / hero-ascii-wordmark
      </p>
      <GlyphCast text="NS UI" className="max-w-3xl" cursorRadius={110} />
      <p className="max-w-md text-center font-mono text-xs text-ns-muted">
        move the pointer across the wordmark — it is the light source
      </p>
    </div>
  );
}
