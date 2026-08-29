"use client";

import { BitplaneCascade } from "./component";

export default function BitplaneCascadeDemo() {
  return (
    <div className="relative h-screen w-full overflow-hidden bg-background">
      <div className="absolute inset-0">
        <BitplaneCascade />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-start gap-3 p-10 text-left">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
          ns-ui / bitplane-cascade
        </p>
        <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-foreground">
          Four planes, one image
        </h1>
        <p className="max-w-sm text-sm text-ns-muted">
          A coarse silhouette resolves into finer tonal bands as each bitplane
          composites in, MSB first — then the stack clears and rebuilds.
        </p>
      </div>
    </div>
  );
}
