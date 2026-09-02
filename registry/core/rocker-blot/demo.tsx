"use client";

import { RockerBlot } from "./component";

// Card-scale: the blotter is alive at rest before anyone types (six seeded
// ghosts, unconditional edge softening) and the payoff — a physically
// located, DOM-readable queue position — only shows up once a real
// placeholder submission is made. No network, no navigation.
export default function RockerBlotDemo() {
  return (
    <main className="flex h-screen w-full items-center justify-center bg-background p-6">
      <RockerBlot className="ns-rb-card" onReferral={() => {}} />
    </main>
  );
}
