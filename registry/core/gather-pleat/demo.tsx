"use client";

import { GatherPleat } from "./component";

const FILES: { path: string; size: string }[] = [
  { path: "~/dev/ns-ui/registry/core/gather-pleat/component.tsx", size: "9.8 KB" },
  { path: "src/lib/utils/format-currency.ts", size: "1.2 KB" },
  { path: "/var/log/deploy/2026-07-22/build-worker-04.log", size: "412 KB" },
  { path: "README.md", size: "3.4 KB" },
];

const REQUESTS: { id: string; status: string }[] = [
  { id: "req_9f3a2c7e1b6d4f80a5c3e9d21f7b4a68", status: "200" },
  { id: "req_1a2b3c", status: "200" },
  { id: "req_6b4e8a1f3c9d7e2058fa1c34d9b7e021", status: "500" },
];

export default function GatherPleatDemo() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-12 bg-background px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">ns-ui / gather-pleat</p>

      <div className="w-full max-w-xl space-y-2">
        <p className="text-sm text-muted">
          Click, drag, or focus + Enter to pull a pleat open — the fold count shows how much is hidden.
        </p>
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-[75%]" />
              <col className="w-[25%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-border bg-background text-left font-mono text-[11px] uppercase tracking-wide text-muted">
                <th className="px-3 py-2 font-normal">Path</th>
                <th className="px-3 py-2 font-normal">Size</th>
              </tr>
            </thead>
            <tbody>
              {FILES.map((f, i) => (
                <tr key={f.path} className={i > 0 ? "border-t border-border" : undefined}>
                  <td className="px-3 py-2 font-mono text-xs text-foreground">
                    <GatherPleat text={f.path} headChars={14} tailChars={16} />
                  </td>
                  <td className="px-3 py-2 text-muted">{f.size}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="w-full max-w-md space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-wide text-muted">Request IDs</p>
        <div className="flex flex-col gap-2 rounded-md border border-border p-3">
          {REQUESTS.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 font-mono text-xs">
              <GatherPleat text={r.id} headChars={6} tailChars={6} />
              <span className={r.status === "500" ? "text-foreground" : "text-muted"}>{r.status}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="w-full max-w-md space-y-1">
        <p className="font-mono text-[11px] uppercase tracking-wide text-muted">Header</p>
        <div className="rounded-sm border border-border px-3 py-2 font-mono text-sm text-foreground">
          <GatherPleat
            text="https://console.example.com/projects/ns-ui-lab/deployments/dpl_8x2mQ9vRk4Lp7tN3wZ"
            headChars={20}
            tailChars={10}
          />
        </div>
      </div>
    </main>
  );
}
