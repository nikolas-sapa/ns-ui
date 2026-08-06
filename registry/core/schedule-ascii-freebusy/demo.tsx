"use client";

import { ScheduleAsciiFreebusy, type Attendee, type SlotStatus } from "./component";

// One design-sync calendar: six attendees, 18 half-hour slots (09:00–18:00).

const F: SlotStatus = "free";
const T: SlotStatus = "tentative";
const B: SlotStatus = "busy";
const O: SlotStatus = "out";

const ATTENDEES: Attendee[] = [
  { id: "dana", name: "Dana", day: [F, B, B, F, F, F, B, B, F, F, B, B, F, F, F, F, O, O] },
  { id: "priya", name: "Priya", day: [B, F, F, F, F, B, B, F, F, T, B, B, B, F, F, F, F, F] },
  { id: "marcus", name: "Marcus", day: [B, F, F, F, F, F, B, B, B, F, F, F, B, B, F, T, F, F] },
  { id: "ines", name: "Inés", day: [F, F, T, F, F, B, F, B, B, F, B, F, F, B, F, F, F, F] },
  { id: "tobias", name: "Tobias", day: [B, F, F, F, F, F, B, F, F, B, F, B, B, F, F, F, B, B] },
  { id: "wei", name: "Wei", day: [F, F, F, F, F, B, B, B, F, B, F, F, F, B, T, F, F, O] },
];

export default function ScheduleAsciiFreebusyDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / schedule-ascii-freebusy
      </p>
      <ScheduleAsciiFreebusy attendees={ATTENDEES} title="Design sync — Thu 16 Apr" />
      <p className="max-w-md text-center text-xs text-ns-muted">
        The accent window is the earliest slot everyone required is free.
      </p>
    </div>
  );
}
