"use client";

import { LodestoneHero } from "./component";

export default function LodestoneHeroDemo() {
  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <p className="font-mono text-xs tracking-widest text-muted">
          ns-ui / hero-dipole-field
        </p>
        <p className="hidden font-mono text-[11px] text-muted sm:block">
          move the cursor — the headline iron-files into place · hover the
          primary CTA to bend the field
        </p>
      </header>
      <LodestoneHero
        eyebrow="FIELD-ALIGNED INFRASTRUCTURE"
        headlineLines={["Every signal bends", "toward your stack"]}
        subcopy="Lodestone routes traffic the way a magnet organizes iron filings: declare the pole, and every request, retry, and rollback aligns itself. No orchestration YAML, no drift."
        primaryCta={{ label: "Deploy the field", href: "#deploy" }}
        secondaryCta={{ label: "Read the docs", href: "#docs" }}
        stats={[
          { value: "12ms", label: "p99 route solve" },
          { value: "99.98%", label: "field uptime" },
          { value: "4,200+", label: "clusters aligned" },
        ]}
        className="min-h-[calc(100vh-3.75rem)]"
      />
    </main>
  );
}
