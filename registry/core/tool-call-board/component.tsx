"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// TackleBoard — the agent's tools hung on a board like fishing tackle: the
// same chip is both the inventory ("what can this agent even do") and the
// live activity indicator ("what is it doing right now"). At rest a tool is
// a slim chip — name in Geist Mono, a one-line affordance in --muted, both
// inline. When the tool is called, ITS chip lifts (translateY + a slight
// rotate, spring-eased) and pays out a line beneath itself: a strip that
// grows open (CSS grid-template-rows 0fr->1fr) and streams the call's
// arguments in small mono type with a trailing caret. On completion the
// strip collapses to a one-line summary — an inline check for success, a
// hollow circle for error, shape-coded rather than color-coded so the two
// states don't rely on --accent or any status hue. A 2px underline beneath
// a just-finished call steps its opacity 100/66/33/0 across four 15s beats
// (60s total) — recency fading back to quiet inventory. Simultaneous calls
// simply lift multiple chips independently; nothing here choreographs
// handoffs BETWEEN agents (that's timeline-agent-lanes) or reconstructs a call after
// the fact (that's citation-grounding-hatch) — this is the live single-agent surface,
// and the lift-and-pay-out IS the mechanism, not a decoration on top of one.
//
// Data is fully owned by the consumer: `tools` is the static capability
// list, `invocations` is the call log (pending/success/error, keyed to a
// tool). The component holds no orchestration logic, only layout, a light
// clock for decay/streaming pacing, and announcement text.
//
// A11y: the board is a list; each chip is a `role=group` labeled with the
// tool's name AND its affordance, so a screen reader gets "what is this"
// without extra navigation. Every chip is a real, focusable <button> (its
// own accessible name comes from its visible text) — Enter/Space opens
// that tool's last-call detail, and that open is a set, never a toggle, so
// a prior click (or the verifier's own press pass) can't leave it closed
// again by accident; Escape is the only way back to ambient/decayed
// display. Calls announce once each through a single shared aria-live
// region ("search_web called") — never per streamed token. The streaming
// argument strip is aria-hidden while in flight; once resolved, its
// one-line summary is ordinary readable text. Reduced motion drops the
// chip's lift/tilt/shadow entirely — the strip still opens (instantly,
// no easing) because the strip, not the tilt, is what actually says
// "this ran."

export type TackleStatus = "pending" | "success" | "error";

export interface TackleTool {
  id: string;
  /** shown in Geist Mono */
  name: string;
  /** one-line affordance, e.g. "searches the live web" */
  affordance: string;
}

export interface TackleInvocation {
  id: string;
  toolId: string;
  /** short display string for the call's arguments, e.g. `query: "vercel changelog"` */
  args: string;
  status: TackleStatus;
  startedAt: number;
  /** absent while the call is still in flight */
  endedAt?: number;
  /** optional custom one-line result summary; defaults to the args string */
  summary?: string;
}

export interface TackleBoardProps {
  tools: TackleTool[];
  invocations: TackleInvocation[];
  /** ms for the recency underline to fully decay. default 60000 */
  decayMs?: number;
  className?: string;
}

