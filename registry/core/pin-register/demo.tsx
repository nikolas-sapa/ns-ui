"use client";

import { useState } from "react";
import { PinRegister, type PinRegisterLayer } from "./component";

function BaseSwatch() {
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden="true">
      <rect x="0.5" y="0.5" width="17" height="13" rx="1" stroke="currentColor" strokeWidth="1" />
      <path d="M6 0.5V13.5M12 0.5V13.5M0.5 4.7H17.5M0.5 9.3H17.5" stroke="currentColor" strokeWidth="0.8" />
    </svg>
  );
}

function LabelsSwatch() {
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden="true">
      <path
        d="M2 4h6M2 7h9M2 10h4.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TrafficSwatch() {
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden="true">
      <path
        d="M1 12C4 12 4 2 8 2C11 2 10 9 13.5 9C15.5 9 16 5 17 3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BoundariesSwatch() {
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden="true">
      <path
        d="M2 11L6 2L13 3.5L16 11Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeDasharray="2 1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HeatSwatch() {
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden="true">
      <circle cx="9" cy="7" r="2" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="9" cy="7" r="4.4" stroke="currentColor" strokeWidth="0.9" opacity="0.7" />
      <circle cx="9" cy="7" r="6.6" stroke="currentColor" strokeWidth="0.7" opacity="0.4" />
    </svg>
  );
}

const LAYERS: PinRegisterLayer[] = [
  { id: "base", label: "Base", swatch: <BaseSwatch /> },
  { id: "labels", label: "Labels", swatch: <LabelsSwatch /> },
  { id: "traffic", label: "Traffic", swatch: <TrafficSwatch /> },
  { id: "boundaries", label: "Boundaries", swatch: <BoundariesSwatch /> },
  { id: "heat", label: "Heat", active: false, swatch: <HeatSwatch /> },
];

export default function PinRegisterDemo() {
  const [count, setCount] = useState(4);

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md">
        <p className="mb-4 text-center font-mono text-xs text-ns-muted">ns-ui / pin-register</p>
        <div className="rounded-md border border-border bg-surface p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-foreground">Map layers</h2>
            <p className="mt-1 text-xs text-ns-muted">
              Hover the panel to fan the stack. Drag a sheet, or Alt+Arrow, to reorder.
            </p>
          </div>

          <PinRegister layers={LAYERS} onChange={(ids) => setCount(ids.length)} />

          <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
            <p className="font-mono text-[10px] text-ns-muted">{count} of 5 layers on the map</p>
          </div>
        </div>
      </div>
    </div>
  );
}
