"use client";

import { useState } from "react";
import { ShingleCourse } from "./component";

export default function ShingleCourseDemo() {
  const [tz, setTz] = useState("europe-berlin");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / listbox-sticky-groups
      </p>

      <div className="w-full max-w-sm rounded-md border border-border bg-surface">
        <div className="border-b border-border px-6 py-5">
          <h2 className="text-sm font-semibold text-foreground">
            Schedule a deploy window
          </h2>
          <p className="mt-1 text-sm text-ns-muted">
            Scroll the list — passed regions compress into a stacked trail of
            headers at the top, still clickable, still labeled.
          </p>
        </div>

        <div className="px-6 py-6">
          <ShingleCourse label="Timezone" value={tz} onValueChange={setTz} />
        </div>

        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <p className="font-mono text-xs text-ns-muted">tz → {tz}</p>
          <button
            type="button"
            className="rounded-sm bg-ns-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-ns-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            Confirm window
          </button>
        </div>
      </div>

      <p className="max-w-sm text-center text-xs text-ns-muted">
        Arrow through options, type to jump by name — Home/End/PageUp/PageDown
        behave like a native select. Tab reaches each region header too;
        click one to ease back to the top of that group.
      </p>
    </div>
  );
}
