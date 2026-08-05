"use client";

import { TallyNotch } from "./component";

const ITEMS = [
  { id: "dns", label: "Point DNS at the new origin", hint: "cutover" },
  { id: "cert", label: "Issue TLS certificate", hint: "cutover" },
  { id: "env", label: "Set env vars in every deploy target", hint: "config" },
  { id: "smoke", label: "Smoke-test the live URL", hint: "verify" },
  { id: "alerts", label: "Wire uptime alerts", hint: "verify" },
  { id: "rollback", label: "Document the rollback path", hint: "safety" },
  { id: "announce", label: "Announce the cutover window", hint: "comms" },
];

export default function TallyNotchDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / checkbox-tally-notch
        </p>
        <TallyNotch label="Launch checklist" items={ITEMS} defaultChecked={["dns", "cert", "env"]} />
        <p className="mt-3 font-mono text-[11px] text-ns-muted">
          each check carves a stroke into the tally — the fifth slashes across
          its group of four
        </p>
      </div>
    </main>
  );
}
