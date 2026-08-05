"use client";

import type { ReactNode } from "react";

import { BellowsCrumb, type BellowsCrumbItem } from "./component";

// Hoisted so the measurement effect isn't handed a new array identity on
// every parent render.
const TRAIL: BellowsCrumbItem[] = [
  { id: "home", label: "Home", href: "#home" },
  { id: "repositories", label: "repositories", href: "#repositories" },
  { id: "ns-ui", label: "ns-ui", href: "#ns-ui" },
  { id: "registry", label: "registry", href: "#registry" },
  { id: "core", label: "core", href: "#core" },
  { id: "breadcrumb-fold", label: "breadcrumb-fold.tsx" },
];

function Frame({ width, note, children }: { width: string; note: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ns-muted">{note}</p>
      <div className={`rounded-md border border-border bg-surface p-4 ${width}`}>{children}</div>
    </div>
  );
}

export default function BellowsCrumbDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 px-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / breadcrumb-fold — every ancestor stays reachable, pleated
      </p>

      <div className="flex w-full max-w-2xl flex-col items-start gap-8">
        <Frame width="w-[380px]" note="fixed budget — ancestors rest pleated">
          <BellowsCrumb items={TRAIL} />
        </Frame>

        <Frame width="w-full" note="wider budget — the same trail, more room to breathe">
          <BellowsCrumb items={TRAIL} />
        </Frame>
      </div>
    </div>
  );
}
