"use client";

import { useState } from "react";
import { CopyButton } from "../_components/copy-button";
import type { MCPClient } from "./mcp-clients";

/**
 * One block visible at a time instead of seven stacked code blocks. Plain
 * toggle buttons rather than an ARIA tablist, the same choice
 * catalog-controls.tsx makes for its collection filter: there's no
 * arrow-key roving-tabindex behind this, so `role="tab"` would promise a
 * keyboard pattern that isn't implemented. Every button is still a real
 * `<button>`, reachable by Tab and activated by Enter/Space — that's what
 * "keyboard operable" means for a toggle group, not an ARIA role.
 */
export function ClientSwitcher({ clients }: { clients: MCPClient[] }) {
  const [active, setActive] = useState(clients[0].id);
  const client = clients.find((c) => c.id === active) ?? clients[0];

  return (
    <div>
      <div
        role="group"
        aria-label="MCP client"
        className="flex flex-wrap items-center gap-1"
      >
        {clients.map((c) => {
          const selected = c.id === client.id;
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={selected}
              onClick={() => setActive(c.id)}
              className={`rounded-sm border px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none ${
                selected
                  ? "border-accent/40 bg-accent/10 text-foreground"
                  : "border-border text-muted hover:text-foreground"
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-muted">
        {client.configPath}
      </p>
      <div className="mt-2 flex items-start gap-2 rounded-md border border-border bg-surface py-2 pl-3.5 pr-1.5">
        <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground">
          <code>{client.snippet}</code>
        </pre>
        <CopyButton
          variant="inline"
          value={client.snippet}
          label={`Copy ${client.label} config`}
        />
      </div>
    </div>
  );
}
