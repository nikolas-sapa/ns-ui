"use client";

import { CockleSwell } from "./component";

export default function CockleSwellDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg">
        <p className="mb-5 font-mono text-xs tracking-widest text-ns-muted">ns-ui / cockle-swell</p>
        {/* the sheet never settles — three drifting humidity sources keep the
            ridges reforming along the grain, with no input required */}
        <CockleSwell />
      </div>
    </main>
  );
}
