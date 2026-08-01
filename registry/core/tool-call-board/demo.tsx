"use client";

import { useEffect, useRef, useState } from "react";
import { TackleBoard, type TackleInvocation, type TackleTool } from "./component";

// A five-tool board for a research-and-edit agent. Every tool starts with a
// call from five minutes ago (past the 60s decay window) so the board opens
// on genuinely resting chips — inventory, not noise — while still giving
// `read_file` (the tool the gate opens) a real last call to expand. A small
// interval then fires fresh calls at random tools every couple of seconds,
// each streaming its arguments open and settling back down on completion,
// so the board reads as live without anyone touching it.

const TOOLS: TackleTool[] = [
  { id: "search_web", name: "search_web", affordance: "searches the live web" },
  { id: "read_file", name: "read_file", affordance: "reads a file from the repo" },
  { id: "run_tests", name: "run_tests", affordance: "runs the test suite" },
  { id: "send_message", name: "send_message", affordance: "messages the user" },
  { id: "fetch_url", name: "fetch_url", affordance: "fetches a URL's contents" },
];

const CALLS: { toolId: string; args: string; summary: string; status: "success" | "error" }[] = [
  { toolId: "search_web", args: 'query: "vercel geist changelog"', summary: "12 results", status: "success" },
  { toolId: "read_file", args: 'path: "src/routes/board.tsx"', summary: "214 lines", status: "success" },
  { toolId: "run_tests", args: "suite: tool-call-board.spec.ts", summary: "18 passed", status: "success" },
  { toolId: "send_message", args: 'text: "board is ready for review"', summary: "delivered", status: "success" },
  { toolId: "fetch_url", args: 'url: "https://vercel.com/design"', summary: "200 OK, 42kb", status: "success" },
  { toolId: "read_file", args: 'path: "config/tsconfig.json"', summary: "not found", status: "error" },
  { toolId: "search_web", args: 'query: "geist mono license"', summary: "4 results", status: "success" },
];

export default function TackleBoardDemo() {
  const idRef = useRef(0);
  const nextId = () => `inv-${(idRef.current += 1)}`;

  const [invocations, setInvocations] = useState<TackleInvocation[]>(() => {
    const base = Date.now() - 5 * 60 * 1000;
    return TOOLS.map((tool, i) => ({
      id: `seed-${tool.id}`,
      toolId: tool.id,
      args: CALLS.find((c) => c.toolId === tool.id)?.args ?? "",
      status: "success" as const,
      startedAt: base + i * 400,
      endedAt: base + i * 400 + 900,
      summary: CALLS.find((c) => c.toolId === tool.id)?.summary,
    }));
  });

  useEffect(() => {
    let callIndex = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const fireOne = () => {
      const call = CALLS[callIndex % CALLS.length];
      callIndex += 1;
      const id = nextId();
      const startedAt = Date.now();
      setInvocations((prev) =>
        [
          ...prev,
          { id, toolId: call.toolId, args: call.args, status: "pending" as const, startedAt },
        ].slice(-40),
      );
      const resolveIn = 750 + Math.random() * 650;
      const t = setTimeout(() => {
        setInvocations((prev) =>
          prev.map((inv) =>
            inv.id === id ? { ...inv, status: call.status, endedAt: Date.now(), summary: call.summary } : inv,
          ),
        );
      }, resolveIn);
      timers.push(t);
    };

    const interval = setInterval(fireOne, 2400);
    const kickoff = setTimeout(fireOne, 700);
    timers.push(kickoff);

    return () => {
      clearInterval(interval);
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl rounded-md border border-border bg-background p-6">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">Agent / tools</p>
        <TackleBoard tools={TOOLS} invocations={invocations} />
      </div>
    </div>
  );
}
