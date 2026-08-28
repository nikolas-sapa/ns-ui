"use client";

import { EdmCraterField } from "./component";

// The plate is already at its steady simmer of craters before anything is
// touched. Overlaid type sits on a token scrim, since the field spans most
// of the value range and a crater can land under any line of it.
export default function EdmCraterFieldDemo() {
  return (
    <main className="h-screen w-full overflow-hidden bg-background">
      <EdmCraterField>
        <div className="pointer-events-none flex h-full w-full flex-col items-center justify-end gap-4 px-6 pb-14 text-center sm:pb-20">
          <div className="flex flex-col items-center gap-3 rounded-lg bg-background/70 px-7 py-5 backdrop-blur-md">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-ns-muted">
              ns-ui / edm-crater-field
            </p>
            <h1 className="text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
              Eroded by spark
            </h1>
            <p className="max-w-sm text-sm text-ns-muted">
              Move over the plate to bring the electrode closer — discharges cluster wherever you linger.
            </p>
          </div>
          <a
            href="#docs"
            className="pointer-events-auto mt-1 inline-flex w-fit items-center justify-center rounded-sm bg-ns-accent px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-ns-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            Read the docs
          </a>
        </div>
      </EdmCraterField>
    </main>
  );
}