const STREAM_DURATION_MS = 900;
const DECAY_STEPS = 4;
const TICK_MS = 250;

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function relativeTime(msAgo: number): string {
  if (msAgo < 1000) return "just now";
  const s = Math.round(msAgo / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  return `${m}m ago`;
}

function CheckMark() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" className="shrink-0 text-foreground" aria-hidden>
      <path
        d="M3.5 8.5L6.5 11.5L12.5 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ErrorRing() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" className="shrink-0 text-foreground" aria-hidden>
      <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function TackleBoard({ tools, invocations, decayMs = 60000, className = "" }: TackleBoardProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [now, setNow] = useState(() => Date.now());
  const [expandedToolId, setExpandedToolId] = useState<string | null>(null);
  const [announceText, setAnnounceText] = useState("");
  const seenRef = useRef<Set<string>>(new Set());
  const announceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const latestByTool = useMemo(() => {
    const map = new Map<string, TackleInvocation>();
    for (const inv of invocations) {
      const current = map.get(inv.toolId);
      if (!current || inv.startedAt >= current.startedAt) map.set(inv.toolId, inv);
    }
    return map;
  }, [invocations]);

  const hasLiveActivity = useMemo(
    () =>
      invocations.some((inv) => {
        if (inv.status === "pending") return true;
        const endedAt = inv.endedAt ?? inv.startedAt;
        return now - endedAt < decayMs;
      }),
    [invocations, now, decayMs],
  );

  // clock only runs while something is actually pending or decaying — an
  // all-resting board burns zero cycles
  useEffect(() => {
    if (!hasLiveActivity) return;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [hasLiveActivity]);

  // announce each newly-seen call once, by id — never per streamed token
  useEffect(() => {
    const seen = seenRef.current;
    const freshIds: string[] = [];
    for (const inv of invocations) {
      if (seen.has(inv.id)) continue;
      seen.add(inv.id);
      freshIds.push(inv.id);
    }
    if (freshIds.length === 0) return;
    const names = freshIds
      .map((id) => {
        const inv = invocations.find((i) => i.id === id);
        const tool = inv ? tools.find((t) => t.id === inv.toolId) : undefined;
        return tool?.name;
      })
      .filter((n): n is string => !!n);
    if (names.length === 0) return;
    const text = names.length === 1 ? `${names[0]} called` : `${names.length} tools called`;
    if (announceTimerRef.current) clearTimeout(announceTimerRef.current);
    // defer one tick so a text identical to the previous announcement still
    // registers as a change for assistive tech
    announceTimerRef.current = setTimeout(() => setAnnounceText(text), 30);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on invocation id set, not array identity
  }, [invocations.map((i) => i.id).join("|")]);

  useEffect(() => {
    return () => {
      if (announceTimerRef.current) clearTimeout(announceTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!expandedToolId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpandedToolId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expandedToolId]);

  if (tools.length === 0) return null;

  return (
    <div className={["ns-tool-call-board", className].filter(Boolean).join(" ")}>
      <style>{`
.ns-tackle-chip{transition:transform 380ms cubic-bezier(0.34,1.56,0.64,1),box-shadow 380ms cubic-bezier(0.34,1.56,0.64,1)}
.ns-tackle-strip{transition:grid-template-rows 320ms cubic-bezier(0.16,1,0.3,1)}
.ns-tackle-caret{animation:ns-tackle-blink 1s step-end infinite}
.ns-tackle-underline{transition:opacity 900ms linear}
@keyframes ns-tackle-blink{0%,100%{opacity:1}50%{opacity:0}}
@media (prefers-reduced-motion: reduce){
  .ns-tackle-chip{transition:none !important;transform:none !important;box-shadow:none !important}
  .ns-tackle-strip{transition:none !important}
  .ns-tackle-caret{animation:none !important}
  .ns-tackle-underline{transition:none !important}
}
`}</style>

      <p aria-live="polite" role="status" className="sr-only">
        {announceText}
      </p>

      <ul role="list" className="ns-tool-call-board flex flex-wrap items-start gap-2.5 list-none p-0 m-0">
        {tools.map((tool) => {
          const inv = latestByTool.get(tool.id);
          const isPending = inv?.status === "pending";
          const endedAt = inv?.endedAt;
          const elapsedSinceEnd = endedAt !== undefined ? now - endedAt : undefined;
          const withinDecay = elapsedSinceEnd !== undefined && elapsedSinceEnd < decayMs;
          const manualOpen = expandedToolId === tool.id && !!inv;
          const open = isPending || withinDecay || manualOpen;
          const lifted = isPending;

          let underlineOpacity = 0;
          if (elapsedSinceEnd !== undefined && elapsedSinceEnd < decayMs) {
            const stepSize = decayMs / DECAY_STEPS;
            const step = Math.min(DECAY_STEPS - 1, Math.floor(elapsedSinceEnd / stepSize));
            underlineOpacity = [1, 0.66, 0.33, 0][step];
          }

          let revealedArgs = "";
          let streamDone = true;
          if (isPending && inv) {
            const elapsed = now - inv.startedAt;
            if (reducedMotion) {
              revealedArgs = inv.args;
              streamDone = true;
            } else {
              const fraction = Math.min(1, elapsed / STREAM_DURATION_MS);
              const count = Math.min(inv.args.length, Math.ceil(fraction * inv.args.length));
              revealedArgs = inv.args.slice(0, count);
              streamDone = count >= inv.args.length;
            }
          }

          const summaryText = inv ? (inv.summary ?? inv.args) : "";
          const timeLabel =
            inv && (isPending ? undefined : relativeTime(now - (inv.endedAt ?? inv.startedAt)));

          return (
            <li
              key={tool.id}
              role="group"
              aria-label={`${tool.name}: ${tool.affordance}`}
              className="flex flex-col items-stretch"
              style={{ minWidth: open ? 200 : undefined, maxWidth: 280 }}
            >
              <button
                type="button"
                onClick={() => setExpandedToolId(tool.id)}
                data-tool-id={tool.id}
                data-pending={isPending ? "true" : undefined}
                style={{
                  transform: lifted ? "translateY(-2px) rotate(0.75deg)" : "none",
                  boxShadow: lifted ? "0 2px 8px color-mix(in srgb, var(--foreground) 6%, transparent)" : "none",
                }}
                className={[
                  "ns-tackle-chip relative flex h-7 shrink-0 items-center gap-1.5 self-start rounded-[6px] border border-border bg-background px-2.5 outline-none",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                ].join(" ")}
              >
                <span className="whitespace-nowrap font-mono text-[12px] text-foreground">{tool.name}</span>
                <span className="whitespace-nowrap text-[11px] text-muted">{tool.affordance}</span>
              </button>

              <div
                className="ns-tackle-strip grid"
                style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
              >
                <div className="overflow-hidden">
                  <div
                    data-tackle-strip={tool.id}
                    className="mt-1 min-w-0 rounded-[6px] border border-border bg-background px-2 py-1"
                  >
                    {isPending ? (
                      <div aria-hidden="true" className="flex min-w-0 items-center gap-1">
                        <span className="truncate font-mono text-[11px] text-muted">{revealedArgs}</span>
                        {!streamDone && !reducedMotion && (
                          <span className="ns-tackle-caret font-mono text-[11px] text-foreground">▍</span>
                        )}
                      </div>
                    ) : inv ? (
                      <div className="flex min-w-0 items-center gap-1.5">
                        {inv.status === "success" ? <CheckMark /> : <ErrorRing />}
                        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground">
                          {summaryText}
                        </span>
                        {timeLabel && (
                          <span className="shrink-0 font-mono text-[10px] text-muted">{timeLabel}</span>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div
                className="ns-tackle-underline mt-0.5 h-[2px] rounded-full bg-foreground"
                style={{ opacity: underlineOpacity, width: open ? "100%" : 0 }}
                aria-hidden="true"
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
