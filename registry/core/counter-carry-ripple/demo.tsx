"use client";

import { useEffect, useRef, useState } from "react";
import { CarryDigit } from "./component";

const BASE = 995;
const PEAK = 1042;

export default function CarryDigitDemo() {
  const [count, setCount] = useState(BASE);
  const dirRef = useRef<1 | -1>(1);

  // ticks past the 999 -> 1000 boundary in both directions on a loop, so the
  // demo shows the carry ripple, the new leading digit growing in, and that
  // same column shrinking back out — without any input. The first tick is
  // held back ~4s so the resting frame (what the screenshot gate captures
  // ~1s after load) shows settled digits, never a mid-flip column.
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      id = setInterval(() => {
        setCount((prev) => {
          const dir = dirRef.current;
          let next = prev + dir * (dir === 1 ? 1 : 3);
          if (dir === 1 && next >= PEAK) {
            next = PEAK;
            dirRef.current = -1;
          } else if (dir === -1 && next <= BASE) {
            next = BASE;
            dirRef.current = 1;
          }
          return next;
        });
      }, 650);
    }, 4000);
    return () => {
      clearTimeout(start);
      if (id) clearInterval(id);
    };
  }, []);

  const [balance, setBalance] = useState(128.4);
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      id = setInterval(() => {
        setBalance((prev) => {
          const delta = (Math.random() - 0.42) * 6;
          const next = Math.max(0, prev + delta);
          return Math.round(next * 100) / 100;
        });
      }, 1400);
    }, 4000);
    return () => {
      clearTimeout(start);
      if (id) clearInterval(id);
    };
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm rounded-md border border-border bg-surface p-6">
        <p className="mb-5 font-mono text-xs tracking-widest text-ns-muted">ns-ui / counter-carry-ripple</p>
        <div className="flex flex-col gap-6">
          <CarryDigit value={count} label="requests / min" />
          <CarryDigit value={balance} decimals={2} label="account balance · usd" />
        </div>
      </div>
    </main>
  );
}
