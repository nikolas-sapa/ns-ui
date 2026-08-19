"use client";

import { BittingCut, type Passkey } from "./component";

// Settings > Sign-in methods, the way it actually reads for the owner: three
// already-enrolled passkeys rendered pre-cut (no entrance animation — they
// were enrolled before this page loaded), a low maxPasskeys so the "Add
// passkey" autoplay demonstrates the cutter pass a couple of times and then
// rests rather than growing the card forever.
const DAY = 86400000;
const NOW = Date.now();

const SEED_PASSKEYS: Passkey[] = [
  {
    id: "cred-a1e4f9c2-macbook",
    name: "MacBook Pro",
    device: "laptop",
    createdAt: NOW - 62 * DAY,
    lastUsedAt: NOW - 40 * 60 * 1000,
  },
  {
    id: "cred-77b03d5e-iphone",
    name: "iPhone 16",
    device: "phone",
    createdAt: NOW - 18 * DAY,
    lastUsedAt: NOW,
  },
  {
    id: "cred-f120c8aa-yubikey",
    name: "YubiKey 5C",
    device: "key",
    createdAt: NOW - 9 * DAY,
    lastUsedAt: NOW - 6 * DAY,
  },
];

export default function BittingCutDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">ns-ui / bitting-cut</p>

      <div className="w-full max-w-lg rounded-[16px] border border-border bg-background p-5">
        <BittingCut initialPasskeys={SEED_PASSKEYS} maxPasskeys={5} />
      </div>

      <p className="max-w-md text-center text-xs text-ns-muted">
        Each passkey&apos;s bitting is cut from its credential id — same id, same six notches, every
        time. Add enrolls a new key with a one-shot cutter pass; Remove arms, then confirms, then files
        the profile flat before the row leaves.
      </p>
    </div>
  );
}
