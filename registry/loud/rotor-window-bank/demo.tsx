"use client";

import { RotorWindowBank } from "./component";

// Unconditional idle loop from mount — the wheels tick, kick, and
// double-step entirely on their own clock, so the demo needs nothing beyond
// mounting the bank itself.
export default function RotorWindowBankDemo() {
  return (
    <main className="h-screen w-full overflow-hidden bg-background">
      <RotorWindowBank />
    </main>
  );
}
