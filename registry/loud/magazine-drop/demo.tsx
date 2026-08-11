"use client";

import { MagazineDrop } from "./component";

// The plates are generated in the component, so this demo only loads the
// magazine and lets the transport run. It idles: the drum indexes on its own
// every few seconds, so the machine is legible without any input.
export default function MagazineDropDemo() {
  return (
    <main className="h-screen w-full overflow-hidden bg-background">
      <MagazineDrop />
    </main>
  );
}
