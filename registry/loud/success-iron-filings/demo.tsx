"use client";

import { IronFilings } from "./component";

export default function IronFilingsDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 px-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / success-iron-filings — confirm, and the field switches on
      </p>
      <IronFilings className="w-full max-w-md" />
    </div>
  );
}
