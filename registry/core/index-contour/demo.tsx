"use client";

import { useMemo, useState } from "react";
import { IndexContour, type ContourCostField } from "./component";

// Builds a small synthetic road-network cost field for the demo: a
// Manhattan grid of avenues/streets (fast edges) over a slow off-road base,
// with one impassable park block carved out of it (no edges cross it at
// all) so the resulting reach is forced to route around it rather than cut
// through — a real graph-distance field, never a circle standing in for
// one. Dijkstra from a single depot node produces the per-node minutes.
function buildDemoField(): ContourCostField {
  const cols = 40;
  const rows = 26;
  const depot: [number, number] = [9, 18];

  const AVENUE_ROWS = [4, 10, 16, 22];
  const STREET_COLS = [6, 14, 22, 30, 36];
  const isAvenueRow = (r: number) => AVENUE_ROWS.includes(r);
  const isStreetCol = (c: number) => STREET_COLS.includes(c);

  // park block: no edge may cross into/out of it
  const inPark = (c: number, r: number) => c >= 17 && c <= 25 && r >= 7 && r <= 13;

  const idx = (c: number, r: number) => r * cols + c;
  const n = cols * rows;

  // adjacency: 4-neighbor grid, weight in minutes per edge
  const ROAD_MIN = 0.9;
  const OFFROAD_MIN = 3.4;
  const edgeWeight = (c0: number, r0: number, c1: number, r1: number) => {
    if (inPark(c0, r0) || inPark(c1, r1)) return Infinity;
    const onRoad =
      (r0 === r1 && (isAvenueRow(r0) || false)) ||
      (c0 === c1 && (isStreetCol(c0) || false));
    return onRoad ? ROAD_MIN : OFFROAD_MIN;
  };

  // plain O(n^2) Dijkstra — ~1000 nodes, runs once, no heap needed
  const dist = new Array(n).fill(Infinity);
  const visited = new Array(n).fill(false);
  dist[idx(depot[0], depot[1])] = 0;

  for (let iter = 0; iter < n; iter++) {
    let u = -1;
    let best = Infinity;
    for (let i = 0; i < n; i++) {
      if (!visited[i] && dist[i] < best) {
        best = dist[i];
        u = i;
      }
    }
    if (u === -1) break;
    visited[u] = true;
    const uc = u % cols;
    const ur = Math.floor(u / cols);
    const neighbors: [number, number][] = [
      [uc + 1, ur],
      [uc - 1, ur],
      [uc, ur + 1],
      [uc, ur - 1],
    ];
    for (const [vc, vr] of neighbors) {
      if (vc < 0 || vc >= cols || vr < 0 || vr >= rows) continue;
      const w = edgeWeight(uc, ur, vc, vr);
      if (!Number.isFinite(w)) continue;
      const v = idx(vc, vr);
      const nd = dist[u] + w;
      if (nd < dist[v]) dist[v] = nd;
    }
  }

  const roads: [number, number][][] = [];
  for (const r of AVENUE_ROWS) roads.push([[0, r], [cols - 1, r]]);
  for (const c of STREET_COLS) roads.push([[c, 0], [c, rows - 1]]);
  // park outline, drawn as context for why reach bends around it
  roads.push([
    [17, 7],
    [25, 7],
    [25, 13],
    [17, 13],
    [17, 7],
  ]);

  return {
    cols,
    rows,
    values: dist,
    roads,
    metersPerCell: 95,
  };
}

export default function IndexContourDemo() {
  const field = useMemo(buildDemoField, []);
  const [minutes, setMinutes] = useState(25);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-xl">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / index-contour
        </p>
        <h1 className="text-lg font-semibold text-foreground">
          How far is {minutes} minutes from the depot?
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-ns-muted">
          Drag the handle to change the travel-time budget. Every band is a
          real contour of the road network&apos;s cost field, not a circle —
          watch it bend around the park rather than cut through it.
        </p>

        <div className="mt-5">
          <IndexContour
            label="Delivery reach"
            costField={field}
            value={minutes}
            onValueChange={setMinutes}
            populationPerKm2={4200}
          />
        </div>

        <p className="mt-3 font-mono text-[11px] text-ns-muted">
          arrows step ±5 min · PageUp/Down steps 15 · Home/End to the rails
        </p>
      </div>
    </main>
  );
}
