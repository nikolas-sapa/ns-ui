"use client";

import { AsciiCascadeText } from "./component";

export default function AsciiCascadeTextDemo() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-10 overflow-hidden bg-background px-6">
      <p className="absolute left-8 top-8 font-mono text-xs uppercase tracking-widest text-ns-muted">
        ns-ui / text-ascii-cascade
      </p>

      <AsciiCascadeText
        text={"COLLAPSE"}
        className="text-[clamp(3rem,12vw,7rem)] leading-none tracking-tight"
      />

      <button className="inline-flex items-center justify-center rounded-sm border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground transition-colors duration-150 hover:border-foreground/40 hover:bg-border/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent">
        Explore registry
      </button>

      <p className="absolute bottom-8 left-8 font-mono text-xs text-ns-muted">
        hover the headline to force the cascade
      </p>
    </div>
  );
}
