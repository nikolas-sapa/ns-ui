"use client";

import { LoaderAsciiDiffuseFill } from "./component";

export default function LoaderAsciiDiffuseFillDemo() {
  return (
    <div
      data-diffuse-fill-card
      className="flex min-h-screen flex-col items-center justify-center gap-14 px-6"
    >
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / loader-ascii-diffuse-fill
      </p>

      <div className="flex w-full max-w-xl flex-col gap-10 rounded-xl border border-border bg-surface px-10 py-12">
        <div className="flex flex-col items-center gap-3">
          <span className="font-mono text-[11px] uppercase tracking-widest text-ns-muted">
            default
          </span>
          <LoaderAsciiDiffuseFill aria-label="Loading" className="h-24 w-full max-w-md" />
        </div>

        <div className="flex flex-col items-center gap-3">
          <span className="font-mono text-[11px] uppercase tracking-widest text-ns-muted">
            compact
          </span>
          <LoaderAsciiDiffuseFill aria-label="Loading" className="h-10 w-48" />
        </div>
      </div>
    </div>
  );
}
