"use client";

import { useEffect, useRef, useState } from "react";
import { SolariFlap } from "./component";

// A real departure board is never one line — it's a table of flights, each
// row clattering on its OWN clock. A single-row demo reads as a marquee, not
// a board. Five flap groups per row (TIME / FLIGHT / DESTINATION / GATE /
// STATUS) at fixed character widths so cell counts never shift mid-cycle,
// each row driven by its own timer with a distinct period and start delay —
// rows visibly land at different moments, the way a real Solari board never
// updates in unison. No pointer/keyboard input required, matching the
// self-driving SCRIPT pattern used elsewhere in this registry.
const pad = (s: string, w: number) => s.toUpperCase().slice(0, w).padEnd(w, " ");

const CELL_W = 26;
const CELL_H = 38;

interface Flight {
  time: string;
  flight: string;
  dest: string;
  gate: string;
  gates?: string[];
  statuses: string[];
  periodMs: number;
  delayMs: number;
}

const FLIGHTS: Flight[] = [
  {
    time: "08:15",
    flight: "BA118",
    dest: "LONDON",
    gate: "12",
    statuses: ["ON TIME", "BOARDING", "FINAL CALL", "DEPARTED"],
    periodMs: 2700,
    delayMs: 300,
  },
  {
    time: "08:40",
    flight: "AF230",
    dest: "PARIS",
    gate: "07",
    statuses: ["ON TIME", "DELAYED", "BOARDING", "DEPARTED"],
    periodMs: 3300,
    delayMs: 1100,
  },
  {
    time: "09:05",
    flight: "LH441",
    dest: "MUNICH",
    gate: "21",
    gates: ["21", "21", "33", "33"],
    statuses: ["ON TIME", "GATE CHNG", "BOARDING", "DEPARTED"],
    periodMs: 3000,
    delayMs: 1900,
  },
  {
    time: "09:30",
    flight: "EK203",
    dest: "DUBAI",
    gate: "15",
    statuses: ["ON TIME", "DELAYED", "FINAL CALL", "DEPARTED"],
    periodMs: 3600,
    delayMs: 700,
  },
];

function FlightRow({ flight }: { flight: Flight }) {
  const [step, setStep] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const ms = step === 0 ? flight.delayMs : flight.periodMs;
    timerRef.current = setTimeout(() => setStep((s) => s + 1), ms);
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const idx = step % flight.statuses.length;
  const status = flight.statuses[idx]!;
  const gate = flight.gates ? flight.gates[idx]! : flight.gate;

  return (
    <div className="flex items-center gap-4">
      <SolariFlap value={pad(flight.time, 5)} cellWidth={CELL_W} cellHeight={CELL_H} />
      <SolariFlap value={pad(flight.flight, 6)} cellWidth={CELL_W} cellHeight={CELL_H} />
      <SolariFlap value={pad(flight.dest, 9)} cellWidth={CELL_W} cellHeight={CELL_H} />
      <SolariFlap value={pad(gate, 3)} cellWidth={CELL_W} cellHeight={CELL_H} />
      <SolariFlap value={pad(status, 10)} cellWidth={CELL_W} cellHeight={CELL_H} />
    </div>
  );
}

const COLUMNS: { label: string; chars: number }[] = [
  { label: "TIME", chars: 5 },
  { label: "FLIGHT", chars: 6 },
  { label: "DESTINATION", chars: 9 },
  { label: "GATE", chars: 3 },
  { label: "STATUS", chars: 10 },
];

function colWidth(chars: number) {
  return chars * (CELL_W + 3) - 3;
}

export default function SolariFlapDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / split-flap-board
      </p>

      <div className="ns-sf-departures inline-flex flex-col gap-4 rounded-[16px] border border-border bg-background p-8">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-ns-muted">
          Departures
        </span>

        <div className="flex gap-4">
          {COLUMNS.map((col) => (
            <span
              key={col.label}
              style={{ width: colWidth(col.chars) }}
              className="font-mono text-[10px] uppercase tracking-[0.15em] text-ns-muted"
            >
              {col.label}
            </span>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          {FLIGHTS.map((flight) => (
            <FlightRow key={flight.flight} flight={flight} />
          ))}
        </div>
      </div>

      <p className="max-w-md text-center text-xs text-ns-muted">
        Hover the board to pause it; hover a single flap to lift it 22° and
        peek the glyph underneath.
      </p>
    </div>
  );
}
