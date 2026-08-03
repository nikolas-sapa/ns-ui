"use client";

import { GlyphScrubTicker } from "./component";

export default function GlyphScrubTickerDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / marquee-ticker-glyph
      </p>

      <div className="w-full max-w-xl">
        <GlyphScrubTicker
          items={[
            "DRAG TO SCRUB",
            "RELEASE TO FLING",
            "SLOW DOWN TO RESOLVE",
            "GRAB THE TAPE",
          ]}
        />
      </div>

      <p className="max-w-md text-center font-mono text-xs text-muted">
        grab the tape and drag — fast motion blurs into noise glyphs, it resolves back to real text as it slows
      </p>
    </div>
  );
}
