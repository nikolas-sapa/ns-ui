"use client";

import { useState } from "react";
import { NibCheck } from "./component";

const CHANNELS = ["Email", "Push notifications", "SMS"];

export default function NibCheckDemo() {
  const [remember, setRemember] = useState(true);
  const [channels, setChannels] = useState<boolean[]>([true, false, true]);

  const allOn = channels.every(Boolean);
  const allOff = channels.every((c) => !c);
  const selectAllValue = allOn ? true : allOff ? false : "indeterminate";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 px-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / checkbox-ink-stroke — the everyday checkbox and its select-all cousin
      </p>

      <div className="w-full max-w-sm rounded-md border border-border bg-surface p-5">
        <NibCheck
          checked={remember}
          onCheckedChange={setRemember}
          label="Remember me on this device"
        />
      </div>

      <div className="w-full max-w-sm rounded-md border border-border bg-surface p-5">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="text-sm font-medium text-foreground">Notifications</h3>
          <NibCheck
            checked={selectAllValue}
            onCheckedChange={(next) => setChannels(channels.map(() => next))}
            label={<span className="text-xs uppercase tracking-wide text-muted">All</span>}
          />
        </div>
        <ul className="mt-3 flex flex-col gap-3">
          {CHANNELS.map((label, i) => (
            <li key={label}>
              <NibCheck
                checked={channels[i]}
                onCheckedChange={(next) =>
                  setChannels((prev) => prev.map((c, idx) => (idx === i ? next : c)))
                }
                label={label}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
