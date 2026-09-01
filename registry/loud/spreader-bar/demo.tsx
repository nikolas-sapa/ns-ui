"use client";

import { SpreaderBar } from "./component";

// Default marks and their measured ink coverage are enough to show the whole
// mechanic at card scale: no props required, no settled state to wait for.
export default function SpreaderBarDemo() {
  return (
    <div className="flex w-full items-center justify-center bg-background px-4 py-10">
      <SpreaderBar className="max-w-xl" />
    </div>
  );
}
