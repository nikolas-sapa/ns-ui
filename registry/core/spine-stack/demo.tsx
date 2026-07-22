"use client";

import { useRef } from "react";
import { SpineStack, type SpineStackHandle, type SpineStackLevel } from "./component";

// A support/engineering workspace drilled four levels deep: teams -> projects
// -> tickets -> ticket detail. Each row is a real button (`data-drill-row`,
// picked up by autoplay's `press` mode and the gate's `openBy`) that pushes
// the next level via the imperative handle — realistic master-detail depth,
// not a two-level toy.

type Node = {
  id: string;
  title: string;
  meta?: string;
  children?: Node[];
  detail?: { status: string; assignee: string; body: string };
};

const TREE: Node[] = [
  {
    id: "eng",
    title: "Engineering",
    meta: "3 projects",
    children: [
      {
        id: "eng-gateway",
        title: "API Gateway",
        meta: "3 open",
        children: [
          {
            id: "tk-1",
            title: "Rate limiting bug",
            meta: "P1",
            detail: {
              status: "In progress",
              assignee: "Priya N.",
              body: "Burst traffic over 200 req/s bypasses the token-bucket limiter on the /v2 route group — likely a stale counter reset on pod restart.",
            },
          },
          {
            id: "tk-2",
            title: "Auth token refresh",
            meta: "P2",
            detail: {
              status: "Triage",
              assignee: "Unassigned",
              body: "Refresh tokens issued before the v4.2 rollout are rejected with a signature mismatch instead of a clean re-auth prompt.",
            },
          },
          {
            id: "tk-3",
            title: "CORS misconfig on staging",
            meta: "P3",
            detail: {
              status: "Open",
              assignee: "Marcus T.",
              body: "Preflight requests from the staging dashboard origin are missing Access-Control-Allow-Credentials on the new billing endpoints.",
            },
          },
        ],
      },
      {
        id: "eng-web",
        title: "Web App",
        meta: "2 open",
        children: [
          {
            id: "tk-4",
            title: "Checkout regression",
            meta: "P1",
            detail: {
              status: "In progress",
              assignee: "Priya N.",
              body: "Applying a discount code twice in one session double-counts the line-item total shown before payment, though the charge itself is correct.",
            },
          },
          {
            id: "tk-5",
            title: "Onboarding redesign",
            meta: "Draft",
            detail: {
              status: "Draft",
              assignee: "Sana K.",
              body: "Three-step signup flow replacing the current single long form; first Figma pass is in for review.",
            },
          },
        ],
      },
    ],
  },
  {
    id: "design",
    title: "Design",
    meta: "1 project",
    children: [
      {
        id: "design-brand",
        title: "Brand Refresh",
        meta: "2 open",
        children: [
          {
            id: "tk-6",
            title: "Logo exploration",
            meta: "Review",
            detail: {
              status: "In review",
              assignee: "Sana K.",
              body: "Second round of wordmark variants, narrowed to two directions after the founder walkthrough.",
            },
          },
          {
            id: "tk-7",
            title: "Typography audit",
            meta: "Open",
            detail: {
              status: "Open",
              assignee: "Unassigned",
              body: "Geist Sans is live in-product; this audit checks every marketing surface still on the old typeface stack.",
            },
          },
        ],
      },
    ],
  },
  {
    id: "support",
    title: "Support",
    meta: "1 project",
    children: [
      {
        id: "support-escalations",
        title: "Escalations",
        meta: "2 open",
        children: [
          {
            id: "tk-8",
            title: "Ticket #4821 — billing",
            meta: "P1",
            detail: {
              status: "In progress",
              assignee: "Marcus T.",
              body: "Customer charged twice for the annual plan after a failed card retry; refund queued, root cause still open.",
            },
          },
          {
            id: "tk-9",
            title: "Ticket #4790 — export",
            meta: "P2",
            detail: {
              status: "Open",
              assignee: "Unassigned",
              body: "CSV export truncates at 10k rows with no error surfaced to the user — likely a silent timeout, not a real row limit.",
            },
          },
        ],
      },
    ],
  },
];

function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 shrink-0 text-muted"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m6 3 5 5-5 5" />
    </svg>
  );
}

function RowList({ nodes, onOpen }: { nodes: Node[]; onOpen: (n: Node) => void }) {
  return (
    <ul className="flex flex-col gap-1">
      {nodes.map((n) => (
        <li key={n.id}>
          <button
            type="button"
            data-drill-row
            onClick={() => onOpen(n)}
            className="flex w-full items-center justify-between gap-3 rounded-sm px-3 py-2 text-left text-sm text-foreground outline-none transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span className="truncate">{n.title}</span>
            <span className="flex shrink-0 items-center gap-2">
              {n.meta && (
                <span className="font-mono text-[10px] uppercase tracking-wide text-muted">{n.meta}</span>
              )}
              <ChevronIcon />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function DetailView({ node }: { node: Node }) {
  if (!node.detail) return null;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted">
          {node.detail.status}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wide text-muted">
          {node.detail.assignee}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-foreground">{node.detail.body}</p>
    </div>
  );
}

function LevelBody({ node, onOpen }: { node: Node; onOpen: (n: Node) => void }) {
  if (node.children) return <RowList nodes={node.children} onOpen={onOpen} />;
  return <DetailView node={node} />;
}

export default function SpineStackDemo() {
  const handleRef = useRef<SpineStackHandle>(null);

  const openNode = (n: Node) => {
    handleRef.current?.push({
      id: n.id,
      title: n.title,
      content: <LevelBody node={n} onOpen={openNode} />,
    });
  };

  const rootLevel: SpineStackLevel = {
    id: "root",
    title: "Workspaces",
    content: <RowList nodes={TREE} onOpen={openNode} />,
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-3xl">
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
          Support workspace
        </p>
        <div className="h-[440px] overflow-hidden rounded-md border border-border bg-background p-2">
          <SpineStack ref={handleRef} initial={rootLevel} className="h-full" />
        </div>
      </div>
    </div>
  );
}
