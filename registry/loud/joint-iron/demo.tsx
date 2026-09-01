"use client";

import { JointIron } from "./component";

// Card-scale demo — no props required, three stations always visible at
// three different phases of the same joint-forming cycle.
export default function JointIronDemo() {
  return (
    <div className="flex min-h-[70vh] w-full flex-col justify-end bg-background">
      <JointIron />
    </div>
  );
}
