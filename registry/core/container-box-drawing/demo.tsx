"use client";

import { RuleFrame } from "./component";

export default function RuleFrameDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-10">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / rule-frame
      </p>
      <RuleFrame title="SESSION" className="w-full max-w-md">
        <div className="flex flex-col gap-3 p-2">
          <p className="text-sm text-foreground">
            Hover or focus this panel, the border upgrades to a double rule,
            sweeping from the top-left corner around the perimeter.
          </p>
          <button
            type="button"
            className="self-start rounded-sm border border-border px-3 py-1.5 font-mono text-xs text-muted transition-colors duration-150 hover:border-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            focus me
          </button>
        </div>
      </RuleFrame>
    </div>
  );
}
