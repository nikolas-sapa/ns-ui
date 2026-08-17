"use client";

import { useRef, useState } from "react";
import { SpindleStrike, type SpindleTransaction } from "./component";

const INITIAL: SpindleTransaction[] = [
  { id: "txn-1", date: "Jun 28", amount: 89.99, status: "settled" },
  { id: "txn-2", date: "Jul 05", amount: 68.2, status: "settled" },
  // Refunded 6 slots back from the newest on purpose, not closer: REFUND_LIFT
  // (24px) is exactly 6 * CARD_GAP (4px) in the component, so a refund pulled
  // up from any nearer than that outranks every new arrival's z-index until
  // enough fresh settles have piled up beneath it to catch up — with the
  // refund on txn-6 (2 slots back) that took 4 clicks of "Settle a payment"
  // with zero visible change on the card before the topmost card finally
  // moved, reading as broken. Six slots back means the very next settle
  // already ties (and, on the tie, wins via later DOM order), so the demo's
  // primary interaction reads as live on the first press.
  { id: "txn-3", date: "Jul 12", amount: 150.0, status: "refunded", refundedAmount: 150.0 },
  { id: "txn-4", date: "Jul 19", amount: 41.0, status: "settled" },
  { id: "txn-5", date: "Jul 26", amount: 96.4, status: "settled" },
  { id: "txn-6", date: "Aug 02", amount: 30.0, status: "settled" },
  { id: "txn-7", date: "Aug 09", amount: 58.5, status: "settled" },
  { id: "txn-8", date: "Aug 15", amount: 212.0, status: "settled" },
];

const MAX_ITEMS = 12;

export default function SpindleStrikeDemo() {
  const [transactions, setTransactions] = useState<SpindleTransaction[]>(INITIAL);
  const nextIdRef = useRef(9);

  function settlePayment() {
    setTransactions((prev) => {
      const n = nextIdRef.current++;
      const amount = Math.round((45 + ((n * 37) % 210)) * 100) / 100;
      const day = 15 + (n - 8) * 2;
      const next: SpindleTransaction = {
        id: `txn-${n}`,
        date: `Aug ${day}`,
        amount,
        status: "settled",
      };
      const merged = [...prev, next];
      return merged.length > MAX_ITEMS ? merged.slice(merged.length - MAX_ITEMS) : merged;
    });
  }

  function refundNewestSettled() {
    setTransactions((prev) => {
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i].status === "settled") {
          const copy = [...prev];
          copy[i] = { ...copy[i], status: "refunded", refundedAmount: copy[i].amount };
          return copy;
        }
      }
      return prev;
    });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">ns-ui / spindle-strike</p>

      <SpindleStrike transactions={transactions} ariaLabel="Payment history" />

      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          data-action="settle"
          onClick={settlePayment}
          className="rounded-md border border-border px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:bg-foreground/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
        >
          Settle a payment
        </button>
        <button
          type="button"
          data-action="refund"
          onClick={refundNewestSettled}
          className="rounded-md border border-border px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:bg-foreground/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
        >
          Refund newest settled
        </button>
      </div>
    </div>
  );
}
