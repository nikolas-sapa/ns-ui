"use client";

import { CarbonLift } from "./component";

export default function CarbonLiftDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / copy-button-travel
      </p>

      <div className="flex w-full max-w-md flex-col gap-4 rounded-md border border-border bg-surface p-6">
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-foreground">
            API key
          </p>
          <div
            data-ns-cl-focus
            className="flex items-center justify-between gap-3 rounded-sm border border-border bg-background px-3 py-2"
          >
            <CarbonLift
              value="ns_demo_51Hb2c9k3f8G4mZ2qX7wA1p"
              description="API key"
            />
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[13px] font-medium text-foreground">
            Install command
          </p>
          <div className="flex items-center justify-between gap-3 rounded-sm border border-border bg-background px-3 py-2">
            <CarbonLift
              value="npx shadcn@latest add copy-button-travel"
              description="install command"
            />
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[13px] font-medium text-foreground">
            Share link
          </p>
          <div className="flex items-center justify-between gap-3 rounded-sm border border-border bg-background px-3 py-2">
            <CarbonLift
              value="https://ns-ui.dev/s/8f2c-9d41-lift"
              description="share link"
            />
          </div>
        </div>
      </div>

      <p className="max-w-md text-center text-xs text-ns-muted">
        Click Copy — a translucent duplicate of the text peels up and drifts
        toward the clipboard glyph, which gives a small settle bounce as the
        label ticks to &quot;Copied&quot;.
      </p>
    </div>
  );
}
