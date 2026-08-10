"use client";

import { PinBarrel } from "./component";

export default function PinBarrelDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">ns-ui / pin-barrel</p>
      <PinBarrel defaultValue="0 */2 * * *" />
      <p className="max-w-md text-center text-xs text-ns-muted">
        Every hour the expression fires gets a raised pin in the seven-day rule. Edit the hour
        field and watch the pins reseat.
      </p>
    </div>
  );
}
