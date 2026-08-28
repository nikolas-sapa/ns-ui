"use client";

import { CapstanSlip } from "./component";

export default function CapstanSlipDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-md">
        <p className="mb-8 font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
          ns-ui / capstan-slip — determinate progress
        </p>

        <section>
          <p className="mb-4 max-w-sm text-sm leading-relaxed text-ns-muted">
            The capstan shaft turns at a constant rate — it never slips. The
            tape's own speed comes from the pinch roller's nip, and every so
            often that nip compresses and slips before catching back up.
          </p>

          <CapstanSlip label="ENCODING" />
        </section>
      </div>
    </main>
  );
}
