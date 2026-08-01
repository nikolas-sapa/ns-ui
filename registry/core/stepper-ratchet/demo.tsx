"use client";

import { useState } from "react";
import { PawlLift } from "./component";

const SEAT_PRICE = 24;

export default function PawlLiftDemo() {
  const [seats, setSeats] = useState(6);
  const [allocation, setAllocation] = useState(40);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / pawl-lift — up is free, down needs a hold
      </p>

      <div className="w-full max-w-sm rounded-md border border-border bg-surface">
        <div className="border-b border-border px-6 py-5">
          <h2 className="text-sm font-semibold text-foreground">Workspace seats</h2>
          <p className="mt-1 text-sm text-muted">
            Billed monthly at ${SEAT_PRICE}/seat. Removing a seat revokes access
            immediately, so it takes a deliberate hold.
          </p>
        </div>
        <div className="flex flex-col gap-4 px-6 py-5">
          <PawlLift
            label="Seats"
            value={seats}
            onValueChange={setSeats}
            min={1}
            max={50}
          />
          <div className="flex items-center justify-between font-mono text-xs text-muted">
            <span>{seats} seat{seats === 1 ? "" : "s"}</span>
            <span>${(seats * SEAT_PRICE).toFixed(0)}/mo</span>
          </div>
        </div>
      </div>

      <div className="w-full max-w-sm rounded-md border border-border bg-surface">
        <div className="border-b border-border px-6 py-5">
          <h2 className="text-sm font-semibold text-foreground">GPU allocation</h2>
          <p className="mt-1 text-sm text-muted">
            Units reserved for this project. Tap + to grab more; hold − and the
            pawl has to swing clear before it lets go of one.
          </p>
        </div>
        <div className="flex flex-col gap-4 px-6 py-5">
          <PawlLift
            label="Allocation"
            unit="units"
            value={allocation}
            onValueChange={setAllocation}
            min={0}
            max={200}
            step={5}
          />
        </div>
      </div>

      <p className="max-w-sm text-center text-xs text-muted">
        Press + to add — instant, no arm delay, and holding it repeats,
        accelerating from 400ms toward 60ms between steps. Press and hold −
        instead: the pawl rotates clear over a quarter second before it
        starts giving anything back, then repeats on that same accelerating
        schedule. Both work with mouse or touch, and each step pulses a
        quick vibration where the device supports it (a no-op on this Mac).
        Focus the number and use Arrow Up/Down: both directions step
        immediately, no hold required.
      </p>
    </div>
  );
}
