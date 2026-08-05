"use client";

import { PrismDragSplit } from "./component";

export default function PrismDragSplitDemo() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background">
      <p className="absolute left-8 top-8 font-mono text-xs uppercase tracking-widest text-ns-muted">
        ns-ui / text-prism-split
      </p>

      <PrismDragSplit
        text="REFRACTION"
        className="px-6 py-10 text-[clamp(2.75rem,10vw,8rem)] leading-none"
      />

      <button
        className="mt-14 inline-flex items-center justify-center rounded-sm border border-black/10 bg-black/[0.04] px-5 py-2.5 text-sm font-medium text-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),0_4px_16px_-4px_rgba(0,0,0,0.15)] backdrop-blur-xl backdrop-saturate-150 transition-[transform,background-color,border-color] duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-px hover:border-black/15 hover:bg-black/[0.07] active:translate-y-0 active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:border-white/10 dark:bg-white/[0.06] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),0_8px_24px_-8px_rgba(0,0,0,0.5)] dark:hover:border-white/20 dark:hover:bg-white/[0.1]"
      >
        Explore registry
      </button>

      <p className="absolute bottom-8 left-8 font-mono text-xs text-ns-muted">
        drag the prism
      </p>
    </div>
  );
}
