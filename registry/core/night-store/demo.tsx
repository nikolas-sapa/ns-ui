"use client";

import { useEffect, useRef, useState } from "react";
import { HeaterRack, type CacheEntryInput } from "./component";

// A believable cache: some key-groups get hammered (product:price,
// product:stock — the classic "everyone's viewing the same PDP" thrash),
// most see ordinary traffic, a couple barely get touched. Short TTLs (6-45s)
// so the decay/eviction story plays out in view rather than over minutes.
const GROUPS: { keyGroup: string; ttlMs: number; weight: number }[] = [
  { keyGroup: "user:session", ttlMs: 9000, weight: 6 },
  { keyGroup: "product:price", ttlMs: 8000, weight: 9 },
  { keyGroup: "product:stock", ttlMs: 6000, weight: 8 },
  { keyGroup: "user:profile", ttlMs: 24000, weight: 3 },
  { keyGroup: "search:query", ttlMs: 12000, weight: 4 },
  { keyGroup: "feed:home", ttlMs: 18000, weight: 3 },
  { keyGroup: "auth:token", ttlMs: 15000, weight: 2 },
  { keyGroup: "product:catalog", ttlMs: 36000, weight: 2 },
  { keyGroup: "search:facets", ttlMs: 27000, weight: 1 },
  { keyGroup: "cdn:manifest", ttlMs: 42000, weight: 1 },
  { keyGroup: "auth:refresh", ttlMs: 45000, weight: 1 },
  { keyGroup: "user:prefs", ttlMs: 30000, weight: 1 },
];

function approxT(e: CacheEntryInput, now: number) {
  const dt = Math.max(0, (now - e.lastHitAt) / 1000);
  const tau = Math.max(0.05, e.ttlMs / 3000);
  return Math.exp(-dt / tau);
}

function pickWeighted(entries: CacheEntryInput[], weights: Map<string, number>) {
  const total = entries.reduce((sum, e) => sum + (weights.get(e.id) ?? 1), 0);
  let r = Math.random() * total;
  for (const e of entries) {
    r -= weights.get(e.id) ?? 1;
    if (r <= 0) return e;
  }
  return entries[entries.length - 1];
}

const WINDOW_MS = 15000;
const EVICT_MIN_INTERVAL_MS = 22000;

// Deterministic seed for the very first render — identical on the server and
// on the client's first (pre-hydration) pass, so there is nothing for
// hydration to disagree about. `hitCount` and `lastHitAt` below used
// Math.random()/Date.now() directly in the useState initializer, which runs
// once during SSR and AGAIN during client hydration with a different clock
// and different random draws — the mismatched `hitCount` text node (and the
// lastHitAt-derived heat) is what threw React error #418. The real,
// staggered/randomized starting state is applied in a useEffect below, which
// only ever runs on the client after hydration has already matched.
function seedEntries(): CacheEntryInput[] {
  return GROUPS.map((g) => ({
    id: g.keyGroup,
    keyGroup: g.keyGroup,
    ttlMs: g.ttlMs,
    hitCount: 1,
    lastHitAt: 0,
  }));
}

function randomizeEntries(now: number): CacheEntryInput[] {
  return GROUPS.map((g) => ({
    id: g.keyGroup,
    keyGroup: g.keyGroup,
    ttlMs: g.ttlMs,
    hitCount: 2 + Math.floor(Math.random() * 5),
    // stagger initial ages so the resting frame already shows a mix of
    // hot, cooling and cold bricks instead of everything starting at T=1
    lastHitAt: now - Math.random() * g.ttlMs * 0.9,
  }));
}

