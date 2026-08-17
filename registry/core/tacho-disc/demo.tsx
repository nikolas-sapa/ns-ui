"use client";

import { useEffect, useRef, useState } from "react";
import { TachoDisc, type SecurityEvent } from "./component";

const ACTORS = ["j.chen", "mrivera", "svc-deploy", "a.novak", "t.singh"];

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function at(dayStart: number, hh: number, mm: number, ss = 0): number {
  return dayStart + hh * 3_600_000 + mm * 60_000 + ss * 1_000;
}

function baseline(dayStart: number, offset: number, dense: boolean): SecurityEvent[] {
  const out: SecurityEvent[] = [];
  const p = (i: number) => ACTORS[i % ACTORS.length]!;
  let n = 0;
  const push = (e: Omit<SecurityEvent, "id">) => out.push({ ...e, id: `d${offset}-${n++}` });

  push({ time: at(dayStart, 8, 12), category: "sign-in", actor: p(0), action: "Sign-in (SSO)", result: "success" });
  push({ time: at(dayStart, 9, 4), category: "sign-in", actor: p(1), action: "Sign-in (SSO)", result: "success" });
  push({ time: at(dayStart, 10, 41), category: "grant", actor: p(2), action: "Added deploy scope", result: "success" });
  push({ time: at(dayStart, 11, 55), category: "sign-in", actor: p(3), action: "Sign-in (password)", result: "success" });
  push({ time: at(dayStart, 13, 20), category: "sign-in", actor: p(0), action: "Sign-in (SSO)", result: "success" });
  push({ time: at(dayStart, 14, 33), category: "grant", actor: p(4), action: "Elevated to admin", result: "success" });
  push({ time: at(dayStart, 16, 8), category: "sign-in", actor: p(2), action: "Sign-in (SSO)", result: "success" });
  push({ time: at(dayStart, 17, 47), category: "sign-in", actor: p(1), action: "Sign-in (password)", result: "success" });

  if (dense) {
    // credential-stuffing run: many failed attempts seconds apart, tightly
    // clustered — this is the shape the whole component exists to show, and
    // it only reads as dense because marks sit at TRUE angular time.
    for (let i = 0; i < 9; i++) {
      push({
        time: at(dayStart, 3, 10) + i * 95_000,
        category: "sign-in",
        actor: "unknown@203.0.113.4",
        action: "Sign-in attempt (password)",
        result: "failed",
      });
    }
    push({ time: at(dayStart, 3, 27), category: "revocation", actor: "security-bot", action: "Revoked session key", result: "revoked" });
  }

  return out;
}

const SEEDED: SecurityEvent[] = [
  ...baseline(startOfToday(), 0, true),
  ...baseline(startOfToday() - 86_400_000, 1, false),
  ...baseline(startOfToday() - 2 * 86_400_000, 2, false),
];
const MAX_LIVE = 40; // cap the LIVE tail only — the seeded credential-stuffing
// arc and the dimmer prior-day discs must never be the thing an idle preview
// tab evicts; only ever-growing live arrivals get capped.

export default function TachoDiscDemo() {
  // seeded and live are tracked separately and merged for render, so capping
  // never eats into the seeded baseline (today's dense arc, the prior two
  // days) — only the appended live tail is ever trimmed.
  const [live, setLive] = useState<SecurityEvent[]>([]);
  const events = live.length > 0 ? [...SEEDED, ...live] : SEEDED;
  const burstRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // A short live burst of failed sign-ins arrives a beat after mount, then
  // again on a loop — demonstrates the 90ms scribe on arrival and the
  // coalesced aria-live announcement, through real state updates rather than
  // a scripted animation.
  useEffect(() => {
    const startBurst = () => {
      // guard: if a prior burst's tick interval is still armed (e.g. the tab
      // was backgrounded and timers got throttled/coalesced), clear it before
      // arming a new one — otherwise two tick intervals stack and append
      // forever every 260ms instead of stopping after 4 ticks.
      if (timerRef.current) clearInterval(timerRef.current);
      burstRef.current = 0;
      timerRef.current = setInterval(() => {
        burstRef.current += 1;
        setLive((prev) => {
          const next = [
            ...prev,
            {
              id: `live-${Date.now()}-${burstRef.current}`,
              time: Date.now(),
              category: "sign-in" as const,
              actor: "unknown@198.51.100.7",
              action: "Sign-in attempt (password)",
              result: "failed" as const,
            },
          ];
          return next.length > MAX_LIVE ? next.slice(next.length - MAX_LIVE) : next;
        });
        if (burstRef.current >= 4 && timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }, 260);
    };
    const initial = setTimeout(startBurst, 1400);
    const loop = setInterval(startBurst, 9000);
    return () => {
      clearTimeout(initial);
      clearInterval(loop);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">ns-ui / tacho-disc</p>

      <div className="w-full max-w-4xl rounded-[16px] border border-border bg-background p-6">
        <TachoDisc events={events} label="Security activity" />
      </div>

      <p className="max-w-md text-center text-xs text-ns-muted">
        Drag the disc to scrub time; arrow the list or the disc to step event to event. The tight arc of thick marks is
        a credential-stuffing run — nine failures ninety seconds apart, sitting at their true angle, not spread evenly.
      </p>
    </div>
  );
}
