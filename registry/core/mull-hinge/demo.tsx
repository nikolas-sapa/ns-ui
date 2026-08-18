"use client";

import { useCallback, useRef, useState } from "react";
import { MullHinge, type MullHingeComment } from "./component";

const INITIAL_COMMENTS: MullHingeComment[] = [
  { id: "c1", author: "Priya", body: "Can we confirm this against the audited figures before it ships?", timestamp: "2d" },
  { id: "c2", author: "Devon", body: "Finance signed off Tuesday — should be safe to cite directly.", timestamp: "1d" },
];

// A small scripted "concurrent edits" sequence: each press of the demo
// button plays one upstream event against the shared document — the real
// trigger for driftPx would be the collab layer's own diff, this just
// stands in for it so the card can demonstrate itself.
const STEPS = [
  { drift: 0, orphaned: false, note: "at rest — freshly anchored" },
  { drift: 46, orphaned: false, note: "a teammate added a paragraph above" },
  { drift: 88, orphaned: false, note: "another edit lands upstream" },
  { drift: 134, orphaned: false, note: "drift exceeds 120px — Mend appears" },
  { drift: 134, orphaned: true, note: "the anchored sentence itself gets deleted" },
  { drift: 0, orphaned: false, note: "thread re-anchored, back to rest" },
];

export default function MullHingeDemo() {
  const [comments, setComments] = useState(INITIAL_COMMENTS);
  const [step, setStep] = useState(0);
  const [driftPx, setDriftPx] = useState(STEPS[0].drift);
  const [orphaned, setOrphaned] = useState(STEPS[0].orphaned);
  const idRef = useRef(3);

  const advance = useCallback(() => {
    setStep((s) => {
      const next = (s + 1) % STEPS.length;
      setDriftPx(STEPS[next].drift);
      setOrphaned(STEPS[next].orphaned);
      return next;
    });
  }, []);

  const handleReply = useCallback((body: string) => {
    setComments((cs) => [...cs, { id: `c${idRef.current++}`, author: "You", body, timestamp: "now" }]);
  }, []);

  const handleMend = useCallback(() => {
    setDriftPx(0);
    setStep(0);
  }, []);

  const simulateDelete = useCallback(() => {
    setOrphaned(true);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <p className="max-w-md text-center font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / mull-hinge — simulate collaborator edits, watch the hinge shear and tear
      </p>

      <MullHinge
        className="w-full max-w-lg"
        title={`${comments.length} comment${comments.length === 1 ? "" : "s"}`}
        anchorQuote="the Q3 numbers"
        driftPx={driftPx}
        orphaned={orphaned}
        comments={comments}
        onReply={handleReply}
        onMend={handleMend}
      />

      <div className="flex flex-col items-center gap-2">
        <p className="text-xs text-ns-muted">{STEPS[step].note}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={advance}
            data-simulate-edit=""
            className="rounded-sm border border-border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide text-foreground outline-none transition-colors hover:bg-foreground/[0.06] focus-visible:ring-2 focus-visible:ring-ns-accent"
          >
            Simulate collaborator edit
          </button>
          <button
            type="button"
            onClick={simulateDelete}
            data-simulate-delete=""
            className="rounded-sm border border-border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide text-ns-muted outline-none transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent"
          >
            Delete anchor
          </button>
        </div>
      </div>
    </div>
  );
}