export default function HeaterRackDemo() {
  const [entries, setEntries] = useState<CacheEntryInput[]>(seedEntries);

  const weights = useRef(new Map(GROUPS.map((g) => [g.keyGroup, g.weight])));
  const hitEventsRef = useRef<number[]>([]);
  const missEventsRef = useRef<number[]>([]);
  const evictEventsRef = useRef<number[]>([]);
  const lastEvictAtRef = useRef(0);
  const shardCounterRef = useRef(0);

  const [hitRatio, setHitRatio] = useState(0.86);
  const [evictionsPerMin, setEvictionsPerMin] = useState(0);

  // Client-only: replace the deterministic seed with the real randomized,
  // staggered starting state now that hydration has already matched.
  useEffect(() => {
    const now = Date.now();
    lastEvictAtRef.current = now;
    setEntries(randomizeEntries(now));
  }, []);

  useEffect(() => {
    const trafficId = window.setInterval(() => {
      const now = Date.now();
      setEntries((cur) => {
        if (cur.length === 0) return cur;
        const isMiss = Math.random() < 0.12;
        if (isMiss) {
          missEventsRef.current.push(now);
          return cur;
        }
        const target = pickWeighted(cur, weights.current);
        hitEventsRef.current.push(now);
        return cur.map((e) => (e.id === target.id ? { ...e, hitCount: e.hitCount + 1, lastHitAt: now } : e));
      });
    }, 550);

    const evictId = window.setInterval(() => {
      const now = Date.now();
      if (now - lastEvictAtRef.current < EVICT_MIN_INTERVAL_MS) return;
      setEntries((cur) => {
        if (cur.length < 3) return cur;
        let coldest = cur[0];
        let coldestT = Infinity;
        for (const e of cur) {
          const t = approxT(e, now);
          if (t < coldestT) {
            coldestT = t;
            coldest = e;
          }
        }
        if (coldestT > 0.35 || !coldest) return cur; // nothing cold enough to be a real eviction yet
        lastEvictAtRef.current = now;
        evictEventsRef.current.push(now);
        const survivors = cur.filter((e) => e.id !== coldest.id);
        // a fresh shard reappears shortly after, so the rack keeps its size
        window.setTimeout(() => {
          shardCounterRef.current += 1;
          const base = GROUPS.find((g) => g.keyGroup === coldest.keyGroup) ?? GROUPS[0];
          const fresh: CacheEntryInput = {
            id: `${base.keyGroup}#${shardCounterRef.current}`,
            keyGroup: base.keyGroup,
            ttlMs: base.ttlMs,
            hitCount: 1,
            lastHitAt: Date.now(),
          };
          setEntries((c) => [...c, fresh]);
        }, 2600);
        return survivors;
      });
    }, 1000);

    const statsId = window.setInterval(() => {
      const now = Date.now();
      const cutoff = now - WINDOW_MS;
      hitEventsRef.current = hitEventsRef.current.filter((t) => t >= cutoff);
      missEventsRef.current = missEventsRef.current.filter((t) => t >= cutoff);
      evictEventsRef.current = evictEventsRef.current.filter((t) => t >= now - 60000);
      const hits = hitEventsRef.current.length;
      const misses = missEventsRef.current.length;
      setHitRatio(hits + misses > 0 ? hits / (hits + misses) : 0.86);
      setEvictionsPerMin(evictEventsRef.current.length);
    }, 1000);

    return () => {
      window.clearInterval(trafficId);
      window.clearInterval(evictId);
      window.clearInterval(statsId);
    };
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-2xl">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">ns-ui / night-store</p>
        <h1 className="text-lg font-semibold text-foreground">Cache heater rack</h1>
        <p className="mt-1 text-sm leading-relaxed text-ns-muted">
          Every brick is a key-group holding heat: a hit charges it toward full
          density, idle time cools it on a decay matched to its own TTL. Watch{" "}
          <span className="text-foreground">product:price</span> and{" "}
          <span className="text-foreground">product:stock</span> — hit hardest,
          they flicker cold-hot instead of settling, the visual signature of a
          thrashing cache.
        </p>

        <div className="mt-5 rounded-md border border-border bg-background p-5">
          <HeaterRack
            entries={entries}
            hitRatio={hitRatio}
            evictionsPerMin={evictionsPerMin}
            hitRatioAlertThreshold={0.7}
          />
        </div>
      </div>
    </main>
  );
}
