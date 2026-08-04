"use client";

import { ScheduleAsciiFreebusy } from "./component";

export default function ScheduleAsciiFreebusyDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / schedule-ascii-freebusy
      </p>
      <ScheduleAsciiFreebusy title="Design sync — Thu 16 Apr" />
      <p className="max-w-md text-center text-xs text-muted">
        The accent window is the earliest slot everyone required is free.
      </p>
    </div>
  );
}
