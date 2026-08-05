"use client";

import { useState } from "react";
import { FlingSegment } from "./component";

type Status = "Todo" | "In progress" | "Done";

interface Task {
  id: string;
  title: string;
  status: Status;
  owner: string;
  due: string;
  start: number; // day offset within the sprint window (0-9)
  span: number; // days
}

const TASKS: Task[] = [
  {
    id: "NS-224",
    title: "Reduced-motion audit for registry demos",
    status: "Done",
    owner: "NS",
    due: "Jul 17",
    start: 0,
    span: 3,
  },
  {
    id: "NS-231",
    title: "Detent capture tuning for trackpad flings",
    status: "In progress",
    owner: "KM",
    due: "Jul 21",
    start: 1,
    span: 5,
  },
  {
    id: "NS-219",
    title: "Pointer-capture edge cases on iPad",
    status: "In progress",
    owner: "JL",
    due: "Jul 23",
    start: 3,
    span: 5,
  },
  {
    id: "NS-228",
    title: "Radiogroup keyboard pass on all controls",
    status: "Todo",
    owner: "AR",
    due: "Jul 24",
    start: 5,
    span: 4,
  },
  {
    id: "NS-215",
    title: "Publish segmented-control docs page",
    status: "Todo",
    owner: "NS",
    due: "Jul 28",
    start: 7,
    span: 3,
  },
];

const COLUMNS: Status[] = ["Todo", "In progress", "Done"];

function StatusDot({ status }: { status: Status }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${
        status === "Done"
          ? "bg-foreground"
          : status === "In progress"
            ? "bg-foreground/50"
            : "border border-foreground/40 bg-transparent"
      }`}
    />
  );
}

function Avatar({ initials }: { initials: string }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-background font-mono text-[10px] text-ns-muted">
      {initials}
    </span>
  );
}

function ListView() {
  return (
    <ul className="divide-y divide-border">
      {TASKS.map((t) => (
        <li
          key={t.id}
          className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-foreground/[0.03]"
        >
          <StatusDot status={t.status} />
          <span className="w-16 shrink-0 font-mono text-xs text-ns-muted">
            {t.id}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-foreground">
            {t.title}
          </span>
          <span className="hidden shrink-0 font-mono text-xs text-ns-muted sm:block">
            {t.due}
          </span>
          <Avatar initials={t.owner} />
        </li>
      ))}
    </ul>
  );
}

function BoardView() {
  return (
    <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
      {COLUMNS.map((col) => {
        const cards = TASKS.filter((t) => t.status === col);
        return (
          <div key={col} className="min-w-0">
            <div className="mb-3 flex items-center gap-2">
              <StatusDot status={col} />
              <span className="font-mono text-xs uppercase tracking-wider text-ns-muted">
                {col}
              </span>
              <span className="ml-auto font-mono text-xs text-ns-muted">
                {cards.length}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {cards.map((t) => (
                <div
                  key={t.id}
                  className="rounded-sm border border-border bg-background p-3 transition-colors hover:border-foreground/25"
                >
                  <p className="font-mono text-[11px] text-ns-muted">{t.id}</p>
                  <p className="mt-1 text-sm leading-snug text-foreground">
                    {t.title}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-mono text-[11px] text-ns-muted">
                      {t.due}
                    </span>
                    <Avatar initials={t.owner} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TimelineView() {
  return (
    <div className="p-5">
      <div className="mb-2 flex">
        <span className="w-16 shrink-0" />
        <div className="flex flex-1 justify-between font-mono text-[10px] text-ns-muted">
          <span>Jul 14</span>
          <span>Jul 16</span>
          <span>Jul 18</span>
          <span>Jul 20</span>
          <span>Jul 23</span>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {TASKS.map((t) => (
          <div key={t.id} className="flex items-center">
            <span className="w-16 shrink-0 font-mono text-xs text-ns-muted">
              {t.id}
            </span>
            <div className="relative h-7 flex-1 overflow-hidden rounded-sm [background-image:repeating-linear-gradient(to_right,var(--color-border)_0_1px,transparent_1px_10%)]">
              <div
                className={`absolute top-1 bottom-1 flex items-center gap-2 overflow-hidden rounded-sm border border-border px-2 ${
                  t.status === "Done" ? "bg-foreground/15" : "bg-background"
                }`}
                style={{
                  left: `${t.start * 10}%`,
                  width: `${t.span * 10}%`,
                }}
              >
                <StatusDot status={t.status} />
                <span className="truncate text-xs text-foreground">
                  {t.title}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FlingSegmentDemo() {
  const [view, setView] = useState("list");
  const inProgress = TASKS.filter((t) => t.status === "In progress").length;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / segmented-control-fling — grab the pill, fling it
      </p>

      <div className="w-full max-w-2xl rounded-md border border-border bg-surface">
        <div className="flex flex-wrap items-center gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-foreground">
              Sprint 24 — Interaction polish
            </h2>
            <p className="mt-0.5 font-mono text-xs text-ns-muted">
              {TASKS.length} tasks · {inProgress} in progress
            </p>
          </div>
          <button
            type="button"
            className="rounded-sm border border-border px-3 py-1.5 text-xs font-medium text-ns-muted transition-colors hover:border-foreground/25 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent"
          >
            Filter
          </button>
          <FlingSegment
            aria-label="Task view"
            introFling
            options={[
              { value: "list", label: "List" },
              { value: "board", label: "Board" },
              { value: "timeline", label: "Timeline" },
            ]}
            value={view}
            onValueChange={setView}
          />
        </div>

        <div className="min-h-[300px]">
          {view === "list" && <ListView />}
          {view === "board" && <BoardView />}
          {view === "timeline" && <TimelineView />}
        </div>

        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <p className="font-mono text-xs text-ns-muted">
            view / {view} · updated 2 min ago
          </p>
          <p className="font-mono text-xs text-ns-muted">sprint ends Jul 25</p>
        </div>
      </div>

      <p className="max-w-md text-center text-xs text-ns-muted">
        Click a segment and it switches instantly. Or grab the pill (the raised
        tab with the grip dots), throw it, and it coasts, bounces off the ends,
        and snaps into the nearest segment. Arrow keys work too.
      </p>
    </div>
  );
}
