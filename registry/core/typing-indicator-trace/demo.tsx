"use client";

import { useEffect, useRef, useState } from "react";
import { TremorTrace, type TremorTraceHandle, type TremorUser } from "./component";

// The "You" row is driven by real keydown events on the textarea below — its
// cadence is your actual typing, not a simulation. The other three rows
// stand in for remote peers: each runs its own irregular burst/pause loop
// (random burst length, random inter-keystroke gap) calling the same
// pulse() a real WebSocket "peer typed" handler would call — nothing here
// is a fixed rhythm baked into the component itself. Ben disconnects partway
// through to show the terminal tick.
export default function TremorTraceDemo() {
  const traceRef = useRef<TremorTraceHandle>(null);
  const [users, setUsers] = useState<TremorUser[]>([
    { id: "you", name: "You", status: "idle" },
    { id: "ana", name: "Ana", status: "idle" },
    { id: "ben", name: "Ben", status: "idle" },
    { id: "cy", name: "Cy", status: "idle" },
  ]);

  const setStatus = (id: string, status: TremorUser["status"]) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, status } : u)));
  };

  // Local row: real keystrokes, real cadence.
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleKeyDown = () => {
    traceRef.current?.pulse("you");
    setStatus("you", "typing");
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setStatus("you", "idle"), 1400);
  };

  // Simulated peers: irregular burst/pause loops, not a metronome.
  useEffect(() => {
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    let cancelled = false;

    function runPeer(id: string) {
      let ended = false;

      function burst() {
        if (cancelled || ended) return;
        setStatus(id, "typing");
        const burstMs = 700 + Math.random() * 1600;
        const startedAt = performance.now();

        function keystroke() {
          if (cancelled || ended) return;
          traceRef.current?.pulse(id);
          if (performance.now() - startedAt < burstMs) {
            timers.push(setTimeout(keystroke, 80 + Math.random() * 170));
          } else {
            setStatus(id, "idle");
            timers.push(setTimeout(burst, 1100 + Math.random() * 2600));
          }
        }
        keystroke();
      }

      timers.push(setTimeout(burst, 400 + Math.random() * 900));

      return () => {
        ended = true;
      };
    }

    const stopAna = runPeer("ana");
    const stopCy = runPeer("cy");
    const stopBen = runPeer("ben");

    // Ben drops off partway through — the terminal tick.
    timers.push(
      setTimeout(() => {
        stopBen();
        setStatus("ben", "disconnected");
      }, 9000)
    );

    return () => {
      cancelled = true;
      stopAna();
      stopCy();
      timers.forEach(clearTimeout);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-16">
      <div className="w-full max-w-md rounded-md border border-border bg-background p-5 shadow-sm">
        <h2 className="text-sm font-medium text-foreground">Release thread</h2>
        <p className="mt-1 text-xs text-muted">Who's typing, who's idle, who left — read from real cadence.</p>

        <div className="mt-4">
          <TremorTrace ref={traceRef} users={users} />
        </div>

        <textarea
          rows={2}
          placeholder="Type here — your row spikes with your own cadence"
          aria-label="Message"
          onKeyDown={handleKeyDown}
          className="mt-4 w-full resize-none rounded-sm border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
      </div>

      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / typing-indicator-trace — cadence, not a canned pulse
      </p>
    </div>
  );
}
