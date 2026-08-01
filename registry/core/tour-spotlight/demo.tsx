"use client";

import { useEffect, useRef, useState } from "react";
import { LeadingLight, type LeadingLightStep } from "./component";

const STEPS: LeadingLightStep[] = [
  {
    target: "#ll-nav-projects",
    title: "Projects live here",
    body: "Every workspace you have access to shows up in this nav — switch between them without leaving the page.",
  },
  {
    target: "#ll-toolbar-new",
    title: "Create anything",
    body: "New docs, tasks and boards all start from this one button, so it's worth knowing by heart.",
  },
  {
    target: "#ll-card-invite",
    title: "Bring your team",
    body: "Invites go out instantly and land in a shared queue — nobody's waiting on an email.",
  },
  {
    target: "#ll-status-save",
    title: "Autosave, always",
    body: "Changes save as you go. This indicator is the only thing worth glancing at before you close the tab.",
  },
];

const STEP_MS = 2600;

export default function LeadingLightDemo() {
  const [active, setActive] = useState(0);
  const [running, setRunning] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!running) return;
    timerRef.current = setTimeout(() => {
      setActive((a) => (a + 1) % STEPS.length);
    }, STEP_MS);
    return () => clearTimeout(timerRef.current);
  }, [active, running]);

  // brief pause, then restart the loop after a full skip/finish
  useEffect(() => {
    if (running) return;
    const id = setTimeout(() => {
      setActive(0);
      setRunning(true);
    }, 1600);
    return () => clearTimeout(id);
  }, [running]);

  const next = () => {
    if (active === STEPS.length - 1) {
      setRunning(false);
      return;
    }
    setActive((a) => a + 1);
  };
  const back = () => setActive((a) => Math.max(0, a - 1));
  const exit = () => setRunning(false);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / tour-spotlight
      </p>

      <div className="w-full max-w-xl overflow-hidden rounded-[12px] border border-border bg-background">
        <div className="flex items-center gap-4 border-b border-border px-4 py-3">
          <span className="font-mono text-xs font-medium text-foreground">Basecamp</span>
          <nav className="flex items-center gap-3 text-xs text-muted">
            <span id="ll-nav-projects" className="rounded-[6px] px-1.5 py-0.5 text-foreground">
              Projects
            </span>
            <span>Team</span>
            <span>Reports</span>
          </nav>
          <span id="ll-status-save" className="ml-auto rounded-full border border-border px-2 py-0.5 font-mono text-[10px] text-muted">
            Saved
          </span>
        </div>

        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <span id="ll-toolbar-new" className="rounded-[6px] border border-border px-2.5 py-1 text-xs text-foreground">
            + New
          </span>
          <span className="rounded-[6px] px-2.5 py-1 text-xs text-muted">Filter</span>
          <span className="rounded-[6px] px-2.5 py-1 text-xs text-muted">Sort</span>
        </div>

        <div className="grid grid-cols-2 gap-3 p-4">
          <div className="flex flex-col gap-2 rounded-[10px] border border-border p-3">
            <span className="h-3 w-2/3 rounded-full bg-border" aria-hidden="true" />
            <span className="h-2 w-full rounded-full bg-border" aria-hidden="true" />
            <span className="h-2 w-4/5 rounded-full bg-border" aria-hidden="true" />
          </div>
          <div id="ll-card-invite" className="flex flex-col gap-2 rounded-[10px] border border-border p-3">
            <span className="text-xs font-medium text-foreground">Invite teammate</span>
            <span className="h-2 w-full rounded-full bg-border" aria-hidden="true" />
            <span className="self-start rounded-[6px] border border-border px-2 py-0.5 text-[10px] text-muted">
              Send invite
            </span>
          </div>
        </div>
      </div>

      <p className="max-w-md text-center text-xs text-muted">
        A 4-stop tour auto-advances through the mini-app above; the beam
        sweeps between each highlighted control while the rest dims.
      </p>

      {running && (
        <LeadingLight steps={STEPS} active={active} onNext={next} onBack={back} onExit={exit} />
      )}
    </div>
  );
}
