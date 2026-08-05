"use client";

import { LogoCloudSettle } from "./component";

export default function LogoCloudSettleDemo() {
  return (
    <main className="bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <span className="font-mono text-sm font-semibold tracking-tight text-foreground">
          ns://ui
        </span>
        <span className="font-mono text-xs tracking-[0.25em] text-ns-muted">
          ns-ui / logo-cloud-settle
        </span>
      </header>
      {/* visible immediately at load, already settled; scroll it out of
          view and back to watch it resettle */}
      <section className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-3xl">
          <LogoCloudSettle />
        </div>
      </section>
      <section className="flex h-[140vh] items-center justify-center border-t border-border p-6">
        <p className="font-mono text-xs text-ns-muted">scroll back up to watch it resettle</p>
      </section>
    </main>
  );
}
