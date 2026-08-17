"use client";

import { ContraStrike, type ContraStrikeLine } from "./component";

const LINES: ContraStrikeLine[] = [
  {
    id: "mouse",
    description: "Wireless Mouse ×6",
    qty: 6,
    unitPrice: 12.5,
    defaultStruck: 2 / 6,
  },
  {
    id: "keyboard",
    description: "Keyboard ×2",
    qty: 2,
    unitPrice: 45,
    defaultStruck: 0.5,
  },
  {
    id: "shipping",
    description: "Priority Shipping",
    qty: 1,
    unitPrice: 18,
    committedStruck: 1,
  },
];

export default function ContraStrikeDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
          ns-ui / contra-strike
        </p>
        <ContraStrike
          orderLabel="Order #4471"
          lines={LINES}
          onCommit={(line, refundAmount) => {
            console.log(`refunded ${refundAmount.toFixed(2)} on ${line.description}`);
          }}
        />
      </div>
    </div>
  );
}
