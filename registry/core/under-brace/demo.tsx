"use client";

import { UnderBrace } from "./component";

export default function UnderBraceDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="w-full max-w-2xl">
        <p className="font-mono text-xs tracking-widest text-ns-muted">ns-ui / under-brace</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          Braces underneath, not colors on top.
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ns-muted">
          Each match gets a └──┘ span directly under its characters; capture
          groups add their own rows further down, one level per nesting
          depth, numbered inside the brace. Hover a brace, or a group chip,
          to see exactly what it caught.
        </p>

        <div className="mt-8">
          <UnderBrace
            defaultPattern={"#([A-Z]{2}-(\\d{2,4}))"}
            defaultFlags=""
            defaultSample={"Ticket #TX-482 shipped today.\nTicket #ca-17 is still pending.\nTicket #NY-9310 arrived early."}
          />
        </div>

        <p className="mt-3 font-mono text-[11px] text-ns-muted">
          add the i flag and “#ca-17” lights up too — the tool re-derives
          every brace live, no recompile step
        </p>
      </div>
    </main>
  );
}
