"use client";

import { useState } from "react";
import { NeedleStepper } from "./component";

const CURRENT_TEMP = 20.8;
const UNIT_PRICE = 18.5;

export default function NeedleStepperDemo() {
  const [setpoint, setSetpoint] = useState(21.5);
  const [qty, setQty] = useState(2);
  const delta = setpoint - CURRENT_TEMP;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / stepper-needle — a number stepper that draws its own history
      </p>

      {/* thermostat panel */}
      <div className="w-full max-w-md rounded-md border border-border bg-surface">
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Climate — Zone 2
            </h2>
            <p className="mt-1 text-sm text-muted">
              Set the target temperature for the living room.
            </p>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            auto
          </span>
        </div>

        <div className="flex flex-col gap-5 px-6 py-5">
          <div className="flex items-end justify-between">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                current
              </span>
              <p className="mt-1 font-mono text-4xl font-semibold tracking-tight text-foreground">
                {CURRENT_TEMP.toFixed(1)}
                <span className="ml-1 text-lg text-muted">°C</span>
              </p>
            </div>
            <p className="pb-1 text-right font-mono text-xs text-muted">
              {delta === 0
                ? "holding"
                : `${delta > 0 ? "heating" : "cooling"} ${Math.abs(delta).toFixed(1)}°`}
            </p>
          </div>

          <NeedleStepper
            label="Target temperature"
            unit="°C"
            value={setpoint}
            onValueChange={setSetpoint}
            min={10}
            max={30}
            step={0.5}
          />

          <p className="text-xs text-muted">
            Click − or + (or type a number) to change the target. Each change
            is etched onto the history strip on the right — the ringed dot is
            your latest adjustment. A red edge appears when you hit the 10–30
            °C limit.
          </p>
        </div>
      </div>

      {/* cart quantity beside a live subtotal */}
      <div className="w-full max-w-md rounded-md border border-border bg-surface">
        <div className="flex items-center justify-between gap-6 px-6 py-5">
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-foreground">
              Anodized cable organizer
            </h3>
            <p className="mt-1 font-mono text-xs text-muted">
              ${UNIT_PRICE.toFixed(2)} each · ships in 2 days
            </p>
          </div>
          <div className="text-right">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              subtotal
            </span>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">
              ${(qty * UNIT_PRICE).toFixed(2)}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-border px-6 py-5">
          <NeedleStepper
            label="Quantity"
            unit="pcs"
            value={qty}
            onValueChange={setQty}
            min={1}
            max={12}
            step={1}
          />
          <p className="text-xs text-muted">
            Changing the quantity updates the subtotal above. Hold − or + to
            sweep quickly.
          </p>
        </div>
      </div>

      <p className="max-w-md text-center text-xs text-muted">
        Keyboard: arrow keys step, Shift+Arrow jumps 10 steps, Home/End snap to
        the limits, typed values clamp on Enter. Hitting a limit gives the
        needle a hard-stop quiver.
      </p>
    </div>
  );
}
