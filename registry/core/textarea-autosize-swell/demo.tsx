"use client";

import { ProofRise } from "./component";

const FIELD_ID = "textarea-autosize-swell-comment";
const LONG_COMMENT =
  "Thanks for the detailed writeup — this is exactly the kind of context I was missing.\n\nA few things I noticed while reading through:\n1. The timeline in section two assumes the migration finishes before the freeze.\n2. We should double-check the rollback plan against last quarter's incident.\n3. Happy to pair on the risky part tomorrow if that helps.";

// writes directly to the textarea's DOM node the same way a real paste
// does — native value setter, then a `paste` event (so the component's own
// paste flag is armed) followed by `input` (so it actually remeasures) —
// rather than routing through React state, so the component sees a genuine
// large-paste sequence instead of an ordinary controlled re-render.
function nativeInsert(text: string, viaPaste: boolean) {
  const ta = document.getElementById(FIELD_ID) as HTMLTextAreaElement | null;
  if (!ta) return;
  ta.focus();
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    "value"
  )?.set;
  if (viaPaste) ta.dispatchEvent(new Event("paste", { bubbles: true }));
  setter?.call(ta, text);
  ta.dispatchEvent(new Event("input", { bubbles: true }));
}

export default function ProofRiseDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <div className="w-full max-w-md">
        <p className="font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / textarea-autosize-swell
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          It rises like it&apos;s proofing.
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ns-muted">
          Type and it swells open line by line. Paste a paragraph and it
          takes one slow continuous breath instead of popping open. Delete
          it back down and the fall is slower still, so nothing ever snaps
          under the cursor.
        </p>

        <form className="mt-8" onSubmit={(e) => e.preventDefault()}>
          <ProofRise
            id={FIELD_ID}
            label="Comment"
            name="comment"
            placeholder="Leave a comment…"
            minRows={1}
            maxRows={10}
          />

          <div className="mt-4 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => nativeInsert(LONG_COMMENT, true)}
              className="rounded-sm border border-border px-3 py-1.5 font-mono text-[11px] tracking-widest text-ns-muted transition-colors duration-200 hover:border-foreground/20 hover:text-foreground"
            >
              PASTE LONG COMMENT
            </button>
            <button
              type="button"
              onClick={() => nativeInsert("", false)}
              className="font-mono text-[11px] tracking-widest text-ns-muted transition-colors duration-200 hover:text-foreground"
            >
              CLEAR
            </button>
          </div>
        </form>

        <p className="mt-3 font-mono text-[11px] text-ns-muted">
          grows in 180ms, shrinks in 320ms, a big paste breathes open over
          400ms — same curve, three different weights
        </p>
      </div>
    </main>
  );
}
