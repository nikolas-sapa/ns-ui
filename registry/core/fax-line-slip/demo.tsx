"use client";

import { FaxLineSlip } from "./component";

export default function FaxLineSlipDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">ns-ui / fax-line-slip</p>

      <div className="h-72 w-full max-w-sm overflow-hidden rounded-[14px] border border-border">
        <FaxLineSlip label="Resolving attachment" />
      </div>

      <p className="max-w-md text-center text-xs text-ns-muted">
        Two handshake tones open the connection, then the page arrives as scan lines —
        watch for the one paper-slip shear partway down before the lines resume true.
      </p>
    </div>
  );
}
