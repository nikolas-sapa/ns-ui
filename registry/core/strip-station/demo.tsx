"use client";

import { useEffect, useState } from "react";
import { StripStation, type StripStationManeuver } from "./component";

const ROUTE: StripStationManeuver[] = [
  { id: "s0", instruction: "Depart", road: "Elm St", distanceM: 180, turnAngleDeg: 0, headingDeg: 95 },
  { id: "s1", instruction: "Turn right", road: "Baker St", distanceM: 220, turnAngleDeg: 88, headingDeg: 5 },
  { id: "s2", instruction: "Turn left onto Mill Rd", distanceM: 1400, turnAngleDeg: -85, headingDeg: 272 },
  { id: "s3", instruction: "Keep right", road: "ramp to Highway 9", distanceM: 650, turnAngleDeg: 28, headingDeg: 250 },
  { id: "s4", instruction: "Merge onto Highway 9 N", distanceM: 34000, turnAngleDeg: 15, headingDeg: 356 },
  { id: "s5", instruction: "Take exit 42", road: "toward Fairview", distanceM: 900, turnAngleDeg: 46, headingDeg: 310 },
  { id: "s6", instruction: "Turn left", road: "Fairview Ave", distanceM: 1200, turnAngleDeg: -90, headingDeg: 220 },
  { id: "s7", instruction: "Turn right", road: "Chestnut St", distanceM: 160, turnAngleDeg: 92, headingDeg: 310 },
  { id: "s8", instruction: "Turn left", road: "Ivy Ln", distanceM: 95, turnAngleDeg: -88, headingDeg: 220 },
  { id: "s9", instruction: "Continue", road: "Ivy Ln", distanceM: 140, turnAngleDeg: -12, headingDeg: 208 },
  { id: "s10", instruction: "Turn right", road: "Depot St", distanceM: 210, turnAngleDeg: 95, headingDeg: 298 },
  { id: "s11", instruction: "Arrive at destination", distanceM: 0, turnAngleDeg: 0, headingDeg: 298 },
];

const TOTAL_M = ROUTE.reduce((sum, s) => sum + s.distanceM, 0);
const TRAVERSE_MS = 42000;

export default function StripStationDemo() {
  const [positionM, setPositionM] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      // static, representative frame: partway down the Mill Rd leg
      setPositionM(TOTAL_M * 0.06);
      return;
    }
    let raf = 0;
    let last = 0;
    let dir: 1 | -1 = 1;
    const speed = TOTAL_M / (TRAVERSE_MS / 1000);
    const tick = (now: number) => {
      const dt = last === 0 ? 1 / 60 : Math.min(0.05, (now - last) / 1000);
      last = now;
      setPositionM((p) => {
        let next = p + dir * speed * dt;
        if (next >= TOTAL_M) {
          next = TOTAL_M;
          dir = -1;
        } else if (next <= 0) {
          next = 0;
          dir = 1;
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    const start = setTimeout(() => {
      raf = requestAnimationFrame(tick);
    }, 700);
    return () => {
      clearTimeout(start);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-sm">
      <StripStation steps={ROUTE} positionM={positionM} className="h-[520px] w-full" />
    </div>
  );
}
