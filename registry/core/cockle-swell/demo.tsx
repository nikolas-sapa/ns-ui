"use client";

import { CockleSwell } from "./component";

export default function CockleSwellDemo() {
  return (
    <main className="flex h-screen w-full items-center justify-center overflow-hidden bg-background p-6">
      <div className="flex h-full max-h-full w-full max-w-lg flex-col justify-center gap-4">
        <p className="shrink-0 font-mono text-xs tracking-widest text-ns-muted">ns-ui / cockle-swell</p>
        {/* the sheet never settles — three drifting humidity sources keep the
            ridges reforming along the grain, with no input required */}
        <CockleSwell />
      </div>
    </main>
  );
}
