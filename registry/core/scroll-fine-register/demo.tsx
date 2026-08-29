"use client";

import { ScrollFineRegister } from "./component";

export default function ScrollFineRegisterDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / scroll-fine-register
      </p>

      <div className="w-full max-w-2xl">
        <ScrollFineRegister />
      </div>

      <p className="max-w-md text-center font-mono text-xs text-ns-muted">
        a fine register sweeps one tile every 480ms while the coarse counter
        beside it ticks once per sweep — the two numbers driving the scroll
      </p>
    </div>
  );
}
