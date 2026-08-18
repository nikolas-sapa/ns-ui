"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// RouteSlip — a multi-party approval ledger styled as an interoffice routing
// slip, not an avatar-stack "seen by" row. Approver rows render in fixed
// ROUTED order and never reorder themselves; that order is set once from the
// `approvers` prop and is the spine every other visual hangs off. Signing is
// a real, irreversible action scoped to `currentApproverId`'s own row — no
// other row ever renders a Sign control. What distinguishes this from a
// checkmark list is that signing out of turn is explicitly PERMITTED: a
// signature is flagged "out of turn" whenever, at final state, some earlier
// -routed approver's slot is still empty or was filled later than this one
// (computed purely from routed index + signed timestamp, not from the order
// clicks happened to arrive in). An in-turn chop settles at a plain 3deg
// tilt; an out-of-turn chop lands with an 8deg skew on top of that tilt —
// large enough to read as irregular at a glance, small enough to stay
// legible — and the row also carries a plain-text "out of turn" note, so the
// distinction never depends on noticing the skew.
//
// One governing scalar — signed count over `quorum` — derives the progress
// line, Publish's aria-disabled state + written reason, and the crawling
// underline under whichever unsigned row is currently "Now" (the first gap
// in routed order, independent of who's allowed to fill it). `quorum` can be
// less than the full roster: publish can unblock before every name is
// stamped, which is a different claim than "everyone signed."
//
// Pure DOM + CSS: a real <table> (approver / role / status / time columns,
// <caption>, <th scope="col">), a polite aria-live region announcing
// "{n} of {total} signed; waiting on {role}", and every color drawn from
// --background / --foreground / --ns-muted / --border / --ns-accent.
// --ns-accent appears nowhere but the enabled Sign/Publish buttons' own
// hover/focus/active states — never on a chop, never as a fill elsewhere.
// ---------------------------------------------------------------------------

export interface RouteSlipApprover {
  /** stable identifier */
  id: string;
  /** printed name */
  name: string;
  /** short role/team label, e.g. "Legal" — this is what Publish's reason and
   * the aria-live announcement name when this approver is next */
  role: string;
}

export interface RouteSlipSignature {
  approverId: string;
  /** when this approver actually signed */
  at: number | Date;
}

export interface RouteSlipProps {
  /** the approver chain in ROUTED order — fixed row order, index 0 is first
   * in sequence. This order never changes regardless of actual signing order. */
  approvers: RouteSlipApprover[];
  /** seed one or more approvers as already signed, in whatever order they
   * actually signed (not necessarily routed order) — out-of-turn flags are
   * derived from this at every render */
  initialSignatures?: RouteSlipSignature[];
  /** signatures required before Publish unblocks. Clamped to
   * [1, approvers.length]. @default approvers.length */
  quorum?: number;
  /** the approver whose row gets a real Sign button — every other row is
   * read-only regardless of signed state */
  currentApproverId?: string;
  /** label for the document being routed, shown as the card title and in
   * the table's accessible caption */
  docLabel?: string;
  /** called once per successful sign, with the approver id and timestamp */
  onSign?: (approverId: string, at: number) => void;
  /** called once, when Publish is activated at or above quorum */
  onPublish?: () => void;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

type Sig = { approverId: string; at: number };

const CHOP_MS = 260;

function toMs(v: number | Date): number {
  return typeof v === "number" ? v : v.getTime();
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function useReducedMotion(): boolean {
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

// A wall-clock stamp is the one thing here that can legitimately differ
// between the server render and the client one (locale/timezone), same
// reasoning as approval-inline-diff's TimeStamp — suppressHydrationWarning
// is correct, not a bug being papered over.
function TimeStamp({ ts }: { ts: number }) {
  const label = new Date(ts).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
  return <span suppressHydrationWarning>{label}</span>;
}

export function RouteSlip({
  approvers,
  initialSignatures,
  quorum,
  currentApproverId,
  docLabel = "Routing slip",
  onSign,
  onPublish,
  className = "",
}: RouteSlipProps) {
  const uid = useId().replace(/:/g, "");
  const captionId = `rs-caption-${uid}`;
  const reasonId = `rs-reason-${uid}`;

  const reducedMotion = useReducedMotion();

  const [signatures, setSignatures] = useState<Sig[]>(() =>
    (initialSignatures ?? []).map((s) => ({ approverId: s.approverId, at: toMs(s.at) }))
  );
  const [published, setPublished] = useState(false);
  const [arrivingId, setArrivingId] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const arriveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const prevSignedCount = useRef(signatures.length);
  const prevPublished = useRef(false);

  useEffect(() => () => clearTimeout(arriveTimer.current), []);

  const quorumN = useMemo(() => {
    const total = approvers.length || 1;
    const raw = quorum ?? total;
    return Math.min(total, Math.max(1, raw));
  }, [quorum, approvers.length]);

  const signedMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of signatures) m.set(s.approverId, s.at);
    return m;
  }, [signatures]);

