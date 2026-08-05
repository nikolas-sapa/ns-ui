"use client";

import { useEffect, useState } from "react";
import { CloudChamber, type ChamberEvent } from "./component";

// A realistic production event stream: deploys, purchases and errors landing
// at an ambient cadence, with an occasional two-event burst standing in for
// a real incident (and exercising the legend's throttled batch flush). No
// pointer/keyboard input needed — the demo drives its own clock, exactly the
// "genuinely ambient" case autoplay's mode: none exists to record.

const POOL: { name: string; category: string; magnitude: number }[] = [
  { name: "Deploy succeeded — api-gateway", category: "deploy", magnitude: 0.32 },
  { name: "Deploy succeeded — web", category: "deploy", magnitude: 0.28 },
  { name: "Checkout completed", category: "purchase", magnitude: 0.4 },
  { name: "Checkout completed", category: "purchase", magnitude: 0.22 },
  { name: "Cache eviction rate elevated", category: "warning", magnitude: 0.5 },
  { name: "5xx spike — checkout-service", category: "error", magnitude: 0.85 },
  { name: "Timeout — payments-webhook", category: "error", magnitude: 0.68 },
  { name: "Webhook received — billing", category: "signal", magnitude: 0.2 },
  { name: "Deploy rollback — auth-service", category: "deploy", magnitude: 0.58 },
  { name: "Database failover triggered", category: "error", magnitude: 0.95 },
];

let seq = 0;
function nextId() {
  seq += 1;
  return `evt-${seq}`;
}

function randomEvent(): ChamberEvent {
  const pick = POOL[Math.floor(Math.random() * POOL.length)]!;
  const jitter = (Math.random() - 0.5) * 0.16;
  return {
    id: nextId(),
    name: pick.name,
    category: pick.category,
    magnitude: Math.min(1, Math.max(0.05, pick.magnitude + jitter)),
    timestamp: Date.now(),
  };
}

export default function CloudChamberDemo() {
  // seed a handful of already-in-flight events so the resting screenshot
  // shows real, mid-decay tracks rather than an empty chamber at t=0.
  const [events, setEvents] = useState<ChamberEvent[]>(() =>
    Array.from({ length: 5 }, () => randomEvent())
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      setEvents((prev) => {
        const burst = Math.random() < 0.15;
        const next = burst ? [randomEvent(), randomEvent()] : [randomEvent()];
        return [...prev, ...next].slice(-60);
      });
    }, 750);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / event-stream-vapor
      </p>

      <div className="w-full max-w-3xl rounded-lg border border-border bg-background p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-foreground">Production — system weather</h2>
            <p className="text-xs text-ns-muted">Deploys, errors and purchases as they happen</p>
          </div>
          <span className="shrink-0 font-mono text-[11px] text-ns-muted">
            {events.length} tracked
          </span>
        </div>

        <CloudChamber events={events} label="Production event chamber" className="h-[380px]" />
      </div>

      <p className="max-w-md text-center font-mono text-[10px] text-ns-muted">
        a quiet chamber vs. one full of long streaks tells you something before any threshold fires
      </p>
    </div>
  );
}
