"use client";

import { LenticuleSwing } from "./component";

export default function LenticuleSwingDemo() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="h-[520px] overflow-y-auto rounded-[16px] border border-border">
        <div className="px-8 py-10">
          <LenticuleSwing
            messageA="Your inbox is chaos."
            messageB="Now it isn't."
            snapAt={0.4}
            className="flex min-h-[380px] items-center"
          />
        </div>
        <div className="space-y-4 border-t border-border px-8 py-10">
          <p className="text-sm leading-relaxed text-ns-muted">
            Scroll. The headline above is set twice behind vertical slats at
            once — the problem statement on one pass, the promise on the
            other. At rest it shimmers between both, never fully settling on
            either; scroll it out of view and it snaps cleanly to the second
            line partway down.
          </p>
          <p className="text-sm leading-relaxed text-ns-muted">
            A screen reader hears both lines once, in order, with no
            interaction required — the slat apparatus is purely decorative.
          </p>
          <div className="h-[900px]" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
