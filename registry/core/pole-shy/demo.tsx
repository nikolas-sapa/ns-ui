"use client";

import { useEffect, useRef, useState } from "react";
import { PoleShy, type PoleShyUser } from "./component";

// Four collaborators crowd one line (row 0) — close enough that their name
// labels would overlap without the repulsion physics. Two more sit far apart
// on a second line (row 1) as a quiet baseline: nothing to repel, so nothing
// moves. "You" is driven by real keydown events on the textarea below; the
// other row-0 peers run their own irregular burst/pause typing loops so more
// than one label can be dominant at once, never a fixed choreography. Kai
// leaves and Mo arrives partway through, exercising the live region's
// arrival/departure announcements.
const INITIAL_USERS: PoleShyUser[] = [
  { id: "you", name: "You", x: 0.4, row: 0, typing: false, section: "section 2" },
  { id: "priya", name: "Priya Nair", x: 0.46, row: 0, typing: false, section: "section 2" },
  { id: "theo", name: "Theo Voss", x: 0.52, row: 0, typing: false, section: "section 2" },
  { id: "sam", name: "Sam Ochieng", x: 0.58, row: 0, typing: false, section: "section 2" },
  { id: "wren", name: "Wren Delacroix", x: 0.15, row: 1, typing: false, section: "intro" },
  { id: "kai", name: "Kai Fujimori", x: 0.82, row: 1, typing: false, section: "intro" },
];

export default function PoleShyDemo() {
  const [users, setUsers] = useState<PoleShyUser[]>(INITIAL_USERS);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setTyping = (id: string, typing: boolean) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, typing } : u)));
  };

  // "You": real keystrokes drive real typing state, with a short idle
  // timeout back to false — the component's own field-strength decay layers
  // on top of this, so precedence fades smoothly rather than snapping off.
  const handleKeyDown = () => {
    setTyping("you", true);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setTyping("you", false), 900);
  };

  useEffect(() => {
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    let cancelled = false;

    function runPeer(id: string) {
      function burst() {
        if (cancelled) return;
        setTyping(id, true);
        const burstMs = 500 + Math.random() * 1100;
        timers.push(
          setTimeout(() => {
            if (cancelled) return;
            setTyping(id, false);
            timers.push(setTimeout(burst, 1200 + Math.random() * 2600));
          }, burstMs)
        );
      }
      timers.push(setTimeout(burst, 300 + Math.random() * 1200));
    }

    runPeer("priya");
    runPeer("theo");
    runPeer("sam");

    timers.push(
      setTimeout(() => {
        if (!cancelled) setUsers((prev) => prev.filter((u) => u.id !== "kai"));
      }, 7000)
    );
    timers.push(
      setTimeout(() => {
        if (!cancelled) {
          setUsers((prev) => [
            ...prev,
            { id: "mo", name: "Mo Abara", x: 0.5, row: 1, typing: false, section: "intro" },
          ]);
        }
      }, 9500)
    );

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-16">
      <div className="w-full max-w-lg rounded-md border border-border bg-background p-5 shadow-sm">
        <h2 className="text-sm font-medium text-foreground">Section 2 — release notes</h2>
        <p className="mt-1 text-xs text-ns-muted">
          Four cursors crowd one line below. Type in the box — your label carries a stronger field
          while you&apos;re actively typing, and the others yield to make room.
        </p>

        <div className="mt-4">
          <PoleShy users={users} />
        </div>

        <textarea
          rows={2}
          placeholder="Type here — your caret label pushes the others aside"
          aria-label="Document body"
          onKeyDown={handleKeyDown}
          className="mt-4 w-full resize-none rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-ns-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
        />
      </div>

      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / pole-shy — repulsion demonstrates precedence, decoration never does
      </p>
    </div>
  );
}
