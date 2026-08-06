"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

// Faceted filter chips as a sieve. A hairline mesh fans from a hub above the
// chip row down to every chip; active facets read as taut, bright threads,
// inactive ones as faint background lattice. Hovering a chip tightens its
// own thread (sag reduces toward a straight line via a CSS transition on the
// SVG path's `d` — same-topology path transitions animate natively in
// Chromium, no rAF needed for a discrete hover response). Deselecting a
// facet widens the results and shakes a few particles through the gap left
// at that chip; the result count re-renders as a staggered dot bar, never a
// tweened number. Chips are real toggle buttons (aria-pressed, visible
// accessible names); the count changes announce through an sr-only region.

type Facet = { key: string; label: string; factor: number };

const FACETS: Facet[] = [
  { key: "in-stock", label: "In stock", factor: 0.72 },
  { key: "new", label: "New", factor: 0.42 },
  { key: "on-sale", label: "On sale", factor: 0.58 },
  { key: "bestseller", label: "Bestseller", factor: 0.34 },
];

const POOL = 240;
const DOT_MAX = 16;
const HUB_HEIGHT = 40;

type Particle = { id: number; x: number };
let seq = 0;

export function SieveFacets({
  defaultActive = ["in-stock", "bestseller"],
  className = "",
}: {
  /** facet ids checked at mount */
  defaultActive?: string[];
  /** extra classes merged onto the rendered root element */
  className?: string;
}) {
  const [active, setActive] = useState<Set<string>>(() => new Set(defaultActive));
  const [hovered, setHovered] = useState<string | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [anchors, setAnchors] = useState<Record<string, number>>({});
  const [rowWidth, setRowWidth] = useState(0);
  const rowRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const liveRef = useRef<HTMLDivElement>(null);
  const reducedRef = useRef(false);

  useEffect(() => {
    reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const measure = useCallback(() => {
    const row = rowRef.current;
    if (!row) return;
    const rowRect = row.getBoundingClientRect();
    const next: Record<string, number> = {};
    for (const f of FACETS) {
      const el = chipRefs.current[f.key];
      if (el) {
        const r = el.getBoundingClientRect();
        next[f.key] = r.left + r.width / 2 - rowRect.left;
      }
    }
    setAnchors(next);
    setRowWidth(rowRect.width);
  }, []);

  useLayoutEffect(() => {
    measure();
    const row = rowRef.current;
    const ro = row ? new ResizeObserver(measure) : undefined;
    if (row && ro) ro.observe(row);
    window.addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  const count = useMemo(() => {
    let c = POOL;
    for (const f of FACETS) if (active.has(f.key)) c *= f.factor;
    return Math.max(1, Math.round(c));
  }, [active]);

  const filledDots = Math.min(DOT_MAX, Math.max(0, Math.round((count / POOL) * DOT_MAX)));

  const toggle = (key: string) => {
    const wasActive = active.has(key);
    const next = new Set(active);
    if (wasActive) next.delete(key);
    else next.add(key);
    setActive(next);

    if (wasActive) {
      // excluded results shake back through the gap this facet leaves
      const x = anchors[key] ?? rowWidth / 2;
      const spawned: Particle[] = reducedRef.current
        ? []
        : Array.from({ length: 4 }, () => ({ id: ++seq, x: x + (Math.random() - 0.5) * 24 }));
      if (spawned.length) setParticles((p) => [...p, ...spawned]);
    }

    let nextCount = POOL;
    for (const f of FACETS) if (next.has(f.key)) nextCount *= f.factor;
    nextCount = Math.max(1, Math.round(nextCount));
    if (liveRef.current) liveRef.current.textContent = `${nextCount} results`;
  };

  const removeParticle = (id: number) => setParticles((p) => p.filter((x) => x.id !== id));

  const allClear = active.size === 0;

  return (
    <div className={`w-full max-w-md ${className}`}>
      <style>{`
        @keyframes nsui-sieve-fall {
          0% { transform: translateY(0) scale(1); opacity: 0.9; }
          100% { transform: translateY(56px) scale(0.5); opacity: 0; }
        }
        .nsui-sieve-line { transition: d 220ms ease-out, opacity 220ms ease-out, stroke-width 220ms ease-out; }
        .nsui-sieve-mesh { transition: opacity 300ms ease-out, transform 300ms ease-out; }
        .nsui-sieve-dot { transition: opacity 260ms ease-out, transform 260ms ease-out; }
      `}</style>

      {/* mesh: hairline threads from a hub down to each chip */}
      <svg
        aria-hidden="true"
        className={`nsui-sieve-mesh block w-full ${allClear ? "scale-95 opacity-0" : "scale-100 opacity-100"}`}
        style={{ height: HUB_HEIGHT }}
        viewBox={`0 0 ${Math.max(1, rowWidth)} ${HUB_HEIGHT}`}
        preserveAspectRatio="none"
      >
        <circle cx={rowWidth / 2} cy={4} r={2} className="fill-ns-muted" />
        {FACETS.map((f) => {
          const x = anchors[f.key];
          if (x === undefined) return null;
          const isActive = active.has(f.key);
          const isHover = hovered === f.key;
          const hubX = rowWidth / 2;
          const sag = isHover ? 3 : 13;
          const midX = (hubX + x) / 2;
          const midY = 4 + (HUB_HEIGHT - 4) * 0.5 + sag;
          return (
            <path
              key={f.key}
              className="nsui-sieve-line"
              d={`M ${hubX} 4 Q ${midX} ${midY} ${x} ${HUB_HEIGHT}`}
              fill="none"
              stroke={isActive ? "var(--foreground)" : "var(--border)"}
              strokeOpacity={isActive ? (isHover ? 0.85 : 0.55) : isHover ? 0.65 : 0.35}
              strokeWidth={isActive ? (isHover ? 1.75 : 1.25) : 1}
            />
          );
        })}
      </svg>

      {/* particle overlay */}
      <div aria-hidden="true" className="pointer-events-none relative h-0 overflow-visible">
        {particles.map((p) => (
          <span
            key={p.id}
            onAnimationEnd={() => removeParticle(p.id)}
            className="absolute top-0 h-1.5 w-1.5 rounded-full bg-foreground/70"
            style={{ left: p.x, animation: "nsui-sieve-fall 520ms ease-in forwards" }}
          />
        ))}
      </div>

      <div ref={rowRef} className="mt-2 flex flex-wrap justify-center gap-2">
        {FACETS.map((f) => {
          const isActive = active.has(f.key);
          return (
            <button
              key={f.key}
              ref={(el) => {
                chipRefs.current[f.key] = el;
              }}
              type="button"
              aria-pressed={isActive}
              onClick={() => toggle(f.key)}
              onMouseEnter={() => setHovered(f.key)}
              onMouseLeave={() => setHovered((h) => (h === f.key ? null : h))}
              onFocus={() => setHovered(f.key)}
              onBlur={() => setHovered((h) => (h === f.key ? null : h))}
              className={`rounded-full border px-3 py-1.5 font-mono text-xs outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                isActive
                  ? "border-foreground/50 bg-foreground/[0.08] text-foreground"
                  : "border-border text-ns-muted hover:border-foreground/30 hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex flex-col items-center gap-2">
        <div className="flex items-center gap-1" aria-hidden="true">
          {Array.from({ length: DOT_MAX }, (_, i) => {
            const filled = i < filledDots;
            return (
              <span
                key={i}
                className={`nsui-sieve-dot h-1.5 w-1.5 rounded-full ${filled ? "scale-100 bg-foreground opacity-90" : "scale-75 bg-ns-muted opacity-30"}`}
                style={reducedRef.current ? undefined : { transitionDelay: `${i * 22}ms` }}
              />
            );
          })}
        </div>
        <p className="font-mono text-xs text-ns-muted">{count} results</p>
      </div>

      <div ref={liveRef} aria-live="polite" aria-atomic="true" className="sr-only" />
    </div>
  );
}
