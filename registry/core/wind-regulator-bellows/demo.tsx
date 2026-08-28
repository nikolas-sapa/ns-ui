"use client";

import { WindRegulatorBellows } from "./component";

export default function WindRegulatorBellowsDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">ns-ui / wind-regulator-bellows</p>

      <div className="flex w-full max-w-md flex-col gap-2">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/40">
          <div className="h-full w-2/5 rounded-full bg-ns-accent" />
        </div>
        <WindRegulatorBellows label="Buffered ahead" />
      </div>

      <p className="max-w-md text-center text-xs text-ns-muted">
        The reservoir's lid steps up on every network fetch, then drains at a steady rate as
        playback consumes it — a spill valve caps the top so a burst of pre-fetching never
        overflows the reading.
      </p>
    </div>
  );
}
