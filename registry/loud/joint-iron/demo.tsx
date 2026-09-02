"use client";

import { JointIron } from "./component";

// Card-scale demo — no props required, three stations always visible at
// three different phases of the same joint-forming cycle. The footer is
// pinned to the bottom of a full-height page so the joint reads as the
// page's own bottom edge, not as a band with dead space under it.
export default function JointIronDemo() {
  return (
    <div className="flex min-h-screen w-full flex-col justify-end bg-background">
      <JointIron />
    </div>
  );
}
