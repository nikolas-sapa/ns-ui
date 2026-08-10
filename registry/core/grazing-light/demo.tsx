"use client";

import { GrazingLightCard, GrazingLightGrid } from "./component";

const FEATURES = [
  {
    heading: "Edge routing",
    body: "Requests resolve at the nearest region before your origin ever wakes up.",
    href: "#edge-routing",
  },
  {
    heading: "Live diffing",
    body: "Every deploy ships a byte-level diff against the previous build, not a full re-push.",
    href: "#live-diffing",
  },
  {
    heading: "Typed webhooks",
    body: "Payload shapes are generated from your schema, so a bad event fails at compile time.",
    href: "#typed-webhooks",
  },
  {
    heading: "Cold-start budget",
    body: "A hard 40ms ceiling on first invoke, enforced in CI before it ships.",
    href: "#cold-start-budget",
  },
  {
    heading: "Audit trail",
    body: "Every mutation is signed and replayable, down to the field that changed.",
    href: "#audit-trail",
  },
  {
    heading: "Rollback anywhere",
    body: "Pin traffic to any prior build by hash, no redeploy required.",
    href: "#rollback-anywhere",
  },
];

export default function GrazingLightDemo() {
  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-10 px-6 py-20">
        <header className="max-w-xl">
          <p className="font-mono text-xs uppercase tracking-widest text-ns-muted">ns-ui / grazing-light</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">Blind embossed, lit in passing</h1>
          <p className="mt-3 text-sm leading-relaxed text-ns-muted">
            Every icon and heading below is carved into the surface, not printed on it — the relief only
            shows when a low-angle light rakes across. At rest the light drifts a slow 24-second circuit.
            Move your cursor over the grid and every card tilts its own light toward it at once.
          </p>
        </header>

        <GrazingLightGrid
          aria-label="Feature grid lit by a raking light"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {FEATURES.map((f) => (
            <GrazingLightCard key={f.heading} heading={f.heading} body={f.body} href={f.href} />
          ))}
        </GrazingLightGrid>
      </section>
    </main>
  );
}
