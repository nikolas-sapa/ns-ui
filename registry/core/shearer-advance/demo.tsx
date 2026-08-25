"use client";

import { useEffect, useRef, useState } from "react";
import { ShearerAdvance } from "./component";

const ROW_COUNT_START = 6;
const ROW_BATCH = 4;
const MAX_ROWS = 18;
const FETCH_MS = 2600; // one simulated "loading more rows" round trip
const HOLD_MS = 1400; // sit on the freshly-appended rows before fetching again
const EXHAUSTED_HOLD_MS = 2600; // sit on "no more rows" before the demo resets

export default function ShearerAdvanceDemo() {
  const [rows, setRows] = useState(ROW_COUNT_START);
  const [loading, setLoading] = useState(true);
  const runRef = useRef(0);

  // ambient state machine: appends a batch of rows every couple of seconds
  // until the list is exhausted, so the "list growing" side of the mapping
  // is visible right next to the mechanism driving it — no scrolling needed.
  // Exhausted is a real terminal state consumers will hit, so it's held
  // legible for a beat, then the demo resets back to the start and loops
  // forever rather than parking dead on a thumbnail.
  useEffect(() => {
    const timers: number[] = [];
    const step = () => {
      const myRun = ++runRef.current;
      setLoading(true);
      timers.push(
        window.setTimeout(() => {
          if (runRef.current !== myRun) return;
          let exhaustedNow = false;
          setRows((r) => {
            const next = Math.min(MAX_ROWS, r + ROW_BATCH);
            exhaustedNow = next >= MAX_ROWS;
            return next;
          });
          setLoading(!exhaustedNow);
          if (!exhaustedNow) {
            timers.push(window.setTimeout(step, HOLD_MS));
          } else {
            timers.push(
              window.setTimeout(() => {
                if (runRef.current !== myRun) return;
                setRows(ROW_COUNT_START);
                step();
              }, EXHAUSTED_HOLD_MS)
            );
          }
        }, FETCH_MS)
      );
    };
    step();
    return () => {
      runRef.current += 1;
      for (const id of timers) window.clearTimeout(id);
    };
  }, []);

  const exhausted = rows >= MAX_ROWS;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 bg-background px-6 py-16">
      <p className="self-start font-mono text-xs uppercase tracking-widest text-ns-muted">
        ns-ui / shearer-advance
      </p>

      <div className="flex w-full max-w-md flex-col overflow-hidden rounded-lg border border-border bg-background">
        <ul className="divide-y divide-border">
          {Array.from({ length: rows }, (_, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3">
              <span className="h-6 w-6 flex-none rounded-full bg-ns-muted/20" aria-hidden />
              <span className="h-2.5 flex-1 rounded-full bg-ns-muted/20" aria-hidden />
              <span className="font-mono text-[10px] text-ns-muted">#{i + 1}</span>
            </li>
          ))}
        </ul>

        <div className="border-t border-border px-4 py-3">
          <ShearerAdvance loading={loading} exhausted={exhausted} height={36} />
        </div>
      </div>

      <p className="max-w-md text-center font-mono text-[11px] text-ns-muted">
        {exhausted
          ? "face worked out — no more rows"
          : "shearer traverses the face, roof supports advance behind it — each pass appends a batch of rows"}
      </p>
    </div>
  );
}
