"use client";

import { useState } from "react";
import { DovetailPick } from "./component";

type Density = "compact" | "comfortable" | "spacious";

const ROW_PADDING: Record<Density, string> = {
  compact: "py-1.5",
  comfortable: "py-2.5",
  spacious: "py-4",
};

const ROWS = [
  { id: "INV-1042", customer: "Marsh & Bell", amount: "$1,240.00", status: "Paid" },
  { id: "INV-1041", customer: "Colston Ridge", amount: "$860.00", status: "Paid" },
  { id: "INV-1040", customer: "Fenwick Ltd.", amount: "$2,015.50", status: "Due" },
  { id: "INV-1039", customer: "Aldergate Co.", amount: "$430.00", status: "Overdue" },
];

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${
        status === "Paid"
          ? "border-border text-muted"
          : status === "Due"
            ? "border-border text-foreground"
            : "border-foreground/40 text-foreground"
      }`}
    >
      {status}
    </span>
  );
}

export default function DovetailPickDemo() {
  const [density, setDensity] = useState<Density>("comfortable");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / dovetail-pick — click a slot, watch it seat
      </p>

      <div className="w-full max-w-xl rounded-md border border-border bg-foreground/[0.02]">
        <div className="flex flex-wrap items-center gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-foreground">Invoices</h2>
            <p className="mt-0.5 font-mono text-xs text-muted">
              {ROWS.length} rows · row density
            </p>
          </div>
          <DovetailPick
            aria-label="Row density"
            options={[
              { value: "compact", label: "Compact" },
              { value: "comfortable", label: "Comfortable" },
              { value: "spacious", label: "Spacious" },
            ]}
            value={density}
            onValueChange={(v) => setDensity(v as Density)}
          />
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left font-mono text-xs uppercase tracking-wider text-muted">
              <th className="px-5 py-2 font-normal">Invoice</th>
              <th className="px-5 py-2 font-normal">Customer</th>
              <th className="px-5 py-2 font-normal">Amount</th>
              <th className="px-5 py-2 font-normal">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ROWS.map((r) => (
              <tr key={r.id} className="transition-colors hover:bg-foreground/[0.03]">
                <td className={`px-5 font-mono text-xs text-muted ${ROW_PADDING[density]}`}>
                  {r.id}
                </td>
                <td className={`px-5 text-foreground ${ROW_PADDING[density]}`}>
                  {r.customer}
                </td>
                <td className={`px-5 font-mono text-xs text-foreground ${ROW_PADDING[density]}`}>
                  {r.amount}
                </td>
                <td className={`px-5 ${ROW_PADDING[density]}`}>
                  <StatusPill status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <p className="font-mono text-xs text-muted">density / {density}</p>
          <p className="font-mono text-xs text-muted">synced across table</p>
        </div>
      </div>

      <p className="max-w-md text-center text-xs text-muted">
        Click a slot or arrow-key between them — the trapezoid lifts out of
        its old seat, slides, and eases down into the new one a beat later.
      </p>
    </div>
  );
}
