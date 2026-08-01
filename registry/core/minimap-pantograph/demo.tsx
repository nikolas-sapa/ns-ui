"use client";

import { ScissorReach } from "./component";

const METHODS = ["GET", "POST", "PUT", "DELETE"] as const;
const ROUTES = [
  "/api/users",
  "/api/orders",
  "/api/sessions",
  "/api/webhooks",
  "/api/search",
  "/api/billing",
];
const STATUSES = [200, 200, 200, 201, 204, 304, 404, 500];

const ROW_HEIGHT = 16;
const ROW_COUNT = 400;
const CONTENT_WIDTH = 560;
const CONTENT_HEIGHT = ROW_COUNT * ROW_HEIGHT;

// deterministic synthetic log line — no Math.random, so server and client
// render byte-identical markup
function genRow(i: number) {
  const method = METHODS[i % METHODS.length];
  const route = ROUTES[(i * 3) % ROUTES.length];
  const status = STATUSES[(i * 5) % STATUSES.length];
  const ms = 4 + ((i * 37) % 180);
  const mm = String((i * 7) % 60).padStart(2, "0");
  const ss = String((i * 11) % 60).padStart(2, "0");
  return `12:${mm}:${ss}  ${method.padEnd(6)} ${route.padEnd(16)} ${status}  ${ms}ms`;
}

const ROWS = Array.from({ length: ROW_COUNT }, (_, i) => genRow(i));

function LogLines() {
  return (
    <div className="font-mono text-[11px] text-muted">
      {ROWS.map((r, i) => (
        <div
          key={i}
          className="flex items-center gap-3 whitespace-pre px-3"
          style={{ height: ROW_HEIGHT, lineHeight: `${ROW_HEIGHT}px` }}
        >
          <span className="text-foreground/50">{String(i + 1).padStart(4, "0")}</span>
          <span>{r}</span>
        </div>
      ))}
    </div>
  );
}

export default function ScissorReachDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-3xl">
        <p className="mb-4 font-mono text-xs tracking-widest text-muted">
          ns-ui / scissor-reach
        </p>
        <div className="overflow-hidden rounded-md border border-border bg-surface">
          <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
            <span className="font-mono text-xs tracking-widest text-muted">
              REQUEST LOG — 400 ROWS
            </span>
            <span className="rounded-full border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted">
              live
            </span>
          </header>

          <div className="p-6">
            <ScissorReach
              contentWidth={CONTENT_WIDTH}
              contentHeight={CONTENT_HEIGHT}
              minimapWidth={140}
              minimapHeight={220}
              viewportHeight={340}
              rowHeight={ROW_HEIGHT}
              aria-label="Log position"
            >
              <LogLines />
            </ScissorReach>
          </div>

          <div className="border-t border-border px-6 py-3">
            <p className="font-mono text-[11px] text-muted">
              drag the band, or focus it — arrows step a row, Page Up/Down a
              screenful, Home/End jump to the ends
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
