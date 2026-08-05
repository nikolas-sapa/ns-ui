"use client";

import { useEffect, useMemo, useState } from "react";
import { RouterTierCascade, type RouterRequest, type RouterTier } from "./component";

// Four model tiers of a real routing stack, cheapest first. The ceilings climb
// left to right down the stack, which is what makes the notch positions read as
// "these are thresholds and they get harder as you go down".
const TIERS: RouterTier[] = [
  { id: "edge-2b", label: "edge-2b", ceiling: 0.22, pricePer1k: 0.0004 },
  { id: "fast-8b", label: "fast-8b", ceiling: 0.46, pricePer1k: 0.0025 },
  { id: "pro-70b", label: "pro-70b", ceiling: 0.72, pricePer1k: 0.015 },
  { id: "frontier", label: "frontier", ceiling: 0.93, pricePer1k: 0.075 },
];

// A realistic difficulty mix for support/agent traffic: most of it is
// classification and lookup the cheap tier holds, a thinner band needs
// reasoning, and a handful are genuinely hard.
const MIX: Array<[number, number]> = [
  [0.04, 620], [0.09, 740], [0.06, 510], [0.13, 880], [0.17, 690],
  [0.11, 950], [0.03, 430], [0.19, 1120], [0.08, 640], [0.15, 780],
  [0.21, 1040], [0.07, 560], [0.12, 820], [0.05, 470], [0.18, 1210],
  [0.1, 700], [0.16, 900], [0.02, 380], [0.14, 860], [0.2, 990],
  [0.09, 610], [0.06, 520], [0.13, 750], [0.11, 830],
  [0.31, 1840], [0.38, 2260], [0.27, 1590], [0.44, 2410], [0.35, 2050],
  [0.41, 2190], [0.29, 1720],
  [0.58, 3480], [0.66, 4120], [0.7, 3860],
  [0.86, 6240], [0.95, 7180],
];

const SEED = MIX.map(([difficulty, tokens], i) => ({
  id: `seed-${i}`,
  difficulty,
  tokens,
}));

// Live arrivals, drawn in a fixed order so the cascade is reproducible: mostly
// cheap traffic with an escalation every few requests.
const LIVE: Array<[number, number]> = [
  [0.12, 780], [0.07, 540], [0.34, 1960], [0.16, 910], [0.05, 450],
  [0.61, 3720], [0.1, 690], [0.19, 1080], [0.42, 2280], [0.08, 600],
  [0.14, 820], [0.89, 6640], [0.06, 500], [0.23, 1310],
];

export default function RouterTierCascadeDemo() {
  const [live, setLive] = useState<RouterRequest[]>([]);
  const [lastChange, setLastChange] = useState<string | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let n = 0;
    const t = setInterval(() => {
      const [difficulty, tokens] = LIVE[n % LIVE.length];
      setLive((prev) => [
        ...prev.slice(-60),
        { id: `live-${n}`, difficulty, tokens },
      ]);
      n += 1;
    }, 2200);
    return () => clearInterval(t);
  }, []);

  const requests = useMemo(() => [...SEED, ...live], [live]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-3xl">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / router-tier-cascade
        </p>
        <h1 className="text-lg font-semibold text-foreground">
          Support agent — model routing, last 15 minutes
        </h1>
        <p className="mt-1 max-w-xl text-sm leading-relaxed text-ns-muted">
          Every request enters at the cheapest tier and runs right until it hits
          that tier&apos;s notch. If it is harder than the notch allows it spills
          one row down and keeps going. Where a request stops is what it cost.
        </p>

        <div className="mt-6 rounded-md border border-border bg-surface p-5">
          <RouterTierCascade
            tiers={TIERS}
            requests={requests}
            ariaLabel="Model routing cascade, last 15 minutes"
            onCeilingChange={(id, ceiling) =>
              setLastChange(`${id} ceiling → ${Math.round(ceiling * 100)}%`)
            }
          />
        </div>

        <p className="mt-3 font-mono text-[11px] text-ns-muted">
          {lastChange ?? "drag a notch (or Tab to it and use ← →) to re-route settled traffic"}
        </p>
      </div>
    </main>
  );
}