  // Out-of-turn is derived from final state alone: approver i is out of turn
  // if some earlier-routed approver j<i is still unsigned, or signed later
  // than i did. Row 0 can never be out of turn — there is no one earlier to
  // have skipped ahead of.
  const outOfTurn = useMemo(() => {
    const flags = new Array<boolean>(approvers.length).fill(false);
    for (let i = 0; i < approvers.length; i++) {
      const at = signedMap.get(approvers[i].id);
      if (at === undefined) continue;
      for (let j = 0; j < i; j++) {
        const otherAt = signedMap.get(approvers[j].id);
        if (otherAt === undefined || otherAt > at) {
          flags[i] = true;
          break;
        }
      }
    }
    return flags;
  }, [approvers, signedMap]);

  const nextIndex = useMemo(
    () => approvers.findIndex((a) => !signedMap.has(a.id)),
    [approvers, signedMap]
  );
  const nextApprover = nextIndex >= 0 ? approvers[nextIndex] : null;

  const signedCount = signatures.length;
  const quorumMet = signedCount >= quorumN;
  const total = approvers.length;

  // Announce only on genuine transitions (new sign / publish), never on the
  // initial seeded mount — matches due-slip's newcomer-only announce pattern.
  useEffect(() => {
    if (signedCount > prevSignedCount.current) {
      const msg = nextApprover
        ? `${signedCount} of ${total} signed; waiting on ${nextApprover.role}.`
        : `${signedCount} of ${total} signed; all signed.`;
      setAnnounce(quorumMet ? `${msg} Publish unlocked.` : msg);
    }
    prevSignedCount.current = signedCount;
  }, [signedCount, total, nextApprover, quorumMet]);

  useEffect(() => {
    if (published && !prevPublished.current) setAnnounce("Published.");
    prevPublished.current = published;
  }, [published]);

  function handleSign() {
    if (!currentApproverId || published) return;
    if (signedMap.has(currentApproverId)) return;
    const at = Date.now();
    setSignatures((prev) => [...prev, { approverId: currentApproverId, at }]);
    onSign?.(currentApproverId, at);
    if (!reducedMotion) {
      setArrivingId(currentApproverId);
      clearTimeout(arriveTimer.current);
      arriveTimer.current = setTimeout(() => setArrivingId(null), CHOP_MS);
    }
  }

  function handlePublish() {
    if (published || !quorumMet) return;
    setPublished(true);
    onPublish?.();
  }

  const remaining = Math.max(0, quorumN - signedCount);
  let reasonText: string;
  if (published) {
    reasonText = "Published.";
  } else if (quorumMet) {
    reasonText = "Quorum met — ready to publish.";
  } else if (nextApprover) {
    reasonText = `Publish disabled — needs ${remaining} more signature${
      remaining === 1 ? "" : "s"
    }, waiting on ${nextApprover.role}.`;
  } else {
    reasonText = "Publish disabled — awaiting signatures.";
  }

  const publishDisabled = !quorumMet || published;

