"use client";

import { useMemo, useState } from "react";
import { ShearBand } from "./component";

const LISTINGS = [
  { name: "Loft studio, Ravenscourt", price: 890 },
  { name: "Two-bed maisonette, Peckham", price: 1450 },
  { name: "Ensuite room, Clapton", price: 720 },
  { name: "Garden flat, Herne Hill", price: 1680 },
  { name: "Warehouse conversion, Hackney Wick", price: 2100 },
  { name: "One-bed, Walthamstow", price: 1180 },
  { name: "Shared house room, Deptford", price: 640 },
  { name: "Riverside two-bed, Wapping", price: 2450 },
  { name: "Studio above a bakery, Dalston", price: 990 },
  { name: "Three-bed terrace, Tooting", price: 1920 },
];

const fmtGBP = (v: number) => `£${v.toLocaleString("en-GB")}`;

export default function ShearBandDemo() {
  const [priceRange, setPriceRange] = useState<[number, number]>([800, 1800]);
  const [dateRange, setDateRange] = useState<[number, number]>([2, 5]);

  const matches = useMemo(
    () => LISTINGS.filter((l) => l.price >= priceRange[0] && l.price <= priceRange[1]),
    [priceRange]
  );

  const dayName = (d: number) =>
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][d];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / shear-band — the span is one taut object, not two thumbs
      </p>

      <div className="w-full max-w-md rounded-md border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Filter listings
            </h2>
            <p className="mt-1 text-sm text-muted">Monthly rent, London</p>
          </div>
          <span className="rounded-full border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted">
            {matches.length} of {LISTINGS.length}
          </span>
        </div>

        <div className="px-6 pb-2 pt-6">
          <ShearBand
            min={500}
            max={2500}
            step={10}
            value={priceRange}
            onValueChange={setPriceRange}
            minLabel="Minimum monthly rent"
            maxLabel="Maximum monthly rent"
            formatValue={fmtGBP}
            className="rent-range-band"
          />
        </div>

        <div className="max-h-64 overflow-y-auto border-t border-border">
          {matches.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted">
              No listings in this range.
            </p>
          ) : (
            <ul>
              {matches.map((l) => (
                <li
                  key={l.name}
                  className="flex items-center justify-between gap-4 border-b border-border px-6 py-3 last:border-b-0"
                >
                  <span className="truncate text-sm text-foreground">{l.name}</span>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-muted">
                    {fmtGBP(l.price)}/mo
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-border px-6 py-3">
          <p className="font-mono text-[11px] text-muted">
            drag a grip fast — the band leans with it, then snaps flat
          </p>
        </div>
      </div>

      {/* second instance — small integer span, proving the near-zero-gap case */}
      <div className="w-full max-w-md rounded-md border border-border bg-surface px-6 py-5">
        <div className="flex items-baseline justify-between">
          <div>
            <h3 className="text-sm font-medium text-foreground">Stay window</h3>
            <p className="mt-0.5 text-xs text-muted">
              Which nights the booking covers.
            </p>
          </div>
          <span className="font-mono text-xs tabular-nums text-foreground">
            {dayName(dateRange[0])}–{dayName(dateRange[1])}
          </span>
        </div>
        <div className="pt-6">
          <ShearBand
            min={0}
            max={6}
            step={1}
            value={dateRange}
            onValueChange={setDateRange}
            minLabel="Check-in day"
            maxLabel="Check-out day"
            formatValue={(v) => dayName(v)}
          />
        </div>
      </div>
    </div>
  );
}
