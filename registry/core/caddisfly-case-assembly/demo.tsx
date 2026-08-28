"use client";

import { CaddisflyCaseAssembly } from "./component";

export default function CaddisflyCaseAssemblyDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / caddisfly-case-assembly
        </p>
        <CaddisflyCaseAssembly />
        <p className="mt-3 font-mono text-[11px] text-ns-muted">
          grains drift to the rim, snap-cement or bounce off, and the case spirals outward course
          by course
        </p>
      </div>
    </main>
  );
}