  return (
    <div className={`w-full max-w-xl rounded-md border border-border bg-background ${className}`}>
      <style>{CSS}</style>
      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announce}
      </span>

      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{docLabel}</p>
          <p className="font-mono text-[11px] text-ns-muted">
            Quorum {quorumN} of {total}
          </p>
        </div>
        <p className="shrink-0 font-mono text-xs tabular-nums text-ns-muted">
          {signedCount} of {total} signed
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption id={captionId} className="sr-only">
            Approver routing slip for {docLabel}, in routed order
          </caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="px-4 py-2 text-left font-mono text-[10px] uppercase tracking-wide text-ns-muted">
                Approver
              </th>
              <th scope="col" className="px-3 py-2 text-left font-mono text-[10px] uppercase tracking-wide text-ns-muted">
                Role
              </th>
              <th scope="col" className="px-3 py-2 text-left font-mono text-[10px] uppercase tracking-wide text-ns-muted">
                Status
              </th>
              <th scope="col" className="px-4 py-2 text-right font-mono text-[10px] uppercase tracking-wide text-ns-muted">
                Time
              </th>
            </tr>
          </thead>
          <tbody>
            {approvers.map((a, i) => {
              const at = signedMap.get(a.id);
              const isSigned = at !== undefined;
              const isNext = !isSigned && i === nextIndex;
              const isOutOfTurn = isSigned && outOfTurn[i];
              const showSign = a.id === currentApproverId && !isSigned && !published;
              const arriving = arrivingId === a.id;

              return (
                <tr key={a.id} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center gap-2.5">
                      <span className="text-foreground">{a.name}</span>
                      <span
                        aria-hidden="true"
                        className="ns-rs-box"
                        data-signed={isSigned || undefined}
                        data-out-of-turn={isOutOfTurn || undefined}
                        data-arriving={arriving || undefined}
                      >
                        {isSigned ? initialsOf(a.name) : null}
                      </span>
                    </div>
                    {isOutOfTurn && (
                      <p
                        data-slip-out-of-turn
                        className="mt-1 font-mono text-[10px] uppercase tracking-wide text-ns-muted"
                      >
                        out of turn
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-3 align-top text-ns-muted">{a.role}</td>
                  <td className="px-3 py-3 align-top">
                    {isSigned ? (
                      <span className="font-mono text-xs text-foreground">Signed</span>
                    ) : showSign ? (
                      <button
                        type="button"
                        data-slip-sign
                        onClick={handleSign}
                        className="ns-rs-btn"
                      >
                        Sign as {a.name}
                      </button>
                    ) : isNext ? (
                      <span className="ns-rs-now">Now</span>
                    ) : (
                      <span className="font-mono text-xs text-ns-muted">Awaiting</span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-right">
                    {isSigned ? (
                      <time
                        dateTime={new Date(at as number).toISOString()}
                        suppressHydrationWarning
                        className="font-mono text-xs tabular-nums text-ns-muted"
                      >
                        <TimeStamp ts={at as number} />
                      </time>
                    ) : (
                      <span aria-hidden="true" className="font-mono text-xs text-ns-muted">
                        —
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="border-t border-border px-4 py-3">
        <button
          type="button"
          data-slip-publish
          aria-disabled={publishDisabled}
          aria-describedby={reasonId}
          data-disabled={publishDisabled || undefined}
          onClick={handlePublish}
          className="ns-rs-btn w-full py-2 text-xs uppercase tracking-wide"
        >
          {published ? "Published" : "Publish"}
        </button>
        <p id={reasonId} className="mt-2 font-mono text-[11px] text-ns-muted">
          {reasonText}
        </p>
      </div>
    </div>
  );
}

const CSS = `
.ns-rs-box{
  position: relative;
  display: inline-flex;
  min-width: 42px;
  height: 26px;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
  border: 1px dashed var(--border);
  border-radius: 6px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--foreground);
  transform-origin: center;
}
.ns-rs-box[data-signed]{
  border-style: solid;
  border-color: var(--foreground);
  transform: rotate(3deg);
}
.ns-rs-box[data-out-of-turn]{
  transform: rotate(2deg) skewX(8deg);
}
.ns-rs-box[data-arriving]{
  animation: ns-rs-chop-in ${CHOP_MS}ms cubic-bezier(0.16,1,0.3,1) both;
}
.ns-rs-box[data-arriving][data-out-of-turn]{
  animation-name: ns-rs-chop-in-skew;
}
@keyframes ns-rs-chop-in{
  from{ transform: scale(1.15) rotate(0deg); opacity: 0.45; }
  to{ transform: scale(1) rotate(3deg); opacity: 1; }
}
@keyframes ns-rs-chop-in-skew{
  from{ transform: scale(1.15) rotate(0deg) skewX(0deg); opacity: 0.45; }
  to{ transform: scale(1) rotate(2deg) skewX(8deg); opacity: 1; }
}

.ns-rs-now{
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--foreground);
  padding-bottom: 3px;
  background-image: repeating-linear-gradient(90deg, var(--foreground) 0 5px, transparent 5px 10px);
  background-position: 0 100%;
  background-repeat: repeat-x;
  background-size: 20px 1px;
  animation: ns-rs-crawl 900ms linear infinite;
}
@keyframes ns-rs-crawl{
  to{ background-position: -20px 100%; }
}

.ns-rs-btn{
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 4px 10px;
  cursor: pointer;
  transition: background-color 150ms ease-out, border-color 150ms ease-out;
}
.ns-rs-btn:hover{
  border-color: var(--ns-accent);
  background: color-mix(in srgb, var(--ns-accent) 10%, var(--background));
}
.ns-rs-btn:active{
  background: color-mix(in srgb, var(--ns-accent) 18%, var(--background));
}
.ns-rs-btn:focus-visible{
  outline: 2px solid var(--ns-accent);
  outline-offset: 2px;
}
.ns-rs-btn[data-disabled="true"]{
  color: var(--ns-muted);
  cursor: not-allowed;
}
.ns-rs-btn[data-disabled="true"]:hover,
.ns-rs-btn[data-disabled="true"]:active{
  border-color: var(--border);
  background: var(--background);
}
.ns-rs-btn[data-disabled="true"]:focus-visible{
  outline: 2px solid var(--foreground);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce){
  .ns-rs-box[data-arriving]{ animation: none; }
  .ns-rs-now{ animation: none; }
  .ns-rs-btn{ transition: none; }
}
`;
