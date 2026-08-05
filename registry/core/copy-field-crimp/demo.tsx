"use client";

import { CrimpCopy } from "./component";

export default function CrimpCopyDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / copy-field-crimp — click the value to copy
      </p>
      <div data-ns-cc-focus className="flex w-full max-w-sm flex-col gap-6">
        <CrimpCopy label="API key" value="ns_51N7f2KcQ9mXG4dP3vB7hT2q0e8f" />
        <CrimpCopy label="Webhook secret" value="8f2a1c9d7b4e6f0a3c5d2e1b9a7c3f0e" masked />
      </div>
    </div>
  );
}
