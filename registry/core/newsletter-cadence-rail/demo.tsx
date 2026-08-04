"use client";

import { useMemo } from "react";
import { NewsletterCadenceRail } from "./component";

// The rail is drawn from real dates, so the demo pins its anchor relative to
// today: the last issue shipped four days ago, on a fortnightly cadence. That
// keeps the resting frame honest whenever it is screenshotted.
function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export default function NewsletterCadenceRailDemo() {
  const { anchor, issues } = useMemo(
    () => ({
      anchor: isoDaysAgo(4),
      issues: [
        { number: 48, title: "Why your design system keeps forking", dateISO: isoDaysAgo(4), href: "#" },
        { number: 47, title: "Reading a flamegraph without panicking", dateISO: isoDaysAgo(18), href: "#" },
        { number: 46, title: "The case against the loading spinner", dateISO: isoDaysAgo(32), href: "#" },
      ],
    }),
    []
  );

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / newsletter-cadence-rail
      </p>
      <div className="w-full max-w-md rounded-md border border-border bg-background px-6 py-6">
        <h2 className="text-xl font-medium tracking-tight text-foreground">Baseline</h2>
        <p className="mt-1 mb-5 text-sm text-muted">
          A fortnightly letter on interface craft, written by the people shipping it.
        </p>
        <NewsletterCadenceRail anchorISO={anchor} intervalDays={14} issues={issues} />
      </div>

      <p className="max-w-md text-center text-xs text-muted">
        The rail is six weeks of days at one character each — a dot per ordinary
        day, a bar on every issue day, the accent block on today. Count the gap
        between bars and you have read the cadence before typing anything.
      </p>
    </div>
  );
}
