"use client";

import { FresnelFlashGroup } from "./component";

export default function FresnelFlashGroupDemo() {
  return (
    <main className="min-h-screen bg-background">
      <section className="border-b border-border px-6 py-16">
        <p className="mx-auto max-w-3xl font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / fresnel-flash-group
        </p>
        <h1 className="mx-auto mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          A light that never stops turning.
        </h1>
      </section>

      <FresnelFlashGroup>
        <p className="font-mono text-xs uppercase tracking-widest text-ns-muted">
          Fl 8s
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Every station has its own signature.
        </h2>
      </FresnelFlashGroup>

      <section className="border-t border-border px-6 py-16">
        <p className="mx-auto max-w-3xl text-sm leading-relaxed text-ns-muted">
          Eight glass panels ring a fixed lamp and turn together at a steady
          rate. Each panel's own glint sweeps past the marker once a second;
          the brighter primary panel's pass — once every 8 seconds — is the
          station's identifying flash.
        </p>
      </section>
    </main>
  );
}
