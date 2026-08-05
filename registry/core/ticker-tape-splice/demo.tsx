"use client";

import { useEffect, useRef, useState } from "react";
import { BourseTape, type Quote } from "./component";

const SYMBOLS = ["ACME", "NORTE", "VELOR", "QUINT", "PIXA", "ORBIT", "FLARE", "TANDEM"];

let counter = 0;
function makeQuote(): Quote {
  const symbol = SYMBOLS[counter % SYMBOLS.length];
  counter += 1;
  const price = 40 + ((counter * 37) % 260) + (counter % 7) * 0.33;
  const changePct = (((counter * 53) % 61) - 30) / 10;
  return { id: `q${counter}`, symbol, price, changePct };
}

export default function BourseTapeDemo() {
  const [quotes, setQuotes] = useState<Quote[]>(() => Array.from({ length: 6 }, makeQuote));
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setQuotes((prev) => [...prev, makeQuote()]);
    }, 1400);
    return () => clearInterval(timerRef.current);
  }, []);

  // Self-driving: toggle pause every few seconds so the brake/inertia and
  // resume are both visible in an unattended loop.
  useEffect(() => {
    const id = setInterval(() => setPaused((p) => !p), 3600);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">ns-ui / ticker-tape-splice</p>

      <div data-ns-bt-focus className="w-full max-w-xl">
        <BourseTape quotes={quotes} paused={paused} onPausedChange={setPaused} />
      </div>

      <p className="max-w-md text-center text-xs text-ns-muted">
        New quotes splice in from the right; hover or focus the tape to brake
        it, or use the transport button to pause outright.
      </p>
    </div>
  );
}
