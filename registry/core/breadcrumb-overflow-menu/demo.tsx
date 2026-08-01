"use client";

import type { ReactNode } from "react";

import { WornPath, type Crumb } from "./component";

// Hoisted so the component's measurement effect isn't handed a new array
// identity on every parent render.
const TRAIL: Crumb[] = [
  { id: "home", label: "Home", href: "#home" },
  { id: "projects", label: "Projects", href: "#projects" },
  { id: "acme", label: "Acme", href: "#acme" },
  { id: "settings", label: "Settings", href: "#settings" },
  { id: "billing", label: "Billing", href: "#billing" },
  { id: "invoices", label: "Invoices" },
];

// The same trail at two container widths, stacked. The collapse rule is
// readable from a still frame: row two is row one with the middle folded away.
function Frame({ width, note, children }: { width: string; note: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">{note}</p>
      <div className={`rounded-md border border-border bg-surface p-4 ${width}`}>{children}</div>
    </div>
  );
}

export default function WornPathDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 px-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / breadcrumb-overflow-menu — a trail that gives way from the middle
      </p>

      <div className="flex w-full max-w-2xl flex-col items-start gap-8">
        <Frame width="w-full" note="container — full width">
          <WornPath items={TRAIL} />
        </Frame>

        <Frame width="w-[352px]" note="container — 320px">
          <WornPath items={TRAIL} />
        </Frame>
      </div>
    </div>
  );
}
