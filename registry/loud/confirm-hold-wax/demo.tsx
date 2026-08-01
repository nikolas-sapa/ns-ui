"use client";

import { SignetDrop } from "./component";

// A letter being closed out. The component's demo prop drives itself through
// the same internal hold/release functions the real handlers use: two short
// early-release pours (the blob slumps and drains back) while the button sits
// in its normal idle state, then one full hold that completes — stamp drop,
// squish ring, 2s cool-down with crack reveal — and stays sealed for good.
export default function SignetDropDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / signet-drop
      </p>

      <div className="w-full max-w-md rounded-[12px] border border-border bg-background px-8 pb-6 pt-8">
        <div className="flex flex-col gap-2.5" aria-hidden="true">
          <span className="h-3 w-1/3 rounded-full bg-border" />
          <span className="mt-3 h-3 w-full rounded-full bg-border" />
          <span className="h-3 w-11/12 rounded-full bg-border" />
          <span className="h-3 w-full rounded-full bg-border" />
          <span className="h-3 w-3/5 rounded-full bg-border" />
        </div>

        <div className="mt-2 flex flex-col items-center">
          <SignetDrop demo />
        </div>
      </div>

      <p className="max-w-md text-center text-xs text-muted">
        Press and hold Seal to pour wax. Release early and the blob slumps
        back; hold to the end and the signet stamps it, the wax cools, and the
        seal is permanent.
      </p>
    </div>
  );
}
