"use client";

import { BrassCheck, type CheckSession } from "./component";

// Deliberately more revocable rows than one autoplay cycle drains: "press"
// mode re-queries the first `.ns-bc-signout` each ~4s cycle and most holds
// abort well short of the 620ms/28deg commit threshold, but on the ones
// that do commit, a shallow list would empty out and sit blank instead of
// reading as a check board.
const SESSIONS: CheckSession[] = [
  { id: "s1", device: "MacBook Pro", location: "Athens, GR", lastSeen: "Active now", current: true },
  { id: "s2", device: "iPhone 15", location: "Athens, GR", lastSeen: "12 min ago" },
  { id: "s3", device: "Pixel 8", location: "Thessaloniki, GR", lastSeen: "2 hours ago" },
  { id: "s4", device: "Firefox / Windows", location: "Berlin, DE", lastSeen: "Yesterday" },
  { id: "s5", device: "iPad Air", location: "Athens, GR", lastSeen: "2 days ago" },
  { id: "s6", device: "Safari / macOS", location: "Patras, GR", lastSeen: "4 days ago" },
];

export default function BrassCheckDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">ns-ui / brass-check</p>

      <div className="w-full max-w-sm">
        <BrassCheck sessions={SESSIONS} label="Active sessions" />
      </div>

      <p className="max-w-md text-center text-xs text-ns-muted">
        Hold a tag&rsquo;s hook past the release angle to sign it out — let go early and it swings back.
      </p>
    </div>
  );
}
