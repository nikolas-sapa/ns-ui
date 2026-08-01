"use client";

import { useEffect, useRef, useState } from "react";
import { ClapperBell, type ClapperBellItem } from "./component";

const FEED: ClapperBellItem[] = [
  { id: "1", message: "Priya commented on your draft." },
  { id: "2", message: "Deploy finished: 3 builds green." },
  { id: "3", message: "New reply in #general." },
  { id: "4", message: "Weekly digest is ready." },
  { id: "5", message: "Marco mentioned you." },
  { id: "6", message: "Storage nearing 80% — review usage." },
];

// Self-driving script: a couple of single arrivals, then a burst of three
// close together (to exercise the cumulative damped swing, not one swing
// per item), then an auto-open of the tray. No pointer/keyboard input in
// the loop, matching the registry's script-driven-demo convention.
type Step = { kind: "arrive"; ids: string[] } | { kind: "open" } | { kind: "wait" };
const SCRIPT: { step: Step; ms: number }[] = [
  { step: { kind: "wait" }, ms: 1200 },
  { step: { kind: "arrive", ids: ["1"] }, ms: 1400 },
  { step: { kind: "arrive", ids: ["2"] }, ms: 1600 },
  { step: { kind: "arrive", ids: ["3", "4", "5"] }, ms: 2200 },
  { step: { kind: "open" }, ms: 2600 },
  { step: { kind: "arrive", ids: ["6"] }, ms: 2200 },
];

export default function ClapperBellDemo() {
  const [items, setItems] = useState<ClapperBellItem[]>([]);
  const [openSignal, setOpenSignal] = useState(0);
  const stepRef = useRef(0);
  const byId = useRef(new Map(FEED.map((n) => [n.id, n])));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const run = () => {
      const entry = SCRIPT[stepRef.current % SCRIPT.length]!;
      if (entry.step.kind === "arrive") {
        const next = entry.step.ids.map((id) => byId.current.get(id)!).filter(Boolean);
        setItems((prev) => [...prev, ...next]);
      } else if (entry.step.kind === "open") {
        setOpenSignal((s) => s + 1);
      }
      stepRef.current += 1;
      timer = setTimeout(run, entry.ms);
    };
    timer = setTimeout(run, SCRIPT[0]!.ms);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (openSignal === 0) return;
    const bell = document.querySelector<HTMLButtonElement>('[aria-haspopup="true"]');
    bell?.click();
    const t = setTimeout(() => bell?.click(), 1800);
    return () => clearTimeout(t);
  }, [openSignal]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / notification-bell-swing
      </p>

      <div className="flex w-full max-w-sm items-center justify-between rounded-[12px] border border-border bg-background px-4 py-3">
        <span className="text-sm text-foreground">Workspace</span>
        <ClapperBell items={items} />
      </div>

      <p className="max-w-md text-center text-xs text-muted">
        Arrivals swing the clapper cumulatively; opening the tray damps the
        bell to rest and drains the badge.
      </p>
    </div>
  );
}
