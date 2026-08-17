"use client";

import { useState } from "react";
import { CruetSettle, type CruetSettleLine } from "./component";

const BASE: CruetSettleLine[] = [
  { key: "net", label: "Net", amount: 605 },
  { key: "tax", label: "VAT 20%", amount: 121 },
  { key: "fees", label: "Card fee", amount: 12.5 },
  { key: "discount", label: "Promo SAVE45", amount: 45, kind: "subtract" },
];

const RUSH: CruetSettleLine[] = [
  { key: "net", label: "Net", amount: 605 },
  { key: "tax", label: "VAT 20%", amount: 121 },
  { key: "fees", label: "Card fee", amount: 12.5 },
  { key: "rush", label: "Rush shipping", amount: 38 },
  { key: "discount", label: "Promo SAVE45", amount: 45, kind: "subtract" },
];

export default function CruetSettleDemo() {
  const [rush, setRush] = useState(false);
  const lines = rush ? RUSH : BASE;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-xl">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">ns-ui / cruet-settle</p>
        <div className="rounded-md border border-border bg-background p-6">
          <CruetSettle lines={lines} label="Order total" />
        </div>
        <button
          type="button"
          onClick={() => setRush((r) => !r)}
          className="mt-4 rounded-sm border border-border px-3 py-1.5 font-mono text-xs text-ns-muted transition-colors duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
        >
          {rush ? "Remove rush shipping" : "Add rush shipping"}
        </button>
      </div>
    </main>
  );
}
