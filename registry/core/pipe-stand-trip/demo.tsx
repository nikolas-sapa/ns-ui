"use client";

import { PipeStandTrip } from "./component";

export default function PipeStandTripDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-8">
      <div className="w-full max-w-sm">
        <PipeStandTrip className="aspect-[3/4]" />
      </div>
    </main>
  );
}
