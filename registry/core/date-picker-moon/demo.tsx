"use client";

import { useState } from "react";
import { TerminatorDateField } from "./component";

export default function TerminatorDateFieldDemo() {
  const [date, setDate] = useState<Date | null>(() => new Date());
  const [saved, setSaved] = useState(false);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / date-picker-moon
      </p>

      <div className="w-full max-w-md rounded-md border border-border bg-surface">
        <div className="border-b border-border px-6 py-5">
          <h2 className="text-sm font-semibold text-foreground">
            New journal entry
          </h2>
          <p className="mt-1 text-sm text-muted">
            The date picker doubles as a moon-phase almanac — every day cell
            carries its computed terminator, and committing a date runs a tiny
            eclipse across the numeral.
          </p>
        </div>

        <div className="flex flex-col gap-5 px-6 py-5">
          <div>
            <label
              htmlFor="journal-title"
              className="mb-1.5 block text-[13px] font-medium text-foreground"
            >
              Title
            </label>
            <input
              id="journal-title"
              type="text"
              defaultValue="Night sky over the ridge"
              onChange={() => setSaved(false)}
              className="h-9 w-full rounded-sm border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted/60 transition-colors hover:border-foreground/25 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
            />
          </div>

          <TerminatorDateField
            label="Entry date"
            value={date}
            onValueChange={(d) => {
              setDate(d);
              setSaved(false);
            }}
          />

          <div>
            <label
              htmlFor="journal-notes"
              className="mb-1.5 block text-[13px] font-medium text-foreground"
            >
              Notes
            </label>
            <textarea
              id="journal-notes"
              rows={3}
              defaultValue="Clear seeing after midnight. Terminator shadows sharp along the Apennines; worth dragging the dob out again tomorrow."
              onChange={() => setSaved(false)}
              className="w-full resize-none rounded-sm border border-border bg-background px-3 py-2 text-sm leading-relaxed text-foreground placeholder:text-muted/60 transition-colors hover:border-foreground/25 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <p className="font-mono text-xs text-muted" aria-live="polite">
            {saved
              ? "Entry saved"
              : date
                ? `Dated ${date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}`
                : "No date set"}
          </p>
          <button
            type="button"
            onClick={() => setSaved(true)}
            className="rounded-sm bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            Save entry
          </button>
        </div>
      </div>

      <p className="max-w-md text-center text-xs text-muted">
        Open the calendar (or press Arrow Down in the field), arrow through the
        month and watch the trailing moon track your focus. Enter commits with
        an eclipse transit across the chosen day.
      </p>
    </div>
  );
}
