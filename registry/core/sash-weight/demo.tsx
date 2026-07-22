"use client";

import { useState } from "react";
import { SashWeight } from "./component";

const FILES = [
  { name: "src/", dir: true, depth: 0 },
  { name: "app/", dir: true, depth: 1 },
  { name: "layout.tsx", dir: false, depth: 2 },
  { name: "page.tsx", dir: false, depth: 2 },
  { name: "components/", dir: true, depth: 1 },
  { name: "sash-weight.tsx", dir: false, depth: 2, active: true },
  { name: "toolbar.tsx", dir: false, depth: 2 },
  { name: "lib/", dir: true, depth: 1 },
  { name: "spring.ts", dir: false, depth: 2 },
  { name: "package.json", dir: false, depth: 0 },
];

const CODE_LINES = [
  "export function SashWeight({",
  "  orientation = \"vertical\",",
  "  detents = [25, 50, 75],",
  "  ...props",
  "}: SashWeightProps) {",
  "  const live = useSpring(pos, {",
  "    k: dragging ? 90 : 170,",
  "    zeta: dragging ? 1.15 : 1,",
  "  });",
  "",
  "  return <Divider {...live} />;",
  "}",
];

export default function SashWeightDemo() {
  const [outer, setOuter] = useState(28);
  const [inner, setInner] = useState(62);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / sash-weight — drag has weight, release finds a rail
      </p>

      <div className="h-[420px] w-full max-w-3xl overflow-hidden rounded-md border border-border bg-surface">
        <SashWeight
          orientation="vertical"
          value={outer}
          onValueChange={setOuter}
          min={16}
          max={60}
          detents={[20, 33, 50]}
          ariaLabel="Resize file tree and editor"
          className="sash-outer"
          start={
            <div className="h-full overflow-y-auto bg-background px-3 py-3">
              <p className="mb-2 px-1 font-mono text-[10px] uppercase tracking-wider text-muted">
                Explorer
              </p>
              <ul>
                {FILES.map((f) => (
                  <li
                    key={f.name}
                    className={`truncate rounded-sm px-1.5 py-1 font-mono text-xs ${
                      f.active ? "bg-border text-foreground" : f.dir ? "text-foreground" : "text-muted"
                    }`}
                    style={{ paddingLeft: 6 + f.depth * 12 }}
                  >
                    {f.name}
                  </li>
                ))}
              </ul>
            </div>
          }
          end={
            <SashWeight
              orientation="horizontal"
              value={inner}
              onValueChange={setInner}
              min={20}
              max={85}
              detents={[25, 50, 75]}
              ariaLabel="Resize editor and preview"
              start={
                <div className="h-full overflow-y-auto bg-background px-4 py-3 font-mono text-xs leading-6 text-foreground">
                  {CODE_LINES.map((line, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="w-5 shrink-0 text-right text-muted">{i + 1}</span>
                      <span className="whitespace-pre">{line || " "}</span>
                    </div>
                  ))}
                </div>
              }
              end={
                <div className="flex h-full flex-col items-center justify-center gap-3 bg-background px-4 py-3">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
                    Preview
                  </p>
                  <div className="w-full max-w-[220px] rounded-md border border-border bg-surface p-4">
                    <div className="mb-2 h-2 w-2/3 rounded-full bg-muted opacity-40" />
                    <div className="mb-1 h-2 w-full rounded-full bg-muted opacity-20" />
                    <div className="h-2 w-4/5 rounded-full bg-muted opacity-20" />
                    <div className="mt-3 h-7 w-20 rounded-sm bg-accent" />
                  </div>
                </div>
              }
            />
          }
        />
      </div>

      <p className="font-mono text-[11px] text-muted">
        drag either rail fast, or nudge it with Arrow keys — Enter jumps to 50/50
      </p>
    </div>
  );
}
