"use client";

import { RapidWire } from "./component";

// The built-in demo cycle (no onSubmit prop) already rotates through the
// four cases worth showing on one control: exact capture, change due,
// partial capture with an instant refund on the balance, and a decline with
// the hold released back — the whole point of the round trip. Repeated
// clicks walk the cycle; nothing here scripts the timeline separately.
export default function RapidWireDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / rapid-wire
      </p>

      <RapidWire amount={24} />

      <p className="max-w-md text-center text-xs text-ns-muted">
        Send payment launches the cup along the wire to the cashier post. It
        rocks while the server settles, then coasts back with the receipt —
        and, when there is one, the change or refund riding as its own line.
        Click again to see the next case: exact tender, change due, a partial
        authorization with an instant refund, then a decline with the hold
        released.
      </p>
    </div>
  );
}
